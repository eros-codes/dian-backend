import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Length,
  Matches,
} from 'class-validator';
import { RoleEnum } from '../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'Username (must be unique)',
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

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  lastName!: string;

  @ApiProperty({
    description:
      'User role in the system. Determines access level and admin panel permissions.',
    enum: RoleEnum,
    examples: {
      admin: {
        summary: 'System Administrator',
        value: RoleEnum.ADMIN,
        description: 'Full system access with all admin panel permissions',
      },
      primary: {
        summary: 'Primary Admin',
        value: RoleEnum.PRIMARY,
        description: 'Admin panel access with most administrative capabilities',
      },
      secondary: {
        summary: 'Secondary Admin',
        value: RoleEnum.SECONDARY,
        description: 'Limited admin panel access for specific tasks',
      },
      user: {
        summary: 'Frontend User',
        value: RoleEnum.USER,
        description: 'Standard user with frontend-only access',
      },
    },
  })
  @IsEnum(RoleEnum)
  role!: RoleEnum;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
