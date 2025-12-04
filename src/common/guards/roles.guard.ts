import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ADMIN_PANEL_KEY } from '../decorators/admin-panel.decorator';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator';
import type { Request } from 'express';
import {
  RoleEnum,
  ROLE_HIERARCHY,
  ADMIN_PANEL_ROLES,
} from '../enums/role.enum';
import { JwtPayload } from '../types/jwt-payload.interface';

type RolesRequest = Request & {
  user?: JwtPayload & {
    roles?: readonly string[] | string[];
  };
};

/**
 * Enhanced roles guard that supports multiple authorization strategies:
 * 1. Specific roles (legacy @Roles decorator)
 * 2. Admin panel access (@AdminPanel decorator)
 * 3. Minimum role level (@MinRole decorator)
 *
 * @class RolesGuard
 * @since 1.0.0
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines if the current user has permission to access the endpoint.
   *
   * @param {ExecutionContext} context - Execution context containing request info
   * @returns {boolean} True if access is granted, false otherwise
   * @throws {ForbiddenException} When access is explicitly denied
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RolesRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check for admin panel access requirement
    const requiresAdminPanel = this.reflector.getAllAndOverride<boolean>(
      ADMIN_PANEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresAdminPanel) {
      const userRole = user.role as RoleEnum;
      const hasAdminAccess = (
        ADMIN_PANEL_ROLES as readonly RoleEnum[]
      ).includes(userRole);
      if (!hasAdminAccess) {
        throw new ForbiddenException(
          'Admin panel access required. Frontend users cannot access this endpoint.',
        );
      }
      return true;
    }

    // Check for minimum role requirement
    const minRole = this.reflector.getAllAndOverride<RoleEnum>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (minRole) {
      const userRoleLevel = ROLE_HIERARCHY[user.role as RoleEnum] ?? 0;
      const requiredRoleLevel = ROLE_HIERARCHY[minRole] ?? 0;

      if (userRoleLevel < requiredRoleLevel) {
        throw new ForbiddenException(
          `Minimum role '${minRole}' required. Current role '${user.role}' is insufficient.`,
        );
      }
      return true;
    }

    // Legacy specific roles check
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((role) => String(role))
      : user.roles
        ? [String(user.roles)]
        : [user.role];
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `One of the following roles is required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
