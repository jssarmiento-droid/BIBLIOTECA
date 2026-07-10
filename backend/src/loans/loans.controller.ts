import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LoansService } from './loans.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO', 'CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.loansService.findAllForUser(user);
  }

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO', 'CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Get('reservations')
  findReservations(@CurrentUser() user: any) {
    return this.loansService.findReservations(user);
  }

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO', 'CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loansService.findOneForUser(Number(id), user);
  }

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO', 'CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Post()
  create(@Body() data: Record<string, unknown>, @CurrentUser() user: any) {
    return this.loansService.createForUser(data, user);
  }

  @Roles('CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Post('reservations')
  reserve(@Body() data: Record<string, unknown>, @CurrentUser() user: any) {
    return this.loansService.reserveBook(Number(data.bookId), user);
  }

  @Roles('CLIENTE', 'USUARIO', 'PROFESOR', 'DOCENTE', 'ESTUDIANTE')
  @Post(':id/renewal')
  requestRenewal(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loansService.requestRenewal(Number(id), user);
  }

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.loansService.update(Number(id), data);
  }

  @Roles('ADMIN', 'SUBADMIN', 'BIBLIOTECARIO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loansService.remove(Number(id));
  }
}
