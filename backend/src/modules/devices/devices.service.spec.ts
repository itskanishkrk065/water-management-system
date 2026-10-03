import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeviceStatus } from '../common/enums';
import { NotFoundException } from '@nestjs/common';

describe('DevicesService & Tablet Fleet Management', () => {
  let service: DevicesService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    deviceRegistration: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ audit_id: 'audit-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should list devices with pagination and filters', async () => {
    mockPrisma.deviceRegistration.count.mockResolvedValueOnce(1);
    mockPrisma.deviceRegistration.findMany.mockResolvedValueOnce([
      {
        device_id: 'tablet-101',
        device_name: 'Field Tablet A',
        status: DeviceStatus.ACTIVE,
        user: { email: 'officer@gov.in' },
      },
    ]);

    const result = await service.findAll({ status: DeviceStatus.ACTIVE });
    expect(result.total).toBe(1);
    expect(result.items[0].device_id).toBe('tablet-101');
  });

  it('should revoke a compromised device', async () => {
    mockPrisma.deviceRegistration.findUnique.mockResolvedValueOnce({
      device_id: 'tablet-lost',
      status: DeviceStatus.ACTIVE,
      is_active: true,
    });
    mockPrisma.deviceRegistration.update.mockResolvedValueOnce({
      device_id: 'tablet-lost',
      status: DeviceStatus.REVOKED,
      is_active: false,
    });

    const res = await service.revokeDevice('tablet-lost', 'admin-id', 'Device stolen in field');
    expect(res.status).toBe(DeviceStatus.REVOKED);
    expect(res.is_active).toBe(false);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'tablet-lost',
        reason: 'Device stolen in field',
      }),
    );
  });

  it('should block a rogue device', async () => {
    mockPrisma.deviceRegistration.findUnique.mockResolvedValueOnce({
      device_id: 'tablet-rogue',
      status: DeviceStatus.ACTIVE,
      is_active: true,
    });
    mockPrisma.deviceRegistration.update.mockResolvedValueOnce({
      device_id: 'tablet-rogue',
      status: DeviceStatus.BLOCKED,
      is_active: false,
    });

    const res = await service.blockDevice('tablet-rogue', 'admin-id', 'Repeated checksum tampering');
    expect(res.status).toBe(DeviceStatus.BLOCKED);
    expect(res.is_active).toBe(false);
  });

  it('should unblock an authorized device', async () => {
    mockPrisma.deviceRegistration.findUnique.mockResolvedValueOnce({
      device_id: 'tablet-cleared',
      status: DeviceStatus.BLOCKED,
      is_active: false,
    });
    mockPrisma.deviceRegistration.update.mockResolvedValueOnce({
      device_id: 'tablet-cleared',
      status: DeviceStatus.ACTIVE,
      is_active: true,
    });

    const res = await service.unblockDevice('tablet-cleared', 'admin-id');
    expect(res.status).toBe(DeviceStatus.ACTIVE);
    expect(res.is_active).toBe(true);
  });

  it('should link a device to a user', async () => {
    mockPrisma.deviceRegistration.findUnique.mockResolvedValueOnce({
      device_id: 'tablet-unassigned',
      status: DeviceStatus.ACTIVE,
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      user_id: 'usr-new-officer',
      email: 'newofficer@gov.in',
    });
    mockPrisma.deviceRegistration.update.mockResolvedValueOnce({
      device_id: 'tablet-unassigned',
      user_id: 'usr-new-officer',
    });

    const res = await service.linkUser('tablet-unassigned', { userId: 'usr-new-officer' }, 'admin-id');
    expect(mockPrisma.deviceRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { device_id: 'tablet-unassigned' },
        data: { user_id: 'usr-new-officer' },
      }),
    );
  });
});
