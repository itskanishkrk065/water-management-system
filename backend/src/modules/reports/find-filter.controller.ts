import {
  Controller,
  Post,
  Get,
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
import { FindFilterDto } from './dto/find-filter.dto';
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
}
