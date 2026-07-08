import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccessService } from './access.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Roles('ADMIN')
  @Get('roles')
  findRoles() {
    return this.accessService.findRoles();
  }

  @Roles('ADMIN')
  @Post('roles')
  createRole(@Body() data: Record<string, unknown>) {
    return this.accessService.createRole(data);
  }

  @Roles('ADMIN')
  @Get('permissions')
  findPermissions() {
    return this.accessService.findPermissions();
  }

  @Roles('ADMIN')
  @Post('permissions')
  createPermission(@Body() data: Record<string, unknown>) {
    return this.accessService.createPermission(data);
  }
}
