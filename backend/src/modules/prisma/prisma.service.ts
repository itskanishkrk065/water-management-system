import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

import * as path from 'path';

function getNormalizedDatabaseUrl(): string | undefined {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return undefined;

  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.slice(5);
    // Resolve relative path to absolute path
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
    // Convert backslashes to forward slashes for SQLite URL compatibility on Windows
    const normalized = resolvedPath.replace(/\\/g, '/');
    dbUrl = `file:${normalized}`;
    process.env.DATABASE_URL = dbUrl;
  }
  return dbUrl;
}

function sanitizeDbUrl(url?: string): string {
  if (!url) return 'DEFAULT';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
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
    this.logger.log(`[Prisma] Initializing connection to: ${sanitizeDbUrl(dbUrl)}`);
    this.logger.log(`[Prisma] Runtime - Platform: ${process.platform}, Arch: ${process.arch}, Node: ${process.version}`);
    this.logger.log(`[Prisma] Prisma Version: ${Prisma.prismaVersion?.client || '5.22.0'}`);

    try {
      await this.$connect();
      this.logger.log('[Prisma] Database connection OK');

      // SQLite Runtime Performance Tuning
      try {
        await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
        await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
        await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
        await this.$queryRawUnsafe('PRAGMA cache_size = -64000;'); // 64 MB cache
        await this.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
        await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
        this.logger.log('[Prisma] SQLite Performance PRAGMAs configured (FK=ON, WAL, cache=64MB, temp_store=MEMORY)');
      } catch (pragmaErr: any) {
        // Non-fatal if using PostgreSQL / Neon mode
      }

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
      console.error(`[Prisma] Database URL: ${sanitizeDbUrl(process.env.DATABASE_URL)}`);
      console.error(`[Prisma] Platform: ${process.platform}, Arch: ${process.arch}, Node: ${process.version}`);
      console.error(`[Prisma] Stack:\n${error?.stack}`);
      console.error('==============================================');
      throw error;
    }
  }

  async reinitializeConnection() {
    try {
      await this.$disconnect();
      await this.$connect();
      try {
        await this.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
        await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
        await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
        await this.$queryRawUnsafe('PRAGMA cache_size = -64000;');
        await this.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
        await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
        this.logger.log('[Prisma] SQLite Performance PRAGMAs configured (FK=ON, WAL)');
      } catch (pragmaErr: any) {
        // Non-fatal if using PostgreSQL / Neon mode
      }
      this.logger.log('[Prisma] Database connection reinitialized successfully');
    } catch (err: any) {
      this.logger.warn(`[Prisma] Warning during database reinitialization: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

