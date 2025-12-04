//upload.controller.ts
import {
  Controller,
  Post,
  Param,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { memoryStorage } from 'multer';

@Controller('products/:productId/images')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // ⛔ حداکثر 5 مگابایت برای هر عکس
    }),
  )
  async uploadProductImages(
    @Param('productId') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('هیچ فایلی ارسال نشده ❌');
    }
    return this.uploadService.saveProductImages(productId, files);
  }
}
