import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, loans: { include: { book: true } } },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.user.create({
      data: this.toUserData(data) as Prisma.UserUncheckedCreateInput,
      include: { role: true },
    });
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: this.toUserData(data, true),
      include: { role: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });

    return { message: 'Usuario eliminado correctamente' };
  }

  private toUserData(
    data: Record<string, unknown>,
    partial = false,
  ): Prisma.UserUncheckedCreateInput | Prisma.UserUncheckedUpdateInput {
    const user: Prisma.UserUncheckedCreateInput | Prisma.UserUncheckedUpdateInput = {};

    if (!partial || data.name !== undefined) user.name = String(data.name ?? '');
    if (!partial || data.email !== undefined) user.email = String(data.email ?? '');
    if (!partial || data.password !== undefined) user.password = String(data.password ?? '');
    if (!partial || data.roleId !== undefined) user.roleId = Number(data.roleId);

    return user;
  }
}
