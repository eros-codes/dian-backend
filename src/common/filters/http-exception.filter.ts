import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const logger = new Logger('HttpExceptionFilter');
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    const normalizedMessage = normalizeMessage(message);

    if (isHttpException) {
      logger.warn(
        `HTTP ${status} on ${request.method} ${request.url}: ${normalizedMessage}`,
      );
    } else {
      logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${
          (exception as Error)?.message ?? 'Unknown error'
        }`,
        (exception as Error)?.stack,
      );
    }

    const payload: Record<string, unknown> = {
      success: false,
      path: request.url,
      statusCode: status,
      message: normalizedMessage,
      timestamp: new Date().toISOString(),
    };

    if (typeof message === 'object' && message !== null) {
      payload.details = message;
    }

    response.status(status).json(payload);
  }
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message.map((item) => normalizeMessage(item)).join(', ');
  }

  if (typeof message === 'object' && message !== null) {
    if (
      'message' in message &&
      typeof (message as { message?: unknown }).message === 'string'
    ) {
      return (message as { message: string }).message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return 'Internal server error';
    }
  }

  return 'Internal server error';
}
