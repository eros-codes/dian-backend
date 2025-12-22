import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class OrdersGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(private readonly redis: RedisService) {
    this.initializeRedisSubscriber();
  }

  afterInit() {
    this.logger.log('Orders gateway initialized');
  }

  private initializeRedisSubscriber() {
    (async () => {
      try {
        let redisClient = this.redis.getClient();
        const start = Date.now();
        while (!redisClient) {
          if (Date.now() - start > 5000) throw new Error('Redis client not available');
          await new Promise((res) => setTimeout(res, 100));
          redisClient = this.redis.getClient();
        }

        const subscriber = redisClient.duplicate();
        await subscriber.connect();

        this.logger.log('🔌 Orders gateway connected to Redis, subscribing to orders:*, products, settings, banners');

        await subscriber.pSubscribe('orders:*', (message: string, channel: string) => {
          try {
            const data = JSON.parse(message);
            // Broadcast to all connected clients
            this.server.emit('orderUpdated', data);
            this.logger.log(`Broadcasted order update from ${channel}`);
          } catch (err) {
            this.logger.error('Failed to parse Redis order message', err as any);
          }
        });

        // products channel
        await subscriber.pSubscribe('products', (message: string, channel: string) => {
          try {
            const data = JSON.parse(message);
            this.server.emit('productUpdated', data);
            this.logger.log(`Broadcasted product update from ${channel}`);
          } catch (err) {
            this.logger.error('Failed to parse Redis product message', err as any);
          }
        });

        // settings channel
        await subscriber.pSubscribe('settings', (message: string, channel: string) => {
          try {
            const data = JSON.parse(message);
            this.server.emit('settingsUpdated', data);
            this.logger.log(`Broadcasted settings update from ${channel}`);
          } catch (err) {
            this.logger.error('Failed to parse Redis settings message', err as any);
          }
        });

        // banners channel
        await subscriber.pSubscribe('banners', (message: string, channel: string) => {
          try {
            const data = JSON.parse(message);
            this.server.emit('bannersUpdated', data);
            this.logger.log(`Broadcasted banners update from ${channel}`);
          } catch (err) {
            this.logger.error('Failed to parse Redis banners message', err as any);
          }
        });
      } catch (err) {
        this.logger.error('Redis subscription error in OrdersGateway', (err as Error).message);
      }
    })();
  }
}
