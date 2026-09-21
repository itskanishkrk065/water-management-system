import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDistrictDto, CreatePanchayatDto, CreateVillageDto } from './dto/location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findDistricts() {
    return this.prisma.district.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { panchayats: true, beneficiaries: true } },
      },
    });
  }

  async createDistrict(dto: CreateDistrictDto) {
    const existing = await this.prisma.district.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('District already exists');
    }
    return this.prisma.district.create({ data: { name: dto.name } });
  }

  async findPanchayats(districtId?: string) {
    return this.prisma.panchayat.findMany({
      where: districtId ? { district_id: districtId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        district: true,
        _count: { select: { villages: true, beneficiaries: true } },
      },
    });
  }

  async createPanchayat(dto: CreatePanchayatDto) {
    return this.prisma.panchayat.create({
      data: {
        district_id: dto.districtId,
        name: dto.name,
      },
      include: { district: true },
    });
  }

  async findVillages(panchayatId?: string) {
    return this.prisma.village.findMany({
      where: panchayatId ? { panchayat_id: panchayatId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        panchayat: { include: { district: true } },
        _count: { select: { beneficiaries: true } },
      },
    });
  }

  async createVillage(dto: CreateVillageDto) {
    return this.prisma.village.create({
      data: {
        panchayat_id: dto.panchayatId,
        name: dto.name,
      },
      include: { panchayat: { include: { district: true } } },
    });
  }

  async getHierarchyTree() {
    return this.prisma.district.findMany({
      orderBy: { name: 'asc' },
      include: {
        panchayats: {
          orderBy: { name: 'asc' },
          include: {
            villages: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }
}
