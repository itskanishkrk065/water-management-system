import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        full_name: dto.fullName,
        role_id: dto.roleId,
        is_active: true,
      },
      include: { role: true },
    });

    const { password_hash, ...rest } = user;
    return rest;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      include: { role: true },
    });
    return users.map(({ password_hash, ...rest }) => rest);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password_hash, ...rest } = user;
    return rest;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { user_id: id },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { user_id: id },
      data: {
        full_name: dto.fullName,
        role_id: dto.roleId,
        is_active: dto.isActive,
      },
      include: { role: true },
    });
    const { password_hash, ...rest } = updated;
    return rest;
  }
}
