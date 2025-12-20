import { Controller, Get, Param } from '@nestjs/common';
import { SharedCartGateway } from './shared-cart.gateway';

@Controller('internal/debug')
export class SharedCartDebugController {
  constructor(private gateway: SharedCartGateway) {}

  @Get('room/:tableId')
  getRoomClients(@Param('tableId') tableId: string) {
    const clients = this.gateway.getTableClientsCount(tableId || '');
    return { tableId, clients };
  }
}
