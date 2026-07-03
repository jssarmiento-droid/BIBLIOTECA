import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.loan.findMany({
      include: { user: true, book: true },
      orderBy: { loanDate: 'desc' },
    });
  }

  async findOne(id: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: { user: true, book: true },
    });

    if (!loan) {
      throw new NotFoundException('Prestamo no encontrado');
    }

    return loan;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.loan.create({
      data: this.toLoanData(data) as Prisma.LoanUncheckedCreateInput,
      include: { user: true, book: true },
    });
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    return this.prisma.loan.update({
      where: { id },
      data: this.toLoanData(data, true),
      include: { user: true, book: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.loan.delete({ where: { id } });

    return { message: 'Prestamo eliminado correctamente' };
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
}
