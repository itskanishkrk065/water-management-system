import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';
import { DeveloperDbExplorerService } from './services/developer-db-explorer.service';
import { DeveloperCleanStateService } from './services/developer-clean-state.service';
import { DeveloperDiagnosticsService } from './services/developer-diagnostics.service';
import { DeveloperTestDataService } from './services/developer-test-data.service';
import {
  QueryTableDataDto,
  ExecuteReadOnlySqlDto,
  CleanStatePreviewDto,
  CleanStateExecuteDto,
  GenerateTestDataDto,
  PurgeTestDataDto,
  RbacTesterDto,
  SetEnvironmentConfigDto,
} from './dto/developer.dto';

@ApiTags('Developer Portal & Engineering Console')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@Controller('developer')
export class DeveloperController {
  constructor(
    private readonly dbExplorerService: DeveloperDbExplorerService,
    private readonly cleanStateService: DeveloperCleanStateService,
    private readonly diagnosticsService: DeveloperDiagnosticsService,
    private readonly testDataService: DeveloperTestDataService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'High-level technical system health overview and telemetry' })
  async getOverview() {
    const [sys, storage, dbStats] = await Promise.all([
      this.diagnosticsService.getSystemInformation(),
      this.diagnosticsService.getStorageCenter(),
      this.dbExplorerService.getDatabaseStatistics(),
    ]);

    return {
      application: {
        name: 'WaterGrid V1',
        version: '1.0.0',
        buildChannel: 'OFFLINE_STANDALONE_DESKTOP',
        environment: this.cleanStateService.getEnvironment(),
        releaseChannel: 'OFFLINE_STABLE',
        buildDate: '2026-09-30',
      },
      system: sys,
      storage,
      database: dbStats,
      mode: 'READ_ONLY',
      healthStatus: dbStats.integrityCheckStatus === 'PASS' ? 'PASS' : 'WARNING',
    };
  }

  @Get('system')
  @ApiOperation({ summary: 'System, CPU, Memory, Runtime, and Process information' })
  async getSystemInfo() {
    return this.diagnosticsService.getSystemInformation();
  }

  @Get('storage')
  @ApiOperation({ summary: 'Storage directory paths and disk space breakdown' })
  async getStorageCenter() {
    return this.diagnosticsService.getStorageCenter();
  }

  @Get('tables')
  @ApiOperation({ summary: 'List all physical SQLite database tables with schema introspection' })
  async getAllTables() {
    return this.dbExplorerService.getAllTablesSummary();
  }

  @Get('tables/:tableName')
  @ApiOperation({ summary: 'Server-side paginated table browser with sorting and search' })
  async getTableData(
    @Param('tableName') tableName: string,
    @Query() query: QueryTableDataDto,
  ) {
    return this.dbExplorerService.getTableData(tableName, query);
  }

  @Get('tables/:tableName/records/:recordId')
  @ApiOperation({ summary: 'Deep record inspector with foreign keys and reverse relationships' })
  async getRecordDetails(
    @Param('tableName') tableName: string,
    @Param('recordId') recordId: string,
  ) {
    return this.dbExplorerService.getRecordDetails(tableName, recordId);
  }

  @Post('sql/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute safe read-only SELECT query with EXPLAIN and microsecond timer' })
  async executeReadOnlySql(@Body() dto: ExecuteReadOnlySqlDto) {
    return this.dbExplorerService.executeReadOnlySql(dto);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Database statistics, PRAGMA checks, page count, and physical file health' })
  async getDatabaseStatistics() {
    return this.dbExplorerService.getDatabaseStatistics();
  }

  @Post('clean-state/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate Clean State Protocol execution preview and safety plan' })
  async getCleanStatePreview(@Body() dto: CleanStatePreviewDto) {
    return this.cleanStateService.getCleanStatePreview(dto);
  }

  @Post('clean-state/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute Clean State Protocol with mandatory safety backup' })
  async executeCleanState(
    @Body() dto: CleanStateExecuteDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.cleanStateService.executeCleanState(dto, user.user_id, ip);
  }

  @Get('clean-state/audit')
  @ApiOperation({ summary: 'Audit history of clean state and reset operations' })
  async getCleanStateAudit() {
    return this.cleanStateService.getCleanStateAuditLogs();
  }

  @Get('environment')
  @ApiOperation({ summary: 'Get current environment classification' })
  async getEnvironment() {
    return { environment: this.cleanStateService.getEnvironment() };
  }

  @Post('environment')
  @ApiOperation({ summary: 'Set environment classification' })
  async setEnvironment(
    @Body() dto: SetEnvironmentConfigDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cleanStateService.setEnvironment(dto.environment, dto.reason, user.user_id);
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Deep duplicate detector across all domain entities' })
  async scanDuplicates() {
    return this.diagnosticsService.scanDuplicates();
  }

  @Get('orphans')
  @ApiOperation({ summary: 'Broken database reference and orphan file detector' })
  async detectOrphans() {
    return this.diagnosticsService.detectOrphanFiles();
  }

  @Post('rbac/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate and test RBAC permission evaluation' })
  async testRbacPermission(@Body() dto: RbacTesterDto) {
    return this.diagnosticsService.testRbacPermission(dto);
  }

  @Post('test-data/generate')
  @ApiOperation({ summary: 'Generate clearly-tagged synthetic records for development' })
  async generateSyntheticData(@Body() dto: GenerateTestDataDto) {
    return this.testDataService.generateSyntheticTestData(dto);
  }

  @Post('test-data/purge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purge ONLY records tagged with synthetic test marker' })
  async purgeSyntheticData(@Body() dto: PurgeTestDataDto) {
    return this.testDataService.purgeSyntheticTestData(dto);
  }

  @Get('diagnostics/bundle')
  @ApiOperation({ summary: 'Export complete diagnostic snapshot bundle' })
  async exportDiagnosticBundle() {
    return this.diagnosticsService.exportDiagnosticBundle();
  }
}
