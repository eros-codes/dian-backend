import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../types/jwt-payload.interface';

/**
 * Custom decorator to extract user information from JWT token.
 *
 * Usage:
 * - @User() user: JwtPayload - Get the full user object
 * - @User('sub') userId: string - Get just the user ID
 * - @User('email') email: string - Get just the email
 * - @User('role') role: string - Get just the role
 */
type UserDecoratorReturn = JwtPayload | JwtPayload[keyof JwtPayload];

type RequestWithUser = Request & { user?: JwtPayload };

export const User = createParamDecorator<
  keyof JwtPayload | undefined,
  UserDecoratorReturn
>((data, ctx: ExecutionContext): UserDecoratorReturn => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  const { user } = request;

  if (!user) {
    throw new Error(
      'User not found in request. Make sure JwtAuthGuard is applied.',
    );
  }

  return data ? user[data] : user;
});
