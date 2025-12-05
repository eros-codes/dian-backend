import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
        const privateKey = configService.get<string>('JWT_PRIVATE_KEY');
        const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
        const accessExpiry = configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY');
        const issuer = configService.get<string>('JWT_ISSUER');
        const audience = configService.get<string>('JWT_AUDIENCE');

        // Prefer RSA keys provided via environment variables
        if (privateKey && publicKey) {
          if (!accessExpiry) throw new Error('Missing JWT_ACCESS_TOKEN_EXPIRY in environment');
          if (!issuer) throw new Error('Missing JWT_ISSUER in environment');
          if (!audience) throw new Error('Missing JWT_AUDIENCE in environment');

          return {
            global: true,
            privateKey,
            publicKey,
            signOptions: {
              algorithm: 'RS256',
              expiresIn: accessExpiry,
              issuer,
              audience,
            },
            verifyOptions: {
              algorithms: ['RS256'],
            },
          } as any;
        }

        // Otherwise require HS256 secret in environment
        const secret = configService.get<string>('JWT_ACCESS_SECRET');
        if (!secret) throw new Error('Missing JWT_ACCESS_SECRET in environment');
        if (!accessExpiry) throw new Error('Missing JWT_ACCESS_TOKEN_EXPIRY in environment');
        if (!issuer) throw new Error('Missing JWT_ISSUER in environment');
        if (!audience) throw new Error('Missing JWT_AUDIENCE in environment');

        return {
          global: true,
          secret,
          signOptions: { expiresIn: accessExpiry, issuer, audience },
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
