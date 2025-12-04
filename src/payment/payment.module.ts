import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * ماژول پرداخت زرین‌پال
 * این ماژول تمام وابستگی‌های لازم برای پرداخت آنلاین را فراهم می‌کند
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
    }),
    ConfigModule,
    PrismaModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService], // در صورت نیاز به استفاده در ماژول‌های دیگر
})
export class PaymentModule {}
