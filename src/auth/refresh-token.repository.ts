import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';


@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string, token: string, familyId?: string, expiresInDays = 7) {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    // Use indexed access to avoid requiring regenerated Prisma client types at build time
    return (this.prisma as any).refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: familyId || `fam_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
        expiresAt,
      },
    });
  }

  async findByToken(token: string) {
    const tokenHash = this.hashToken(token);
    return (this.prisma as any).refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeToken(id: string) {
    return (this.prisma as any).refreshToken.update({ where: { id }, data: { isRevoked: true } });
  }

  async revokeFamily(familyId: string) {
    return (this.prisma as any).refreshToken.updateMany({ where: { familyId }, data: { isRevoked: true } });
  }

  async revokeAllUserTokens(userId: string) {
    return (this.prisma as any).refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
  }
}
