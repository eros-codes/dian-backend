//upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async saveProductImages(productId: string, files: Express.Multer.File[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new BadRequestException('محصول پیدا نشد ❌');

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const r = await this.cloudinary.uploadImage(file.buffer); // ✅ مستقیم به Cloudinary
        return this.prisma.productImage.create({
          data: {
            productId,
            url: r.secure_url,
            publicId: r.public_id, // 👈 مهم برای حذف بعدی
          },
        });
      }),
    );

    return {
      success: true,
      count: uploaded.length,
      images: uploaded.map((img) => ({
        id: img.id,
        url: img.url,
        publicId: img.publicId,
      })),
    };
  }
}
