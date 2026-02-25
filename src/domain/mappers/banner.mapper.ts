import { Banner } from '@prisma/client';
import { BannerResponseDto } from '../../banners/dto/banner-response.dto';

export class BannerMapper {
  static toResponse(row: Banner | null): BannerResponseDto | null {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title ?? undefined,
      caption: row.caption ?? undefined,
      imageUrl: row.imageUrl,
      order: row.order,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
