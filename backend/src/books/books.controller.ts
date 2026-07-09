import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll() {
    return this.booksService.findAll();
  }

  @Get('/authors/list')
  findAuthors() {
    return this.booksService.findAuthors();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Post('/authors')
  createAuthor(@Body() body: Record<string, unknown>) {
    return this.booksService.createAuthor(body);
  }

  @Get('/categories/list')
  findCategories() {
    return this.booksService.findCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Post('/categories')
  createCategory(@Body() body: Record<string, unknown>) {
    return this.booksService.createCategory(body);
  }

  @Get('/recommendations/new-arrivals')
  findNewArrivals() {
    return this.booksService.findNewArrivals();
  }

  @Get('/recommendations/most-loaned')
  findMostLoaned() {
    return this.booksService.findMostLoaned();
  }

  @Get(':id/recommendations')
  findRecommendations(@Param('id') id: string) {
    return this.booksService.findRecommendations(Number(id));
  }

  @Get(':id/copies')
  findCopies(@Param('id') id: string) {
    return this.booksService.findCopies(Number(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Post(':id/copies')
  createCopy(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.booksService.createCopy(Number(id), body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Patch('/copies/:id')
  updateCopy(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.booksService.updateCopy(Number(id), body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO', 'USUARIO', 'DOCENTE', 'ESTUDIANTE')
  @Post(':id/ratings')
  rateBook(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: any,
  ) {
    return this.booksService.rateBook(Number(id), body, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Post()
  create(@Body() body: any) {
    return this.booksService.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.booksService.update(Number(id), body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.booksService.remove(Number(id));
  }
}
