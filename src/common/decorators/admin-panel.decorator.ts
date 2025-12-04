import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark endpoints that require admin panel access.
 * Only users with ADMIN, PRIMARY, or SECONDARY roles can access these endpoints.
 *
 * @decorator AdminPanel
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * @AdminPanel()
 * @Get('dashboard')
 * getDashboard() {
 *   // Only admin panel users can access this
 * }
 * ```
 */
export const ADMIN_PANEL_KEY = 'adminPanel';
export const AdminPanel = () => SetMetadata(ADMIN_PANEL_KEY, true);
