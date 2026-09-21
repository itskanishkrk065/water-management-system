import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateDistrictDto, CreatePanchayatDto, CreateVillageDto } from './dto/location.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get complete administrative hierarchy tree' })
  async getTree() {
    return this.locationsService.getHierarchyTree();
  }

  @Get('districts')
  @ApiOperation({ summary: 'Get all districts' })
  async getDistricts() {
    return this.locationsService.findDistricts();
  }

  @Post('districts')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create district (Admin only)' })
  async createDistrict(@Body() dto: CreateDistrictDto) {
    return this.locationsService.createDistrict(dto);
  }

  @Get('panchayats')
  @ApiOperation({ summary: 'Get panchayats (optionally filtered by districtId)' })
  async getPanchayats(@Query('districtId') districtId?: string) {
    return this.locationsService.findPanchayats(districtId);
  }

  @Post('panchayats')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create panchayat (Admin only)' })
  async createPanchayat(@Body() dto: CreatePanchayatDto) {
    return this.locationsService.createPanchayat(dto);
  }

  @Get('villages')
  @ApiOperation({ summary: 'Get villages (optionally filtered by panchayatId)' })
  async getVillages(@Query('panchayatId') panchayatId?: string) {
    return this.locationsService.findVillages(panchayatId);
  }

  @Post('villages')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create village (Admin only)' })
  async createVillage(@Body() dto: CreateVillageDto) {
    return this.locationsService.createVillage(dto);
  }
}
