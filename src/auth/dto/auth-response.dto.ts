import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '../../common/enums/role.enum';

class UserInfoDto {
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
    description: 'User role',
    enum: RoleEnum,
    example: RoleEnum.USER,
  })
  role!: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (valid for 15 minutes)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT refresh token (valid for 7 days)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'User information',
    type: UserInfoDto,
  })
  user!: UserInfoDto;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message!: string;
}
