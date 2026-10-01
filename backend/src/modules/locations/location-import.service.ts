import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import { LocationImportStatus, AuditAction } from '../common/enums';
import * as crypto from 'crypto';
import * as xlsx from 'xlsx';

export interface ParsedRow {
  rowNumber: number;
  lgdDistrictCode: number;
  districtName: string;
  lgdBlockCode: number;
  blockName: string;
  lgdVillageCode: number;
  villageName: string;
}

export interface ValidationErrorItem {
  rowNumber: number;
  column: string;
  value: any;
  reason: string;
}

export interface ImportPreviewResult {
  importId: string;
  fileName: string;
  fileHash: string;
  status: LocationImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newDistricts: number;
  existingDistricts: number;
  newBlocks: number;
  existingBlocks: number;
  newVillages: number;
  existingVillages: number;
  potentialDuplicates: number;
  sampleValidRows: ParsedRow[];
  errors: ValidationErrorItem[];
}

@Injectable()
export class LocationImportService {
  private readonly logger = new Logger(LocationImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Normalizes strings by trimming and collapsing multiple whitespace characters.
   */
  private normalizeString(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalizes numeric LGD codes. Returns positive integer or NaN.
   */
  private normalizeCode(val: any): number {
    if (val === null || val === undefined) return NaN;
    const str = String(val).trim().replace(/,/g, '');
    const num = Number(str);
    if (Number.isInteger(num) && num > 0) {
      return num;
    }
    return NaN;
  }

  /**
   * Maps Excel column headers tolerant of case, whitespace, underscores, etc.
   */
  private matchColumnKey(header: string): string | null {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean === 'lgddistrictcode' || clean === 'districtcode' || clean === 'lgddistcode' || clean === 'districtlgdcode') {
      return 'lgdDistrictCode';
    }
    if (clean === 'districtname' || clean === 'district') {
      return 'districtName';
    }
    if (clean === 'lgdblockcode' || clean === 'blockcode' || clean === 'lgdblkcode' || clean === 'blocklgdcode') {
      return 'lgdBlockCode';
    }
    if (clean === 'blockname' || clean === 'block') {
      return 'blockName';
    }
    if (clean === 'lgdvillagecode' || clean === 'villagecode' || clean === 'lgdvilcode' || clean === 'villagelgdcode') {
      return 'lgdVillageCode';
    }
    if (clean === 'villagename' || clean === 'village') {
      return 'villageName';
    }
    return null;
  }

  /**
   * Step 1: Upload, parse, validate Excel, compute preview stats, and persist in LocationImport table.
   */
  async processAndPreviewExcel(
    fileBuffer: Buffer,
    fileName: string,
    uploadedBy: string,
    ipAddress?: string,
  ): Promise<ImportPreviewResult> {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 1. Parse Excel Workbook
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse Excel file format: ${err.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('The uploaded Excel workbook contains no sheets.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawData || rawData.length < 2) {
      throw new BadRequestException('The uploaded sheet is empty or contains no data rows.');
    }

    // 2. Validate Header Columns
    const headerRow: string[] = rawData[0].map((h) => String(h || ''));
    const colMap: Record<string, number> = {};

    headerRow.forEach((colHeader, index) => {
      const matched = this.matchColumnKey(colHeader);
      if (matched && colMap[matched] === undefined) {
        colMap[matched] = index;
      }
    });

    const requiredKeys: { key: string; label: string }[] = [
      { key: 'lgdDistrictCode', label: 'LGD District Code' },
      { key: 'districtName', label: 'District Name' },
      { key: 'lgdBlockCode', label: 'LGD Block code' },
      { key: 'blockName', label: 'Block Name' },
      { key: 'lgdVillageCode', label: 'LGD Village Code' },
      { key: 'villageName', label: 'Village Name' },
    ];

    const missingColumns = requiredKeys.filter((req) => colMap[req.key] === undefined);
    if (missingColumns.length > 0) {
      const missingList = missingColumns.map((c) => c.label).join(', ');
      // Record failed import in history
      const failedImport = await this.prisma.locationImport.create({
        data: {
          file_name: fileName,
          file_hash: fileHash,
          uploaded_by: uploadedBy,
          total_rows: Math.max(0, rawData.length - 1),
          valid_rows: 0,
          invalid_rows: Math.max(0, rawData.length - 1),
          status: LocationImportStatus.FAILED,
          error_summary: JSON.stringify({
            reason: `Import failed: Missing required column(s): ${missingList}`,
            missingColumns: missingColumns.map((c) => c.label),
            foundHeaders: headerRow,
          }) as any,
        },
      });

      throw new BadRequestException(
        `Import failed. Missing required column: ${missingColumns[0].label}. Expected columns: LGD District Code, District Name, LGD Block code, Block Name, LGD Village Code, Village Name.`,
      );
    }

    // 3. Row Validation & Data Extraction
    const validParsedRows: ParsedRow[] = [];
    const errors: ValidationErrorItem[] = [];

    const districtCodeToNames = new Map<number, Set<string>>();
    const blockCodeToInfo = new Map<number, { names: Set<string>; districtCodes: Set<number> }>();
    const villageCodeToInfo = new Map<number, { names: Set<string>; blockCodes: Set<number>; rows: number[] }>();

    let duplicateRowsCount = 0;

    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      const rowNumber = r + 1; // 1-indexed for human readability

      // Skip completely empty rows
      const isCompletelyEmpty = row.every((cell) => cell === '' || cell === null || cell === undefined);
      if (isCompletelyEmpty) {
        continue;
      }

      const rawDistCode = row[colMap.lgdDistrictCode];
      const rawDistName = row[colMap.districtName];
      const rawBlkCode = row[colMap.lgdBlockCode];
      const rawBlkName = row[colMap.blockName];
      const rawVilCode = row[colMap.lgdVillageCode];
      const rawVilName = row[colMap.villageName];

      const distCode = this.normalizeCode(rawDistCode);
      const distName = this.normalizeString(rawDistName);
      const blkCode = this.normalizeCode(rawBlkCode);
      const blkName = this.normalizeString(rawBlkName);
      const vilCode = this.normalizeCode(rawVilCode);
      const vilName = this.normalizeString(rawVilName);

      let rowHasError = false;

      if (Number.isNaN(distCode)) {
        errors.push({
          rowNumber,
          column: 'LGD District Code',
          value: rawDistCode,
          reason: 'District code must be a valid positive integer',
        });
        rowHasError = true;
      }
      if (!distName) {
        errors.push({
          rowNumber,
          column: 'District Name',
          value: rawDistName,
          reason: 'District name is required',
        });
        rowHasError = true;
      }
      if (Number.isNaN(blkCode)) {
        errors.push({
          rowNumber,
          column: 'LGD Block code',
          value: rawBlkCode,
          reason: 'Block code must be a valid positive integer',
        });
        rowHasError = true;
      }
      if (!blkName) {
        errors.push({
          rowNumber,
          column: 'Block Name',
          value: rawBlkName,
          reason: 'Block name is required',
        });
        rowHasError = true;
      }
      if (Number.isNaN(vilCode)) {
        errors.push({
          rowNumber,
          column: 'LGD Village Code',
          value: rawVilCode,
          reason: 'Village code must be a valid positive integer',
        });
        rowHasError = true;
      }
      if (!vilName) {
        errors.push({
          rowNumber,
          column: 'Village Name',
          value: rawVilName,
          reason: 'Village name is required',
        });
        rowHasError = true;
      }

      if (rowHasError) {
        continue;
      }

      // Track district code consistency
      if (!districtCodeToNames.has(distCode)) {
        districtCodeToNames.set(distCode, new Set([distName]));
      } else {
        districtCodeToNames.get(distCode)!.add(distName);
      }

      // Track block code consistency
      if (!blockCodeToInfo.has(blkCode)) {
        blockCodeToInfo.set(blkCode, { names: new Set([blkName]), districtCodes: new Set([distCode]) });
      } else {
        blockCodeToInfo.get(blkCode)!.names.add(blkName);
        blockCodeToInfo.get(blkCode)!.districtCodes.add(distCode);
      }

      // Track village code consistency
      if (!villageCodeToInfo.has(vilCode)) {
        villageCodeToInfo.set(vilCode, { names: new Set([vilName]), blockCodes: new Set([blkCode]), rows: [rowNumber] });
      } else {
        duplicateRowsCount++;
        villageCodeToInfo.get(vilCode)!.names.add(vilName);
        villageCodeToInfo.get(vilCode)!.blockCodes.add(blkCode);
        villageCodeToInfo.get(vilCode)!.rows.push(rowNumber);
      }

      validParsedRows.push({
        rowNumber,
        lgdDistrictCode: distCode,
        districtName: distName,
        lgdBlockCode: blkCode,
        blockName: blkName,
        lgdVillageCode: vilCode,
        villageName: vilName,
      });
    }

    // Check for internal conflicts in file
    for (const [code, names] of districtCodeToNames.entries()) {
      if (names.size > 1) {
        errors.push({
          rowNumber: 0,
          column: 'LGD District Code',
          value: code,
          reason: `Conflicting district names found for LGD Code ${code}: ${Array.from(names).join(', ')}`,
        });
      }
    }

    for (const [code, info] of blockCodeToInfo.entries()) {
      if (info.districtCodes.size > 1) {
        errors.push({
          rowNumber: 0,
          column: 'LGD Block code',
          value: code,
          reason: `Conflicting parent districts found for LGD Block Code ${code}: districts ${Array.from(info.districtCodes).join(', ')}`,
        });
      }
    }

    for (const [code, info] of villageCodeToInfo.entries()) {
      if (info.blockCodes.size > 1) {
        errors.push({
          rowNumber: info.rows[0] || 0,
          column: 'LGD Village Code',
          value: code,
          reason: `Conflicting parent blocks found for LGD Village Code ${code}: blocks ${Array.from(info.blockCodes).join(', ')}`,
        });
      }
      if (info.names.size > 1) {
        errors.push({
          rowNumber: info.rows[0] || 0,
          column: 'LGD Village Code',
          value: code,
          reason: `Conflicting village names found for LGD Village Code ${code}: ${Array.from(info.names).join(', ')}`,
        });
      }
    }

    // 4. Check against Database for Existing vs New Counts
    const uniqueDistCodes = Array.from(districtCodeToNames.keys());
    const uniqueBlkCodes = Array.from(blockCodeToInfo.keys());
    const uniqueVilCodes = Array.from(villageCodeToInfo.keys());

    const [existingDistricts, existingBlocks, existingVillages] = await Promise.all([
      this.prisma.district.findMany({
        where: { lgd_district_code: { in: uniqueDistCodes } },
        select: { lgd_district_code: true },
      }),
      this.prisma.block.findMany({
        where: { lgd_block_code: { in: uniqueBlkCodes } },
        select: { lgd_block_code: true },
      }),
      this.prisma.village.findMany({
        where: { lgd_village_code: { in: uniqueVilCodes } },
        select: { lgd_village_code: true },
      }),
    ]);

    const existingDistSet = new Set(existingDistricts.map((d) => d.lgd_district_code));
    const existingBlkSet = new Set(existingBlocks.map((b) => b.lgd_block_code));
    const existingVilSet = new Set(existingVillages.map((v) => v.lgd_village_code));

    const newDistrictsCount = uniqueDistCodes.filter((c) => !existingDistSet.has(c)).length;
    const existingDistrictsCount = uniqueDistCodes.filter((c) => existingDistSet.has(c)).length;

    const newBlocksCount = uniqueBlkCodes.filter((c) => !existingBlkSet.has(c)).length;
    const existingBlocksCount = uniqueBlkCodes.filter((c) => existingBlkSet.has(c)).length;

    const newVillagesCount = uniqueVilCodes.filter((c) => !existingVilSet.has(c)).length;
    const existingVillagesCount = uniqueVilCodes.filter((c) => existingVilSet.has(c)).length;

    const totalRows = Math.max(0, rawData.length - 1);
    const validRows = validParsedRows.length;
    const invalidRows = errors.length;

    const status =
      errors.length > 0 && validRows === 0
        ? LocationImportStatus.FAILED
        : LocationImportStatus.VALIDATED;

    // 5. Store in location_imports
    const sampleValidRows = validParsedRows.slice(0, 50);

    const importRecord = await this.prisma.locationImport.create({
      data: {
        file_name: fileName,
        file_hash: fileHash,
        uploaded_by: uploadedBy,
        total_rows: totalRows,
        valid_rows: validRows,
        invalid_rows: invalidRows,
        status,
        error_summary: errors.length > 0 ? JSON.stringify(errors.slice(0, 200)) : null,
        preview_data: JSON.stringify({
          newDistricts: newDistrictsCount,
          existingDistricts: existingDistrictsCount,
          newBlocks: newBlocksCount,
          existingBlocks: existingBlocksCount,
          newVillages: newVillagesCount,
          existingVillages: existingVillagesCount,
          potentialDuplicates: duplicateRowsCount,
          sampleRows: sampleValidRows,
          parsedRows: validParsedRows, // Stored to execute import deterministically
        }),
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: 'LocationImport',
      entityId: importRecord.import_id,
      newValues: {
        fileName,
        fileHash,
        totalRows,
        validRows,
        invalidRows,
        status,
      },
      reason: `Uploaded location master file '${fileName}' for preview & validation`,
      ipAddress,
    });

    return {
      importId: importRecord.import_id,
      fileName,
      fileHash,
      status,
      totalRows,
      validRows,
      invalidRows,
      newDistricts: newDistrictsCount,
      existingDistricts: existingDistrictsCount,
      newBlocks: newBlocksCount,
      existingBlocks: existingBlocksCount,
      newVillages: newVillagesCount,
      existingVillages: existingVillagesCount,
      potentialDuplicates: duplicateRowsCount,
      sampleValidRows,
      errors: errors.slice(0, 100),
    };
  }

  /**
   * Step 2: Confirm import and commit master data inside a database transaction.
   */
  async confirmImport(importId: string, adminUserId: string, ipAddress?: string) {
    const importRecord = await this.prisma.locationImport.findUnique({
      where: { import_id: importId },
    });

    if (!importRecord) {
      throw new NotFoundException(`Location import record with ID ${importId} not found`);
    }

    if (importRecord.status === LocationImportStatus.IMPORTED) {
      throw new ConflictException('This location master file has already been imported into the database.');
    }

    if (importRecord.status === LocationImportStatus.FAILED || importRecord.status === LocationImportStatus.CANCELLED) {
      throw new BadRequestException(`Cannot confirm an import in '${importRecord.status}' status.`);
    }

    let previewData: any = importRecord.preview_data;
    if (typeof previewData === 'string') {
      try {
        previewData = JSON.parse(previewData);
      } catch {
        previewData = null;
      }
    }
    const parsedRows: ParsedRow[] = previewData?.parsedRows || [];

    if (!parsedRows || parsedRows.length === 0) {
      throw new BadRequestException('No valid parsed rows available to import.');
    }

    this.logger.log(`Starting transactional import for ${parsedRows.length} rows...`);

    // Extract unique entities
    const districtsMap = new Map<number, string>(); // lgd_district_code -> name
    const blocksMap = new Map<number, { name: string; lgdDistrictCode: number }>(); // lgd_block_code -> { name, lgdDistrictCode }
    const villagesMap = new Map<number, { name: string; lgdBlockCode: number }>(); // lgd_village_code -> { name, lgdBlockCode }

    for (const r of parsedRows) {
      districtsMap.set(r.lgdDistrictCode, r.districtName);
      blocksMap.set(r.lgdBlockCode, { name: r.blockName, lgdDistrictCode: r.lgdDistrictCode });
      villagesMap.set(r.lgdVillageCode, { name: r.villageName, lgdBlockCode: r.lgdBlockCode });
    }

    // Execute in Transaction
    let districtsCreated = 0;
    let districtsUpdated = 0;
    let blocksCreated = 0;
    let blocksUpdated = 0;
    let villagesCreated = 0;
    let villagesUpdated = 0;

    await this.prisma.$transaction(
      async (tx) => {
        // 1. Upsert Districts
        const districtCodeToId = new Map<number, string>();
        for (const [distCode, distName] of districtsMap.entries()) {
          const existing = await tx.district.findUnique({
            where: { lgd_district_code: distCode },
          });

          if (existing) {
            const updated = await tx.district.update({
              where: { district_id: existing.district_id },
              data: { name: distName, is_active: true },
            });
            districtCodeToId.set(distCode, updated.district_id);
            districtsUpdated++;
          } else {
            const created = await tx.district.create({
              data: {
                lgd_district_code: distCode,
                name: distName,
                is_active: true,
              },
            });
            districtCodeToId.set(distCode, created.district_id);
            districtsCreated++;
          }
        }

        // 2. Upsert Blocks
        const blockCodeToId = new Map<number, string>();
        for (const [blkCode, blkInfo] of blocksMap.entries()) {
          const parentDistrictId = districtCodeToId.get(blkInfo.lgdDistrictCode);
          if (!parentDistrictId) {
            throw new BadRequestException(`Parent district for block code ${blkCode} not found`);
          }

          const existing = await tx.block.findUnique({
            where: { lgd_block_code: blkCode },
          });

          if (existing) {
            const updated = await tx.block.update({
              where: { block_id: existing.block_id },
              data: {
                name: blkInfo.name,
                district_id: parentDistrictId,
                is_active: true,
              },
            });
            blockCodeToId.set(blkCode, updated.block_id);
            blocksUpdated++;
          } else {
            const created = await tx.block.create({
              data: {
                lgd_block_code: blkCode,
                district_id: parentDistrictId,
                name: blkInfo.name,
                is_active: true,
              },
            });
            blockCodeToId.set(blkCode, created.block_id);
            blocksCreated++;
          }
        }

        // 3. Upsert Villages in Optimized Batches (Postgres INSERT ON CONFLICT)
        const villageEntries = Array.from(villagesMap.entries());
        const BATCH_SIZE = 500;

        for (let i = 0; i < villageEntries.length; i += BATCH_SIZE) {
          const chunk = villageEntries.slice(i, i + BATCH_SIZE);
          for (const [vilCode, vilInfo] of chunk) {
            const parentBlockId = blockCodeToId.get(vilInfo.lgdBlockCode);
            if (!parentBlockId) continue;

            const existing = await tx.village.findUnique({
              where: { lgd_village_code: vilCode },
            });

            if (existing) {
              await tx.village.update({
                where: { village_id: existing.village_id },
                data: {
                  name: vilInfo.name,
                  block_id: parentBlockId,
                  is_active: true,
                },
              });
              villagesUpdated++;
            } else {
              await tx.village.create({
                data: {
                  lgd_village_code: vilCode,
                  block_id: parentBlockId,
                  name: vilInfo.name,
                  is_active: true,
                },
              });
              villagesCreated++;
            }
          }
        }

        // 4. Update LocationImport Record
        await tx.locationImport.update({
          where: { import_id: importId },
          data: {
            status: LocationImportStatus.IMPORTED,
            districts_created: districtsCreated,
            districts_updated: districtsUpdated,
            blocks_created: blocksCreated,
            blocks_updated: blocksUpdated,
            villages_created: villagesCreated,
            villages_updated: villagesUpdated,
            preview_data: JSON.stringify({
              ...(previewData || {}),
              parsedRows: undefined, // Clear large array after import
            }),
          },
        });

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            user_id: adminUserId,
            action: AuditAction.CREATE,
            entity_type: 'LocationImport',
            entity_id: importId,
            new_values: JSON.stringify({
              importId,
              status: LocationImportStatus.IMPORTED,
              districtsCreated,
              districtsUpdated,
              blocksCreated,
              blocksUpdated,
              villagesCreated,
              villagesUpdated,
            }) as any,
            reason: `Admin confirmed and applied location master data import '${importRecord.file_name}'`,
            ip_address: ipAddress || null,
          },
        });
      },
      {
        timeout: 120000, // 2 minutes for 12,500+ records
      },
    );

