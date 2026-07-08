import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.loan.findMany({
      include: { user: { include: { role: true } }, book: true },
      orderBy: { loanDate: 'desc' },
    }).then((loans) => loans.map((loan) => this.withoutUserPassword(loan)));
  }

  findAllForUser(user: any) {
    if (user.role === 'USUARIO') {
      return this.prisma.loan.findMany({
        where: { userId: Number(user.sub ?? user.userId) },
        include: { user: { include: { role: true } }, book: true },
        orderBy: { loanDate: 'desc' },
      }).then((loans) => loans.map((loan) => this.withoutUserPassword(loan)));
    }

    return this.findAll();
  }

  async findOne(id: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: { user: { include: { role: true } }, book: true },
    });

    if (!loan) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    return this.withoutUserPassword(loan);
  }

  async findOneForUser(id: number, user: any) {
    const loan = await this.findOne(id);
    if (user.role === 'USUARIO' && loan.userId !== Number(user.sub ?? user.userId)) {
      throw new ForbiddenException('No tienes permisos para ver este préstamo');
    }

    return loan;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.loan.create({
      data: this.toLoanData(data) as Prisma.LoanUncheckedCreateInput,
      include: { user: { include: { role: true } }, book: true },
    }).then((loan) => this.withoutUserPassword(loan));
  }

  createForUser(data: Record<string, unknown>, user: any) {
    const payload = { ...data };
    if (user.role === 'USUARIO') {
      payload.userId = Number(user.sub ?? user.userId);
      payload.status = 'Pendiente';
    }

    return this.create(payload);
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    const loan = await this.prisma.loan.update({
      where: { id },
      data: this.toLoanData(data, true),
      include: { user: { include: { role: true } }, book: true },
    });

    return this.withoutUserPassword(loan);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.loan.delete({ where: { id } });

    return { message: 'Préstamo eliminado correctamente' };
  }

  private toLoanData(
    data: Record<string, unknown>,
    partial = false,
  ): Prisma.LoanUncheckedCreateInput | Prisma.LoanUncheckedUpdateInput {
    const loan: Prisma.LoanUncheckedCreateInput | Prisma.LoanUncheckedUpdateInput = {};

    if (!partial || data.userId !== undefined) loan.userId = Number(data.userId);
    if (!partial || data.bookId !== undefined) loan.bookId = Number(data.bookId);
    if (data.loanDate !== undefined) loan.loanDate = new Date(String(data.loanDate));
    if (data.returnDate !== undefined) {
      loan.returnDate = data.returnDate ? new Date(String(data.returnDate)) : null;
    }
    if (data.status !== undefined) loan.status = String(data.status);

    return loan;
  }

  private withoutUserPassword(loan: any) {
    if (!loan?.user) return loan;
    const { password, ...safeUser } = loan.user;
    return { ...loan, user: safeUser };
  }
}
