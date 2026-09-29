import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { project_code: dto.projectCode },
    });
    if (existing) {
      throw new ConflictException(`Project code '${dto.projectCode}' already exists`);
    }

    return this.prisma.project.create({
      data: {
        project_code: dto.projectCode,
        project_name: dto.projectName,
        description: dto.description,
        status: dto.status,
        start_date: dto.startDate ? new Date(dto.startDate) : null,
        end_date: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            landHoldings: true,
            waterApplications: true,
            rateConfigurations: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { project_id: id },
      include: {
        rateConfigurations: {
          orderBy: { effective_from: 'desc' },
        },
        installmentTemplates: {
          orderBy: { created_at: 'desc' },
        },
        _count: {
          select: {
            landHoldings: true,
            waterApplications: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findActive() {
    return this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { project_name: 'asc' },
      select: {
        project_id: true,
        project_code: true,
        project_name: true,
        description: true,
        status: true,
        start_date: true,
        end_date: true,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findUnique({
      where: { project_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { project_id: id },
      data: {
        project_name: dto.projectName,
        description: dto.description,
        status: dto.status,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        end_date: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async toggleStatus(id: string) {
    const existing = await this.prisma.project.findUnique({
      where: { project_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Project scheme not found');
    }
    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.prisma.project.update({
      where: { project_id: id },
      data: { status: newStatus },
    });
  }
}
