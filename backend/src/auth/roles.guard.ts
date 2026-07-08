import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();
    const roles = Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = String(request.user?.role ?? '').toUpperCase();

    if (roles.includes(role)) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos para realizar esta acción');
  }
}
