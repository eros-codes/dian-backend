import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardizedResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, unknown>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardizedResponse<T>> {
    return next.handle().pipe(map((data: T) => standardizeResponse<T>(data)));
  }
}

function standardizeResponse<T>(
  data: T,
  message?: string,
): StandardizedResponse<T> {
  if (isStandardizedResponse<T>(data)) {
    return data;
  }

  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

function isStandardizedResponse<T>(
  value: unknown,
): value is StandardizedResponse<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StandardizedResponse<T>>;
  return (
    candidate.success === true &&
    'data' in candidate &&
    typeof candidate.timestamp === 'string'
  );
}
