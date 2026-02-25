import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SharedCartService } from './shared-cart.service';

interface AddItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  baseUnitPrice: number;
  optionsSubtotal?: number;
  options?: { id?: number; name: string; additionalPrice: number }[];
}

interface UpdateQuantityDto {
  quantity: number;
}

@Controller('shared-carts')
export class SharedCartController {
  constructor(private readonly sharedCartService: SharedCartService) {}

  @Get(':tableId')
  async getCart(@Param('tableId') tableId: string) {
    try {
      return await this.sharedCartService.getOrCreateCart(tableId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  @Post(':tableId/items')
  async addItem(@Param('tableId') tableId: string, @Body() dto: AddItemDto) {
    try {
      if (!dto.productId || dto.quantity <= 0 || !dto.unitPrice) {
        throw new BadRequestException(
          'Missing or invalid required fields: productId, quantity, unitPrice',
        );
      }

      return await this.sharedCartService.addItem(tableId, {
        productId: dto.productId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        baseUnitPrice: dto.baseUnitPrice || dto.unitPrice,
        optionsSubtotal: dto.optionsSubtotal || 0,
        options: dto.options || [],
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  @Put(':tableId/items/:itemId')
  async updateQuantity(
    @Param('tableId') tableId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuantityDto,
  ) {
    try {
      if (!Number.isInteger(dto.quantity) || dto.quantity < 0) {
        throw new BadRequestException(
          'Quantity must be a non-negative integer',
        );
      }

      return await this.sharedCartService.updateItemQuantity(
        tableId,
        itemId,
        dto.quantity,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  @Delete(':tableId/items/:itemId')
  async removeItem(
    @Param('tableId') tableId: string,
    @Param('itemId') itemId: string,
  ) {
    try {
      return await this.sharedCartService.removeItem(tableId, itemId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  @Delete(':tableId')
  async clearCart(@Param('tableId') tableId: string) {
    try {
      return await this.sharedCartService.clearCart(tableId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }
}
