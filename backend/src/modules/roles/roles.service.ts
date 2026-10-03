import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName, PermissionCode } from '../common/enums';

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  category: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Beneficiaries
  { code: PermissionCode.BENEFICIARY_VIEW, name: 'View Beneficiaries', category: 'BENEFICIARY', description: 'View beneficiary profiles and details' },
  { code: PermissionCode.BENEFICIARY_CREATE, name: 'Create Beneficiaries', category: 'BENEFICIARY', description: 'Register new beneficiaries' },
  { code: PermissionCode.BENEFICIARY_EDIT, name: 'Edit Beneficiaries', category: 'BENEFICIARY', description: 'Modify existing beneficiary profiles' },

  // Land Holdings
  { code: PermissionCode.LAND_VIEW, name: 'View Land Holdings', category: 'LAND', description: 'View land records and parcels' },
  { code: PermissionCode.LAND_CREATE, name: 'Register Land', category: 'LAND', description: 'Register new land holdings and surveys' },
  { code: PermissionCode.LAND_EDIT, name: 'Edit Land', category: 'LAND', description: 'Update land parcels and survey numbers' },

  // Water Applications
  { code: PermissionCode.WATER_APPLICATION_VIEW, name: 'View Applications', category: 'WATER_APPLICATION', description: 'View water connection applications' },
  { code: PermissionCode.WATER_APPLICATION_CREATE, name: 'Submit Application', category: 'WATER_APPLICATION', description: 'Submit new water connection requests' },
  { code: PermissionCode.WATER_APPLICATION_APPROVE, name: 'Approve Application', category: 'WATER_APPLICATION', description: 'Formally approve or reject water applications' },

  // Usage & Metering
  { code: PermissionCode.USAGE_VIEW, name: 'View Water Usage', category: 'USAGE', description: 'Inspect water consumption and meter records' },
  { code: PermissionCode.USAGE_RECORD, name: 'Record Water Usage', category: 'USAGE', description: 'Enter meter readings and daily water consumption' },

  // Billing
  { code: PermissionCode.BILL_VIEW, name: 'View Bills', category: 'BILLING', description: 'Inspect running bills, dues, and installments' },
  { code: PermissionCode.BILL_CREATE, name: 'Generate Bills', category: 'BILLING', description: 'Calculate and generate monthly water bills' },

  // Payments
  { code: PermissionCode.PAYMENT_VIEW, name: 'View Payments', category: 'PAYMENT', description: 'View collection records and financial receipts' },
  { code: PermissionCode.PAYMENT_RECORD, name: 'Record Payments', category: 'PAYMENT', description: 'Accept and record payments from beneficiaries' },
  { code: PermissionCode.PAYMENT_REVERSE, name: 'Reverse Payments', category: 'PAYMENT', description: 'Reverse erroneous payments with mandatory audit justification' },

  // Reports
  { code: PermissionCode.REPORT_VIEW, name: 'View Reports', category: 'REPORTS', description: 'Access operational and fiscal dashboards' },
  { code: PermissionCode.REPORT_EXPORT, name: 'Export Reports', category: 'REPORTS', description: 'Export accounting and consumption datasets to CSV/Excel' },

  // User Management
  { code: PermissionCode.USER_VIEW, name: 'View Users', category: 'USER_MANAGEMENT', description: 'Inspect system staff accounts and permissions' },
  { code: PermissionCode.USER_CREATE, name: 'Create Users', category: 'USER_MANAGEMENT', description: 'Provision new staff accounts' },
  { code: PermissionCode.USER_EDIT, name: 'Edit Users', category: 'USER_MANAGEMENT', description: 'Modify user profiles, roles, and scopes' },
  { code: PermissionCode.USER_DISABLE, name: 'Disable Users', category: 'USER_MANAGEMENT', description: 'Lock, archive, or disable user credentials' },

  // System & Infrastructure
  { code: PermissionCode.AUDIT_VIEW, name: 'View Audit Logs', category: 'AUDIT', description: 'Inspect immutable system event audit trail' },
  { code: PermissionCode.MASTER_DATA_MANAGE, name: 'Manage Master Data', category: 'INFRASTRUCTURE', description: 'Configure tariffs, locations, and infrastructure' },
  { code: PermissionCode.DEVICE_MANAGE, name: 'Manage Devices', category: 'INFRASTRUCTURE', description: 'Authorize, inspect, and revoke field tablets and devices' },
  { code: PermissionCode.SYSTEM_ADMIN, name: 'System Administration', category: 'INFRASTRUCTURE', description: 'Full root access to system maintenance and backups' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  [RoleName.ADMIN]: Object.values(PermissionCode),
  [RoleName.FIELD_OFFICER]: [
    PermissionCode.BENEFICIARY_VIEW,
    PermissionCode.BENEFICIARY_CREATE,
    PermissionCode.BENEFICIARY_EDIT,
    PermissionCode.LAND_VIEW,
    PermissionCode.LAND_CREATE,
    PermissionCode.LAND_EDIT,
    PermissionCode.WATER_APPLICATION_VIEW,
    PermissionCode.WATER_APPLICATION_CREATE,
    PermissionCode.USAGE_VIEW,
    PermissionCode.USAGE_RECORD,
    PermissionCode.REPORT_VIEW,
  ],
  [RoleName.COLLECTION_AGENT]: [
    PermissionCode.BENEFICIARY_VIEW,
    PermissionCode.USAGE_VIEW,
    PermissionCode.USAGE_RECORD,
    PermissionCode.BILL_VIEW,
    PermissionCode.PAYMENT_VIEW,
    PermissionCode.PAYMENT_RECORD,
  ],
  [RoleName.ACCOUNTS]: [
    PermissionCode.BENEFICIARY_VIEW,
    PermissionCode.BILL_VIEW,
    PermissionCode.BILL_CREATE,
    PermissionCode.PAYMENT_VIEW,
    PermissionCode.PAYMENT_RECORD,
    PermissionCode.PAYMENT_REVERSE,
    PermissionCode.REPORT_VIEW,
    PermissionCode.REPORT_EXPORT,
  ],
  [RoleName.VIEWER]: [
    PermissionCode.BENEFICIARY_VIEW,
    PermissionCode.LAND_VIEW,
    PermissionCode.WATER_APPLICATION_VIEW,
    PermissionCode.USAGE_VIEW,
    PermissionCode.BILL_VIEW,
    PermissionCode.PAYMENT_VIEW,
    PermissionCode.REPORT_VIEW,
  ],
  [RoleName.BENEFICIARY]: [
    PermissionCode.BENEFICIARY_VIEW,
    PermissionCode.WATER_APPLICATION_VIEW,
    PermissionCode.USAGE_VIEW,
    PermissionCode.BILL_VIEW,
    PermissionCode.PAYMENT_VIEW,
    PermissionCode.PAYMENT_RECORD,
  ],
};

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedRolesAndPermissions();
    } catch (err: any) {
      this.logger.warn(`Deferred role/permission seeding: ${err?.message}`);
    }
  }

  async seedRolesAndPermissions(): Promise<void> {
    const roleDescriptions: Record<RoleName, string> = {
      [RoleName.ADMIN]: 'System Administrator with unrestricted access to all operations',
      [RoleName.FIELD_OFFICER]: 'Field officer managing beneficiary onboarding, land verification, and water applications',
      [RoleName.COLLECTION_AGENT]: 'Field collection agent for meter readings and fee collections',
      [RoleName.ACCOUNTS]: 'Finance officer managing bills, payments, adjustments, and accounting reports',
      [RoleName.VIEWER]: 'Read-only observer for regulatory compliance and operational auditing',
      [RoleName.BENEFICIARY]: 'Self-service citizen portal for water consumers',
    };

    // 1. Ensure all Roles exist
    const roleEntities: Record<string, any> = {};
    for (const [name, desc] of Object.entries(roleDescriptions)) {
      let role = await this.prisma.role.findUnique({
        where: { name: name as any },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: name as any,
            description: desc,
          },
        });
      }
      roleEntities[name] = role;
    }

    // 2. Ensure all Permissions exist
    const permissionEntities: Record<string, any> = {};
    for (const p of ALL_PERMISSIONS) {
      let perm = await this.prisma.permission.findUnique({
        where: { code: p.code },
      });
      if (!perm) {
        perm = await this.prisma.permission.create({
          data: {
            code: p.code,
            name: p.name,
            category: p.category,
            description: p.description,
          },
        });
      }
      permissionEntities[p.code] = perm;
    }

    // 3. Map default permissions to roles
    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = roleEntities[roleName];
      if (!role) continue;

      for (const pCode of permissions) {
        const perm = permissionEntities[pCode];
        if (!perm) continue;

        const existingLink = await this.prisma.rolePermission.findUnique({
          where: {
            role_id_permission_id: {
              role_id: role.role_id,
              permission_id: perm.permission_id,
            },
          },
        });

        if (!existingLink) {
          await this.prisma.rolePermission.create({
            data: {
              role_id: role.role_id,
              permission_id: perm.permission_id,
            },
          });
        }
      }
    }

    this.logger.log('Standard Roles and Permissions verified successfully.');
  }

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
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
      },
    });

    if (!user || !user.role) return [];
    return user.role.rolePermissions.map((rp: any) => rp.permission.code);
  }
}
