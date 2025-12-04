export class BannerResponseDto {
  id: string;
  title?: string;
  caption?: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
