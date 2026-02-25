import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'http';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? 'UNKNOWN';
    const startedAt = Date.now();

    // Conditional debug logging controlled by DEBUG_NETWORK env var
    const debug =
      String(process.env.DEBUG_NETWORK ?? '')
        .trim()
        .toLowerCase() === 'true';

    if (!debug) {
      return next.handle();
    }

    // If debug enabled, log origin and path, and timing when the response completes
    const origin = extractHeaderValue(request.headers, 'origin');

    console.log(`[api.debug] incoming ${method} ${url} origin=${origin}`);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - startedAt;

        console.log(`[api.debug] handled ${method} ${url} in ${ms}ms`);
      }),
    );
  }
}

function extractHeaderValue(
  headers: IncomingHttpHeaders,
  key: string,
): string | null {
  const direct = headers[key];
  if (typeof direct === 'string') {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct.join(',');
  }

  const caseInsensitiveKey = Object.keys(headers).find(
    (headerKey) => headerKey.toLowerCase() === key.toLowerCase(),
  );

  if (!caseInsensitiveKey) {
    return null;
  }

  const value = headers[caseInsensitiveKey];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(',');
  }

  return null;
}
