import { Controller, Get, Post, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExtensionsService } from './extensions.service';
import { CreateExtensionRequestDto, ApproveExtensionDto } from './dto/extension.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { ExtensionStatus, RoleName } from '../common/enums';

@ApiTags('Extensions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Post()
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Submit an extension request for additional land/litres' })
  async create(
    @Body() dto: CreateExtensionRequestDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.extensionsService.create(dto, user.user_id, ip);
  }

  @Post(':id/approve')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Approve extension request (Admin only - isolates original allotment)' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveExtensionDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.extensionsService.approve(id, dto, user.email, user.user_id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List extension requests' })
  async findAll(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('status') status?: ExtensionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.extensionsService.findAll({
      beneficiaryId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get extension details' })
  async findOne(@Param('id') id: string) {
    return this.extensionsService.findOne(id);
  }
}
