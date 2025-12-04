import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address to send password reset instructions to',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email!: string;
}
