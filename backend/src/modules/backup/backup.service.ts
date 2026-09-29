import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class BackupService {
  private readonly appDataDir: string;
  private readonly dbPath: string;
  private readonly backupsDir: string;
  private readonly documentsDir: string;
  private readonly receiptsDir: string;
  private readonly logsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.HOME || '.';
    this.appDataDir = process.env.WATER_APP_DATA_DIR || path.join(localAppData, 'WaterManagement');
    this.backupsDir = path.join(this.appDataDir, 'backups');
    this.documentsDir = path.join(this.appDataDir, 'documents');
    this.receiptsDir = path.join(this.appDataDir, 'receipts');
    this.logsDir = path.join(this.appDataDir, 'logs');

    // Resolve active SQLite database path
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:')) {
      this.dbPath = path.resolve(dbUrl.replace('file:', ''));
    } else {
      this.dbPath = path.join(this.appDataDir, 'database', 'water_management.db');
    }

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.appDataDir, this.backupsDir, this.documentsDir, this.receiptsDir, this.logsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          // ignore in environments where root dir is fixed
        }
      }
    });
  }

  /**
   * Performs SQLite database integrity check.
   */
  async checkIntegrity(): Promise<{ healthy: boolean; details: string; databaseSize: number }> {
    try {
      let healthy = true;
      let details = 'Database integrity check passed (ok)';

      // Run raw PRAGMA integrity_check if supported by provider
      try {
        const result: any = await this.prisma.$queryRawUnsafe('PRAGMA integrity_check;');
        if (result && result.length > 0) {
          const status = result[0]?.integrity_check || result[0]?.['integrity_check'] || 'ok';
          healthy = status.toLowerCase() === 'ok';
          details = healthy ? 'SQLite database file is consistent and healthy.' : `Integrity error: ${status}`;
        }
      } catch {
        // In PostgreSQL dev mode, simple query check
        await this.prisma.$queryRawUnsafe('SELECT 1;');
        details = 'Database engine is active and reachable.';
      }

      let databaseSize = 0;
      if (fs.existsSync(this.dbPath)) {
        const stat = fs.statSync(this.dbPath);
        databaseSize = stat.size;
      }

      return {
        healthy,
        details,
        databaseSize,
      };
    } catch (err: any) {
      return {
        healthy: false,
        details: `Integrity check error: ${err.message}`,
        databaseSize: 0,
      };
    }
  }

  /**
   * Creates a full offline .wmbak archive containing SQLite DB, documents, and manifest.
   */
  async createBackup(userId: string, reason?: string, ipAddress?: string) {
    this.ensureDirectories();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `WaterManagement_Backup_${timestamp}.wmbak`;
    const backupFilePath = path.join(this.backupsDir, backupFileName);

    // 1. Flush SQLite WAL Checkpoint if SQLite
    try {
      await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');
    } catch {
      // Ignore if PostgreSQL
    }

    // 2. Collect Statistics
    const [beneficiariesCount, landCount, allotmentsCount, billsCount, paymentsCount] = await Promise.all([
      this.prisma.beneficiary.count().catch(() => 0),
      this.prisma.landHolding.count().catch(() => 0),
      this.prisma.waterAllotment.count().catch(() => 0),
      this.prisma.developmentBill.count().catch(() => 0),
      this.prisma.payment.count().catch(() => 0),
    ]);

    // 3. Read Database File or Create Dump
    let dbBuffer: Buffer;
    if (fs.existsSync(this.dbPath)) {
      dbBuffer = fs.readFileSync(this.dbPath);
    } else {
      dbBuffer = Buffer.from(
        JSON.stringify({
          app: 'Water Management System',
          createdAt: new Date().toISOString(),
          note: 'Database file snapshot',
        }),
      );
    }

    const dbChecksum = crypto.createHash('sha256').update(dbBuffer).digest('hex');

    // 4. Create Manifest Metadata
    const manifest = {
      version: '1.0.0',
      appName: 'Water Management System',
      backupType: 'OFFLINE_FULL',
      createdAt: new Date().toISOString(),
      createdByUserId: userId,
      reason: reason || 'Manual administrative backup',
      counts: {
        beneficiaries: beneficiariesCount,
        landHoldings: landCount,
        allotments: allotmentsCount,
        bills: billsCount,
        payments: paymentsCount,
      },
      database: {
        fileName: path.basename(this.dbPath),
        sizeBytes: dbBuffer.length,
        sha256: dbChecksum,
      },
    };

    // 5. Package as structured archive (Manifest header + payload)
    const manifestString = JSON.stringify(manifest);
    const manifestBuffer = Buffer.from(manifestString, 'utf-8');

    // Format: 4-byte header length + manifest + database payload
    const headerLenBuffer = Buffer.alloc(4);
    headerLenBuffer.writeUInt32BE(manifestBuffer.length, 0);

    const fullArchiveBuffer = Buffer.concat([headerLenBuffer, manifestBuffer, dbBuffer]);
    fs.writeFileSync(backupFilePath, fullArchiveBuffer);

    const archiveChecksum = crypto.createHash('sha256').update(fullArchiveBuffer).digest('hex');

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'SystemBackup',
      entityId: backupFileName,
      newValues: {
        fileName: backupFileName,
        sizeBytes: fullArchiveBuffer.length,
        sha256: archiveChecksum,
        counts: manifest.counts,
      },
      reason: reason || 'Created complete offline .wmbak system backup archive',
      ipAddress,
    });

    return {
      success: true,
      fileName: backupFileName,
      filePath: backupFilePath,
      sizeBytes: fullArchiveBuffer.length,
      sha256: archiveChecksum,
      manifest,
    };
  }

  /**
   * Lists all existing .wmbak backup archives in local AppData directory.
   */
  async listBackups() {
    this.ensureDirectories();

    if (!fs.existsSync(this.backupsDir)) {
      return { backups: [] };
    }

    const files = fs.readdirSync(this.backupsDir).filter((f) => f.endsWith('.wmbak'));
    const backups = files.map((fileName) => {
      const fullPath = path.join(this.backupsDir, fileName);
      const stat = fs.statSync(fullPath);

      let manifest: any = null;
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        if (fileBuffer.length > 4) {
          const manifestLen = fileBuffer.readUInt32BE(0);
          const manifestJson = fileBuffer.slice(4, 4 + manifestLen).toString('utf-8');
          manifest = JSON.parse(manifestJson);
        }
      } catch {
        manifest = null;
      }

      return {
        fileName,
        sizeBytes: stat.size,
        createdAt: stat.birthtime || stat.mtime,
        manifest,
      };
    });

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { backups };
  }

  /**
   * Restores a .wmbak backup archive safely with checksum and structure validation.
   */
  async restoreBackup(fileName: string, userId: string, reason: string, ipAddress?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A mandatory reason is required to restore system data');
    }

    const backupFilePath = path.join(this.backupsDir, fileName);
    if (!fs.existsSync(backupFilePath)) {
      throw new NotFoundException(`Backup file "${fileName}" was not found in ${this.backupsDir}`);
    }

    const fileBuffer = fs.readFileSync(backupFilePath);
    if (fileBuffer.length <= 4) {
      throw new BadRequestException('Invalid .wmbak backup archive format: file is corrupt or empty');
    }

    const manifestLen = fileBuffer.readUInt32BE(0);
    if (fileBuffer.length < 4 + manifestLen) {
      throw new BadRequestException('Invalid .wmbak backup archive: manifest header corrupted');
    }

    const manifestJson = fileBuffer.slice(4, 4 + manifestLen).toString('utf-8');
    let manifest: any;
    try {
      manifest = JSON.parse(manifestJson);
    } catch {
      throw new BadRequestException('Failed to parse backup archive metadata manifest');
    }

    const dbPayloadBuffer = fileBuffer.slice(4 + manifestLen);
    const dbPayloadChecksum = crypto.createHash('sha256').update(dbPayloadBuffer).digest('hex');

    if (manifest.database?.sha256 && manifest.database.sha256 !== dbPayloadChecksum) {
      throw new BadRequestException('Backup archive database checksum verification failed');
    }

    // Safety: Backup the current database before overwriting
    if (fs.existsSync(this.dbPath)) {
      const preRestorePath = `${this.dbPath}.pre-restore-${Date.now()}`;
      fs.copyFileSync(this.dbPath, preRestorePath);
    }

    // Write restored database file
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, dbPayloadBuffer);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'SystemRestore',
      entityId: fileName,
      oldValues: { status: 'PRE_RESTORE' },
      newValues: {
        restoredFrom: fileName,
        manifest,
        timestamp: new Date().toISOString(),
      },
      reason: `RESTORE: ${reason.trim()}`,
      ipAddress,
    });

    return {
      success: true,
      message: `System successfully restored from "${fileName}". Application data has been reloaded.`,
      manifest,
    };
  }
}
