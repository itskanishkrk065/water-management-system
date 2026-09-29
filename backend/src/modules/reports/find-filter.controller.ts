import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Ip,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { FindFilterService } from './find-filter.service';
import { FindFilterDto, CreatePresetDto, UpdatePresetDto } from './dto/find-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Find & Filter Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports/find')
export class FindFilterController {
  constructor(private readonly findFilterService: FindFilterService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS, RoleName.VIEWER)
  @ApiOperation({
    summary: 'Execute dynamic multi-entity filter and aggregate metrics across the entire matched population',
  })
  @ApiResponse({ status: 200, description: 'Filtered records and whole-population aggregate metrics' })
  async executeFilter(
    @Body() dto: FindFilterDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const userId = user.user_id;
    return this.findFilterService.executeFilterQuery(dto, userId, ipAddress);
  }

  @Get('metadata')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS, RoleName.VIEWER)
  @ApiOperation({ summary: 'Get reporting filter dropdown metadata, enums, and supported date types' })
  async getFilterMetadata() {
    return this.findFilterService.getFilterMetadata();
  }

  @Post('export/pdf')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({
    summary: 'Export filtered dataset as an authoritative PDF report matching exact filter criteria',
  })
  async exportPdf(
    @Body() dto: FindFilterDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Res() res: Response,
  ) {
    const result = await this.findFilterService.generatePdfReport(dto, user, ipAddress);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': result.buffer.length,
      'X-Report-Record-Count': result.recordCount.toString(),
    });

    res.status(HttpStatus.OK).send(result.buffer);
  }

  @Post('export/excel')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({
    summary: 'Export filtered dataset as an authoritative Excel (.xlsx) spreadsheet matching exact filter criteria',
  })
  async exportExcel(
    @Body() dto: FindFilterDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
    @Res() res: Response,
  ) {
    const result = await this.findFilterService.generateExcelReport(dto, user, ipAddress);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': result.buffer.length,
      'X-Report-Record-Count': result.recordCount.toString(),
    });

    res.status(HttpStatus.OK).send(result.buffer);
  }

  @Get('presets')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS, RoleName.VIEWER)
  @ApiOperation({ summary: 'List all available reporting presets' })
  async getPresets(@Query('category') category?: string) {
    return this.findFilterService.getPresets(category);
  }

  @Post('presets')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Create a new reusable reporting preset' })
  async createPreset(
    @Body() dto: CreatePresetDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    return this.findFilterService.createPreset(
      {
        name: dto.name,
        description: dto.description,
        category: dto.report_type || 'GENERAL',
        filters: dto.filters,
        columns: dto.columns,
        sortBy: dto.sort_by,
        sortOrder: dto.sort_order,
      },
      user.user_id,
      ipAddress,
    );
  }

  @Put('presets/:id')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Update an existing reporting preset' })
  async updatePreset(
    @Param('id') id: string,
    @Body() dto: UpdatePresetDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    return this.findFilterService.updatePreset(
      id,
      {
        name: dto.name,
        description: dto.description,
        category: dto.report_type,
        filters: dto.filters,
        columns: dto.columns,
        sortBy: dto.sort_by,
        sortOrder: dto.sort_order,
      },
      user.user_id,
      ipAddress,
    );
  }

  @Delete('presets/:id')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Deactivate / Delete a reporting preset' })
  async deletePreset(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    return this.findFilterService.deletePreset(id, user.user_id, ipAddress);
  }

  @Post('presets/:id/run')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS, RoleName.VIEWER)
  @ApiOperation({ summary: 'Execute a saved preset dynamically against current database data' })
  async runPreset(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    return this.findFilterService.runPreset(id, user.user_id, ipAddress);
  }
}

