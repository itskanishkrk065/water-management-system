import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

function getNormalizedDatabaseUrl(): string | undefined {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return undefined;

  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.slice(5);
    // Convert backslashes to forward slashes for SQLite URL compatibility on Windows
    const normalized = rawPath.replace(/\\/g, '/');
    dbUrl = `file:${normalized}`;
    process.env.DATABASE_URL = dbUrl;
  }
  return dbUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const dbUrl = getNormalizedDatabaseUrl();

    super({
      datasources: dbUrl
        ? {
            db: {
              url: dbUrl,
            },
          }
        : undefined,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL || 'DEFAULT';
    this.logger.log(`[Prisma] Initializing connection to: ${dbUrl}`);
    this.logger.log(`[Prisma] Runtime - Platform: ${process.platform}, Arch: ${process.arch}, Node: ${process.version}`);
    this.logger.log(`[Prisma] Prisma Version: ${Prisma.prismaVersion?.client || '5.22.0'}`);

    try {
      await this.$connect();
      this.logger.log('[Prisma] Database connection OK');

      // Controlled startup health check
      const userCount = await this.user.count().catch(() => null);
      this.logger.log(`[Prisma] Database Health Check OK - Users in DB: ${userCount ?? 'Table ready'}`);
    } catch (error: any) {
      console.error('==============================================');
      console.error('[Prisma] Database connection FAILED');
      console.error(`[Prisma] Error Code: ${error?.code || 'N/A'}`);
      console.error(`[Prisma] Message: ${error?.message || error}`);
      if (error?.meta) {
        console.error(`[Prisma] Meta: ${JSON.stringify(error.meta)}`);
      }
      console.error(`[Prisma] Database URL: ${process.env.DATABASE_URL}`);
      console.error(`[Prisma] Platform: ${process.platform}, Arch: ${process.arch}, Node: ${process.version}`);
      console.error(`[Prisma] Stack:\n${error?.stack}`);
      console.error('==============================================');
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

