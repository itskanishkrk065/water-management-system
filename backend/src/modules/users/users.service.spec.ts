import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { GeographicScopeService } from './geographic-scope.service';
import { UserStatus, RoleName, PermissionCode, DeviceStatus } from '../common/enums';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UsersService, IAM, RBAC & Geographic Scoping', () => {
  let service: UsersService;
  let rolesService: RolesService;
  let scopeService: GeographicScopeService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    permission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    rolePermission: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    district: {
      findUnique: jest.fn(),
    },
    userGeographicScope: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    deviceRegistration: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ audit_id: 'mock-audit' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        RolesService,
        GeographicScopeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    rolesService = module.get<RolesService>(RolesService);
    scopeService = module.get<GeographicScopeService>(GeographicScopeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('User Provisioning', () => {
    it('should create a new staff account with assigned role and geographic scope', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // email not taken
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        role_id: 'role-officer',
        name: RoleName.FIELD_OFFICER,
      });
      mockPrisma.district.findUnique.mockResolvedValueOnce({
        district_id: 'dist-coimbatore',
        name: 'Coimbatore',
      });

      const createdUserRecord = {
        user_id: 'usr-101',
        email: 'officer@watergrid.gov',
        full_name: 'V. Ramanathan',
        role_id: 'role-officer',
        status: UserStatus.ACTIVE,
        is_active: true,
        force_password_change: true,
        token_version: 1,
      };
      mockPrisma.user.create.mockResolvedValueOnce(createdUserRecord);

      // findOne mock return
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...createdUserRecord,
        role: { role_id: 'role-officer', name: RoleName.FIELD_OFFICER, rolePermissions: [] },
        geographicScope: {
          scope_id: 'scope-1',
          district_id: 'dist-coimbatore',
          district_name: 'Coimbatore',
          panchayats_json: JSON.stringify(['Pollachi North']),
        },
        devices: [],
        _count: { auditLogs: 0, collectedWaterUsages: 0 },
      });

      const result = await service.create(
        {
          email: 'officer@watergrid.gov',
          fullName: 'V. Ramanathan',
          roleId: 'role-officer',
          districtId: 'dist-coimbatore',
          panchayats: ['Pollachi North'],
        },
        'admin-usr-1',
        '192.168.1.10',
      );

      expect(result.user_id).toBe('usr-101');
      expect(result.geographicScope?.district_name).toBe('Coimbatore');
      expect(result.geographicScope?.panchayats).toEqual(['Pollachi North']);
      expect(result.temporaryPassword).toBeDefined(); // auto-generated secure temp password
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-usr-1',
          action: 'CREATE',
          entityType: 'User',
          entityId: 'usr-101',
        }),
      );
    });

    it('should reject creation if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ user_id: 'existing-1', email: 'taken@watergrid.gov' });

      await expect(
        service.create({
          email: 'taken@watergrid.gov',
          fullName: 'Duplicate User',
          roleId: 'role-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Lifecycle State Machine: Lock, Disable, Session Revocation', () => {
    it('should lock an account and set is_active=false', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ user_id: 'u-1', email: 'user@gov.in' });
      mockPrisma.user.update.mockResolvedValueOnce({ user_id: 'u-1', status: UserStatus.LOCKED, is_active: false });

      const res = await service.lockUser('u-1', 'admin-1', 'Suspicious activity detected');
      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { user_id: 'u-1' },
        data: { status: UserStatus.LOCKED, is_active: false },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'u-1',
          reason: 'Suspicious activity detected',
        }),
      );
    });

    it('should disable an account, increment token_version, and revoke all sessions & devices', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ user_id: 'u-2', email: 'compromised@gov.in' });

      const res = await service.disableUser('u-2', 'admin-1', 'Staff offboarded');
      expect(res.success).toBe(true);

      // Verify token_version increment
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u-2' },
          data: expect.objectContaining({
            status: UserStatus.DISABLED,
            is_active: false,
            disabled_by: 'admin-1',
            token_version: { increment: 1 },
          }),
        }),
      );

      // Verify refresh tokens wiped
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'u-2' },
      });

      // Verify devices revoked
      expect(mockPrisma.deviceRegistration.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'u-2' },
        data: expect.objectContaining({
          is_active: false,
          status: 'REVOKED',
          revoked_by: 'admin-1',
        }),
      });
    });

    it('should force password reset on next login and increment token_version', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ user_id: 'u-3', email: 'reset@gov.in' });

      const res = await service.forcePasswordReset('u-3', 'admin-1');
      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u-3' },
          data: expect.objectContaining({
            force_password_change: true,
            token_version: { increment: 1 },
          }),
        }),
      );
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'u-3' },
      });
    });
  });

  describe('Geographic Scope & IDOR Protection', () => {
    it('should allow ADMIN statewide unrestricted access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        user_id: 'admin-id',
        role: { name: RoleName.ADMIN },
        geographicScope: null,
      });

      const scope = await scopeService.getUserScope('admin-id');
      expect(scope.isStatewide).toBe(true);

      // Should not throw even for random district
      await expect(
        scopeService.assertEntityWithinScope('admin-id', 'foreign-district-999', 'foreign-panchayat'),
      ).resolves.not.toThrow();
    });

    it('should block Field Officer from accessing an entity in a different district (IDOR defense)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        user_id: 'officer-id',
        role: { name: RoleName.FIELD_OFFICER },
        geographicScope: {
          district_id: 'district-salem',
          district_name: 'Salem',
          panchayats_json: JSON.stringify(['Attur', 'Omalur']),
        },
      });

      // Allowed within same district and assigned panchayat
      await expect(
        scopeService.assertEntityWithinScope('officer-id', 'district-salem', 'Attur'),
      ).resolves.not.toThrow();

      // Blocked if entity belongs to a foreign district
      await expect(
        scopeService.assertEntityWithinScope('officer-id', 'district-madurai', 'Attur'),
      ).rejects.toThrow(ForbiddenException);

      // Blocked if entity belongs to an unassigned panchayat
      await expect(
        scopeService.assertEntityWithinScope('officer-id', 'district-salem', 'Yercaud'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should automatically augment queries with scope filter for non-admin users', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        user_id: 'officer-id',
        role: { name: RoleName.FIELD_OFFICER },
        geographicScope: {
          district_id: 'district-erode',
          district_name: 'Erode',
          panchayats_json: null,
        },
      });

      const where = await scopeService.applyScopeFilter('officer-id', { status: 'ACTIVE' });
      expect(where).toEqual({
        status: 'ACTIVE',
        district_id: 'district-erode',
      });
    });
  });

  describe('RBAC Roles & Permissions', () => {
    it('should verify default role permissions', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        user_id: 'collector-1',
        role: {
          name: RoleName.COLLECTION_AGENT,
          rolePermissions: [
            { permission: { code: PermissionCode.PAYMENT_RECORD } },
            { permission: { code: PermissionCode.USAGE_RECORD } },
          ],
        },
      });

      const permissions = await rolesService.getUserPermissions('collector-1');
      expect(permissions).toContain(PermissionCode.PAYMENT_RECORD);
      expect(permissions).toContain(PermissionCode.USAGE_RECORD);
      expect(permissions).not.toContain(PermissionCode.PAYMENT_REVERSE); // Collection agents cannot reverse payments!
    });
  });
});
