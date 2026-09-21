import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
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

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokenPair(user);
  }

  async refreshTokens(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-water-mgmt-v1',
      });

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

      return this.generateTokenPair(tokenRecord.user);
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

  private async generateTokenPair(user: any) {
    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role.name,
      name: user.full_name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-water-management-v1-32chars',
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
      { sub: user.user_id, jti: refreshTokenRecord.token_id },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-water-mgmt-v1',
        expiresIn: '7d',
      },
    );

    await this.prisma.refreshToken.update({
      where: { token_id: refreshTokenRecord.token_id },
      data: { token_hash: refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role.name,
      },
    };
  }
}
