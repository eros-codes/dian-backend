//app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { RedisService } from './redis/redis.service';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import { UploadModule } from './upload/upload.module';
import { UploadService } from './upload/upload.service';
import { UploadController } from './upload/upload.controller';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { BannersModule } from './banners/banners.module';
import { SalesModule } from './admin/sales/sales.module';
import { FooterSettingsModule } from './footer-settings/footer-settings.module';
import { PaymentModule } from './payment/payment.module';
import { CommentsModule } from './comments/comments.module';
import { RedisModule } from './redis/redis.module';
import { QrModule } from './qr/qr.module';
import { DiningTablesModule } from './dining-tables/dining-tables.module';
import { CartModule } from './cart/cart.module';
// SharedCartModule removed - cart is now client-local only

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In production rely on the environment provided by the host (e.g. Railway).
      // In non-production, load `.env` from project root if present.
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    // Use Redis-backed throttler storage for production-like behavior
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: async (redisService: RedisService) => {
        return {
          throttlers: [{ name: 'global', limit: 100, ttl: 60, blockDuration: 300 }],
          storage: new RedisThrottlerStorage(redisService),
        } as any;
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    AdminModule,
    CategoriesModule,
    UploadModule,
    CloudinaryModule,
    BannersModule,
    SalesModule,
    FooterSettingsModule,
    PaymentModule,
    CommentsModule,
    QrModule,
    DiningTablesModule,
    CartModule,
    // SharedCartModule removed
  ],
  controllers: [AppController, UploadController],
  providers: [
    AppService,
    UploadService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
