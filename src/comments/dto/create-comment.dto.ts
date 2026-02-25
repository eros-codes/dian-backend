import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'نام نمی‌تواند بیشتر از 100 کاراکتر باشد' })
  name?: string;

  @IsString({ message: 'پیام باید متن باشد' })
  @MinLength(5, { message: 'پیام باید حداقل 5 کاراکتر باشد' })
  @MaxLength(1000, { message: 'پیام نمی‌تواند بیشتر از 1000 کاراکتر باشد' })
  message: string;
}
