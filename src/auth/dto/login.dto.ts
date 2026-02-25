import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username',
    example: 'admin',
  })
  @IsString()
  @Length(4, 32)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'Username can only include letters, numbers, dots, underscores, or hyphens',
  })
  username!: string;

  @ApiProperty({
    description: 'User password',
    example: 'securePassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;
}
