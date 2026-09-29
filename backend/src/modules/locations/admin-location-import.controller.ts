import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { LocationImportService } from './location-import.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Admin Location Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@Controller('admin')
export class AdminLocationImportController {
  constructor(private readonly importService: LocationImportService) {}

  @Post('location-import')
  @ApiOperation({ summary: 'Upload and validate LGD Location Master Excel file (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'LGD Excel file (.xls, .xlsx) containing District, Block, and Village hierarchy',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ];
        const lowerName = file.originalname.toLowerCase();
        if (
          allowedMimeTypes.includes(file.mimetype) ||
          lowerName.endsWith('.xls') ||
          lowerName.endsWith('.xlsx')
        ) {
          callback(null, true);
        } else {
          callback(new BadRequestException('Only Excel spreadsheets (.xls, .xlsx) are allowed'), false);
        }
      },
    }),
  )
  async uploadAndPreview(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    if (!file) {
      throw new BadRequestException('Please provide an Excel file (.xls or .xlsx) to upload.');
    }

    const uploadedBy = req.user?.email || 'admin@water.gov';
    return this.importService.processAndPreviewExcel(
      file.buffer,
      file.originalname,
      uploadedBy,
      ipAddress,
    );
  }

  @Post('location-import/:id/confirm')
  @ApiOperation({ summary: 'Confirm and commit validated location master import into PostgreSQL (Admin only)' })
  async confirmImport(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
  ) {
    const adminUserId = req.user?.sub || req.user?.userId;
    return this.importService.confirmImport(id, adminUserId, ipAddress);
  }

  @Get('location-imports')
  @ApiOperation({ summary: 'Get list of past location import operations (Admin only)' })
  async getImportHistory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.importService.getImportHistory(Number(page) || 1, Number(limit) || 20);
  }

  @Get('location-imports/:id')
  @ApiOperation({ summary: 'Get details and validation preview for a specific import (Admin only)' })
  async getImportById(@Param('id') id: string) {
    return this.importService.getImportById(id);
  }

  @Post('location-import/:id/cancel')
  @ApiOperation({ summary: 'Cancel/discard a pending validated location import (Admin only)' })
  async cancelImport(@Param('id') id: string) {
    return this.importService.cancelImport(id);
  }
}
