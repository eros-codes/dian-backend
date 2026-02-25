import { Controller, Get, Post, Delete, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CartService } from './cart.service';

/**
 * Simple controller to GET/POST/DELETE cart data for a session.
 * Expects header `x-table-session` to identify the session.
 */
@Controller('api/cart')
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  @Get('session')
  async getSessionCart(@Headers('x-table-session') sessionId?: string) {
    if (!sessionId) return { ok: false, error: 'missing_session' };
    const json = await this.cartService.getCart(sessionId);
    if (!json) return { ok: true, cart: null };
    try {
      const parsed = JSON.parse(json);
      return { ok: true, cart: parsed };
    } catch (err) {
      this.logger.error('Invalid JSON in stored cart', err as any);
      return { ok: true, cart: null };
    }
  }

  @Post('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async postSessionCart(@Headers('x-table-session') sessionId: string, @Body() body: any) {
    if (!sessionId) return { ok: false, error: 'missing_session' };
    try {
      const raw = body?.cart ?? body;
      // Basic validation: expect { items: [{ productId?, product?, quantity, options? }, ...] }
      const items = Array.isArray(raw?.items) ? raw.items : [];
      const sanitized = items
        .filter((it: any) => it && (it.productId || it.product))
        .map((it: any) => ({ productId: it.productId ?? it.product?.id ?? null, product: it.product ?? null, quantity: Number(it.quantity ?? 1) || 1, options: Array.isArray(it.options) ? it.options : [] }));

      const storeObj = { items: sanitized, totalItems: sanitized.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0) };

      // TTL: accept client-provided ttlSeconds but enforce reasonable bounds; default to 7 days
      const DEFAULT_TTL = 60 * 60 * 24 * 7;
      let ttl = Number(body?.ttlSeconds ?? DEFAULT_TTL) || DEFAULT_TTL;
      if (ttl < 60) ttl = DEFAULT_TTL; // never accept very small TTL

      const json = JSON.stringify(storeObj);
      await this.cartService.setCart(sessionId, json, ttl);
      return;
    } catch (err) {
      this.logger.error('Failed to store cart', err as any);
      return { ok: false, error: 'store_failed' };
    }
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSessionCart(@Headers('x-table-session') sessionId?: string) {
    if (!sessionId) return { ok: false, error: 'missing_session' };
    await this.cartService.deleteCart(sessionId);
    return;
  }
}
