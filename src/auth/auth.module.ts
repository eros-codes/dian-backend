import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersRepository } from '../users/users.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RefreshTokenRepository } from './refresh-token.repository';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // If RSA key paths are provided, use RS256
        const privateKeyPath = configService.get<string>('JWT_PRIVATE_KEY_PATH');
        const publicKeyPath = configService.get<string>('JWT_PUBLIC_KEY_PATH');

        if (privateKeyPath && publicKeyPath) {
          const privateKey = readFileSync(privateKeyPath, 'utf8');
          const publicKey = readFileSync(publicKeyPath, 'utf8');
          return {
            global: true,
            privateKey,
            publicKey,
            signOptions: {
              algorithm: 'RS256',
              expiresIn: configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY') || '15m',
              issuer: configService.get<string>('JWT_ISSUER') || 'cafe-api',
              audience: configService.get<string>('JWT_AUDIENCE') || 'cafe-client',
            },
            verifyOptions: {
              algorithms: ['RS256'],
            },
          } as any;
        }

        // Fallback to HS256 using env secret
        return {
          global: true,
          secret: configService.get<string>('JWT_ACCESS_SECRET') || 'change-me',
          signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY') || '2h' },
        } as any;
      },
    }),
    PrismaModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UsersRepository, RefreshTokenRepository],
  exports: [AuthService],
})
export class AuthModule {}
