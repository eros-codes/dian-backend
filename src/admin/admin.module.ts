import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Admin module providing admin panel functionality with role-based access control.
 * Demonstrates the 4-tier role system implementation.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [PrismaService],
  exports: [],
})
export class AdminModule {}
