/**
 * User role enumeration defining access levels and permissions.
 *
 * @enum RoleEnum
 * @since 1.0.0
 */
export enum RoleEnum {
  /** Full system administrator with complete access to admin panel and all features */
  ADMIN = 'ADMIN',

  /** Primary administrator with admin panel access and most administrative features */
  PRIMARY = 'PRIMARY',

  /** Secondary administrator with limited admin panel access */
  SECONDARY = 'SECONDARY',

  /** Regular user with frontend-only access, no admin panel permissions */
  USER = 'USER',
}

/**
 * Role hierarchy levels for permission checking.
 * Higher numbers indicate higher privilege levels.
 */
export const ROLE_HIERARCHY = {
  [RoleEnum.USER]: 1,
  [RoleEnum.SECONDARY]: 2,
  [RoleEnum.PRIMARY]: 3,
  [RoleEnum.ADMIN]: 4,
} as const;

/**
 * Roles that have access to admin panel functionality.
 */
export const ADMIN_PANEL_ROLES = [
  RoleEnum.ADMIN,
  RoleEnum.PRIMARY,
  RoleEnum.SECONDARY,
] as const;

/**
 * Roles that are restricted to frontend-only access.
 */
export const FRONTEND_ONLY_ROLES = [RoleEnum.USER] as const;
