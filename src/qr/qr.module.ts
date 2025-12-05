import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rateStr = config.get<string>('QR_MAX_CONSUME_RATE');
        if (!rateStr) throw new Error('Missing QR_MAX_CONSUME_RATE in environment');
        const limit = parseInt(rateStr, 10);
        return {
          throttlers: [
            {
              name: 'default',
              ttl: 60000, // 60 seconds
              limit,
            },
          ],
        } as any;
      },
    }),
  ],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
