import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import {
  CreateDistrictDto,
  CreateBlockDto,
  CreateVillageDto,
  CreatePanchayatDto,
  UpdateDistrictDto,
  UpdateBlockDto,
  UpdateVillageDto,
  UpdatePanchayatDto,
  QueryVillagesDto,
  QueryBlocksDto,
  LocationSearchQueryDto,
} from './dto/location.dto';
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
  @ApiOperation({ summary: 'Get administrative hierarchy tree (District -> Block -> Village)' })
  async getTree(@Query('districtId') districtId?: string) {
    return this.locationsService.getHierarchyTree(districtId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Global search across districts, blocks, and villages' })
  async search(@Query() dto: LocationSearchQueryDto) {
    return this.locationsService.searchLocations(dto);
  }

  // --- DISTRICTS ---

  @Get('districts')
  @ApiOperation({ summary: 'Get all districts' })
  async getDistricts(
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    return this.locationsService.findDistricts({ search, activeOnly });
  }

  @Get('districts/:districtId')
  @ApiOperation({ summary: 'Get single district with child blocks' })
  async getDistrictById(@Param('districtId') districtId: string) {
    return this.locationsService.getDistrictById(districtId);
  }

  @Post('districts')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create district manually (Admin only)' })
  async createDistrict(@Body() dto: CreateDistrictDto) {
    return this.locationsService.createDistrict(dto);
  }

  @Patch('districts/:districtId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update district (Admin only)' })
  async updateDistrict(
    @Param('districtId') districtId: string,
    @Body() dto: UpdateDistrictDto,
  ) {
    return this.locationsService.updateDistrict(districtId, dto);
  }

  @Delete('districts/:districtId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Safe delete unused district (Admin only)' })
  async deleteDistrict(@Param('districtId') districtId: string) {
    return this.locationsService.deleteDistrict(districtId);
  }

  @Get('districts/:districtId/blocks')
  @ApiOperation({ summary: 'Get cascading blocks belonging to a specific district' })
  async getBlocksForDistrict(
    @Param('districtId') districtId: string,
    @Query() query: QueryBlocksDto,
  ) {
    return this.locationsService.findBlocks(districtId, query);
  }

  // --- BLOCKS ---

  @Get('blocks')
  @ApiOperation({ summary: 'Get blocks (optionally filtered by districtId or search)' })
  async getBlocks(@Query() query: QueryBlocksDto) {
    return this.locationsService.findBlocks(undefined, query);
  }

  @Get('blocks/:blockId')
  @ApiOperation({ summary: 'Get single block details with child villages' })
  async getBlockById(@Param('blockId') blockId: string) {
    return this.locationsService.getBlockById(blockId);
  }

  @Post('blocks')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create block manually (Admin only)' })
  async createBlock(@Body() dto: CreateBlockDto) {
    return this.locationsService.createBlock(dto);
  }

  @Patch('blocks/:blockId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update block (Admin only)' })
  async updateBlock(
    @Param('blockId') blockId: string,
    @Body() dto: UpdateBlockDto,
  ) {
    return this.locationsService.updateBlock(blockId, dto);
  }

  @Delete('blocks/:blockId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Safe delete unused block (Admin only)' })
  async deleteBlock(@Param('blockId') blockId: string) {
    return this.locationsService.deleteBlock(blockId);
  }

  @Get('blocks/:blockId/villages')
  @ApiOperation({ summary: 'Get cascading villages belonging to a specific block (supports search and pagination)' })
  async getVillagesForBlock(
    @Param('blockId') blockId: string,
    @Query() query: QueryVillagesDto,
  ) {
    return this.locationsService.findVillages(blockId, query);
  }

  // --- VILLAGES ---

  @Get('villages')
  @ApiOperation({ summary: 'Get villages (optionally filtered by blockId or search with pagination)' })
  async getVillages(@Query() query: QueryVillagesDto) {
    return this.locationsService.findVillages(query.blockId, query);
  }

  @Get('villages/:villageId')
  @ApiOperation({ summary: 'Get single village details with parent block and district' })
  async getVillageById(@Param('villageId') villageId: string) {
    return this.locationsService.getVillageById(villageId);
  }

  @Post('villages')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create village manually (Admin only)' })
  async createVillage(@Body() dto: CreateVillageDto) {
    return this.locationsService.createVillage(dto);
  }

  @Patch('villages/:villageId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update village (Admin only)' })
  async updateVillage(
    @Param('villageId') villageId: string,
    @Body() dto: UpdateVillageDto,
  ) {
    return this.locationsService.updateVillage(villageId, dto);
  }

  @Delete('villages/:villageId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Safe delete unused village (Admin only)' })
  async deleteVillage(@Param('villageId') villageId: string) {
    return this.locationsService.deleteVillage(villageId);
  }

  // --- LEGACY PANCHAYAT ROUTES ---

  @Get('panchayats')
  @ApiOperation({ summary: 'Get legacy panchayats (optionally filtered by districtId)' })
  async getPanchayats(@Query('districtId') districtId?: string) {
    return this.locationsService.findPanchayats(districtId);
  }

  @Post('panchayats')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create legacy panchayat (Admin only)' })
  async createPanchayat(@Body() dto: CreatePanchayatDto) {
    return this.locationsService.createPanchayat(dto);
  }

  @Patch('panchayats/:panchayatId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update legacy panchayat (Admin only)' })
  async updatePanchayat(
    @Param('panchayatId') panchayatId: string,
    @Body() dto: UpdatePanchayatDto,
  ) {
    return this.locationsService.updatePanchayat(panchayatId, dto);
  }

  @Delete('panchayats/:panchayatId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Safe delete unused legacy panchayat (Admin only)' })
  async deletePanchayat(@Param('panchayatId') panchayatId: string) {
    return this.locationsService.deletePanchayat(panchayatId);
  }
}

