import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

const INSECURE_DEFAULT_JWT = 'super-secret-jwt-key-for-water-management-v1-32chars';
const INSECURE_DEFAULT_REFRESH = 'super-secret-refresh-jwt-key-water-mgmt-v1';

@Injectable()
export class EnvironmentConfigService implements OnModuleInit {
  private readonly logger = new Logger(EnvironmentConfigService.name);

  onModuleInit() {
    this.validateProductionEnvironment();
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public validateProductionEnvironment(): void {
    if (!this.isProduction()) {
      return;
    }

    const errors: string[] = [];

    // 1. Database URL check
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
      errors.push('DATABASE_URL environment variable is required in production.');
    }

    // 2. JWT Secret check
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === INSECURE_DEFAULT_JWT) {
      errors.push('JWT_SECRET must be configured with a unique, secure key in production (cannot use development default).');
    } else if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production.');
    }

    // 3. JWT Refresh Secret check
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret || refreshSecret === INSECURE_DEFAULT_REFRESH) {
      errors.push('JWT_REFRESH_SECRET must be configured with a unique, secure key in production.');
    } else if (refreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters long in production.');
    }

    if (errors.length > 0) {
      const msg = `[FATAL] Production Configuration Validation Failed:\n  - ${errors.join('\n  - ')}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    this.logger.log('✓ Production environment security configuration validated successfully.');
  }

  public getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (this.isProduction() && (!secret || secret === INSECURE_DEFAULT_JWT)) {
      throw new Error('Insecure JWT_SECRET detected in production.');
    }
    return secret || INSECURE_DEFAULT_JWT;
  }

  public getJwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (this.isProduction() && (!secret || secret === INSECURE_DEFAULT_REFRESH)) {
      throw new Error('Insecure JWT_REFRESH_SECRET detected in production.');
    }
    return secret || INSECURE_DEFAULT_REFRESH;
  }
}
