import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface ClientSession {
  socketId: string;
  tableId: string;
  userId?: string;
  connectedAt: Date;
}

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class SharedCartGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SharedCartGateway.name);
  private clientSessions: Map<string, ClientSession> = new Map();
  private tableSubscriptions: Map<string, Set<string>> = new Map();

  constructor(private redis: RedisService) {
    this.initializeRedisSubscriber();
  }

  private initializeRedisSubscriber() {
    // Subscribe to all cart update channels
    (async () => {
      try {
        // wait for Redis client to be initialized by RedisService
        let redisClient = this.redis.getClient();
        const start = Date.now();
        while (!redisClient) {
          if (Date.now() - start > 5000) {
            throw new Error('Redis client not available');
          }
          // small delay before retrying
          await new Promise((res) => setTimeout(res, 100));
          redisClient = this.redis.getClient();
        }

        const subscriber = redisClient.duplicate();
        await subscriber.connect();

        this.logger.log('🔌 Redis subscriber connected, subscribing to cart:* pattern');

        await subscriber.pSubscribe(
          'cart:*',
          (message: string, channel: string) => {
            try {
              this.logger.log(`📨 Received Redis message on channel: ${channel}`);
              const data = JSON.parse(message) as {
                tableId: string;
                cart: unknown;
              };
              const { tableId, cart } = data;

              // compute room size if possible
              let roomSize = 0;
              try {
                const room = this.server.sockets.adapter.rooms.get(`table:${tableId}`);
                roomSize = room ? room.size : 0;
              } catch (e) {
                // ignore
              }

              // Broadcast to all clients in this table room
              this.server.to(`table:${tableId}`).emit('cartUpdated', {
                cart,
                timestamp: new Date().toISOString(),
              });

              this.logger.log(
                `✅ Broadcasted cart update for table: ${tableId} to socket room 'table:${tableId}' (roomSize=${roomSize})`,
              );
              this.logger.debug(`payload preview: ${JSON.stringify(cart).slice(0, 1000)}`);
            } catch (error) {
              this.logger.error(
                `❌ Failed to parse/emit Redis message: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          },
        );
      } catch (error) {
        this.logger.error(
          `❌ Redis subscription error: ${(error as Error).message}`,
        );
      }
    })();
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const session = this.clientSessions.get(client.id);
    if (session) {
      const tableId = session.tableId;
      const tableClients = this.tableSubscriptions.get(tableId);

      if (tableClients) {
        tableClients.delete(client.id);
        if (tableClients.size === 0) {
          this.tableSubscriptions.delete(tableId);
          this.logger.log(`No more clients for table: ${tableId}`);
        }
      }

      this.clientSessions.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id} (table: ${tableId})`);
    }
  }

  @SubscribeMessage('joinCart')
  handleJoinCart(
    client: Socket,
    payload: { tableId: string; userId?: string },
  ) {
    const { tableId, userId } = payload;

    if (!tableId) {
      client.emit('error', { message: 'tableId is required' });
      return;
    }

    // Store client session
    this.clientSessions.set(client.id, {
      socketId: client.id,
      tableId,
      userId,
      connectedAt: new Date(),
    });

    // Track clients per table
    if (!this.tableSubscriptions.has(tableId)) {
      this.tableSubscriptions.set(tableId, new Set());
    }
    const tableClients = this.tableSubscriptions.get(tableId);
    if (tableClients) {
      tableClients.add(client.id);
    }

    // Join socket.io room
    client.join(`table:${tableId}`);

    // Confirm subscription
    client.emit('cartSubscribed', {
      tableId,
      message: `Subscribed to cart for table ${tableId}`,
      clientsInTable: this.tableSubscriptions.get(tableId)?.size || 0,
    });

    this.logger.log(
      `Client ${client.id} joined cart for table: ${tableId} (total clients: ${this.tableSubscriptions.get(tableId)?.size})`,
    );

    // Notify other clients that someone joined
    this.server.to(`table:${tableId}`).emit('userJoined', {
      userId,
      clientCount: this.tableSubscriptions.get(tableId)?.size || 0,
    });
  }

  @SubscribeMessage('leaveCart')
  handleLeaveCart(client: Socket, payload: { tableId: string }) {
    const { tableId } = payload;
    client.leave(`table:${tableId}`);

    const session = this.clientSessions.get(client.id);
    if (session) {
      this.clientSessions.delete(client.id);
      const tableClients = this.tableSubscriptions.get(tableId);
      if (tableClients) {
        tableClients.delete(client.id);
      }
    }

    this.server.to(`table:${tableId}`).emit('userLeft', {
      clientCount: this.tableSubscriptions.get(tableId)?.size || 0,
    });

    this.logger.log(`Client ${client.id} left cart for table: ${tableId}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): { pong: number } {
    return { pong: Date.now() };
  }

  getTableClientsCount(tableId: string): number {
    return this.tableSubscriptions.get(tableId)?.size || 0;
  }
}
