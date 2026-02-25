import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  Authority: string;

  @IsString()
  @IsNotEmpty()
  Status: string;

  @IsString()
  @IsOptional()
  orderId?: string;
}
