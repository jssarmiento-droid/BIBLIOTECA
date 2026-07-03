import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  findRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createRole(data: Record<string, unknown>) {
    return this.prisma.role.create({
      data: {
        name: String(data.name ?? ''),
        description:
          data.description === undefined ? undefined : String(data.description),
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  findPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
  }

  createPermission(data: Record<string, unknown>) {
    return this.prisma.permission.create({
      data: {
        name: String(data.name ?? ''),
        description:
          data.description === undefined ? undefined : String(data.description),
      },
    });
  }
}
