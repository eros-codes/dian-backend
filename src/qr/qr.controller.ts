import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { QrService } from './qr.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  IssueTokenParamsDto,
  IssueTokenResponseDto,
} from './dto/issue-token.dto';
import {
  ConsumeTokenParamsDto,
  ConsumeTokenResponseDto,
} from './dto/consume-token.dto';

/**
 * QR Table Check-in Controller
 * کنترلر ورود به سیستم با QR کد میز
 */
@ApiTags('QR Table Check-in')
@Controller('qr')
@UseGuards(ThrottlerGuard)
export class QrController {
  constructor(private readonly qrService: QrService) {}

  /**
   * Issue a new QR session token
   * POST /api/qr/issue/:tableStaticId
   */
  @Post('issue/:tableStaticId')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue QR session token',
    description: 'صدور توکن جدید برای نشست میز',
  })
  @ApiParam({
    name: 'tableStaticId',
    description: 'Static table identifier',
    example: '4',
  })
  @ApiResponse({
    status: 200,
    description: 'Token issued successfully',
    type: IssueTokenResponseDto,
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async issueToken(
    @Param() params: IssueTokenParamsDto,
    @Req() req: Request,
  ): Promise<IssueTokenResponseDto> {
    // Diagnostic log for e2e debugging: ensure request reaches controller

    console.log(
      `[QR][Controller] issueToken called for tableStaticId=${params.tableStaticId}`,
    );
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.qrService.issueToken(
      params.tableStaticId,
      ip,
      userAgent,
    );

    return {
      deepLink: result.deepLink,
      token: result.token,
      ttl: result.ttl,
    };
  }

  /**
   * Alternative: GET endpoint for direct browser redirect
   * GET /api/qr/issue/:tableStaticId
   */
  @Get('issue/:tableStaticId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Issue token and redirect (for QR direct scan)',
    description: 'صدور توکن و هدایت مستقیم',
  })
  async issueTokenRedirect(
    @Param() params: IssueTokenParamsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Diagnostic log for e2e debugging

    console.log(
      `[QR][Controller] issueTokenRedirect called for tableStaticId=${params.tableStaticId}`,
    );
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.qrService.issueToken(
      params.tableStaticId,
      ip,
      userAgent,
    );

    // Redirect to token consumption page
    res.redirect(302, result.deepLink);
  }

  /**
   * Consume a QR session token (atomic, single-use)
   * GET /api/qr/consume/:token
   */
  @Get('consume/:token')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiOperation({
    summary: 'Consume QR session token',
    description: 'مصرف توکن نشست (یک‌بار مصرف)',
  })
  @ApiParam({
    name: 'token',
    description: 'Session token',
    example: 'aB3xY9mN4pQ7wR2vK5sT8uL1',
  })
  @ApiResponse({
    status: 200,
    description: 'Token consumed successfully',
    type: ConsumeTokenResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Token not found' })
  @ApiResponse({ status: 410, description: 'Token expired or already used' })
  @ApiResponse({
    status: 409,
    description: 'Token conflict (IP mismatch, etc.)',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async consumeToken(
    @Param() params: ConsumeTokenParamsDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Diagnostic log for e2e debugging

    console.log(
      `[QR][Controller] consumeToken called for token=${params.token}`,
    );
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.qrService.consumeToken(
      params.token,
      ip,
      userAgent,
    );

    // Set secure HttpOnly cookie for table session
    res.cookie('table_session', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: Math.max(1, result.sessionTtlSeconds) * 1000,
      path: '/',
    });

    res.status(HttpStatus.OK).json(result);
  }

  /**
   * Get session statistics (admin only - add auth guard in production)
   * GET /api/qr/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get QR session statistics',
    description: 'دریافت آمار نشست‌های QR',
  })
  async getStats(): Promise<any> {
    return await this.qrService.getSessionStats(24);
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(req: Request): string {
    // Check X-Forwarded-For header (if behind proxy)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    // Fallback to socket remote address
    return req.socket.remoteAddress || 'unknown';
  }
}
