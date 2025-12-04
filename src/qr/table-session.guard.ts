import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QrService, ActiveSession } from './qr.service';

type CookieRecord = Record<string, string>;

function resolveCookies(req: Request): CookieRecord | undefined {
  const possibleCookies = (req as { cookies?: unknown }).cookies;
  if (
    typeof possibleCookies === 'object' &&
    possibleCookies !== null &&
    !Array.isArray(possibleCookies)
  ) {
    return possibleCookies as CookieRecord;
  }
  return undefined;
}

declare module 'express-serve-static-core' {
  interface Request {
    tableSession?: ActiveSession;
  }
}

@Injectable()
export class TableSessionGuard implements CanActivate {
  constructor(private readonly qrService: QrService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    if (req.headers.authorization) {
      // Allow admin/service traffic that authenticates via Authorization header
      return true;
    }

    const sessionId = this.extractSessionId(req);
    if (!sessionId) {
      throw new UnauthorizedException('TABLE_SESSION_REQUIRED');
    }

    const ip = this.getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    const session = await this.qrService.validateActiveSession(
      sessionId,
      ip,
      userAgent,
    );

    req.tableSession = session;
    res.locals.tableSession = session;

    return true;
  }

  private extractSessionId(req: Request): string | undefined {
    const headerSession = req.headers['x-table-session'];
    if (typeof headerSession === 'string' && headerSession.trim().length > 0) {
      return headerSession.trim();
    }

    const cookies = resolveCookies(req);
    if (cookies) {
      const cookieSession = cookies.table_session;
      if (
        typeof cookieSession === 'string' &&
        cookieSession.trim().length > 0
      ) {
        return cookieSession.trim();
      }
    }

    return undefined;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      if (ips.length > 0) {
        return ips[0].trim();
      }
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    return (req.ip || req.socket.remoteAddress || '').toString();
  }
}
