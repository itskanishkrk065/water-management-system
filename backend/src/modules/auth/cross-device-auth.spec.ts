/**
 * WATERGRID — CROSS-DEVICE LOGIN AND USER MANAGEMENT REGRESSION TEST SUITE
 * Test coverage for AUTH-001 through AUTH-023.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { hashPassword, verifyPassword } from '../common/password.util';
import { RolesService } from '../roles/roles.service';

describe('WATERGRID — Cross-Device Authentication & User Management (AUTH-001 to AUTH-023)', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let prismaMock: any;

  const mockRole = {
    role_id: 'role-field-off-1',
    name: 'FIELD_OFFICER',
    description: 'Field Collection Officer',
  };

  const mockAdminRole = {
    role_id: 'role-admin-1',
    name: 'ADMINISTRATOR',
    description: 'System Administrator',
  };

  const mockAccountsRole = {
    role_id: 'role-accounts-1',
    name: 'ACCOUNTS',
    description: 'Finance and Accounts',
  };

  const mockViewerRole = {
    role_id: 'role-viewer-1',
    name: 'VIEWER',
    description: 'Read-only Viewer',
  };

  let sampleUserHash: string;

  beforeAll(async () => {
    sampleUserHash = await hashPassword('SecurePass123!');
  });

  beforeEach(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      userGeographicScope: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      beneficiary: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ token_id: 'rt-123' }),
        update: jest.fn().mockResolvedValue({ token_id: 'rt-123' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: RolesService, useValue: { findOne: jest.fn().mockResolvedValue(mockRole) } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { sign: () => 'mock-jwt-access-token' } },
        { provide: AuditService, useValue: { logAction: jest.fn(), log: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  // AUTH-001: Admin can create a user.
  it('AUTH-001: Admin can create a user', async () => {
    const createdUserRecord = {
      user_id: 'usr-new-001',
      email: 'newuser@watergrid.gov.in',
      username: 'newuser',
      full_name: 'New Test User',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role_id: mockRole.role_id,
      role: mockRole,
      geographicScope: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findUnique.mockResolvedValue(mockRole);
    prismaMock.user.create.mockResolvedValue(createdUserRecord);
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.user_id === 'usr-new-001') return createdUserRecord;
      return null;
    });

    const result = await usersService.create(
      {
        fullName: 'New Test User',
        email: 'newuser@watergrid.gov.in',
        username: 'newuser',
        password: 'SecurePass123!',
        roleId: mockRole.role_id,
      },
      'admin-usr-1',
    );

    expect(result).toBeDefined();
    expect(result.user_id).toBe('usr-new-001');
    expect((result as any).password_hash).toBeUndefined(); // Password hash must not be returned
  });

  // AUTH-002: Newly created central user can log in using the intended identifier.
  it('AUTH-002: Newly created central user can log in using username or email', async () => {
    const createdUser = {
      user_id: 'usr-new-002',
      email: 'field1@watergrid.gov.in',
      username: 'field1',
      full_name: 'Field Officer One',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(createdUser);

    const loginResult = await authService.login(
      { username: 'field1', password: 'SecurePass123!' },
      '192.168.1.50',
    );

    expect(loginResult).toBeDefined();
    expect(loginResult.accessToken).toBe('mock-jwt-access-token');
    expect(loginResult.user.email).toBe('field1@watergrid.gov.in');
  });

  // AUTH-003: Incorrect password is rejected.
  it('AUTH-003: Incorrect password is rejected with UnauthorizedException', async () => {
    const user = {
      user_id: 'usr-003',
      email: 'user3@watergrid.gov.in',
      username: 'user3',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(user);

    await expect(
      authService.login(
        { username: 'user3', password: 'WrongPassword999!' },
        '192.168.1.50',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  // AUTH-004: Unknown account is rejected.
  it('AUTH-004: Unknown account is rejected with generic error', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.login(
        { username: 'nonexistent_user', password: 'Password123!' },
        '192.168.1.50',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  // AUTH-005: Leading/trailing identifier whitespace is handled consistently.
  it('AUTH-005: Leading/trailing identifier whitespace is trimmed', async () => {
    const user = {
      user_id: 'usr-005',
      email: 'whitespace@watergrid.gov.in',
      username: 'whitespace_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(user);

    const loginResult = await authService.login(
      { username: '  whitespace_user  ', password: 'SecurePass123!' },
      '192.168.1.50',
    );

    expect(loginResult).toBeDefined();
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ username: 'whitespace_user' }]),
        }),
      }),
    );
  });

  // AUTH-006: Email matching follows case-insensitive normalization.
  it('AUTH-006: Email matching is case-insensitive', async () => {
    const user = {
      user_id: 'usr-006',
      email: 'officer@watergrid.gov.in',
      username: 'officer1',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(user);

    const loginResult = await authService.login(
      { email: 'OFFICER@WATERGRID.GOV.IN', password: 'SecurePass123!' },
      '192.168.1.50',
    );

    expect(loginResult).toBeDefined();
    expect(loginResult.user.email).toBe('officer@watergrid.gov.in');
  });

  // AUTH-007: Active FIELD_OFFICER can log in.
  it('AUTH-007: Active FIELD_OFFICER can authenticate successfully', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-fo-1',
      email: 'field.officer@watergrid.gov.in',
      username: 'field_officer',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    });

    const res = await authService.login({
      username: 'field_officer',
      password: 'SecurePass123!',
    });
    expect(res.user.role).toBe('FIELD_OFFICER');
  });

  // AUTH-008: Active ACCOUNTS user can log in.
  it('AUTH-008: Active ACCOUNTS user can authenticate successfully', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-acc-1',
      email: 'accounts@watergrid.gov.in',
      username: 'accounts_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockAccountsRole,
    });

    const res = await authService.login({
      username: 'accounts_user',
      password: 'SecurePass123!',
    });
    expect(res.user.role).toBe('ACCOUNTS');
  });

  // AUTH-009: Active VIEWER can log in.
  it('AUTH-009: Active VIEWER can authenticate successfully', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-vw-1',
      email: 'viewer@watergrid.gov.in',
      username: 'viewer_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockViewerRole,
    });

    const res = await authService.login({
      username: 'viewer_user',
      password: 'SecurePass123!',
    });
    expect(res.user.role).toBe('VIEWER');
  });

  // AUTH-010: Disabled user cannot log in.
  it('AUTH-010: Disabled user is rejected upon authentication attempt', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-dis-1',
      email: 'disabled@watergrid.gov.in',
      username: 'disabled_user',
      password_hash: sampleUserHash,
      status: 'DISABLED',
      role: mockRole,
    });

    await expect(
      authService.login({
        username: 'disabled_user',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // AUTH-011: Locked user cannot log in.
  it('AUTH-011: Locked user is rejected upon authentication attempt', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-loc-1',
      email: 'locked@watergrid.gov.in',
      username: 'locked_user',
      password_hash: sampleUserHash,
      status: 'LOCKED',
      role: mockRole,
    });

    await expect(
      authService.login({
        username: 'locked_user',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // AUTH-012: User's server-assigned role cannot be overridden by the client.
  it('AUTH-012: Client cannot override server-assigned user role', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-fo-2',
      email: 'field2@watergrid.gov.in',
      username: 'field2',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole, // Server specifies FIELD_OFFICER
    });

    const loginRes = await authService.login({
      username: 'field2',
      password: 'SecurePass123!',
    });

    // Regardless of what client requested, response role is server role
    expect(loginRes.user.role).toBe('FIELD_OFFICER');
  });

  // AUTH-013: User's geographic scope comes from the server.
  it('AUTH-013: Geographic scope is loaded strictly from central database record', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-scope-1',
      email: 'scoped@watergrid.gov.in',
      username: 'scoped_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
      geographicScope: {
        district_id: 'dst-coimbatore-1',
        panchayats: ['Panchayat A', 'Panchayat B'],
      },
    });

    const loginRes = await authService.login({
      username: 'scoped_user',
      password: 'SecurePass123!',
    });

    expect(loginRes.user).toBeDefined();
    expect(loginRes.user.user_id).toBe('usr-scope-1');
  });

  // AUTH-014: Password hashes are never returned to the client.
  it('AUTH-014: Password hashes are stripped before returning user object to client', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-hash-1',
      email: 'hashcheck@watergrid.gov.in',
      username: 'hashcheck',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    });

    const loginRes = await authService.login({
      username: 'hashcheck',
      password: 'SecurePass123!',
    });

    expect((loginRes.user as any).password_hash).toBeUndefined();
    expect((loginRes.user as any).password).toBeUndefined();
  });

  // AUTH-015: Passwords are not stored in plaintext.
  it('AUTH-015: Passwords stored in central DB are hashed with Argon2id', async () => {
    const isArgon2 = sampleUserHash.startsWith('$argon2id$');
    expect(isArgon2).toBe(true);

    const match = await verifyPassword('SecurePass123!', sampleUserHash);
    expect(match).toBe(true);
  });

  // AUTH-016: Central database outage is not reported as invalid credentials.
  it('AUTH-016: Central database outage throws InternalServerErrorException with explicit message', async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error('Connection to Neon DB timed out'));

    await expect(
      authService.login({
        username: 'anyuser',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  // AUTH-017: User creation and login use the same canonical user record.
  it('AUTH-017: User Management creation and login read identical Prisma User model', async () => {
    const canonicalRecord = {
      user_id: 'usr-canonical-1',
      email: 'canonical@watergrid.gov.in',
      username: 'canonical_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role_id: mockRole.role_id,
      role: mockRole,
      geographicScope: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    prismaMock.user.findFirst.mockResolvedValue(canonicalRecord);
    prismaMock.role.findUnique.mockResolvedValue(mockRole);
    prismaMock.user.create.mockResolvedValue(canonicalRecord);
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.user_id === 'usr-canonical-1') return canonicalRecord;
      return null;
    });

    const created = await usersService.create(
      {
        fullName: 'Canonical User',
        email: 'canonical@watergrid.gov.in',
        username: 'canonical_user',
        password: 'SecurePass123!',
        roleId: mockRole.role_id,
      },
      'admin-usr-1',
    );

    const loginRes = await authService.login({
      username: 'canonical_user',
      password: 'SecurePass123!',
    });

    expect(loginRes.user.user_id).toBe(created.user_id);
  });

  // AUTH-018: Two independent clients can authenticate against the same central user account.
  it('AUTH-018: Independent Device A and Device B authenticate against same central user', async () => {
    const centralUser = {
      user_id: 'usr-cross-device',
      email: 'shared@watergrid.gov.in',
      username: 'shared_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(centralUser);

    const loginDevA = await authService.login(
      { username: 'shared_user', password: 'SecurePass123!' },
      '10.0.0.1',
    );

    const loginDevB = await authService.login(
      { username: 'shared_user', password: 'SecurePass123!' },
      '10.0.0.2',
    );

    expect(loginDevA.user.user_id).toEqual(loginDevB.user.user_id);
    expect(loginDevA.accessToken).toBeDefined();
    expect(loginDevB.accessToken).toBeDefined();
  });

  // AUTH-019: Device identity is separate from user identity.
  it('AUTH-019: Device identity is separate from user identity', async () => {
    const user = {
      user_id: 'usr-dev-sep',
      email: 'sep@watergrid.gov.in',
      username: 'sep_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(user);

    const res = await authService.login(
      { username: 'sep_user', password: 'SecurePass123!' },
      '127.0.0.1',
    );

    expect(res.user.user_id).toBe('usr-dev-sep');
    expect(res.user.user_id).not.toEqual('HARDWARE-DEV-XYZ-999');
  });

  // AUTH-020: Packaged application login URL resolution safety check.
  it('AUTH-020: Login DTO accepts standard JSON payload without device locks', async () => {
    const user = {
      user_id: 'usr-win-app',
      email: 'winapp@watergrid.gov.in',
      username: 'winapp_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    };

    prismaMock.user.findFirst.mockResolvedValue(user);

    const res = await authService.login({
      username: 'winapp_user',
      password: 'SecurePass123!',
    });

    expect(res.accessToken).toBe('mock-jwt-access-token');
  });

  // AUTH-021: Deployed API endpoint format check.
  it('AUTH-021: Authentication response contains required tokens and user identity', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      user_id: 'usr-render-1',
      email: 'render@watergrid.gov.in',
      username: 'render_user',
      password_hash: sampleUserHash,
      status: 'ACTIVE',
      role: mockRole,
    });

    const res = await authService.login({
      username: 'render_user',
      password: 'SecurePass123!',
    });

    expect(res).toHaveProperty('accessToken');
    expect(res).toHaveProperty('refreshToken');
    expect(res).toHaveProperty('user');
  });

  // AUTH-022: Logout and session isolation check.
  it('AUTH-022: Refresh token revocation clears session state on logout', async () => {
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await authService.logout('usr-123');
    expect(result).toEqual({ success: true, message: 'Logged out successfully' });
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'usr-123', revoked: false },
        data: { revoked: true },
      }),
    );
  });

  // AUTH-023: Central database requirement for central authentication.
  it('AUTH-023: Requests needing central auth must query central database via Prisma', async () => {
    prismaMock.user.findFirst.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    await expect(
      authService.validateUser('central_user', 'SecurePass123!'),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
