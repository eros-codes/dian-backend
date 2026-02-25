import { Module } from '@nestjs/common';
import { SharedCartService } from './shared-cart.service';
import { SharedCartController } from './shared-cart.controller';
import { SharedCartDebugController } from './debug.controller';
import { SharedCartGateway } from './shared-cart.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [SharedCartService, SharedCartGateway],
  controllers: [SharedCartController, SharedCartDebugController],
  exports: [SharedCartService, SharedCartGateway],
})
export class SharedCartModule {}
