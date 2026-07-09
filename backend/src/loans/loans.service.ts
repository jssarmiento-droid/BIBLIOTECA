import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SELF_SERVICE_ROLES = ['USUARIO', 'DOCENTE', 'ESTUDIANTE'];
const STAFF_ROLES = ['ADMIN', 'BIBLIOTECARIO'];

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

    return this.create({
      ...data,
      userId,
      status: SELF_SERVICE_ROLES.includes(role) ? 'Pendiente' : data.status ?? 'Pendiente',
    });
  }

  async create(data: Record<string, unknown>) {
    await this.assertUserCanBorrow(Number(data.userId));

    return this.prisma.loan.create({
      data: this.toLoanData(data) as Prisma.LoanUncheckedCreateInput,
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

      const loan = await tx.loan.update({
        where: { id },
        data: {
          ...updateData,
          status: 'Devuelto',
          renewalRequested: false,
          returnDate: rawData.returnDate ? updateData.returnDate : new Date(),
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

  private calculateDueDate(role: unknown) {
    const days = this.normalizeRole(role) === 'DOCENTE' ? 30 : 7;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private normalizeRole(role: unknown) {
    const value = String(role?.['name'] ?? role ?? '').toUpperCase();
    if (value.includes('ADMIN')) return 'ADMIN';
    if (value.includes('BIBLIOTECARIO') || value.includes('LIBRARIAN')) return 'BIBLIOTECARIO';
    if (value.includes('DOCENTE') || value.includes('TEACHER')) return 'DOCENTE';
    if (value.includes('ESTUDIANTE') || value.includes('STUDENT')) return 'ESTUDIANTE';
    if (value.includes('USUARIO') || value.includes('USER') || value.includes('CLIENTE')) return 'USUARIO';
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
    if (data.renewalRequested !== undefined) loan.renewalRequested = Boolean(data.renewalRequested);

    return loan;
  }

  private withoutUserPassword(record: any) {
    if (!record?.user) return record;
    const { password, ...safeUser } = record.user;
    return { ...record, user: safeUser };
  }
}
