// services/cloudinary.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { UploadApiResponse, v2 as CloudinaryType } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject('CLOUDINARY') private cloudinary: typeof CloudinaryType,
  ) {}

  async uploadImage(fileBuffer: Buffer): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { folder: 'products' },
        (err: unknown, result: UploadApiResponse | undefined) => {
          if (err) {
            const normalizedError =
              err instanceof Error
                ? err
                : new Error('Cloudinary upload failed');
            reject(normalizedError);
            return;
          }
          resolve(result as UploadApiResponse);
        },
      );
      try {
        Readable.from(fileBuffer).pipe(uploadStream);
      } catch (streamErr: unknown) {
        const normalizedError =
          streamErr instanceof Error
            ? streamErr
            : new Error('Error piping to cloudinary uploader');
        reject(normalizedError);
      }
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId);
  }
}
