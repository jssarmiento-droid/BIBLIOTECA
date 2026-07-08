import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(body: Record<string, unknown>) {
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    return this.createSession(user);
  }

  async register(body: Record<string, unknown>) {
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();

    if (!email || !password || !name) {
      throw new UnauthorizedException('Nombre, correo y contraseña son obligatorios');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo');
    }

    const role = await this.prisma.role.findFirst({
      where: { name: { in: ['Usuario', 'USUARIO', 'User', 'USER'] } },
    });

    if (!role) {
      throw new UnauthorizedException('No se encontró el rol de usuario');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        roleId: role.id,
      },
      include: { role: true },
    });

    return this.createSession(user);
  }

  private createSession(user: any) {
    const safeUser = this.toSafeUser(user);
    const accessToken = this.jwtService.sign({
      sub: safeUser.id,
      userId: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    });

    return { accessToken, user: safeUser };
  }

  private toSafeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: this.normalizeRole(user.role?.name),
    };
  }

  private normalizeRole(role?: string) {
    const value = String(role ?? '').toUpperCase();
    if (value.includes('ADMIN')) return 'ADMIN';
    if (value.includes('BIBLIOTECARIO') || value.includes('LIBRARIAN')) return 'BIBLIOTECARIO';
    if (value.includes('USUARIO') || value.includes('USER') || value.includes('CLIENTE')) return 'USUARIO';
    return 'INVITADO';
  }
}
