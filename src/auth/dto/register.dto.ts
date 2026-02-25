import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength, IsOptional } from 'class-validator';
import { RoleEnum } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'Username (must be unique)',
    example: 'username123',
  })
  @IsString()
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
      'User role (defaults to USER if not specified). ADMIN/PRIMARY/SECONDARY have admin panel access, USER is frontend-only.',
    enum: RoleEnum,
    examples: {
      admin: {
        summary: 'Full Administrator',
        value: RoleEnum.ADMIN,
        description: 'Complete system access and admin panel permissions',
      },
      primary: {
        summary: 'Primary Administrator',
        value: RoleEnum.PRIMARY,
        description: 'Admin panel access with most administrative features',
      },
      secondary: {
        summary: 'Secondary Administrator',
        value: RoleEnum.SECONDARY,
        description: 'Limited admin panel access',
      },
      user: {
        summary: 'Regular User',
        value: RoleEnum.USER,
        description: 'Frontend-only access, no admin panel permissions',
      },
    },
    required: false,
    default: RoleEnum.USER,
  })
  @IsEnum(RoleEnum)
  @IsOptional()
  role?: RoleEnum;
}
