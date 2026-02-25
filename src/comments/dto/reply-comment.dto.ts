import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReplyCommentDto {
  @IsString({ message: 'پاسخ باید متن باشد' })
  @MinLength(5, { message: 'پاسخ باید حداقل 5 کاراکتر باشد' })
  @MaxLength(2000, { message: 'پاسخ نمی‌تواند بیشتر از 2000 کاراکتر باشد' })
  adminReply: string;
}