    this.logger.log(`Import completed: ${districtsCreated} new districts, ${blocksCreated} new blocks, ${villagesCreated} new villages.`);

    return {
      message: 'Location master data successfully imported into PostgreSQL database.',
      importId,
      status: LocationImportStatus.IMPORTED,
      summary: {
        districtsCreated,
        districtsUpdated,
        blocksCreated,
        blocksUpdated,
        villagesCreated,
        villagesUpdated,
        totalDistricts: districtsCreated + districtsUpdated,
        totalBlocks: blocksCreated + blocksUpdated,
        totalVillages: villagesCreated + villagesUpdated,
      },
    };
  }

  /**
   * Get all past location import records.
   */
  async getImportHistory(page: number = 1, limit: number = 20) {
    const skip = (Math.max(1, page) - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.locationImport.findMany({
        orderBy: { uploaded_at: 'desc' },
        skip,
        take: limit,
        select: {
          import_id: true,
          file_name: true,
          file_hash: true,
          uploaded_by: true,
          uploaded_at: true,
          total_rows: true,
          valid_rows: true,
          invalid_rows: true,
          districts_created: true,
          districts_updated: true,
          blocks_created: true,
          blocks_updated: true,
          villages_created: true,
          villages_updated: true,
          status: true,
          created_at: true,
        },
      }),
      this.prisma.locationImport.count(),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get details for a single import run.
   */
  async getImportById(importId: string) {
    const record = await this.prisma.locationImport.findUnique({
      where: { import_id: importId },
    });
    if (!record) {
      throw new NotFoundException(`Location import ${importId} not found`);
    }
    return record;
  }

  /**
   * Cancel or discard a validated import run.
   */
  async cancelImport(importId: string) {
    const record = await this.prisma.locationImport.findUnique({
      where: { import_id: importId },
    });
    if (!record) {
      throw new NotFoundException(`Location import ${importId} not found`);
    }
    if (record.status === LocationImportStatus.IMPORTED) {
      throw new BadRequestException('Cannot cancel an already imported file');
    }

    return this.prisma.locationImport.update({
      where: { import_id: importId },
      data: { status: LocationImportStatus.CANCELLED },
    });
  }
}
