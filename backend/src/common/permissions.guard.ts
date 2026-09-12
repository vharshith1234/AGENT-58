import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Action, Resource, Role, can } from './permissions';

export const PERMS_KEY = 'perms';
export const RequirePerm = (resource: Resource, action: Action) =>
  SetMetadata(PERMS_KEY, { resource, action });

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<{
      resource: Resource;
      action: Action;
    }>(PERMS_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const req = context.switchToHttp().getRequest();
    const role = req.user?.role as Role | undefined;
    if (!role || !can(role, required.resource, required.action)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
