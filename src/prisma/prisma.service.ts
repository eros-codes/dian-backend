import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    // Determine the database URL from ConfigService or process.env
    const url = configService.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;

    // In production, fail early with a clear message if DATABASE_URL is missing
    if (!url && process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variable DATABASE_URL');
    }

    // If a URL is available, pass it as a datasource to PrismaClient constructor.
    // Otherwise call super() without datasources so Prisma uses process.env at runtime.
    if (url) {
      super({ datasources: { db: { url } } } as any);
      this.logger.log('PrismaClient configured with explicit datasource URL');
    } else {
      super();
      this.logger.log('PrismaClient configured to read datasource URL from process.env at runtime');
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
