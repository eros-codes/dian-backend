/**
 * Zarinpal API Interfaces
 * این فایل تایپ‌های TypeScript برای ارتباط با API زرین‌پال را تعریف می‌کند
 */

export interface ZarinpalPaymentRequest {
  merchant_id: string;
  amount: number;
  callback_url: string;
  description: string;
  metadata?: {
    mobile?: string;
    email?: string;
    order_id?: string;
  };
}

export interface ZarinpalPaymentResponse {
  data: {
    code: number;
    message: string;
    authority: string;
    fee_type?: string;
    fee?: number;
  };
  errors: any[];
}

export interface ZarinpalVerificationRequest {
  merchant_id: string;
  amount: number;
  authority: string;
}

export interface ZarinpalVerificationResponse {
  data: {
    code: number;
    message: string;
    card_hash: string;
    card_pan: string;
    ref_id: number;
    fee_type?: string;
    fee?: number;
  };
  errors: any[];
}
