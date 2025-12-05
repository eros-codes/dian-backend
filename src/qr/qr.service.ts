import {
  Injectable,
  NotFoundException,
  ConflictException,
  GoneException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TokenGenerator } from '../utils/token';

export interface SessionPayload {
  tableId: string;
  tableNumber: string;
  issuedAt: number;
  createdIp: string;
  createdUa: string;
  maxUses: number;
  uses: number;
}

export interface IssueResult {
  token: string;
  deepLink: string;
  ttl: number;
}

export interface ConsumeResult {
  tableId: string;
  tableNumber: string;
  establishedAt: Date;
  sessionId: string;
  sessionExpiresAt: Date;
  sessionTtlSeconds: number;
}

export interface ActiveSession {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  createdAt: number;
  expiresAt: number;
  createdIp: string;
  createdUa: string;
  lastIp: string;
  lastUa: string;
}

/**
 * QR Table Check-in Service
 * سرویس ورود به سیستم با QR کد میز
 */
@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly tokenLength: number;
  private readonly tokenTtl: number;
  private readonly clientUrl: string;
  private readonly bindToIp: boolean;
  private readonly sessionTtl: number;
  private readonly tableCacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private tablesCache: {
    data: Record<string, { id: string; staticId: string; name: string }>;
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    const tokenLengthStr = this.config.get<string>('QR_TOKEN_LENGTH');
    const tokenTtlStr = this.config.get<string>('QR_TOKEN_TTL_SECONDS');
    const clientUrlStr = this.config.get<string>('CLIENT_URL');
    const bindToIpStr = this.config.get<string>('QR_BIND_TO_IP');
    const sessionTtlStr = this.config.get<string>('QR_SESSION_TTL_SECONDS');

    if (!tokenLengthStr) throw new Error('Missing QR_TOKEN_LENGTH in environment');
    if (!tokenTtlStr) throw new Error('Missing QR_TOKEN_TTL_SECONDS in environment');
    if (!clientUrlStr) throw new Error('Missing CLIENT_URL in environment');
    if (bindToIpStr === undefined) throw new Error('Missing QR_BIND_TO_IP in environment');
    if (!sessionTtlStr) throw new Error('Missing QR_SESSION_TTL_SECONDS in environment');

    this.tokenLength = parseInt(tokenLengthStr, 10);
    this.tokenTtl = parseInt(tokenTtlStr, 10);
    // CLIENT_URL may be comma-separated; take first value
    this.clientUrl = clientUrlStr.split(',')[0].trim();
    this.bindToIp = bindToIpStr === 'true';
    this.sessionTtl = parseInt(sessionTtlStr, 10);
  }

  /**
   * Issue a new QR session token
   * صدور توکن جدید برای نشست QR
   */
  async issueToken(
    tableStaticId: string,
    ip: string,
    userAgent: string,
  ): Promise<IssueResult> {
    const table = await this.getTableByStaticId(tableStaticId);
    const tableNumber = table.name;

    // Generate cryptographically-strong token
    const token = TokenGenerator.generateSecureToken(this.tokenLength);
    const key = `table:session:${token}`;

    // Create session payload
    const payload: SessionPayload = {
      tableId: table.staticId,
      tableNumber,
      issuedAt: Date.now(),
      createdIp: ip,
      createdUa: userAgent || 'unknown',
      maxUses: 1,
      uses: 0,
    };

    // Store in Redis with TTL
    await this.redis.setex(key, this.tokenTtl, JSON.stringify(payload));

    // Log to database for analytics
    await this.logSessionEvent({
      token,
      tableId: table.staticId,
      action: 'issue',
      ip,
      ua: userAgent,
      result: 'success',
    });

    const deepLink = `${this.clientUrl}/t/${token}`;

    this.logger.log(
      `Token issued for table ${tableStaticId}: ${token.substring(0, 8)}...`,
    );

    return {
      token,
      deepLink,
      ttl: this.tokenTtl,
    };
  }

  /**
   * Consume a QR session token (atomic, single-use)
   * مصرف توکن نشست QR (اتمیک، یک‌بار مصرف)
   */
  async consumeToken(
    token: string,
    ip: string,
    userAgent: string,
  ): Promise<ConsumeResult> {
    // Validate token format
    if (!TokenGenerator.isValidTokenFormat(token, this.tokenLength)) {
      await this.logSessionEvent({
        token,
        tableId: 'unknown',
        action: 'consume',
        ip,
        ua: userAgent,
        result: 'invalid_format',
      });
      throw new BadRequestException('فرمت توکن نامعتبر است');
    }

    const key = `table:session:${token}`;

    // Atomic GET and DELETE using Lua script
    const payloadStr = await this.redis.getAndDelete(key);

    if (!payloadStr) {
      // Token doesn't exist or already consumed
      await this.logSessionEvent({
        token,
        tableId: 'unknown',
        action: 'consume',
        ip,
        ua: userAgent,
        result: 'not_found_or_expired',
      });
      throw new GoneException('این QR منقضی شده یا قبلاً استفاده شده است');
    }

    let payload: SessionPayload;
    try {
      const parsed = JSON.parse(payloadStr) as Partial<SessionPayload>;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.tableId === 'string' &&
        typeof parsed.tableNumber === 'string' &&
        typeof parsed.issuedAt === 'number' &&
        typeof parsed.createdIp === 'string' &&
        typeof parsed.createdUa === 'string' &&
        typeof parsed.maxUses === 'number' &&
        typeof parsed.uses === 'number'
      ) {
        payload = parsed as SessionPayload;
      } else {
        throw new Error('Invalid payload shape');
      }
    } catch (error) {
      this.logger.error('Failed to parse session payload', error);
      throw new BadRequestException('داده نشست معتبر نیست');
    }

    // Optional: Check IP binding
    if (this.bindToIp && payload.createdIp !== ip) {
      this.logger.warn(
        `IP mismatch for token ${token.substring(0, 8)}...: ${payload.createdIp} vs ${ip}`,
      );
      await this.logSessionEvent({
        token,
        tableId: payload.tableId,
        action: 'consume',
        ip,
        ua: userAgent,
        result: 'ip_mismatch',
      });
      throw new ConflictException('این QR از دستگاه دیگری صادر شده است');
    }

    // Check max uses (redundant since we delete, but good for logging)
    if (payload.uses >= payload.maxUses) {
      await this.logSessionEvent({
        token,
        tableId: payload.tableId,
        action: 'consume',
        ip,
        ua: userAgent,
        result: 'max_uses_exceeded',
      });
      throw new ConflictException('این QR قبلاً استفاده شده است');
    }

    // Log successful consumption
    await this.logSessionEvent({
      token,
      tableId: payload.tableId,
      action: 'consume',
      ip,
      ua: userAgent,
      result: 'success',
    });

    this.logger.log(
      `Token consumed successfully for table ${payload.tableNumber}: ${token.substring(0, 8)}...`,
    );

    const sessionId = TokenGenerator.generateSecureToken(this.tokenLength);
    const establishedAt = Date.now();
    const expiresAt = establishedAt + this.sessionTtl * 1000;

    const activeSession: ActiveSession = {
      sessionId,
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
      createdAt: establishedAt,
      expiresAt,
      createdIp: payload.createdIp,
      createdUa: payload.createdUa,
      lastIp: ip,
      lastUa: userAgent,
    };

    await this.redis.setex(
      this.buildActiveSessionKey(sessionId),
      this.sessionTtl,
      JSON.stringify(activeSession),
    );

    this.logger.log(
      `Active session established for table ${payload.tableNumber}: ${sessionId.substring(0, 8)}... (expires in ${this.sessionTtl} seconds)`,
    );

    return {
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
      establishedAt: new Date(establishedAt),
      sessionId,
      sessionExpiresAt: new Date(expiresAt),
      sessionTtlSeconds: this.sessionTtl,
    };
  }

  /**
   * Log session event to PostgreSQL for analytics and audit
   * ثبت رویداد نشست در PostgreSQL برای آنالیز و ممیزی
   */
  private async logSessionEvent(event: {
    token: string;
    tableId: string;
    action: 'issue' | 'consume';
    ip: string;
    ua: string;
    result: string;
  }): Promise<void> {
    // Skip logging for unknown table IDs to avoid FK violations during tests
    if (!event.tableId || event.tableId === 'unknown') {
      this.logger.debug(
        `Skipping session log for unknown tableId (token=${event.token})`,
      );
      return;
    }

    try {
      await this.prisma.tableSessionLog.create({
        data: {
          token: event.token,
          tableId: event.tableId,
          action: event.action,
          ip: event.ip,
          userAgent: event.ua,
          result: event.result,
        },
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      this.logger.error('Failed to log session event', error);
    }
  }

  /**
   * Map static table ID to human-readable table number
   * In production, query from database or config
   */
  private async getTableByStaticId(
    staticId: string,
  ): Promise<{ id: string; staticId: string; name: string }> {
    const normalizedId = staticId.trim();
    if (!normalizedId) {
      throw new BadRequestException('شناسه میز نامعتبر است');
    }

    const cached = this.tablesCache;
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      const hit = cached.data[normalizedId];
      if (hit) {
        return hit;
      }
    }

    if (!cached || cached.expiresAt <= now) {
      const tables = await this.prisma.diningTable.findMany({
        where: { isActive: true },
        select: { id: true, staticId: true, name: true },
      });

      this.tablesCache = {
        data: tables.reduce<
          Record<string, { id: string; staticId: string; name: string }>
        >((acc, table) => {
          acc[table.staticId] = {
            id: table.id,
            staticId: table.staticId,
            name: table.name,
          };
          return acc;
        }, {}),
        expiresAt: now + this.tableCacheTtlMs,
      };
      // Diagnostic: log which table staticIds were loaded into cache
      this.logger.debug(
        `Loaded ${tables.length} dining tables into cache: ${tables
          .map((t) => t.staticId)
          .join(',')}`,
      );
    }

    const table = this.tablesCache!.data[normalizedId];
    if (!table) {
      // Log diagnostics to help e2e debugging why a table is not found
      this.logger.warn(
        `Table not found for staticId='${normalizedId}'. Available: ${Object.keys(
          this.tablesCache!.data,
        ).join(',')}`,
      );
      throw new NotFoundException('میز پیدا نشد یا غیرفعال است');
    }

    return table;
  }

  /**
   * Get session statistics (for admin/monitoring)
   */
  async getSessionStats(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stats = await this.prisma.tableSessionLog.groupBy({
      by: ['action', 'result'],
      where: {
        createdAt: {
          gte: since,
        },
      },
      _count: true,
    });

    return stats;
  }

  private buildActiveSessionKey(sessionId: string) {
    return `table:active:${sessionId}`;
  }

  async validateActiveSession(
    sessionId: string,
    ip: string,
    userAgent: string,
  ): Promise<ActiveSession> {
    const key = this.buildActiveSessionKey(sessionId);
    const payloadStr = await this.redis.get(key);

    if (!payloadStr) {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    let session: ActiveSession;
    try {
      session = JSON.parse(payloadStr) as ActiveSession;
    } catch (error) {
      this.logger.error('Failed to parse active session payload', error);
      await this.redis.del(key);
      throw new UnauthorizedException('SESSION_INVALID');
    }

    if (session.expiresAt <= Date.now()) {
      await this.redis.del(key);
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    if (this.bindToIp && session.createdIp && session.createdIp !== ip) {
      this.logger.warn(
        `Active session IP mismatch for ${sessionId.substring(0, 8)}...: expected ${session.createdIp}, got ${ip}`,
      );
      throw new UnauthorizedException('SESSION_IP_MISMATCH');
    }

    // Update last seen metadata (without extending TTL)
    session.lastIp = ip;
    session.lastUa = userAgent;

    const remainingMs = session.expiresAt - Date.now();
    if (remainingMs <= 0) {
      await this.redis.del(key);
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    await this.redis.setex(
      key,
      Math.max(1, Math.floor(remainingMs / 1000)),
      JSON.stringify(session),
    );

    return session;
  }

  async invalidateActiveSession(sessionId: string): Promise<void> {
    await this.redis.del(this.buildActiveSessionKey(sessionId));
  }
}
