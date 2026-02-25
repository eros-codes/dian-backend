// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { networkInterfaces } from 'os';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Response } from 'express';
import cookieParser from 'cookie-parser';
// Load local .env in non-production environments so child processes (prisma migrate, etc.) have access
if (process.env.NODE_ENV !== 'production') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: join(process.cwd(), '.env') });
  } catch (e) {
    // ignore if dotenv is not available
  }
}
// Use dynamic require for `helmet` so builds don't fail if package isn't installed yet
let helmet: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  helmet = require('helmet');
} catch (e) {
  helmet = undefined;
}

function runCommandWithLogs(
  command: string,
  args: string[],
  opts: { required?: boolean; name?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  const logger = new Logger('Startup');
  const label = opts.name ?? `${command} ${args.join(' ')}`;
  logger.log(`Starting: ${label}`);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, ...(opts.env ?? {}) },
    });

    child.stdout.on('data', (chunk: Buffer) => {
      const text: string = chunk.toString();
      text.split('\n').forEach((line) => {
        if (line.trim()) logger.log(`[${label}] ${line}`);
      });
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text: string = chunk.toString();
      text.split('\n').forEach((line) => {
        if (line.trim()) logger.warn(`[${label}] ${line}`);
      });
    });

    child.on('close', (code: number | null) => {
      const ms: number = Date.now() - startedAt;
      if (code === 0) {
        logger.log(`Completed: ${label} in ${ms}ms`);
        resolve();
        return;
      }
      const message = `Failed: ${label} with exit code ${code} after ${ms}ms`;
      if (opts.required) {
        logger.error(message);
        reject(new Error(message));
      } else {
        logger.warn(`${message} (continuing startup)`);
        resolve();
      }
    });

    child.on('error', (err: Error) => {
      const ms: number = Date.now() - startedAt;
      const message = `Error spawning ${label} after ${ms}ms: ${err.message}`;
      if (opts.required) {
        logger.error(message);
        reject(err);
      } else {
        logger.warn(`${message} (continuing startup)`);
        resolve();
      }
    });
  });
}

type ExpressRouterLayer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
};

function extractExpressStack(
  instance: unknown,
): ExpressRouterLayer[] | undefined {
  if (
    typeof instance === 'object' &&
    instance !== null &&
    '_router' in instance &&
    typeof (instance as { _router?: unknown })._router === 'object' &&
    (instance as { _router?: { stack?: unknown } })._router !== null
  ) {
    const router = (instance as { _router?: { stack?: unknown } })._router;
    if (router && Array.isArray((router as { stack?: unknown }).stack)) {
      const stack = (router as { stack?: unknown }).stack;
      if (Array.isArray(stack)) {
        return stack as ExpressRouterLayer[];
      }
    }
  }
  return undefined;
}

