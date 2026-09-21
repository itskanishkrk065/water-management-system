import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName, BeneficiaryStatus } from '@prisma/client';

@ApiTags('Beneficiaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup beneficiary by phone number (first step of onboarding)' })
  async lookup(@Query('phone') phone: string) {
    return this.beneficiariesService.lookupByPhone(phone || '');
  }

  @Post()
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Create new beneficiary profile' })
  async create(
    @Body() dto: CreateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.create(dto, user.user_id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List beneficiaries with search, filters and pagination' })
  async findAll(
    @Query('search') search?: string,
    @Query('districtId') districtId?: string,
    @Query('panchayatId') panchayatId?: string,
    @Query('status') status?: BeneficiaryStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.beneficiariesService.findAll({
      search,
      districtId,
      panchayatId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full beneficiary dossier across all 9 operational tabs' })
  async findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Update beneficiary details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.update(id, dto, user.user_id, ip);
  }
}
