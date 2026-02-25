import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import type { Prisma } from '@prisma/client';
import {
  ZarinpalPaymentRequest,
  ZarinpalPaymentResponse,
  ZarinpalVerificationRequest,
  ZarinpalVerificationResponse,
} from './interfaces/zarinpal.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { computeOrderPricing } from '../orders/utils/pricing.util';

type PendingOrderWithItems = Prisma.PendingOrderGetPayload<{
  include: { items: true };
}>;

type PendingOrderItemRecord = PendingOrderWithItems['items'][number];

type AxiosErrorPayload = {
  errors?: { message?: string };
  message?: string;
};

type AxiosErrorLike = {
  response?: { data?: AxiosErrorPayload };
  message?: string;
};

const extractRemoteMessage = (error: unknown): string | undefined => {
  const axiosLike = error as AxiosErrorLike | undefined;
  return (
    axiosLike?.response?.data?.errors?.message ??
    axiosLike?.response?.data?.message ??
    axiosLike?.message
  );
};

const extractRemotePayload = (error: unknown): unknown => {
  const axiosLike = error as { response?: { data?: unknown } } | undefined;
  return axiosLike?.response?.data ?? error;
};

/**
 * سرویس پرداخت زرین‌پال
 * این سرویس مسئول ارتباط با API زرین‌پال sandbox و مدیریت وضعیت پرداخت‌ها است
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly zarinpalMerchantId: string;
  private readonly zarinpalCallbackUrl: string;
  private readonly clientUrl: string;
  private readonly zarinpalApi = 'https://sandbox.zarinpal.com/pg/v4/payment';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const merchantId = this.configService.get<string>('ZARINPAL_MERCHANT_ID');
    const callbackUrl = this.configService.get<string>('ZARINPAL_CALLBACK');
    const clientUrls = this.configService.get<string>('CLIENT_URL');

    if (!merchantId) throw new Error('Missing ZARINPAL_MERCHANT_ID in environment');
    if (!callbackUrl) throw new Error('Missing ZARINPAL_CALLBACK in environment');
    if (!clientUrls) throw new Error('Missing CLIENT_URL in environment');

    this.zarinpalMerchantId = merchantId;
    this.zarinpalCallbackUrl = callbackUrl;
    this.clientUrl = clientUrls.split(',')[0].trim();
  }

  /**
   * ایجاد درخواست پرداخت جدید (پرداخت آنلاین)
   * @param dto اطلاعات سفارش موقت جهت پرداخت
   * @returns لینک صفحه پرداخت زرین‌پال به همراه شناسه سفارش موقت
   */
  async createPayment(
    dto: CreatePaymentDto,
  ): Promise<{ url: string; pendingOrderId: string }> {
    // ابتدا سفارش موقت را ذخیره می‌کنیم تا فقط بعد از تایید، سفارش اصلی ساخته شود
    const pricing = await computeOrderPricing(this.prisma, dto.items);

    try {
      const declaredTotal = Number(dto.totalAmount ?? 0);
      if (declaredTotal && Math.abs(declaredTotal - pricing.totalAmount) > 1) {
        this.logger.warn(
          '[PaymentService.createPayment] declared total differs from computed total',
          {
            declaredTotal,
            computedTotal: pricing.totalAmount,
          },
        );
      }
    } catch {
      // ignore logging errors
    }

    const pendingOrder = await this.prisma.pendingOrder.create({
      data: {
        tableNumber: dto.tableNumber ?? 'N/A',
        paymentMethod: dto.paymentMethod,
        subtotal: pricing.subtotal,
        serviceFee: pricing.serviceFee,
        taxMultiplier: pricing.taxMultiplier,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        notes: dto.notes ?? null,
        items: {
          create: pricing.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            unitPriceFinal: item.unitPriceFinal,
            totalPriceFinal: item.totalPriceFinal,
            taxAmount: item.taxAmount,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    try {
      const totalAmountNumber = Number(pendingOrder.totalAmount);
      const amountInRials = totalAmountNumber * 10;

      this.logger.log(
        `Creating payment for pending order ${pendingOrder.id}, amount: ${totalAmountNumber} Tomans (${amountInRials} Rials)`,
      );

      const paymentData: ZarinpalPaymentRequest = {
        merchant_id: this.zarinpalMerchantId,
        amount: amountInRials,
        callback_url: `${this.zarinpalCallbackUrl}?pendingOrderId=${pendingOrder.id}`,
        description: `پرداخت سفارش موقت ${pendingOrder.id}`,
        metadata: {
          order_id: pendingOrder.id,
        },
      };

      const response: AxiosResponse<ZarinpalPaymentResponse> =
        await firstValueFrom(
          this.httpService.post<ZarinpalPaymentResponse>(
            `${this.zarinpalApi}/request.json`,
            paymentData,
          ),
        );

      const data = response.data;

      if (data.data.code !== 100) {
        this.logger.error(
          `Zarinpal error: ${data.data.code} - ${data.data.message}`,
        );
        throw new BadRequestException(
          `خطا در اتصال به درگاه پرداخت: ${data.data.message}`,
        );
      }

      const authority = data.data.authority;
      this.logger.log(
        `Payment authority created for pending order ${pendingOrder.id}: ${authority}`,
      );

      await this.prisma.pendingOrder.update({
        where: { id: pendingOrder.id },
        data: {
          authorityCode: authority,
        },
      });

      return {
        url: `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
        pendingOrderId: pendingOrder.id,
      };
    } catch (error) {
      const remoteMessage = extractRemoteMessage(error);
      this.logger.error(
        'Error in createPayment for pending order:',
        extractRemotePayload(error),
      );

      try {
        await this.prisma.pendingOrder.delete({
          where: { id: pendingOrder.id },
        });
      } catch (cleanupError) {
        this.logger.error(
          'Error deleting pending order after payment creation failure:',
          cleanupError,
        );
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `خطا در ایجاد درگاه پرداخت${remoteMessage ? `: ${remoteMessage}` : ''}`,
      );
    }
  }

  /**
   * تایید پرداخت پس از بازگشت از زرین‌پال
   * @param authority کد Authority دریافتی از زرین‌پال
   * @param pendingOrderId شناسه سفارش موقت
   * @returns وضعیت موفقیت و لینک بازگشت
   */
  async verifyPayment(
    authority: string,
    pendingOrderId: string,
    origin?: string,
  ): Promise<{
    success: boolean;
    redirectUrl: string;
    refId?: number;
    orderId?: string;
  }> {
    try {
      const pendingOrder = await this.prisma.pendingOrder.findUnique({
        where: { id: pendingOrderId },
        include: { items: true },
      });

      if (!pendingOrder) {
        throw new NotFoundException('سفارش موقت یافت نشد');
      }

      if (
        pendingOrder.authorityCode &&
        pendingOrder.authorityCode !== authority
      ) {
        this.logger.error(
          `Authority mismatch: ${authority} !== ${pendingOrder.authorityCode} for pending order ${pendingOrderId}`,
        );
        throw new BadRequestException('کد تراکنش نامعتبر است');
      }

      // تبدیل مبلغ از تومان به ریال برای تایید پرداخت
      const totalAmountNumber = Number(pendingOrder.totalAmount);
      const amountInRials = totalAmountNumber * 10;

      this.logger.log(
        `Verifying payment for pending order ${pendingOrderId}, authority: ${authority}, amount: ${totalAmountNumber} Tomans (${amountInRials} Rials)`,
      );

      // آماده‌سازی درخواست تایید
      const verifyData: ZarinpalVerificationRequest = {
        merchant_id: this.zarinpalMerchantId,
        amount: amountInRials,
        authority: authority,
      };

      // ارسال درخواست تایید به زرین‌پال v4
      const response: AxiosResponse<ZarinpalVerificationResponse> =
        await firstValueFrom(
          this.httpService.post<ZarinpalVerificationResponse>(
            `${this.zarinpalApi}/verify.json`,
            verifyData,
          ),
        );

      const data = response.data;

      // بررسی موفقیت پرداخت
      if (data.data.code === 100 || data.data.code === 101) {
        // کد 100: تراکنش موفق
        // کد 101: تراکنش قبلاً تایید شده
        const refId = data.data.ref_id;

        /**
         * ⚠️ توجه: فیلد paymentRefId در schema وجود ندارد
         * در صورت نیاز، باید به schema اضافه شود
         */
        const createdOrder = await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const order = await tx.order.create({
              data: {
                tableNumber: pendingOrder.tableNumber,
                paymentMethod: pendingOrder.paymentMethod,
                subtotal: pendingOrder.subtotal,
                serviceFee: pendingOrder.serviceFee,
                taxMultiplier: pendingOrder.taxMultiplier,
                taxAmount: pendingOrder.taxAmount,
                totalAmount: pendingOrder.totalAmount,
                notes: pendingOrder.notes ?? null,
                trackingCode: authority,
                paymentGatewayRef: refId?.toString() ?? null,
                items: {
                  create: pendingOrder.items.map(
                    (item: PendingOrderItemRecord) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      totalPrice: item.totalPrice,
                      unitPriceFinal: item.unitPriceFinal,
                      totalPriceFinal: item.totalPriceFinal,
                      taxAmount: item.taxAmount,
                    }),
                  ),
                },
              },
            });

            await tx.pendingOrder.delete({
              where: { id: pendingOrder.id },
            });

            return order;
          },
        );

        this.logger.log(
          `Payment verified successfully. RefID: ${refId}, Order: ${createdOrder.id}`,
        );

        // Use origin-specific URL if provided, otherwise fallback to configured URL
        let redirectBaseUrl = this.clientUrl;
        if (origin) {
          const allowedUrls = (process.env.CLIENT_URL || '')
            .split(',')
            .map((url) => url.trim());
          if (allowedUrls.includes(origin)) {
            redirectBaseUrl = origin;
          }
        }

        return {
          success: true,
          redirectUrl: `${redirectBaseUrl}/orders/confirmation?orderId=${createdOrder.id}`,
          refId,
          orderId: createdOrder.id,
        };
      } else {
        // پرداخت ناموفق
        this.logger.error(
          `Payment verification failed: ${data.data.code} - ${data.data.message}`,
        );

        await this.prisma.pendingOrder.delete({
          where: { id: pendingOrder.id },
        });

        return {
          success: false,
          redirectUrl: `${this.clientUrl}/orders/failure?pendingOrderId=${pendingOrder.id}`,
        };
      }
    } catch (error) {
      const remoteMessage = extractRemoteMessage(error);
      this.logger.error('Error in verifyPayment:', extractRemotePayload(error));

      // در صورت خطا، سفارش را لغو می‌کنیم
      try {
        await this.prisma.pendingOrder.delete({
          where: { id: pendingOrderId },
        });
      } catch (updateError) {
        this.logger.error(
          'Error deleting pending order after payment error:',
          updateError,
        );
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `خطا در تایید پرداخت${remoteMessage ? `: ${remoteMessage}` : ''}`,
      );
    }
  }

  /**
   * لغو کردن سفارش (وقتی کاربر پرداخت را لغو می‌کند)
   * @param orderId شناسه سفارش
   */
  async cancelPendingOrder(pendingOrderId: string): Promise<void> {
    try {
      await this.prisma.pendingOrder.delete({
        where: { id: pendingOrderId },
      });
      this.logger.log(
        `Pending order ${pendingOrderId} deleted successfully after cancel`,
      );
    } catch (error) {
      this.logger.error(
        `Error cancelling pending order ${pendingOrderId}:`,
        error,
      );
      throw new BadRequestException('خطا در لغو سفارش موقت');
    }
  }
}
