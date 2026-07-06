import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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

  @Post('/authors')
  createAuthor(@Body() body: Record<string, unknown>) {
    return this.booksService.createAuthor(body);
  }

  @Get('/categories/list')
  findCategories() {
    return this.booksService.findCategories();
  }

  @Post('/categories')
  createCategory(@Body() body: Record<string, unknown>) {
    return this.booksService.createCategory(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.booksService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.booksService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.booksService.remove(Number(id));
  }
}
