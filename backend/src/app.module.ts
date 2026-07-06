import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { LoansModule } from './loans/loans.module';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './access/access.module';

@Module({
  imports: [BooksModule, UsersModule, LoansModule, PrismaModule, AccessModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
