import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SELF_SERVICE_ROLES = ['CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE'];
const STAFF_ROLES = ['ADMIN', 'SUBADMIN', 'BIBLIOTECARIO'];
const ACTIVE_LOAN_STATUSES = ['Pendiente', 'Activo', 'Vencido'];
const BASE_LOAN_COST = 2;
const DAILY_FINE = 0.5;

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.loan.findMany({
      include: {
        user: { include: { role: true } },
        book: { include: { author: true, category: true } },
        bookCopy: true,
      },
      orderBy: { loanDate: 'desc' },
    }).then((loans) => loans.map((loan) => this.withoutUserPassword(loan)));
  }

  findAllForUser(user: any) {
    if (SELF_SERVICE_ROLES.includes(this.normalizeRole(user.role))) {
      return this.prisma.loan.findMany({
        where: { userId: Number(user.sub ?? user.userId) },
        include: {
          user: { include: { role: true } },
          book: { include: { author: true, category: true } },
          bookCopy: true,
        },
        orderBy: { loanDate: 'desc' },
      }).then((loans) => loans.map((loan) => this.withoutUserPassword(loan)));
    }

    return this.findAll();
  }

  async findOne(id: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        user: { include: { role: true } },
        book: { include: { author: true, category: true } },
        bookCopy: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    return this.withoutUserPassword(loan);
  }

  async findOneForUser(id: number, user: any) {
    const loan = await this.findOne(id);
    if (SELF_SERVICE_ROLES.includes(this.normalizeRole(user.role)) && loan.userId !== Number(user.sub ?? user.userId)) {
      throw new ForbiddenException('No tienes permisos para ver este préstamo');
    }

    return loan;
  }

  async createForUser(data: Record<string, unknown>, user: any) {
    const role = this.normalizeRole(user.role);
    const userId = SELF_SERVICE_ROLES.includes(role)
      ? Number(user.sub ?? user.userId)
      : Number(data.userId);

    await this.assertUserCanBorrow(userId);
    await this.assertLoanLimit(userId);

    return this.create({
      ...data,
      userId,
      status: SELF_SERVICE_ROLES.includes(role) ? 'Pendiente' : data.status ?? 'Pendiente',
    });
  }

  async create(data: Record<string, unknown>) {
    await this.assertUserCanBorrow(Number(data.userId));
    await this.assertLoanLimit(Number(data.userId));

    const user = await this.prisma.user.findUnique({
      where: { id: Number(data.userId) },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const documentType = String(data.documentType ?? 'Cédula').trim() || 'Cédula';
    const pricing = this.calculatePricing(user.role?.name);

    return this.prisma.loan.create({
      data: this.toLoanData({
        ...data,
        documentType,
        ...pricing,
      }) as Prisma.LoanUncheckedCreateInput,
      include: {
        user: { include: { role: true } },
        book: { include: { author: true, category: true } },
        bookCopy: true,
      },
    }).then((loan) => this.withoutUserPassword(loan));
  }

  async update(id: number, data: Record<string, unknown>) {
    const currentLoan = await this.findOne(id);
    const currentStatus = this.normalizeStatus(currentLoan.status);
    const nextStatus = data.status !== undefined ? this.normalizeStatus(String(data.status)) : currentStatus;
    const updateData = this.toLoanData(data, true);

    if (nextStatus === 'Activo' && currentStatus !== 'Activo') {
      return this.approveLoan(id, currentLoan, updateData);
    }

    if (nextStatus === 'Devuelto' && currentStatus !== 'Devuelto') {
      return this.returnLoan(id, currentLoan, updateData, data);
    }

    const loan = await this.prisma.loan.update({
      where: { id },
      data: { ...updateData, status: data.status !== undefined ? nextStatus : updateData.status },
      include: {
        user: { include: { role: true } },
        book: { include: { author: true, category: true } },
        bookCopy: true,
      },
    });

    return this.withoutUserPassword(loan);
  }

  async requestRenewal(id: number, user: any) {
    const loan = await this.findOneForUser(id, user);
    if (this.normalizeStatus(loan.status) !== 'Activo') {
      throw new BadRequestException('Solo se pueden renovar préstamos activos');
    }

    return this.prisma.loan.update({
      where: { id },
      data: { renewalRequested: true },
      include: { user: { include: { role: true } }, book: true, bookCopy: true },
    }).then((updated) => this.withoutUserPassword(updated));
  }

  async reserveBook(bookId: number, user: any) {
    const userId = Number(user.sub ?? user.userId);
    await this.assertUserCanBorrow(userId);
    await this.assertLoanLimit(userId);

    const existing = await this.prisma.reservation.findFirst({
      where: { userId, bookId, status: 'PENDIENTE' },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.reservation.create({
      data: { userId, bookId, status: 'PENDIENTE' },
      include: { book: true, user: { include: { role: true } } },
    }).then((reservation) => this.withoutUserPassword(reservation));
  }

  findReservations(user: any) {
    const role = this.normalizeRole(user.role);
    const where = STAFF_ROLES.includes(role) ? {} : { userId: Number(user.sub ?? user.userId) };

    return this.prisma.reservation.findMany({
      where,
      include: { book: { include: { author: true, category: true } }, user: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    }).then((reservations) => reservations.map((reservation) => this.withoutUserPassword(reservation)));
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.loan.delete({ where: { id } });

    return { message: 'Préstamo eliminado correctamente' };
  }

  private async approveLoan(id: number, currentLoan: any, updateData: Prisma.LoanUncheckedUpdateInput) {
    await this.assertUserCanBorrow(Number(currentLoan.userId));

    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.bookCopy.findFirst({
        where: { bookId: Number(currentLoan.bookId), status: 'DISPONIBLE' },
        orderBy: { createdAt: 'asc' },
      });

      const book = await tx.book.findUnique({ where: { id: Number(currentLoan.bookId) } });
      if (!copy && (!book || Number(book.stock) <= 0)) {
        throw new BadRequestException('No hay ejemplares disponibles para aprobar este préstamo');
      }

      if (copy) {
        await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'PRESTADO' } });
      }

      if (book && Number(book.stock) > 0) {
        await tx.book.update({
          where: { id: Number(currentLoan.bookId) },
          data: { stock: { decrement: 1 }, available: Number(book.stock) - 1 > 0 },
        });
      }

      const loan = await tx.loan.update({
        where: { id },
        data: {
          ...updateData,
          status: 'Activo',
          bookCopyId: copy?.id ?? currentLoan.bookCopyId ?? undefined,
          dueDate: updateData.dueDate ?? this.calculateDueDate(currentLoan.user?.role?.name ?? currentLoan.user?.role),
        },
        include: {
          user: { include: { role: true } },
          book: { include: { author: true, category: true } },
          bookCopy: true,
        },
      });

      return this.withoutUserPassword(loan);
    });
  }

  private async returnLoan(
    id: number,
    currentLoan: any,
    updateData: Prisma.LoanUncheckedUpdateInput,
    rawData: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (this.normalizeStatus(currentLoan.status) === 'Activo') {
        if (currentLoan.bookCopyId) {
          await tx.bookCopy.update({
            where: { id: Number(currentLoan.bookCopyId) },
            data: { status: 'DISPONIBLE' },
          });
        }

        const book = await tx.book.findUnique({ where: { id: Number(currentLoan.bookId) } });
        await tx.book.update({
          where: { id: Number(currentLoan.bookId) },
          data: { stock: { increment: 1 }, available: true },
        });

        const nextReservation = await tx.reservation.findFirst({
          where: { bookId: Number(currentLoan.bookId), status: 'PENDIENTE' },
          orderBy: { createdAt: 'asc' },
        });

        if (nextReservation && book) {
          await tx.reservation.update({
            where: { id: nextReservation.id },
            data: { status: 'DISPONIBLE', fulfilledAt: new Date() },
          });
        }
      }

      const returnDate = rawData.returnDate ? updateData.returnDate as Date : new Date();
      const fineAmount = this.calculateFine(currentLoan, returnDate);

      const loan = await tx.loan.update({
        where: { id },
        data: {
          ...updateData,
          status: 'Devuelto',
          renewalRequested: false,
          returnDate,
          fineAmount,
        },
        include: {
          user: { include: { role: true } },
          book: { include: { author: true, category: true } },
          bookCopy: true,
        },
      });

      return this.withoutUserPassword(loan);
    });
  }

  private async assertUserCanBorrow(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (String(user.status ?? '').toUpperCase() === 'SUSPENDED') {
      throw new ForbiddenException('Tu cuenta está suspendida y no puede solicitar préstamos');
    }
  }

  private async assertLoanLimit(userId: number) {
    const activeLoans = await this.prisma.loan.count({
      where: {
        userId,
        status: { in: ACTIVE_LOAN_STATUSES },
      },
    });

    if (activeLoans >= 3) {
      throw new ForbiddenException('No puedes tener más de tres préstamos activos o pendientes');
    }
  }

  private calculateDueDate(role: unknown) {
    const normalizedRole = this.normalizeRole(role);
    const days = normalizedRole === 'PROFESOR' ? 30 : normalizedRole === 'ESTUDIANTE' ? 15 : 10;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private calculatePricing(role: unknown) {
    const normalizedRole = this.normalizeRole(role);
    const discountPercent = normalizedRole === 'PROFESOR' ? 100 : normalizedRole === 'ESTUDIANTE' ? 50 : 0;
    const finalCost = Number((BASE_LOAN_COST * (1 - discountPercent / 100)).toFixed(2));

    return {
      baseCost: BASE_LOAN_COST,
      discountPercent,
      finalCost,
      fineAmount: 0,
    };
  }

  private calculateFine(loan: any, returnDate: Date) {
    const role = this.normalizeRole(loan.user?.role?.name ?? loan.user?.role);
    if (role !== 'CLIENTE') return Number(loan.fineAmount ?? 0);
    if (!loan.dueDate) return 0;

    const dueDate = new Date(loan.dueDate);
    if (returnDate <= dueDate) return 0;

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysLate = Math.ceil((returnDate.getTime() - dueDate.getTime()) / millisecondsPerDay);
    return Number((daysLate * DAILY_FINE).toFixed(2));
  }

  private normalizeRole(role: unknown) {
    const value = String(role?.['name'] ?? role ?? '').toUpperCase();
    if (value.includes('SUBADMIN') || value.includes('SUBADMINISTRADOR')) return 'SUBADMIN';
    if (value.includes('ADMIN')) return 'ADMIN';
    if (value.includes('BIBLIOTECARIO') || value.includes('LIBRARIAN')) return 'BIBLIOTECARIO';
    if (value.includes('PROFESOR') || value.includes('DOCENTE') || value.includes('TEACHER')) return 'PROFESOR';
    if (value.includes('ESTUDIANTE') || value.includes('STUDENT')) return 'ESTUDIANTE';
    if (value.includes('CLIENTE') || value.includes('USUARIO') || value.includes('USER')) return 'CLIENTE';
    return 'INVITADO';
  }

  private normalizeStatus(status: unknown) {
    const value = String(status || '').trim().toUpperCase();
    if (['ACTIVE', 'ACTIVO', 'APROBADO', 'APPROVED'].includes(value)) return 'Activo';
    if (['RETURNED', 'DEVUELTO'].includes(value)) return 'Devuelto';
    if (['CANCELLED', 'CANCELADO', 'RECHAZADO', 'REJECTED'].includes(value)) return 'Cancelado';
    if (['OVERDUE', 'VENCIDO'].includes(value)) return 'Vencido';
    if (['PENDING', 'PENDIENTE'].includes(value)) return 'Pendiente';
    return String(status || 'Pendiente');
  }

  private toLoanData(
    data: Record<string, unknown>,
    partial = false,
  ): Prisma.LoanUncheckedCreateInput | Prisma.LoanUncheckedUpdateInput {
    const loan: Prisma.LoanUncheckedCreateInput | Prisma.LoanUncheckedUpdateInput = {};

    if (!partial || data.userId !== undefined) loan.userId = Number(data.userId);
    if (!partial || data.bookId !== undefined) loan.bookId = Number(data.bookId);
    if (data.bookCopyId !== undefined) loan.bookCopyId = data.bookCopyId ? Number(data.bookCopyId) : null;
    if (data.loanDate !== undefined) loan.loanDate = new Date(String(data.loanDate));
    if (data.dueDate !== undefined) loan.dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
    if (data.returnDate !== undefined) {
      loan.returnDate = data.returnDate ? new Date(String(data.returnDate)) : null;
    }
    if (data.status !== undefined) loan.status = String(data.status);
    if (data.documentType !== undefined) loan.documentType = String(data.documentType);
    if (data.baseCost !== undefined) loan.baseCost = Number(data.baseCost);
    if (data.discountPercent !== undefined) loan.discountPercent = Number(data.discountPercent);
    if (data.finalCost !== undefined) loan.finalCost = Number(data.finalCost);
    if (data.fineAmount !== undefined) loan.fineAmount = Number(data.fineAmount);
    if (data.renewalRequested !== undefined) loan.renewalRequested = Boolean(data.renewalRequested);

    return loan;
  }

  private withoutUserPassword(record: any) {
    if (!record?.user) return record;
    const { password, ...safeUser } = record.user;
    return { ...record, user: safeUser };
  }
}
