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

  @Roles('ADMIN', 'BIBLIOTECARIO', 'USUARIO')
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.loansService.findAllForUser(user);
  }

  @Roles('ADMIN', 'BIBLIOTECARIO', 'USUARIO')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loansService.findOneForUser(Number(id), user);
  }

  @Roles('ADMIN', 'BIBLIOTECARIO', 'USUARIO')
  @Post()
  create(@Body() data: Record<string, unknown>, @CurrentUser() user: any) {
    return this.loansService.createForUser(data, user);
  }

  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.loansService.update(Number(id), data);
  }

  @Roles('ADMIN', 'BIBLIOTECARIO')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loansService.remove(Number(id));
  }
}
