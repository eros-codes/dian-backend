import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { QrModule } from '../qr/qr.module';
import { TableSessionGuard } from '../qr/table-session.guard';

@Module({
  imports: [PrismaModule, QrModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, TableSessionGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
