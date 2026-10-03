import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be explicitly configured in production environment.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'super-secret-jwt-key-for-water-management-v1-32chars',
    });
  }

  async validate(payload: { sub: string; email: string; role: string; tokenVersion?: number; deviceId?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.is_active || (user as any).status === 'LOCKED' || (user as any).status === 'DISABLED') {
      throw new UnauthorizedException('User account is inactive, locked, or disabled');
    }

    if (payload.tokenVersion !== undefined && (user as any).token_version !== undefined) {
      if ((user as any).token_version !== payload.tokenVersion) {
        throw new UnauthorizedException('Session has been revoked. Please sign in again.');
      }
    }

    return {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role.name,
      status: (user as any).status || 'ACTIVE',
      forcePasswordChange: (user as any).force_password_change || false,
      deviceId: payload.deviceId || null,
    };
  }
}
