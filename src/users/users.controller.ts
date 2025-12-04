import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MinRole } from '../common/decorators/min-role.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { User } from '../common/decorators/user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserMapper } from '../domain/mappers/user.mapper';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @MinRole(RoleEnum.PRIMARY)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Create a new user account with email, password, and profile information.',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User creation data',
    examples: {
      admin: {
        summary: 'Create admin user',
        value: {
          email: 'admin@example.com',
          password: 'adminPassword123',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isActive: true,
        },
      },
      user: {
        summary: 'Create regular user',
        value: {
          email: 'user@example.com',
          password: 'userPassword123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER',
          isActive: true,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'User created successfully',
    type: UserResponseDto,
    example: {
      id: 'clx1b2c3d4e5f6g7h8i9j0k1',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      isActive: true,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
    },
  })
  @ApiConflictResponse({
    description: 'Email already exists',
    example: {
      statusCode: 409,
      message: 'User with this email already exists',
      error: 'Conflict',
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    example: {
      statusCode: 400,
      message: [
        'email must be an email',
        'password must be longer than or equal to 6 characters',
        'firstName should not be empty',
      ],
      error: 'Bad Request',
    },
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const model = await this.usersService.create(dto);
    return UserMapper.toResponseDto(model);
  }

  @Get()
  @MinRole(RoleEnum.PRIMARY)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieve users with optional filtering by email, name, role, or active status. Supports pagination.',
  })
  @ApiQuery({
    name: 'email',
    description: 'Filter users by email (partial match)',
    required: false,
    example: 'john@example.com',
  })
  @ApiQuery({
    name: 'firstName',
    description: 'Filter users by first name (partial match)',
    required: false,
    example: 'John',
  })
  @ApiQuery({
    name: 'lastName',
    description: 'Filter users by last name (partial match)',
    required: false,
    example: 'Doe',
  })
  @ApiQuery({
    name: 'role',
    description: 'Filter users by role',
    required: false,
    enum: ['ADMIN', 'PRIMARY', 'SECONDARY', 'USER'],
    example: 'USER',
  })
  @ApiQuery({
    name: 'isActive',
    description: 'Filter users by active status',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({
    name: 'skip',
    description: 'Number of users to skip for pagination',
    required: false,
    type: Number,
    example: 0,
  })
  @ApiQuery({
    name: 'take',
    description: 'Number of users to return (max 50)',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
    example: [
      {
        id: 'clx1b2c3d4e5f6g7h8i9j0k1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 'clx1b2c3d4e5f6g7h8i9j0k2',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        isActive: true,
        createdAt: '2024-01-15T11:00:00Z',
        updatedAt: '2024-01-15T11:00:00Z',
      },
    ],
  })
  async findAll(@Query() query: UserQueryDto): Promise<UserResponseDto[]> {
    const models = await this.usersService.findAll(query);
    return models.map((user) => UserMapper.toResponseDto(user));
  }

  // Self routes MUST be registered before parameterized ':id' routes so '/users/me'
  // does not get captured by '/users/:id'.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user (self)',
    description: 'Return the authenticated user profile.',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  async getMe(
    @User('sub') requesterId: string,
  ): Promise<UserResponseDto | null> {
    const model = await this.usersService.findOne(requesterId);
    return model ? UserMapper.toResponseDto(model) : null;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @MinRole(RoleEnum.USER)
  @ApiOperation({
    summary: 'Update current user (self)',
    description:
      'Update limited profile fields of the authenticated user (e.g., IBAN).',
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  async updateMe(
    @User('sub') requesterId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto | null> {
    const safe: UpdateUserDto = {};
    if (typeof dto.iban === 'string' || dto.iban === null) {
      safe.iban = dto.iban;
    }
    const model = await this.usersService.update(requesterId, safe);
    return model ? UserMapper.toResponseDto(model) : null;
  }

  @Get(':id')
  @MinRole(RoleEnum.PRIMARY)
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  @ApiOkResponse({
    description: 'User found successfully',
    type: UserResponseDto,
    example: {
      id: 'clx1b2c3d4e5f6g7h8i9j0k1',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
      isActive: true,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      statusCode: 404,
      message: 'User not found',
      error: 'Not Found',
    },
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto | null> {
    const model = await this.usersService.findOne(id);
    return model ? UserMapper.toResponseDto(model) : null;
  }

  @Patch(':id')
  @MinRole(RoleEnum.PRIMARY)
  @ApiOperation({
    summary: 'Update user',
    description:
      'Update user information. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User update data (all fields optional)',
    examples: {
      updateProfile: {
        summary: 'Update profile information',
        value: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      },
      updateRole: {
        summary: 'Update user role',
        value: {
          role: 'ADMIN',
        },
      },
      deactivateUser: {
        summary: 'Deactivate user account',
        value: {
          isActive: false,
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'User updated successfully',
    type: UserResponseDto,
    example: {
      id: 'clx1b2c3d4e5f6g7h8i9j0k1',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'USER',
      isActive: true,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:45:00Z',
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      statusCode: 404,
      message: 'User not found',
      error: 'Not Found',
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    example: {
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @User('role') requesterRole: RoleEnum,
  ): Promise<UserResponseDto | null> {
    const safeDto: UpdateUserDto = { ...dto };
    // Only ADMIN can change roles or activation status.
    if (requesterRole !== RoleEnum.ADMIN) {
      if ('role' in safeDto) delete safeDto.role;
      if ('isActive' in safeDto) delete safeDto.isActive;
    }
    const model = await this.usersService.update(id, safeDto);
    return model ? UserMapper.toResponseDto(model) : null;
  }

  @Delete(':id')
  @MinRole(RoleEnum.PRIMARY)
  @ApiOperation({
    summary: 'Delete user',
    description:
      'Permanently delete a user account. This action cannot be undone.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier',
    example: 'clx1b2c3d4e5f6g7h8i9j0k1',
  })
  @ApiOkResponse({
    description: 'User deleted successfully',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
      example: { success: true },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    example: {
      statusCode: 404,
      message: 'User not found',
      error: 'Not Found',
    },
  })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const ok = await this.usersService.remove(id);
    return { success: ok };
  }
}
