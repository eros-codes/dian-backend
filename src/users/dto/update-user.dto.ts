import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleEnum } from '../../common/enums/role.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User email address (must be unique)',
    example: 'newemail@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'New password',
    example: 'newSecurePassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'Jane',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Smith',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'User role in the system. Changes access level and admin panel permissions.',
    enum: RoleEnum,
    examples: {
      promoteToAdmin: {
        summary: 'Promote to Administrator',
        value: RoleEnum.ADMIN,
        description: 'Grant full system access',
      },
      demoteToUser: {
        summary: 'Demote to User',
        value: RoleEnum.USER,
        description: 'Restrict to frontend-only access',
      },
      setPrimary: {
        summary: 'Set as Primary Admin',
        value: RoleEnum.PRIMARY,
        description: 'Grant admin panel access with most features',
      },
      setSecondary: {
        summary: 'Set as Secondary Admin',
        value: RoleEnum.SECONDARY,
        description: 'Grant limited admin panel access',
      },
    },
  })
  @IsEnum(RoleEnum)
  @IsOptional()
  role?: RoleEnum;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'User IBAN (optional, up to 26 chars)',
    example: 'IR861234567890123456789012',
    maxLength: 26,
  })
  @IsString()
  @IsOptional()
  iban?: string | null;
}
