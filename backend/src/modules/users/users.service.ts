import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUsersDto,
  AssignScopeDto,
} from './dto/user.dto';
import { AuditAction, UserStatus, RoleName } from '../common/enums';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rolesService: RolesService,
  ) {}

  async create(dto: CreateUserDto, creatorId?: string, ipAddress?: string) {
    // 1. Verify uniqueness of email, username, employeeId
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existingEmail) {
      throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    if (dto.employeeId) {
      const existingEmp = await this.prisma.user.findUnique({
        where: { employee_id: dto.employeeId.trim() },
      });
      if (existingEmp) {
        throw new ConflictException(`Employee ID '${dto.employeeId}' is already in use`);
      }
    }

    if (dto.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: dto.username.toLowerCase().trim() },
      });
      if (existingUser) {
        throw new ConflictException(`Username '${dto.username}' is already taken`);
      }
    }

    // 2. Verify Role
    const role = await this.prisma.role.findUnique({
      where: { role_id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID '${dto.roleId}' not found`);
    }

    // 3. Password handling
    let plainPassword = dto.password;
    let isTemporaryPassword = false;
    if (!plainPassword) {
      plainPassword = `WG#${crypto.randomBytes(4).toString('hex')}!`;
      isTemporaryPassword = true;
    }
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 4. Create User and Geographic Scope atomically
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone?.trim() || null,
          employee_id: dto.employeeId?.trim() || null,
          username: dto.username?.toLowerCase().trim() || null,
          password_hash: passwordHash,
          full_name: dto.fullName.trim(),
          role_id: dto.roleId,
          status: UserStatus.ACTIVE,
          is_active: true,
          force_password_change: dto.forcePasswordChange !== undefined ? dto.forcePasswordChange : isTemporaryPassword,
          token_version: 1,
          created_by: creatorId || null,
        },
        include: {
          role: true,
        },
      });

      if (dto.districtId) {
        let districtName: string | null = null;
        const district = await tx.district.findUnique({
          where: { district_id: dto.districtId },
        });
        if (district) {
          districtName = district.name;
        }

        await tx.userGeographicScope.create({
          data: {
            user_id: createdUser.user_id,
            district_id: dto.districtId,
            district_name: districtName,
            panchayats_json: dto.panchayats && dto.panchayats.length > 0 ? JSON.stringify(dto.panchayats) : null,
          },
        });
      }

      await this.auditService.log({
        userId: creatorId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: createdUser.user_id,
        newValues: {
          email: createdUser.email,
          fullName: createdUser.full_name,
          role: role.name,
          status: UserStatus.ACTIVE,
          districtId: dto.districtId || null,
        },
        reason: 'User account created by administrator',
        ipAddress,
        tx,
      });

      return createdUser;
    });

    const fullCreated = await this.findOne(user.user_id);
    return {
      ...fullCreated,
      temporaryPassword: isTemporaryPassword ? plainPassword : undefined,
    };
  }

  async findAll(query: QueryUsersDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.roleId) {
      where.role_id = query.roleId;
    }

    if (query.roleName) {
      where.role = { name: query.roleName };
    }

    if (query.districtId) {
      where.geographicScope = { district_id: query.districtId };
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { full_name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { employee_id: { contains: q } },
        { username: { contains: q } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          role: true,
          geographicScope: true,
          devices: {
            where: { is_active: true },
            select: { device_id: true, device_name: true, platform: true, last_seen_at: true },
          },
        },
      }),
    ]);

    const items = users.map((u) => {
      const { password_hash, ...rest } = u;
      let parsedPanchayats: string[] = [];
      if (u.geographicScope?.panchayats_json) {
        try {
          parsedPanchayats = JSON.parse(u.geographicScope.panchayats_json);
        } catch {
          parsedPanchayats = [];
        }
      }
      return {
        ...rest,
        geographicScope: u.geographicScope
          ? {
              scope_id: u.geographicScope.scope_id,
              district_id: u.geographicScope.district_id,
              district_name: u.geographicScope.district_name,
              panchayats: parsedPanchayats,
            }
          : null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        geographicScope: true,
        devices: {
          orderBy: { registered_at: 'desc' },
        },
        _count: {
          select: {
            auditLogs: true,
            collectedWaterUsages: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    const { password_hash, role, geographicScope, ...rest } = user;

    let parsedPanchayats: string[] = [];
    if (geographicScope?.panchayats_json) {
      try {
        parsedPanchayats = JSON.parse(geographicScope.panchayats_json);
      } catch {
        parsedPanchayats = [];
      }
    }

    const permissions = role?.rolePermissions?.map((rp: any) => rp.permission) || [];

    return {
      ...rest,
      role: {
        role_id: role.role_id,
        name: role.name,
        description: role.description,
      },
      effectivePermissions: permissions.map((p: any) => p.code),
      permissionsList: permissions,
      geographicScope: geographicScope
        ? {
            scope_id: geographicScope.scope_id,
            district_id: geographicScope.district_id,
            district_name: geographicScope.district_name,
            panchayats: parsedPanchayats,
          }
        : null,
    };
  }

  async update(id: string, dto: UpdateUserDto, adminId?: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: { role: true, geographicScope: true },
    });
    if (!existing) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    if (dto.roleId && dto.roleId !== existing.role_id) {
      const roleExists = await this.prisma.role.findUnique({
        where: { role_id: dto.roleId },
      });
      if (!roleExists) {
        throw new NotFoundException(`Role with ID '${dto.roleId}' not found`);
      }
    }

    if (dto.employeeId && dto.employeeId !== existing.employee_id) {
      const conflict = await this.prisma.user.findUnique({
        where: { employee_id: dto.employeeId.trim() },
      });
      if (conflict && conflict.user_id !== id) {
        throw new ConflictException(`Employee ID '${dto.employeeId}' is already assigned`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (dto.fullName !== undefined) dataToUpdate.full_name = dto.fullName.trim();
      if (dto.phone !== undefined) dataToUpdate.phone = dto.phone?.trim() || null;
      if (dto.employeeId !== undefined) dataToUpdate.employee_id = dto.employeeId?.trim() || null;
      if (dto.roleId !== undefined) dataToUpdate.role_id = dto.roleId;
      if (dto.status !== undefined) {
        dataToUpdate.status = dto.status;
        dataToUpdate.is_active = dto.status === UserStatus.ACTIVE;
      }
      if (dto.isActive !== undefined) dataToUpdate.is_active = dto.isActive;
      if (dto.forcePasswordChange !== undefined) dataToUpdate.force_password_change = dto.forcePasswordChange;

      await tx.user.update({
        where: { user_id: id },
        data: dataToUpdate,
      });

      // Update Geographic Scope if specified
      if (dto.districtId !== undefined || dto.panchayats !== undefined) {
        if (dto.districtId) {
          let districtName: string | null = null;
          const district = await tx.district.findUnique({
            where: { district_id: dto.districtId },
          });
          if (district) districtName = district.name;

          await tx.userGeographicScope.upsert({
            where: { user_id: id },
            create: {
              user_id: id,
              district_id: dto.districtId,
              district_name: districtName,
              panchayats_json: dto.panchayats && dto.panchayats.length > 0 ? JSON.stringify(dto.panchayats) : null,
            },
            update: {
              district_id: dto.districtId,
              district_name: districtName,
              panchayats_json: dto.panchayats && dto.panchayats.length > 0 ? JSON.stringify(dto.panchayats) : null,
            },
          });
        } else if (dto.districtId === null) {
          // Cleared scope (made statewide)
          await tx.userGeographicScope.deleteMany({
            where: { user_id: id },
          });
        }
      }

      await this.auditService.log({
        userId: adminId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        oldValues: {
          fullName: existing.full_name,
          roleId: existing.role_id,
          status: existing.status,
          isActive: existing.is_active,
        },
        newValues: dto,
        reason: 'User details updated by administrator',
        ipAddress,
        tx,
      });
    });

    return this.findOne(id);
  }

  async lockUser(id: string, adminId?: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { user_id: id },
      data: {
        status: UserStatus.LOCKED,
        is_active: false,
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      reason: reason || 'User account locked by administrator',
    });

    return { success: true, message: `User ${user.email} is now LOCKED` };
  }

  async unlockUser(id: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { user_id: id },
      data: {
        status: UserStatus.ACTIVE,
        is_active: true,
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      reason: 'User account unlocked by administrator',
    });

    return { success: true, message: `User ${user.email} is now ACTIVE` };
  }

  async disableUser(id: string, adminId?: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: id },
        data: {
          status: UserStatus.DISABLED,
          is_active: false,
          disabled_at: new Date(),
          disabled_by: adminId || null,
          token_version: { increment: 1 },
        },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.deleteMany({
        where: { user_id: id },
      });

      // Revoke all devices
      await tx.deviceRegistration.updateMany({
        where: { user_id: id },
        data: {
          is_active: false,
          status: 'REVOKED',
          revoked_at: new Date(),
          revoked_by: adminId || null,
          revocation_reason: reason || 'User account disabled',
        },
      });

      await this.auditService.log({
        userId: adminId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        reason: reason || 'User account disabled; all sessions and devices revoked',
        tx,
      });
    });

    return { success: true, message: `User ${user.email} has been DISABLED and all active sessions/devices terminated` };
  }

  async reactivateUser(id: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { user_id: id },
      data: {
        status: UserStatus.ACTIVE,
        is_active: true,
        disabled_at: null,
        disabled_by: null,
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      reason: 'User account reactivated by administrator',
    });

    return { success: true, message: `User ${user.email} reactivated` };
  }

  async forcePasswordReset(id: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: id },
        data: {
          force_password_change: true,
          token_version: { increment: 1 },
        },
      });

      await tx.refreshToken.deleteMany({
        where: { user_id: id },
      });

      await this.auditService.log({
        userId: adminId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        reason: 'Forced password reset on next login; existing sessions revoked',
        tx,
      });
    });

    return { success: true, message: `User ${user.email} will be required to change password on next login` };
  }

  async revokeSessions(id: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: id },
        data: {
          token_version: { increment: 1 },
        },
      });

      await tx.refreshToken.deleteMany({
        where: { user_id: id },
      });

      await this.auditService.log({
        userId: adminId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        reason: 'All active sessions and tokens revoked by administrator',
        tx,
      });
    });

    return { success: true, message: `All active sessions revoked for ${user.email}` };
  }

  async revokeDevices(id: string, adminId?: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.deviceRegistration.updateMany({
        where: { user_id: id, is_active: true },
        data: {
          is_active: false,
          status: 'REVOKED',
          revoked_at: new Date(),
          revoked_by: adminId || null,
          revocation_reason: reason || 'All devices revoked by administrator',
        },
      });

      await this.auditService.log({
        userId: adminId || null,
        actorRole: RoleName.ADMIN,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: id,
        reason: reason || 'All linked field devices revoked by administrator',
        tx,
      });
    });

    return { success: true, message: `All devices revoked for ${user.email}` };
  }

  async assignScope(id: string, dto: AssignScopeDto, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    const district = await this.prisma.district.findUnique({
      where: { district_id: dto.districtId },
    });
    if (!district) throw new NotFoundException(`District with ID '${dto.districtId}' not found`);

    const scope = await this.prisma.userGeographicScope.upsert({
      where: { user_id: id },
      create: {
        user_id: id,
        district_id: dto.districtId,
        district_name: district.name,
        panchayats_json: dto.panchayats && dto.panchayats.length > 0 ? JSON.stringify(dto.panchayats) : null,
      },
      update: {
        district_id: dto.districtId,
        district_name: district.name,
        panchayats_json: dto.panchayats && dto.panchayats.length > 0 ? JSON.stringify(dto.panchayats) : null,
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      action: AuditAction.UPDATE,
      entityType: 'UserGeographicScope',
      entityId: scope.scope_id,
      newValues: {
        districtId: dto.districtId,
        districtName: district.name,
        panchayats: dto.panchayats || [],
      },
      reason: `Geographic scope assigned to user ${user.email} (District: ${district.name})`,
    });

    return scope;
  }

  async getActivity(id: string, limit: number = 50) {
    const logs = await this.prisma.auditLog.findMany({
      where: { user_id: id },
      orderBy: { created_at: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return logs;
  }
}
