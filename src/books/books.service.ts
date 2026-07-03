import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.book.findMany({
      include: { author: true, category: true },
      orderBy: { title: 'asc' },
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

  async findOne(id: number) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { author: true, category: true, loans: true },
    });

    if (!book) {
      throw new NotFoundException('Libro no encontrado');
    }

    return book;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.book.create({
      data: this.toBookData(data) as Prisma.BookUncheckedCreateInput,
      include: { author: true, category: true },
    });
  }

  async update(id: number, data: Record<string, unknown>) {
    await this.findOne(id);

    return this.prisma.book.update({
      where: { id },
      data: this.toBookData(data, true),
      include: { author: true, category: true },
    });
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
    if (data.stock !== undefined) book.stock = Number(data.stock);
    if (data.available !== undefined) book.available = Boolean(data.available);
    if (data.imageUrl !== undefined) book.imageUrl = String(data.imageUrl);
    if (!partial || data.authorId !== undefined) book.authorId = Number(data.authorId);
    if (!partial || data.categoryId !== undefined) book.categoryId = Number(data.categoryId);

    return book;
  }
}
