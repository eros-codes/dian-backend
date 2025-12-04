import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'oldPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (must be different from current password)',
    example: 'newSecurePassword456',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