function printRegisteredRoutes(app: NestExpressApplication): void {
  const logger = new Logger('Startup');
  try {
    const adapter = app.getHttpAdapter();
    const server = adapter.getInstance?.();
    const stack = extractExpressStack(server);

    if (stack && stack.length > 0) {
      const routes = stack
        .filter((layer) => Boolean(layer.route?.path))
        .map((layer) => {
          const methods = Object.keys(layer.route?.methods ?? {})
            .map((method) => method.toUpperCase())
            .join(',');
          return `${methods} ${layer.route?.path}`;
        });
      logger.log('=== Registered routes ===');
      routes.forEach((route) => logger.log(route));
      logger.log('=========================');
    } else {
      logger.warn(
        'Router structure not detected (non-express or unusual adapter).',
      );
    }
  } catch (error) {
    logger.warn(`Failed to print routes: ${(error as Error).message}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const prismaClientEntry = join(
    process.cwd(),
    'node_modules',
    '@prisma',
    'client',
    'index.js',
  );

  if (!existsSync(prismaClientEntry)) {
    logger.warn(
      'Prisma Client not found. Expected to be generated during build. Proceeding without runtime generation.',
    );
  }

  // Try to run migrations but DON'T break startup on failure (for dev).
  try {
    await runCommandWithLogs(
      'npx',
      ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`],
      {
        required: false, // dev: not required to start
        name: 'prisma migrate deploy',
      },
    );
  } catch (error) {
    logger.warn(
      `prisma migrate deploy failed (ignored in dev). ${(error as Error).message}`,
    );
  }

  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Read allowed origins from environment variable (comma-separated)
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((o) => o.trim())
    : [];

  logger.log(`Allowed CORS origins: ${JSON.stringify(allowedOrigins)}`);

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
    index: false,
    setHeaders(res: Response) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      const requestOrigin = res.req?.headers?.origin as string | undefined;
      if (requestOrigin) {
        // Allow the requesting origin for static assets. This ensures browsers
        // won't block images when the frontend origin differs from the API host.
        // In production, prefer setting `CLIENT_URL` correctly and restricting
        // allowed origins via the main CORS config.
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
      }
    },
  });

  // Also expose static assets under /api/uploads to match clients that
  // construct URLs using the API prefix (e.g. `${API_BASE}/uploads/...`).
  // This prevents 404s when clients include the global `/api` prefix.
  app.useStaticAssets(uploadsDir, {
    prefix: '/api/uploads',
    index: false,
    setHeaders(res: Response) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      const requestOrigin = res.req?.headers?.origin as string | undefined;
      if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
      }
    },
  });

  // Parse cookies so session guards can access table_session
  app.use(cookieParser());

  // Support method override via header or query param for environments
  // where certain HTTP verbs (DELETE/PUT/PATCH) are blocked by a CDN/WAF.
  // Client can send `X-HTTP-Method-Override: DELETE` or `?_method=DELETE`.
  app.use((req, _res, next) => {
    try {
      const override = (req.headers['x-http-method-override'] as string) ||
        (req.query && (req.query as Record<string, unknown>)._method as string);
      if (override && typeof override === 'string') {
        // Mutate method so Nest/Express will route using the overridden verb
        (req as any).method = override.toUpperCase();
      }
    } catch (e) {
      // ignore
    }
    next();
  });

  // Simple access logger to help diagnose network/CORS issues during debugging
  app.use((req, res, next) => {
    try {
      const origin = (req.headers && (req.headers.origin as string)) || '-';
      logger.log(`HTTP ${req.method} ${req.originalUrl} origin=${origin}`);
    } catch (e) {
      // ignore
    }
    next();
  });

  // Apply basic security headers via Helmet
  try {
    app.use(
      helmet({
        contentSecurityPolicy: false, // Disabled here to avoid breaking dev tools; enable CSP in production
      }),
    );
    logger.log('Helmet security headers enabled');
  } catch (e) {
    logger.warn('Failed to enable helmet: ' + (e as Error).message);
  }

  const debugNetwork = String(process.env.DEBUG_NETWORK ?? '').toLowerCase();
  logger.log(`DEBUG_NETWORK=${debugNetwork || 'unset'}`);
  logger.log(
    `Allowed CORS origins (${allowedOrigins.length}): ${allowedOrigins.join(', ')}`,
  );

  const netInfo = networkInterfaces();
  const ipv4Addresses = Object.entries(netInfo)
    .flatMap(([iface, entries]) =>
      (entries ?? [])
        .filter((address) => address.family === 'IPv4')
        .map((address) => ({
          iface,
          address: address.address,
          internal: address.internal,
        })),
    )
    .filter((entry) => !entry.internal);

  if (ipv4Addresses.length === 0) {
    logger.warn(
      'No external IPv4 addresses detected. Server may only be reachable via localhost.',
    );
  } else {
    ipv4Addresses.forEach((entry) =>
      logger.log(
        `IPv4 ${entry.iface}: ${entry.address} (internal=${entry.internal})`,
      ),
    );
  }

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // In production, disallow requests without origin (prevents Postman/curl misuse)
      if (!origin && process.env.NODE_ENV === 'production') {
        callback(new Error('CORS: No origin'), false);
        return;
      }
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Fast fallback: allow same-site systemdian.ir subdomains (admin/app)
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('systemdian.ir')) {
          callback(null, true);
          return;
        }
      } catch (e) {
        // ignore parse errors
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, x-table-session',
  };

  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false },
    }),
  );

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Cafe API')
    .setDescription('E-commerce backend API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  printRegisteredRoutes(app);

  // Default to 4000 in development so it matches the frontend api-real default
  const port = Number(process.env.PORT ?? 4000);
  // Bind to 0.0.0.0 so the server is reachable from LAN IPs (e.g. 192.168.x.x)
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  logger.log(
    `🚀 Nest application is running on: http://${host === '0.0.0.0' ? 'localhost' : host}:${port} (bound to ${host})`,
  );
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});
