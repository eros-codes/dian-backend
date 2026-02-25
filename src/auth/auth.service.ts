import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RedisService } from '../redis/redis.service';
import { UsersRepository } from '../users/users.repository';
import { RoleEnum } from '../common/enums/role.enum';

interface AuthJwtPayload {
  sub: string;
  username: string;
  role: RoleEnum;
}

/**
 * Service responsible for handling authentication operations including login, registration,
 * password management, and JWT token generation.
 *
 * @class AuthService
 * @since 1.0.0
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Logout user by revoking refresh token and blacklisting the access token (by jti).
   * @param accessTokenRaw Full Bearer token string (optional)
   * @param refreshToken Optional refresh token to revoke (if provided)
   */
  async logout(accessTokenRaw?: string | null, refreshToken?: string | null) {
    // Blacklist access token by jti if present
    try {
      if (accessTokenRaw) {
        const token = accessTokenRaw.replace(/^Bearer\s+/i, '').trim();
        const decoded: any = this.jwtService.decode(token) as any;
        if (decoded && decoded.jti) {
          // compute TTL from exp claim if present
          const now = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp ? Math.max(1, decoded.exp - now) : 60 * 60;
          await this.redisService.setex(`blacklist:${decoded.jti}`, ttl, '1');
        }
      }
    } catch (err) {
      console.error('Failed to blacklist access token', err);
    }

    // Revoke provided refresh token (and its family) if provided
    try {
      if (refreshToken) {
        const stored = await this.refreshTokenRepository.findByToken(refreshToken);
        if (stored) {
          await this.refreshTokenRepository.revokeFamily(stored.familyId);
        }
      }
    } catch (err) {
      console.error('Failed to revoke refresh token during logout', err);
    }

    return { message: 'Logged out' };
  }

  /**
   * Authenticates a user with email and password, returning JWT tokens and user information.
   *
   * @async
   * @function login
   * @param {LoginDto} dto - Login credentials containing email and password
   * @returns {Promise<AuthResponseDto>} Authentication response with tokens and user data
   * @throws {UnauthorizedException} When credentials are invalid or account is deactivated
   *
   * @example
   * ```typescript
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'securePassword123'
   * });
   * console.log(result.accessToken); // JWT access token
   * ```
   *
   * @since 1.0.0
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    let user = await this.usersRepository.findByUsername(dto.username);

    // اگر کاربر پیدا نشد، چک کن دیتابیس خالی است یا نه
    if (!user) {
      const userCount = await this.usersRepository.count();

      // اگر دیتابیس خالی است، اولین کاربر را به عنوان ادمین بساز
      if (userCount === 0) {
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

        user = await this.usersRepository.create({
          username: dto.username,
          password: hashedPassword,
          firstName: 'first',
          lastName: 'admin',
          role: RoleEnum.ADMIN,
          isActive: true,
        });

        console.log('First user created as admin:', {
          username: user.username,
          id: user.id,
        });
      } else {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      // کاربر پیدا شد، رمز عبور را چک کن
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const payload: AuthJwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    // persist hashed refresh token for rotation + reuse-detection
    try {
      await this.refreshTokenRepository.create(user.id, refreshToken);
    } catch (err) {
      console.error('Failed to persist refresh token for user', user.id, err);
    }

    try {
      const ma = `${accessToken.slice(0, 6)}...${accessToken.slice(-6)}`;
      const mr = `${refreshToken.slice(0, 6)}...${refreshToken.slice(-6)}`;
      console.log('AuthService.login - issued tokens masked:', {
        access: ma,
        refresh: mr,
        userId: user.id,
      });
    } catch {
      // ignore
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Registers a new user account with email, password, and profile information.
   * Automatically generates JWT tokens upon successful registration.
   *
   * @async
   * @function register
   * @param {RegisterDto} dto - Registration data including email, password, and profile info
   * @returns {Promise<AuthResponseDto>} Authentication response with tokens and user data
   * @throws {ConflictException} When email address is already registered
   *
   * @example
   * ```typescript
   * const result = await authService.register({
   *   email: 'newuser@example.com',
   *   password: 'securePassword123',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   role: RoleEnum.USER
   * });
   * console.log(result.user.id); // New user ID
   * ```
   *
   * @since 1.0.0
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersRepository.findByUsername(
      dto.username,
    );
    if (existingUser) {
      throw new ConflictException('User with this username already exists');
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.usersRepository.create({
      username: dto.username,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role ?? RoleEnum.USER,
      isActive: true,
    });

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    try {
      await this.refreshTokenRepository.create(user.id, refreshToken);
    } catch (err) {
      console.error('Failed to persist refresh token for user (register)', user.id, err);
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Changes the password for an authenticated user after validating the current password.
   * Requires the user to provide their current password for security verification.
   *
   * @async
   * @function changePassword
   * @param {ChangePasswordDto} dto - Password change data with current and new passwords
   * @param {string} userId - ID of the authenticated user requesting password change
   * @returns {Promise<MessageResponseDto>} Success message confirming password change
   * @throws {NotFoundException} When user is not found
   * @throws {BadRequestException} When current password is incorrect or same as new password
   *
   * @example
   * ```typescript
   * const result = await authService.changePassword({
   *   currentPassword: 'oldPassword123',
   *   newPassword: 'newSecurePassword456'
   * }, 'user-id-123');
   * console.log(result.message); // "Password changed successfully"
   * ```
   *
   * @since 1.0.0
   */
  async changePassword(
    dto: ChangePasswordDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.usersRepository.update(userId, {
      password: hashedNewPassword,
    });

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Refresh access token using a valid refresh token. Verifies the refresh token
   * and issues a new access token (+ optionally a new refresh token).
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    // Verify token signature & expiry first
    let payload: AuthJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(
        dto.refreshToken,
      );
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ensure token exists in DB and not revoked
    const stored = await this.refreshTokenRepository.findByToken(dto.refreshToken);
    if (!stored) {
      // token not found -> treat as invalid / possible reuse
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.isRevoked) {
      // token reuse detected: revoke whole family
      try {
        await this.refreshTokenRepository.revokeFamily(stored.familyId);
      } catch (err) {
        console.error('Failed to revoke refresh token family on reuse', stored.familyId, err);
      }
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // find user
    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newPayload: AuthJwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(newPayload);
    const newRefreshToken = await this.jwtService.signAsync(newPayload, {
      expiresIn: '7d',
    });

    // rotate: create new token with same familyId, revoke the used one
    try {
      await this.refreshTokenRepository.create(user.id, newRefreshToken, stored.familyId);
      await this.refreshTokenRepository.revokeToken(stored.id);
    } catch (err) {
      console.error('Failed to rotate refresh token for user', user.id, err);
    }

    try {
      const ma = `${accessToken.slice(0, 6)}...${accessToken.slice(-6)}`;
      const mr = `${newRefreshToken.slice(0, 6)}...${newRefreshToken.slice(-6)}`;
      console.log('AuthService.refresh - refreshed tokens masked:', {
        access: ma,
        refresh: mr,
        userId: user.id,
      });
    } catch {
      // ignore
    }

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
