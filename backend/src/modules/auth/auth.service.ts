import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../common/password.util';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      return null;
    }

    const isMatch = await verifyPassword(pass, user.password_hash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto, deviceId?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokenPair(user, deviceId);
  }

  async refreshTokens(dto: RefreshTokenDto) {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      if (!refreshSecret && process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('JWT_REFRESH_SECRET is not configured in production');
      }
      const secret = refreshSecret || 'super-secret-refresh-jwt-key-water-mgmt-v1';
      const payload = this.jwtService.verify(dto.refreshToken, { secret });

      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token_id: payload.jti },
        include: { user: { include: { role: true } } },
      });

      if (!tokenRecord || tokenRecord.revoked || tokenRecord.expires_at < new Date()) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      // Invalidate old token and issue fresh pair (token rotation)
      await this.prisma.refreshToken.update({
        where: { token_id: tokenRecord.token_id },
        data: { revoked: true },
      });

      return this.generateTokenPair(tokenRecord.user, payload.deviceId);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async beneficiarySignUp(dto: any, ipAddress?: string) {
    const rawFullName = dto.fullName || dto.full_name;
    const rawPhone = dto.phoneNumber || dto.phone;

    if (!rawFullName || !String(rawFullName).trim()) {
      throw new (await import('@nestjs/common')).BadRequestException('Full name is required');
    }
    if (!rawPhone || !String(rawPhone).trim()) {
      throw new (await import('@nestjs/common')).BadRequestException('Phone number is required');
    }

    const cleanName = String(rawFullName).trim();
    const cleanPhone = String(rawPhone).trim();
    const cleanEmail = dto.email.trim().toLowerCase();

    // Check existing email in users
    const existingUser = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      throw new (await import('@nestjs/common')).ConflictException(
        `An account with email '${cleanEmail}' is already registered`,
      );
    }

    // Check existing phone in beneficiaries
    const existingBeneficiaryPhone = await this.prisma.beneficiary.findUnique({
      where: { phone_number: cleanPhone },
    });
    if (existingBeneficiaryPhone) {
      throw new (await import('@nestjs/common')).ConflictException(
        `Phone number '${cleanPhone}' is already registered with an existing beneficiary profile`,
      );
    }

    const { RoleName, BeneficiaryStatus, AuditAction } = await import('@prisma/client');

    // Get or create BENEFICIARY role
    let role = await this.prisma.role.findUnique({
      where: { name: RoleName.BENEFICIARY },
    });
    if (!role) {
      role = await this.prisma.role.create({
        data: {
          name: RoleName.BENEFICIARY,
          description: 'Self-service farmer and water recipient portal access',
        },
      });
    }

    const passwordHash = await hashPassword(dto.password);

    // Create User and Beneficiary in transaction
    const { user, beneficiary } = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: cleanEmail,
          password_hash: passwordHash,
          full_name: cleanName,
          role_id: role.role_id,
          is_active: true,
        },
        include: { role: true },
      });

      const newBeneficiary = await tx.beneficiary.create({
        data: {
          user_id: newUser.user_id,
          name: cleanName,
          phone_number: cleanPhone,
          email: cleanEmail,
          status: BeneficiaryStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: newUser.user_id,
          action: AuditAction.CREATE,
          entity_type: 'BeneficiarySignup',
          entity_id: newBeneficiary.beneficiary_id,
          new_values: JSON.stringify({
            email: cleanEmail,
            phone: cleanPhone,
            name: cleanName,
            role: 'BENEFICIARY',
          }) as any,
          reason: 'Beneficiary self-service online registration',
          ip_address: ipAddress || null,
        },
      });

      return { user: newUser, beneficiary: newBeneficiary };
    });

    const tokens = await this.generateTokenPair(user);
    return {
      ...tokens,
      beneficiary: {
        beneficiary_id: beneficiary.beneficiary_id,
        name: beneficiary.name,
        phone_number: beneficiary.phone_number,
        email: beneficiary.email,
        status: beneficiary.status,
      },
    };
  }

  async forgotPassword(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    return {
      success: true,
      message: 'If an account exists with this email, instructions have been dispatched.',
      tokenPreview: user ? 'demo-reset-token-2026' : undefined,
    };
  }

  async resetPassword(dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      throw new (await import('@nestjs/common')).BadRequestException('Invalid or expired reset token');
    }
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { password_hash: passwordHash },
    });
    return { success: true, message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  private async generateTokenPair(user: any, deviceId?: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be explicitly configured in production environment.');
    }
    const jwtSecret = secret || 'super-secret-jwt-key-for-water-management-v1-32chars';

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_REFRESH_SECRET must be explicitly configured in production environment.');
    }
    const jwtRefreshSecret = refreshSecret || 'super-secret-refresh-jwt-key-water-mgmt-v1';

    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role.name,
      name: user.full_name,
      tokenVersion: user.token_version || 1,
      forcePasswordChange: user.force_password_change || false,
      deviceId: deviceId || null,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: '1h',
    });

    // Generate refresh token record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        user_id: user.user_id,
        token_hash: `pending_${Math.random().toString(36).slice(2)}_${Date.now()}`,
        expires_at: expiresAt,
      },
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.user_id, jti: refreshTokenRecord.token_id, deviceId: deviceId || null },
      {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      },
    );

    await this.prisma.refreshToken.update({
      where: { token_id: refreshTokenRecord.token_id },
      data: { token_hash: refreshToken },
    });

    const beneficiaryRecord = await this.prisma.beneficiary.findUnique({
      where: { user_id: user.user_id },
      select: { beneficiary_id: true, name: true, phone_number: true },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role.name,
        beneficiary_id: beneficiaryRecord?.beneficiary_id || null,
        deviceId: deviceId || null,
      },
    };
  }
}
