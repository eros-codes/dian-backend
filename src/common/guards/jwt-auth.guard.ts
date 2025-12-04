import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Log presence of Authorization header to help debug 401s during development
    try {
      const req = context.switchToHttp().getRequest<Request>();
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        this.logger.warn('No Authorization header present on request');
      } else {
        // Do not log token contents; just note that it's present
        this.logger.log(
          'Authorization header present (will attempt JWT validation)',
        );
      }
    } catch {
      // Non-fatal - best-effort logging
      this.logger.debug('Could not inspect request headers for Authorization');
    }

    const result = super.canActivate(context) as boolean | Promise<boolean>;

    // If super.canActivate returns a Promise, attach a catch to log failures
    if (result instanceof Promise) {
      return result.catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`JWT auth failed: ${message}`);
        throw error;
      });
    }

    if (!result) {
      this.logger.warn('JWT guard returned false (no valid token)');
    }

    return result;
  }
}
