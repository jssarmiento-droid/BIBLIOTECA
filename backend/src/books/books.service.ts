import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.book.findMany({
      include: {
        author: true,
        category: true,
        copies: true,
        ratings: true,
        _count: { select: { loans: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  findNewArrivals() {
    return this.prisma.book.findMany({
      include: { author: true, category: true, ratings: true, copies: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  findMostLoaned() {
    return this.prisma.book.findMany({
      include: {
        author: true,
        category: true,
        ratings: true,
        copies: true,
        _count: { select: { loans: true } },
      },
      orderBy: { loans: { _count: 'desc' } },
      take: 8,
    });
  }

  findAuthors() {
    return this.prisma.author.findMany({
      orderBy: { name: 'asc' },
    });
  }

  findCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  createAuthor(data: Record<string, unknown>) {
    return this.prisma.author.create({
      data: {
        name: String(data.name ?? ''),
        biography:
          data.biography === undefined ? undefined : String(data.biography),
      },
    });
  }

  createCategory(data: Record<string, unknown>) {
    const name = String(data.name ?? '');

    return this.prisma.category.upsert({
      where: { name },
      update: {
        description:
          data.description === undefined ? undefined : String(data.description),
      },
      create: {
        name,
        description:
          data.description === undefined ? undefined : String(data.description),
      },
    });
  }

  async findOne(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        author: true,
        category: true,
        loans: true,
        copies: { orderBy: { code: 'asc' } },
        ratings: { include: { user: { include: { role: true } } }, orderBy: { updatedAt: 'desc' } },
      },
    });

    if (!book) {
      throw new NotFoundException('Libro no encontrado');
    }

    return this.withSafeRatings(book);
  }

  async findRecommendations(id: number) {
    const book = await this.findOne(id);
    const [sameCategory, sameAuthor, mostLoaned, newArrivals] = await Promise.all([
      this.prisma.book.findMany({
        where: { id: { not: id }, categoryId: book.categoryId },
        include: { author: true, category: true, ratings: true, copies: true },
        take: 6,
      }),
      this.prisma.book.findMany({
        where: { id: { not: id }, authorId: book.authorId },
        include: { author: true, category: true, ratings: true, copies: true },
        take: 6,
      }),
      this.findMostLoaned(),
      this.findNewArrivals(),
    ]);

    return {
      sameCategory,
      sameAuthor,
      mostLoaned: mostLoaned.filter((item) => item.id !== id).slice(0, 6),
      newArrivals: newArrivals.filter((item) => item.id !== id).slice(0, 6),
    };
  }

  create(data: Record<string, unknown>) {
    return this.prisma.book.create({
      data: this.toBookData(data) as Prisma.BookUncheckedCreateInput,
      include: { author: true, category: true, copies: true, ratings: true },
    });
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    return this.prisma.book.update({
      where: { id },
      data: this.toBookData(data, true),
      include: { author: true, category: true, copies: true, ratings: true },
    });
  }

  findCopies(bookId: number) {
    return this.prisma.bookCopy.findMany({
      where: { bookId },
      orderBy: { code: 'asc' },
    });
  }

  async createCopy(bookId: number, data: Record<string, unknown>) {
    await this.findOne(bookId);
    const code = String(data.code ?? '').trim();
    if (!code) {
      throw new BadRequestException('El código del ejemplar es obligatorio');
    }

    return this.prisma.bookCopy.create({
      data: {
        bookId,
        code,
        status: this.normalizeCopyStatus(data.status),
        location: data.location === undefined ? undefined : String(data.location),
      },
    });
  }

  async updateCopy(id: number, data: Record<string, unknown>) {
    const copy = await this.prisma.bookCopy.findUnique({ where: { id } });
    if (!copy) {
      throw new NotFoundException('Ejemplar no encontrado');
    }

    return this.prisma.bookCopy.update({
      where: { id },
      data: {
        code: data.code === undefined ? undefined : String(data.code).trim(),
        status: data.status === undefined ? undefined : this.normalizeCopyStatus(data.status),
        location: data.location === undefined ? undefined : String(data.location),
      },
    });
  }

  async rateBook(bookId: number, data: Record<string, unknown>, user: any) {
    const userId = Number(user.sub ?? user.userId);
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('La calificación debe estar entre 1 y 5');
    }

    const completedLoan = await this.prisma.loan.findFirst({
      where: {
        userId,
        bookId,
        status: { in: ['Devuelto', 'RETURNED', 'DEVUELTO'] },
      },
    });

    if (!completedLoan) {
      throw new ForbiddenException('Solo puedes calificar libros que ya devolviste');
    }

    return this.prisma.bookRating.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: { rating, comment: data.comment === undefined ? undefined : String(data.comment) },
      create: {
        userId,
        bookId,
        rating,
        comment: data.comment === undefined ? undefined : String(data.comment),
      },
      include: { user: { include: { role: true } } },
    }).then((bookRating) => this.withoutUserPassword(bookRating));
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.book.delete({ where: { id } });

    return { message: 'Libro eliminado correctamente' };
  }

  private toBookData(
    data: Record<string, unknown>,
    partial = false,
  ): Prisma.BookUncheckedCreateInput | Prisma.BookUncheckedUpdateInput {
    const book: Prisma.BookUncheckedCreateInput | Prisma.BookUncheckedUpdateInput = {};

    if (!partial || data.title !== undefined) book.title = String(data.title ?? '');
    if (!partial || data.isbn !== undefined) book.isbn = String(data.isbn ?? '');
    if (data.description !== undefined) book.description = String(data.description);
    if (data.publicationYear !== undefined) {
      book.publicationYear = data.publicationYear ? Number(data.publicationYear) : null;
    }
    if (data.publisher !== undefined) book.publisher = String(data.publisher);
    if (data.stock !== undefined) book.stock = Number(data.stock);
    if (data.available !== undefined) book.available = Boolean(data.available);
    if (data.imageUrl !== undefined) book.imageUrl = String(data.imageUrl);
    if (!partial || data.authorId !== undefined) book.authorId = Number(data.authorId);
    if (!partial || data.categoryId !== undefined) book.categoryId = Number(data.categoryId);

    return book;
  }

  private normalizeCopyStatus(status: unknown) {
    const value = String(status ?? 'DISPONIBLE').trim().toUpperCase();
    if (['PRESTADO', 'LOANED'].includes(value)) return 'PRESTADO';
    if (['DAÑADO', 'DANADO', 'DAMAGED'].includes(value)) return 'DAÑADO';
    if (['PERDIDO', 'LOST'].includes(value)) return 'PERDIDO';
    if (['MANTENIMIENTO', 'MAINTENANCE'].includes(value)) return 'MANTENIMIENTO';
    return 'DISPONIBLE';
  }

  private withSafeRatings(book: any) {
    if (!book?.ratings) return book;
    return {
      ...book,
      ratings: book.ratings.map((rating: any) => this.withoutUserPassword(rating)),
    };
  }

  private withoutUserPassword(record: any) {
    if (!record?.user) return record;
    const { password, ...safeUser } = record.user;
    return { ...record, user: safeUser };
  }
}
