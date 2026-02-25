import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '../../common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  id!: string;

  @ApiProperty({
    description: 'Username',
    example: 'admin',
  })
  username!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName!: string;

  @ApiProperty({
    description: 'User role in the system',
    enum: RoleEnum,
    example: RoleEnum.USER,
  })
  role!: RoleEnum;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'User account creation timestamp',
    example: '2024-01-15T10:30:00Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'User account last update timestamp',
    example: '2024-01-15T11:45:00Z',
    format: 'date-time',
  })
  updatedAt!: Date;
}
