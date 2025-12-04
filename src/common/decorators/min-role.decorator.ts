import { SetMetadata } from '@nestjs/common';
import { RoleEnum } from '../enums/role.enum';

/**
 * Decorator to specify minimum role required for an endpoint.
 * Users must have at least the specified role level to access the endpoint.
 *
 * @decorator MinRole
 * @param {RoleEnum} role - Minimum role required
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * @MinRole(RoleEnum.PRIMARY)
 * @Delete('users/:id')
 * deleteUser() {
 *   // Only PRIMARY and ADMIN can access this
 * }
 * ```
 */
export const MIN_ROLE_KEY = 'minRole';
export const MinRole = (role: RoleEnum) => SetMetadata(MIN_ROLE_KEY, role);
