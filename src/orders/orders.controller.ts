import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderMapper } from '../domain/mappers/order.mapper';
import { OrderResponseDto } from './dto/order-response.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  private readonly logger = new Logger(OrdersController.name);

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Create a new order with multiple items and shipping information.',
  })
  @ApiBody({
    type: CreateOrderDto,
    description: 'Order creation data',
    examples: {
      singleItem: {
        summary: 'Single item order',
        value: {
          items: [
            {
              productId: 'clx1b2c3d4e5f6g7h8i9j0k2',
              quantity: 2,
              unitPrice: 299.99,
            },
          ],
          shippingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA',
          },
        },
      },
      multipleItems: {
        summary: 'Multiple items order',
        value: {
          items: [
            {
              productId: 'clx1b2c3d4e5f6g7h8i9j0k2',
              quantity: 1,
              unitPrice: 299.99,
            },
            {
              productId: 'clx1b2c3d4e5f6g7h8i9j0k3',
              quantity: 3,
              unitPrice: 29.99,
            },
          ],
          shippingAddress: {
            street: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90210',
            country: 'USA',
          },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    example: {
      statusCode: 400,
      message: ['items should not be empty', 'shippingAddress is required'],
      error: 'Bad Request',
    },
  })
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    try {
      const tableNumber = dto.tableNumber || 'N/A'; // شماره میز از tableNumber
      const model = await this.ordersService.create(tableNumber, dto);
      return OrderMapper.toResponseDto(model);
    } catch (error) {
      const err = error as Error;
      this.logger.error('[create] Failed to create order', err);
      throw err;
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description:
      'Retrieve all orders with optional filtering by status and pagination. For cafe system.',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter orders by status',
    required: false,
    example: 'CONFIRMED',
  })
  @ApiQuery({
    name: 'skip',
    description: 'Number of orders to skip for pagination',
    required: false,
    type: Number,
    example: 0,
  })
  @ApiQuery({
    name: 'take',
    description: 'Number of orders to return (max 50)',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiOkResponse({
    description: 'Orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async findAll(@Query() query: OrderQueryDto): Promise<OrderResponseDto[]> {
    const models = await this.ordersService.findAll(query);
    return models.map((order) => OrderMapper.toResponseDto(order));
  }

  // Removed my-orders endpoint - no longer needed for cafe system

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieve a specific order by its unique identifier, including all order items.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  @ApiOkResponse({
    description: 'Order found successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
    example: {
      statusCode: 404,
      message: 'Order not found',
      error: 'Not Found',
    },
  })
  async findOne(@Param('id') id: string): Promise<OrderResponseDto | null> {
    const model = await this.ordersService.findOne(id);
    return model ? OrderMapper.toResponseDto(model) : null;
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update order status',
    description:
      'Update the status of an existing order (e.g., from CONFIRMED to DELIVERED).',
  })
  @ApiParam({
    name: 'id',
    description: 'Order unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  @ApiBody({
    type: UpdateOrderStatusDto,
    description: 'New order status',
    examples: {
      paid: {
        summary: 'Mark as paid',
        value: {
          status: 'PAID',
        },
      },
      deliver: {
        summary: 'Mark as delivered',
        value: {
          status: 'DELIVERED',
        },
      },
      cancel: {
        summary: 'Cancel order',
        value: {
          status: 'CANCELLED',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Order not found',
    example: {
      statusCode: 404,
      message: 'Order not found',
      error: 'Not Found',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid status transition',
    example: {
      statusCode: 400,
      message: 'Invalid status transition',
      error: 'Bad Request',
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto | null> {
    // No admin authentication needed for cafe system
    const model = await this.ordersService.updateStatus(id, dto);
    return model ? OrderMapper.toResponseDto(model) : null;
  }
}
