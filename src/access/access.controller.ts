import { Body, Controller, Get, Post } from '@nestjs/common';
import { AccessService } from './access.service';

@Controller()
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('roles')
  findRoles() {
    return this.accessService.findRoles();
  }

  @Post('roles')
  createRole(@Body() data: Record<string, unknown>) {
    return this.accessService.createRole(data);
  }

  @Get('permissions')
  findPermissions() {
    return this.accessService.findPermissions();
  }

  @Post('permissions')
  createPermission(@Body() data: Record<string, unknown>) {
    return this.accessService.createPermission(data);
  }
}
