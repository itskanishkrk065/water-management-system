import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Project Schemes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['projects', 'project-schemes'])
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create a new project scheme (Admin only)' })
  async create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all project schemes' })
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'List only active project schemes for dropdown selection' })
  async findActive() {
    return this.projectsService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project scheme details with rates and templates' })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update project scheme details (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Toggle project scheme active/inactive status (Admin only)' })
  async toggleStatus(@Param('id') id: string) {
    return this.projectsService.toggleStatus(id);
  }
}

