// backend/src/banners/banners.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Banner, Prisma } from '@prisma/client';
import { BannersRepository } from './banners.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerResponseDto } from './dto/banner-response.dto';
import { BannerMapper } from '../domain/mappers/banner.mapper';

@Injectable()
export class BannersService {
  constructor(
    private readonly repo: BannersRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createWithFile(
    dto: CreateBannerDto,
    file?: Express.Multer.File,
  ): Promise<BannerResponseDto> {
    let imageUrl = dto.imageUrl ?? undefined;

    if (file) {
      const uploaded = await this.cloudinary.uploadImage(file.buffer);
      imageUrl = uploaded.secure_url;
    }

    if (!imageUrl) {
      throw new Error('Image is required for banner');
    }

    const orderValue = this.toNumber(dto.order);
    const isActive = this.toBoolean(dto.isActive);

    const created = await this.repo.create({
      title: dto.title ?? null,
      caption: dto.caption ?? null,
      imageUrl,
      order: orderValue ?? 0,
      isActive: isActive ?? true,
    });

    return this.mapToResponse(created);
  }

  async listActive(): Promise<BannerResponseDto[]> {
    const banners = await this.repo.findAllActive();
    return banners.map((banner) => this.mapToResponse(banner));
  }

  async listAll(): Promise<BannerResponseDto[]> {
    const banners = await this.repo.findAll();
    return banners.map((banner) => this.mapToResponse(banner));
  }

  async get(id: string): Promise<BannerResponseDto> {
    const found = await this.repo.findById(id);
    if (!found) {
      throw new NotFoundException('Banner not found');
    }

    return this.mapToResponse(found);
  }

  async update(
    id: string,
    dto: UpdateBannerDto,
    file?: Express.Multer.File,
  ): Promise<BannerResponseDto> {
    let imageUrl = dto.imageUrl ?? undefined;
    const shouldRemoveImage = this.toBoolean(dto.removeImage) === true;

    if (shouldRemoveImage) {
      imageUrl = '';
    }

    if (file) {
      const uploaded = await this.cloudinary.uploadImage(file.buffer);
      imageUrl = uploaded.secure_url;
    }

    const payload: Prisma.BannerUpdateInput = {};

    if (dto.title !== undefined) {
      payload.title = dto.title ?? null;
    }

    if (dto.caption !== undefined) {
      payload.caption = dto.caption ?? null;
    }

    if (imageUrl !== undefined) {
      payload.imageUrl = imageUrl;
    }

    const orderValue = this.toNumber(dto.order);
    if (orderValue !== undefined) {
      payload.order = orderValue;
    }

    const isActive = this.toBoolean(dto.isActive);
    if (isActive !== undefined) {
      payload.isActive = isActive;
    }

    const updated = await this.repo.update(id, payload);
    return this.mapToResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }

  async swapOrders(idA: string, idB: string): Promise<void> {
    await this.repo.swapOrders(idA, idB);
  }

  async reorder(ids: string[]): Promise<void> {
    await this.repo.reorder(ids);
  }

  private mapToResponse(banner: Banner): BannerResponseDto {
    const mapped = BannerMapper.toResponse(banner);
    if (!mapped) {
      throw new Error('Unable to map banner to response DTO');
    }

    return mapped;
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no'].includes(normalized)) {
        return false;
      }
    }

    return undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }
}
