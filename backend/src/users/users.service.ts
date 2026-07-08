import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => this.withoutPassword(user));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, loans: { include: { book: true } } },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.withoutPassword(user);
  }

  async findOneForRequest(id: number, currentUser: any) {
    if (currentUser.role !== 'ADMIN' && currentUser.sub !== id && currentUser.userId !== id) {
      throw new ForbiddenException('No tienes permisos para ver este usuario');
    }

    return this.findOne(id);
  }

  async create(data: Record<string, unknown>) {
    const user = await this.prisma.user.create({
      data: await this.toUserData(data) as Prisma.UserUncheckedCreateInput,
      include: { role: true },
    });

    return this.withoutPassword(user);
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: await this.toUserData(data, true),
      include: { role: true },
    });

    return this.withoutPassword(user);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });

    return { message: 'Usuario eliminado correctamente' };
  }

  private async toUserData(
    data: Record<string, unknown>,
    partial = false,
  ): Promise<Prisma.UserUncheckedCreateInput | Prisma.UserUncheckedUpdateInput> {
    const user: Prisma.UserUncheckedCreateInput | Prisma.UserUncheckedUpdateInput = {};

    if (!partial || data.name !== undefined) user.name = String(data.name ?? '');
    if (!partial || data.email !== undefined) user.email = String(data.email ?? '').trim().toLowerCase();
    if (!partial || data.password !== undefined) {
      user.password = await bcrypt.hash(String(data.password ?? ''), 10);
    }
    if (!partial || data.roleId !== undefined) user.roleId = Number(data.roleId);

    return user;
  }

  private withoutPassword(user: any) {
    if (!user) return user;
    const { password, ...safeUser } = user;

    if (Array.isArray(safeUser.loans)) {
      safeUser.loans = safeUser.loans.map((loan: any) => {
        if (!loan.user) return loan;
        const { password: _password, ...safeLoanUser } = loan.user;
        return { ...loan, user: safeLoanUser };
      });
    }

    return safeUser;
  }
}
