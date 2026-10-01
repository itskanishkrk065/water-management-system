import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BeneficiaryPortalService } from './beneficiary-portal.service';
import {
  UpdateProfileDto,
  CreatePortalLandDto,
  SubmitWaterApplicationDto,
  CreateExtensionRequestDto,
  UploadDocumentDto,
} from './dto/portal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../common/enums';

@ApiTags('Beneficiary Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.BENEFICIARY, RoleName.ADMIN)
@Controller('beneficiary')
export class BeneficiaryPortalController {
  constructor(private readonly portalService: BeneficiaryPortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current beneficiary profile with dynamic completion score' })
  async getMyProfile(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyProfile(user.user_id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile address and location details' })
  async updateMyProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.portalService.updateMyProfile(user.user_id, dto, ip);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get beneficiary dashboard summary and metrics' })
  async getDashboard(@CurrentUser() user: RequestUser) {
    return this.portalService.getDashboard(user.user_id);
  }

  @Get('land')
  @ApiOperation({ summary: 'List all land holdings and parcels with computed total land' })
  async getMyLand(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyLand(user.user_id);
  }

  @Post('land')
  @ApiOperation({ summary: 'Add a new land holding with validated SF/subdivision parcels' })
  async addMyLand(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePortalLandDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.portalService.addMyLand(user.user_id, dto, ip);
  }

  @Get('land/:id')
  @ApiOperation({ summary: 'Get details of a specific land holding' })
  async getMyLandById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.portalService.getMyLandById(user.user_id, id);
  }

  @Get('water/preview')
  @ApiOperation({ summary: 'Section 28 transparent allotment calculation preview' })
  async getWaterPreview(@CurrentUser() user: RequestUser) {
    return this.portalService.getWaterPreview(user.user_id);
  }

  @Post('water/applications')
  @ApiOperation({ summary: 'Submit self-service water requirement application' })
  async submitWaterApplication(
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitWaterApplicationDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.portalService.submitWaterApplication(user.user_id, dto, ip);
  }

  @Get('water/applications')
  @ApiOperation({ summary: 'List all water quota applications for the current beneficiary' })
  async getMyWaterApplications(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyWaterApplications(user.user_id);
  }

  @Get('allotments')
  @ApiOperation({ summary: 'Get approved water allotment, rate snapshot, and development cost' })
  async getMyAllotments(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyAllotments(user.user_id);
  }

  @Get('bills')
  @ApiOperation({ summary: 'List development bills and periodic running bills' })
  async getMyBills(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyBills(user.user_id);
  }

  @Get('installments')
  @ApiOperation({ summary: 'Get 5-stage installment milestones, target amounts, and payments' })
  async getMyInstallments(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyInstallments(user.user_id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List all payments and fiscal receipts' })
  async getMyPayments(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyPayments(user.user_id);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get printable receipt data for a payment' })
  async getMyReceipt(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.portalService.getMyReceipt(user.user_id, id);
  }

  @Get('infrastructure')
  @ApiOperation({ summary: 'Track physical pipeline and pump execution status' })
  async getMyInfrastructure(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyInfrastructure(user.user_id);
  }

  @Get('running-bills')
  @ApiOperation({ summary: 'Get periodic running charges (strictly gated by COMMISSIONED)' })
  async getMyRunningBills(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyRunningBills(user.user_id);
  }

  @Get('extensions')
  @ApiOperation({ summary: 'List quota extension requests' })
  async getMyExtensions(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyExtensions(user.user_id);
  }

  @Post('extensions')
  @ApiOperation({ summary: 'Submit a new quota extension request' })
  async submitExtension(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateExtensionRequestDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.portalService.submitExtension(user.user_id, dto, ip);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List all documents by category' })
  async getMyDocuments(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyDocuments(user.user_id);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Register a new document metadata record' })
  async uploadDocument(@CurrentUser() user: RequestUser, @Body() dto: UploadDocumentDto) {
    return this.portalService.uploadDocument(user.user_id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get complete chronological audit event history for beneficiary' })
  async getMyHistory(@CurrentUser() user: RequestUser) {
    return this.portalService.getMyHistory(user.user_id);
  }
}
