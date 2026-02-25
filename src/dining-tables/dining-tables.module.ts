import { Module } from '@nestjs/common';
import { DiningTablesController } from './dining-tables.controller';
import { DiningTablesService } from './dining-tables.service';
import { DiningTablesRepository } from './dining-tables.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DiningTablesController],
  providers: [DiningTablesService, DiningTablesRepository],
  exports: [DiningTablesService],
})
export class DiningTablesModule {}
