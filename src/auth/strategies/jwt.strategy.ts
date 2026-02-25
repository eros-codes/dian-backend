import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../../users/users.repository';
import { RedisService } from '../../redis/redis.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly redisService: RedisService,
  ) {
    // Determine whether to use RS256 (public key) or HS256 (secret)
    const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
    let secretOrKey: string | Buffer | undefined;
    let algorithms: string[] | undefined;

    if (publicKey) {
      secretOrKey = publicKey;
      algorithms = ['RS256'];
    } else {
      const secret = configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) throw new Error('Missing JWT_ACCESS_SECRET in environment');
      secretOrKey = secret;
      algorithms = ['HS256'];
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
      // cast algorithms to any to satisfy Strategy type differences across versions
      algorithms: algorithms as any,
      issuer: configService.get<string>('JWT_ISSUER'),
      audience: configService.get<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: JwtPayload) {
    // Simple blacklist check using Redis (expects key `blacklist:<jti>`)
    try {
      if (payload && payload.jti) {
        const black = await this.redisService.get(`blacklist:${payload.jti}`);
        if (black === '1') {
          throw new UnauthorizedException('Token revoked');
        }
      }
    } catch (err) {
      // If Redis is unavailable, prefer to fail-safe by allowing (to avoid outage) but log
      // In higher-security posture, you may want to deny when Redis is down
      // For now, continue if Redis errors
      // eslint-disable-next-line no-console
      console.warn('Redis blacklist check failed:', (err as Error).message);
    }

    // Validate user existence
    if (!payload || !payload.sub) throw new UnauthorizedException('Invalid token');
    const user = await this.usersRepository.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    // Return sanitized payload for request.user
    return { userId: payload.sub, username: payload.username, role: payload.role, jti: payload.jti };
  }
}
