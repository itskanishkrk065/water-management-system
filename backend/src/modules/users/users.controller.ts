import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RolesService } from '../roles/roles.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUsersDto,
  AssignScopeDto,
  ChangeStatusDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums';

@ApiTags('User Administration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Provision a new staff account (Admin only)' })
  async create(@Body() dto: CreateUserDto, @Req() req: any, @Ip() ip: string) {
    return this.usersService.create(dto, req.user?.user_id, ip);
  }

  @Get()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List and filter users with pagination (Admin only)' })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Get complete user profile with role, scopes, and devices (Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update user profile, status, or role (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.update(id, dto, req.user?.user_id, ip);
  }

  @Post(':id/lock')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Lock a user account (Admin only)' })
  async lockUser(
    @Param('id') id: string,
    @Body() body: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.usersService.lockUser(id, req.user?.user_id, body?.reason);
  }

  @Post(':id/unlock')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Unlock a user account (Admin only)' })
  async unlockUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.unlockUser(id, req.user?.user_id);
  }

  @Post(':id/disable')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Disable account, terminating all active sessions and registered devices (Admin only)' })
  async disableUser(
    @Param('id') id: string,
    @Body() body: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.usersService.disableUser(id, req.user?.user_id, body?.reason);
  }

  @Post(':id/reactivate')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Reactivate a disabled user account (Admin only)' })
  async reactivateUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.reactivateUser(id, req.user?.user_id);
  }

  @Post(':id/force-password-reset')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Require user to change password on next login (Admin only)' })
  async forcePasswordReset(@Param('id') id: string, @Req() req: any) {
    return this.usersService.forcePasswordReset(id, req.user?.user_id);
  }

  @Post(':id/revoke-sessions')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Revoke all active tokens and sessions for this user (Admin only)' })
  async revokeSessions(@Param('id') id: string, @Req() req: any) {
    return this.usersService.revokeSessions(id, req.user?.user_id);
  }

  @Post(':id/revoke-devices')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Revoke all field devices registered to this user (Admin only)' })
  async revokeDevices(
    @Param('id') id: string,
    @Body() body: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.usersService.revokeDevices(id, req.user?.user_id, body?.reason);
  }

  @Post(':id/scope')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Assign geographic jurisdiction (district/panchayats) to user (Admin only)' })
  async assignScope(
    @Param('id') id: string,
    @Body() dto: AssignScopeDto,
    @Req() req: any,
  ) {
    return this.usersService.assignScope(id, dto, req.user?.user_id);
  }

  @Get(':id/activity')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Get user audit activity history (Admin only)' })
  async getActivity(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.usersService.getActivity(id, limit ? Number(limit) : 50);
  }

  @Get(':id/permissions')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Get effective permissions for user (Admin only)' })
  async getPermissions(@Param('id') id: string) {
    const permissions = await this.rolesService.getUserPermissions(id);
    return { userId: id, permissions };
  }
}
