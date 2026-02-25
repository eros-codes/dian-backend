import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

/**
 * کنترلر پرداخت زرین‌پال
 * این کنترلر endpoint های لازم برای شروع و تایید پرداخت را فراهم می‌کند
 */
@Controller('pay')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * ایجاد درخواست پرداخت
   * POST /api/pay/create
   * @param createPaymentDto شامل orderId
   * @returns لینک صفحه پرداخت زرین‌پال
   */
  @Post('create')
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    this.logger.log(
      `Creating payment (online) for table: ${createPaymentDto.tableNumber ?? 'N/A'}, amount: ${createPaymentDto.totalAmount}`,
    );

    try {
      const result = await this.paymentService.createPayment(createPaymentDto);

      return {
        success: true,
        url: result.url,
        pendingOrderId: result.pendingOrderId,
        message: 'لینک پرداخت با موفقیت ایجاد شد',
      };
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Payment create failed');
      this.logger.error('Error creating payment:', err);

      return {
        success: false,
        message: err.message || 'خطا در ایجاد درگاه پرداخت',
      };
    }
  }

  /**
   * لغو سفارش موقت هنگام بازگشت کاربر از درگاه پرداخت بدون تکمیل
   * POST /api/pay/cancel
   */
  @Post('cancel')
  async cancelPendingOrder(@Body('pendingOrderId') pendingOrderId?: string) {
    if (!pendingOrderId) {
      throw new BadRequestException('pendingOrderId is required');
    }

    await this.paymentService.cancelPendingOrder(pendingOrderId);

    return {
      success: true,
      message: 'سفارش موقت با موفقیت حذف شد',
    };
  }

  /**
   * Callback زرین‌پال - تایید پرداخت
   * GET /api/pay/callback?Authority=...&Status=...&orderId=...
   *
   * این endpoint توسط زرین‌پال پس از پرداخت کاربر فراخوانی می‌شود
   * کاربر به صفحه موفقیت یا شکست در frontend ریدایرکت می‌شود
   */
  @Get('callback')
  async verifyPayment(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Query('pendingOrderId') pendingOrderId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    this.logger.log(
      `Payment callback received - Authority: ${authority}, Status: ${status}, PendingOrderId: ${pendingOrderId}`,
    );

    // Log all query parameters for debugging
    this.logger.debug('Full callback query params:', req.query);

    try {
      // اگر کاربر پرداخت را لغو کرده باشد
      if (status !== 'OK') {
        this.logger.warn(
          `Payment cancelled by user for pending order: ${pendingOrderId}`,
        );

        // لغو سفارش در دیتابیس
        await this.paymentService.cancelPendingOrder(pendingOrderId);

        // ریدایرکت به صفحه پرداخت ناموفق
        // Use origin-specific URL if available
        let redirectBaseUrl =
          process.env.CLIENT_URL?.split(',')[0].trim() ||
          'http://localhost:3001';
        if (req.headers.origin) {
          const allowedUrls = (process.env.CLIENT_URL || '')
            .split(',')
            .map((url) => url.trim());
          if (allowedUrls.includes(req.headers.origin)) {
            redirectBaseUrl = req.headers.origin;
          }
        }

        return res.redirect(
          `${redirectBaseUrl}/orders/failure?pendingOrderId=${pendingOrderId}&reason=cancelled`,
        );
      }

      // تایید پرداخت با زرین‌پال
      const result = await this.paymentService.verifyPayment(
        authority,
        pendingOrderId,
        req.headers.origin,
      );

      // ریدایرکت به صفحه مناسب
      return res.redirect(result.redirectUrl);
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Payment callback failed');
      this.logger.error('Error in payment callback:', err);

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';

      return res.redirect(
        `${clientUrl}/orders/failure?pendingOrderId=${pendingOrderId}&reason=error`,
      );
    }
  }

  /**
   * بررسی وضعیت پرداخت (اختیاری - برای دیباگ)
   * GET /api/pay/status/:orderId
   */
  @Get('status/:orderId')
  checkPaymentStatus(@Query('orderId') orderId: string) {
    // این endpoint را می‌توانید برای دیباگ استفاده کنید
    // در production ممکن است نیاز باشد authentication اضافه کنید
    return {
      message: 'این endpoint برای دیباگ است',
      orderId,
    };
  }
}
