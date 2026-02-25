/**
 * JWT payload interface representing the structure of decoded JWT tokens.
 *
 * @interface JwtPayload
 * @since 1.0.0
 */
export interface JwtPayload {
  /** User unique identifier (subject) */
  sub: string;

  /** User email address */
  email: string;

  /** User role */
  role: string;
  /** Optional username for convenience */
  username?: string;
  /** Optional JWT ID for blacklisting */
  jti?: string;
}
