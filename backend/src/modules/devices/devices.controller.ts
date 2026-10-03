import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { QueryDevicesDto, DeviceActionDto, LinkDeviceUserDto } from './dto/device.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums';

@ApiTags('Device Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List and filter registered field devices (Admin only)' })
  async findAll(@Query() query: QueryDevicesDto) {
    return this.devicesService.findAll(query);
  }

  @Get(':deviceId')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Get details for a registered device (Admin only)' })
  async findOne(@Param('deviceId') deviceId: string) {
    return this.devicesService.findOne(deviceId);
  }

  @Patch(':deviceId/revoke')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Revoke device authorization (Admin only)' })
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @Body() body: DeviceActionDto,
    @Req() req: any,
  ) {
    return this.devicesService.revokeDevice(deviceId, req.user?.user_id, body?.reason);
  }

  @Patch(':deviceId/block')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Block device from syncing due to security violation (Admin only)' })
  async blockDevice(
    @Param('deviceId') deviceId: string,
    @Body() body: DeviceActionDto,
    @Req() req: any,
  ) {
    return this.devicesService.blockDevice(deviceId, req.user?.user_id, body?.reason);
  }

  @Patch(':deviceId/unblock')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Unblock device and restore sync authorization (Admin only)' })
  async unblockDevice(
    @Param('deviceId') deviceId: string,
    @Req() req: any,
  ) {
    return this.devicesService.unblockDevice(deviceId, req.user?.user_id);
  }

  @Post(':deviceId/link-user')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Link device to a specific user (Admin only)' })
  async linkUser(
    @Param('deviceId') deviceId: string,
    @Body() dto: LinkDeviceUserDto,
    @Req() req: any,
  ) {
    return this.devicesService.linkUser(deviceId, dto, req.user?.user_id);
  }
}
