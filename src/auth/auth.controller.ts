import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { User } from '../common/decorators/user.decorator';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user and issue tokens',
    description:
      'Authenticate a user with email and password. Returns JWT access token (valid for 15 minutes) and refresh token (valid for 7 days) along with user information.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      user: {
        summary: 'Regular user login',
        value: {
          email: 'user@example.com',
          password: 'securePassword123',
        },
      },
      admin: {
        summary: 'Admin user login',
        value: {
          email: 'admin@example.com',
          password: 'adminPassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: {
        id: 'clx1b2c3d4e5f6g7h8i9j0k1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or account deactivated',
    example: {
      statusCode: 401,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    example: {
      statusCode: 400,
      message: [
        'email must be an email',
        'password must be longer than or equal to 6 characters',
      ],
      error: 'Bad Request',
    },
  })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Create a new user account with email, password, and personal information. Returns JWT tokens immediately upon successful registration.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'User registration information',
    examples: {
      user: {
        summary: 'Regular user registration',
        value: {
          email: 'newuser@example.com',
          password: 'securePassword123',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'USER',
        },
      },
      admin: {
        summary: 'Admin user registration',
        value: {
          email: 'newadmin@example.com',
          password: 'adminPassword123',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: {
        id: 'clx1b2c3d4e5f6g7h8i9j0k2',
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'USER',
      },
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
        'lastName should not be empty',
        'role must be one of the following values: ADMIN, USER',
      ],
      error: 'Bad Request',
    },
  })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using a refresh token',
    description:
      'Exchange a valid refresh token for a new access token (and refresh token).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change current user password',
    description:
      'Update the current authenticated user password. Requires the current password for verification and a new password.',
  })
  @ApiBody({
    type: ChangePasswordDto,
    description: 'Current and new password information',
    examples: {
      changePassword: {
        summary: 'Change password example',
        value: {
          currentPassword: 'oldPassword123',
          newPassword: 'newSecurePassword456',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: MessageResponseDto,
    example: {
      message: 'Password changed successfully',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing JWT token',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
    },
  })
  @ApiBadRequestResponse({
    description: 'Current password incorrect or validation errors',
    examples: {
      wrongPassword: {
        summary: 'Wrong current password',
        value: {
          statusCode: 400,
          message: 'Current password is incorrect',
          error: 'Bad Request',
        },
      },
      samePassword: {
        summary: 'Same password provided',
        value: {
          statusCode: 400,
          message: 'New password must be different from current password',
          error: 'Bad Request',
        },
      },
      validation: {
        summary: 'Validation error',
        value: {
          statusCode: 400,
          message: [
            'currentPassword must be longer than or equal to 6 characters',
            'newPassword must be longer than or equal to 6 characters',
          ],
          error: 'Bad Request',
        },
      },
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
  changePassword(
    @Body() dto: ChangePasswordDto,
    @User('sub') userId: string,
  ): Promise<MessageResponseDto> {
    return this.authService.changePassword(dto, userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current user', description: 'Revoke refresh token and blacklist current access token.' })
  logout(@Req() req: any, @Body() dto?: RefreshTokenDto) {
    const authHeader = req?.headers?.authorization ?? null;
    const refreshToken = dto?.refreshToken ?? null;
    return this.authService.logout(authHeader, refreshToken);
  }
}
