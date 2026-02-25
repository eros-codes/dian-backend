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
    const url = configService.get<string>('DATABASE_URL');

    // Always require DATABASE_URL to be provided via environment/config
    if (!url) {
      throw new Error('Missing required environment variable DATABASE_URL');
    }

    // Pass explicit datasource to Prisma so it's deterministic
    super({ datasources: { db: { url } } } as any);
    this.logger.log('PrismaClient configured with explicit datasource URL');
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
