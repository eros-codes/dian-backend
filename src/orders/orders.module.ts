import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { QrModule } from '../qr/qr.module';
import { TableSessionGuard } from '../qr/table-session.guard';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { OrdersGateway } from './orders.gateway';

@Module({
  imports: [PrismaModule, QrModule, RedisModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, TableSessionGuard, OrdersGateway, RedisService],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
