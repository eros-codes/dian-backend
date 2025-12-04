import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  SalesService,
  SalesSummaryItem,
  ClearResetsResult,
  MonthlyMetrics,
} from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('admin/sales')
@Controller('admin')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('sales-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sales summary grouped by product' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ description: 'Sales summary' })
  async getSalesSummary(
    @User('sub') adminId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<SalesSummaryItem[]> {
    const fromRaw = from ? new Date(from) : undefined;
    const toRaw = to ? new Date(to) : undefined;
    const fromDate = fromRaw
      ? new Date(
          fromRaw.getFullYear(),
          fromRaw.getMonth(),
          fromRaw.getDate(),
          0,
          0,
          0,
          0,
        )
      : undefined;
    const toDate = toRaw
      ? new Date(
          toRaw.getFullYear(),
          toRaw.getMonth(),
          toRaw.getDate(),
          23,
          59,
          59,
          999,
        )
      : undefined;
    return this.salesService.getSalesSummary(adminId, fromDate, toDate);
  }

  @Post('sales-reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset sales snapshot for admin' })
  @ApiOkResponse({ description: 'Reset done' })
  async resetSales(@User('sub') adminId: string): Promise<{
    success: true;
    resetAt: Date;
    data: SalesSummaryItem[];
  }> {
    const snapshot = await this.salesService.resetSales(adminId);
    // Return the aggregated summary for the new snapshot range so UI isn't empty
    const summary = await this.salesService.getSalesSummary(
      adminId,
      snapshot.resetAt,
      new Date(),
    );
    return { success: true, resetAt: snapshot.resetAt, data: summary };
  }

  @Post('sales-reset/clear')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear all sales snapshots for admin (undo all resets)',
  })
  @ApiOkResponse({ description: 'Cleared' })
  async clearResets(@User('sub') adminId: string): Promise<{
    success: true;
    deletedCount: number;
    data: SalesSummaryItem[];
  }> {
    const result: ClearResetsResult =
      await this.salesService.clearResets(adminId);
    return {
      success: true,
      deletedCount: result.deletedCount,
      data: result.summary,
    };
  }

  @Get('metrics-monthly')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get monthly metrics (orders, revenue, returns) for current and previous month',
  })
  @ApiOkResponse({ description: 'Monthly metrics' })
  async getMonthlyMetrics(): Promise<{ success: true; data: MonthlyMetrics }> {
    const data = await this.salesService.getMonthlyMetrics();
    return { success: true, data };
  }
}
