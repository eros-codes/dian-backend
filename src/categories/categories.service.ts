import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, CategoryType } from '@prisma/client';
import { CategoriesRepository } from './categories.repository';
import { Category, CategoryOptionModel } from '../domain/category.model';
import {
  CreateCategoryDto,
  CategoryTypeOption,
} from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../prisma/prisma.service';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import axios, { type AxiosResponse } from 'axios';
import { CategoryOptionInputDto } from './dto/category-option-input.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const existingCategory = await this.categoriesRepository.findByName(
      createCategoryDto.name,
    );
    if (existingCategory) {
      throw new ConflictException(
        `Category with name "${createCategoryDto.name}" already exists`,
      );
    }

    const { iconUrl, options, type, name } = createCategoryDto;
    const payload: Prisma.CategoryUncheckedCreateInput = {
      name,
      type: this.resolveCategoryType(type),
    };

    let createdIcon: { id: string; iconPath: string } | null = null;
    try {
      const trimmedIconSource = iconUrl?.trim();
      if (trimmedIconSource) {
        createdIcon = await this.persistIconFromSource(trimmedIconSource);
        payload.iconId = createdIcon.id;
      }

      const category = await this.categoriesRepository.create(payload);

      if (Array.isArray(options) && options.length > 0) {
        await this.syncCategoryOptions(category.id, options);
        const hydratedCategory = await this.categoriesRepository.findById(
          category.id,
        );
        return hydratedCategory ?? category;
      }

      return category;
    } catch (error) {
      if (createdIcon) {
        await this.removeIconAsset(createdIcon.id, createdIcon.iconPath);
      }
      throw error;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  async getActiveCategories(): Promise<Category[]> {
    return this.categoriesRepository.findAllActive();
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
    return category;
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    await this.getCategoryById(id);

    if (updateCategoryDto.name) {
      const existingCategory = await this.categoriesRepository.findByName(
        updateCategoryDto.name,
      );
      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException(
          `Category with name "${updateCategoryDto.name}" already exists`,
        );
      }
    }

    const {
      iconUrl,
      clearIcon,
      options,
      type,
      name,
      isActive,
      discountPercent,
    } = updateCategoryDto;

    const updatePayload: Prisma.CategoryUncheckedUpdateInput = {};
    if (name !== undefined) {
      updatePayload.name = name;
    }
    if (isActive !== undefined) {
      updatePayload.isActive = isActive;
    }
    if (discountPercent !== undefined) {
      updatePayload.discountPercent = discountPercent;
    }
    if (type !== undefined) {
      updatePayload.type = this.resolveCategoryType(type);
    }
    // fetch current category before update
    const currentCategory = await this.categoriesRepository.findById(id);

    let createdIcon: { id: string; iconPath: string } | null = null;
    try {
      const nextIconSource = iconUrl?.trim();
      if (nextIconSource) {
        createdIcon = await this.persistIconFromSource(nextIconSource);
        updatePayload.iconId = createdIcon.id;
      } else if (clearIcon) {
        updatePayload.iconId = null;
      }

      const updatedCat = await this.categoriesRepository.update(
        id,
        updatePayload,
      );

      // If discountPercent changed, force-apply the category discount to ALL products
      // in this category (override any product-level discount). This preserves or sets
      // originalPrice if missing, and recomputes the product price from originalPrice.
      if (discountPercent !== undefined) {
        const newCatDiscount =
          discountPercent !== null && discountPercent !== undefined
            ? Number(discountPercent)
            : null;

        // fetch all products in this category
        const products = await this.prisma.product.findMany({
          where: { categoryId: id },
          select: {
            id: true,
            originalPrice: true,
            price: true,
            discountPercent: true,
          },
        });

        if (products.length > 0) {
          const updates = products.map((product) => {
            const originalValue = this.toDecimalNumber(
              product.originalPrice ?? product.price,
            );
            const clamp = (value: number): number =>
              Math.max(0, Math.min(100, value));
            const newPrice =
              newCatDiscount !== null
                ? Number(
                    (originalValue * (1 - clamp(newCatDiscount) / 100)).toFixed(
                      2,
                    ),
                  )
                : originalValue;

            const data: Prisma.ProductUncheckedUpdateInput = {
              discountPercent: newCatDiscount,
              price: newPrice,
            };
            if (product.originalPrice === null) {
              data.originalPrice = originalValue;
            }

            return this.prisma.product.update({
              where: { id: product.id },
              data,
            });
          });

          await this.prisma.$transaction(updates);
          // logging removed
        }
      }

      if (Array.isArray(options)) {
        await this.syncCategoryOptions(id, options);
      }

      if (
        createdIcon &&
        currentCategory?.iconId &&
        currentCategory.iconId !== createdIcon.id
      ) {
        await this.removeIconAsset(
          currentCategory.iconId,
          currentCategory.iconPath,
        );
      } else if (
        !createdIcon &&
        updateCategoryDto.clearIcon &&
        currentCategory?.iconId
      ) {
        await this.removeIconAsset(
          currentCategory.iconId,
          currentCategory.iconPath,
        );
      }

      const finalCategory = await this.categoriesRepository.findById(id);
      return finalCategory ?? updatedCat;
    } catch (error) {
      if (createdIcon) {
        await this.removeIconAsset(createdIcon.id, createdIcon.iconPath);
      }
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<Category> {
    const category = await this.getCategoryById(id);
    // New behaviour:
    // - Products with historical order items or returns are preserved for
    //   reporting. We'll reassign them to an 'uncategorized' category and
    //   mark them inactive.
    // - Products without historical refs will be deleted (images removed as well).
    // Do this in a transaction.
    await this.prisma.$transaction(async (tx) => {
      // ensure an 'uncategorized' category exists (create if missing)
      let uncategorized = await tx.category.findUnique({
        where: { name: 'uncategorized' },
      });
      if (!uncategorized) {
        uncategorized = await tx.category.create({
          data: { name: 'uncategorized', isActive: false },
        });
      }

      // fetch products in this category with minimal data
      const prods = await tx.product.findMany({
        where: { categoryId: id },
        select: { id: true },
      });
      const ids = prods.map((p) => p.id);
      if (ids.length > 0) {
        for (const pid of ids) {
          const orderCount = await tx.orderItem.count({
            where: { productId: pid },
          });
          // Check returns referencing orders that include this product is complicated;
          // we'll rely on order items as the primary signal for historical usage.
          if (orderCount > 0) {
            // reassign product to 'uncategorized' and mark inactive
            await tx.product.update({
              where: { id: pid },
              data: { categoryId: uncategorized.id, isActive: false },
            });
          } else {
            // no historical refs -> delete images and product
            await tx.productImage.deleteMany({ where: { productId: pid } });
            await tx.product.delete({ where: { id: pid } });
          }
        }
      }

      // finally delete the category
      await tx.category.delete({ where: { id } });
    });

    if (category.iconId) {
      await this.removeIconAsset(category.iconId, category.iconPath);
    }

    return category;
  }

  private async persistIconFromSource(
    iconSource: string,
  ): Promise<{ id: string; iconPath: string }> {
    const svgContent = await this.resolveSvgContent(iconSource);
    const normalizedSvg = this.normalizeSvgContent(svgContent);
    const { filePath, iconPath, id } = await this.saveSvgToFile(normalizedSvg);
    try {
      await this.prisma.categoryIcon.create({ data: { id, iconPath } });
    } catch (err) {
      await fs.unlink(filePath).catch(() => undefined);
      throw err;
    }
    return { id, iconPath };
  }

  private async resolveSvgContent(iconSource: string): Promise<string> {
    const trimmed = iconSource.trim();
    if (!trimmed) {
      throw new BadRequestException('Provided icon source is empty.');
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return this.fetchSvgFromHttp(trimmed);
    }

    if (/^data:image\/svg\+xml/i.test(trimmed)) {
      return this.extractSvgFromDataUri(trimmed);
    }

    if (/<svg[\s\S]*?>[\s\S]*<\/svg>/i.test(trimmed)) {
      return trimmed;
    }

    throw new BadRequestException(
      'Icon source must be an HTTPS URL, an SVG data URI, or inline <svg> markup.',
    );
  }

  private async fetchSvgFromHttp(url: string): Promise<string> {
    let response: AxiosResponse<string>;
    try {
      response = await axios.get<string, AxiosResponse<string>>(url, {
        responseType: 'text',
      });
    } catch {
      throw new BadRequestException(
        'Failed to download SVG icon from provided URL',
      );
    }

    const headerValue = response.headers['content-type'] as
      | string
      | string[]
      | undefined;
    const contentType = Array.isArray(headerValue)
      ? typeof headerValue[0] === 'string'
        ? headerValue[0].toLowerCase()
        : ''
      : typeof headerValue === 'string'
        ? headerValue.toLowerCase()
        : '';
    const data: string = response.data ?? '';
    if (!contentType.includes('svg') && !/<svg[\s\S]*?>/i.test(data)) {
      throw new BadRequestException(
        'Provided URL does not point to a valid SVG resource',
      );
    }

    return data;
  }

  private extractSvgFromDataUri(dataUri: string): string {
    const match = dataUri.match(/^data:image\/svg\+xml([^,]*),(.*)$/i);
    if (!match) {
      throw new BadRequestException('Invalid SVG data URI.');
    }

    const meta = match[1] ?? '';
    const data = match[2] ?? '';

    try {
      if (/;base64/i.test(meta)) {
        return Buffer.from(data, 'base64').toString('utf8');
      }
      return decodeURIComponent(data);
    } catch {
      throw new BadRequestException('Failed to decode SVG data URI.');
    }
  }

  private async saveSvgToFile(
    svgContent: string,
  ): Promise<{ id: string; filePath: string; iconPath: string }> {
    const id = randomUUID();
    const iconsDir = join(process.cwd(), 'uploads', 'icons');
    await fs.mkdir(iconsDir, { recursive: true });
    const filePath = join(iconsDir, `${id}.svg`);
    await fs.writeFile(filePath, svgContent, 'utf8');
    const iconPath = `/uploads/icons/${id}.svg`;
    return { id, filePath, iconPath };
  }

  private normalizeSvgContent(raw: string): string {
    const input = typeof raw === 'string' ? raw : String(raw);
    let svg = input
      .replace(/<\?xml[^>]*>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '');
    svg = svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    svg = svg.replace(/fill="(?!none)(.*?)"/gi, 'fill="currentColor"');
    svg = svg.replace(/<svg([^>]*)>/i, (match: string, attrs: string) => {
      if (/fill=/i.test(attrs)) {
        return `<svg${attrs.replace(/fill="[^"]*"/i, ' fill="currentColor"')}>`;
      }
      return `<svg${attrs} fill="currentColor">`;
    });
    return svg.trim();
  }

  private async removeIconAsset(
    iconId?: string | null,
    iconPath?: string | null,
  ): Promise<void> {
    if (!iconId && !iconPath) {
      return;
    }

    if (iconId) {
      try {
        await this.prisma.categoryIcon.delete({ where: { id: iconId } });
      } catch {
        // ignore when icon record has already been removed
      }
    }

    if (iconPath) {
      const relativePath = iconPath.startsWith('/')
        ? iconPath.slice(1)
        : iconPath;
      const absolutePath = join(process.cwd(), relativePath);
      await fs.unlink(absolutePath).catch(() => undefined);
    }
  }

  private async syncCategoryOptions(
    categoryId: string,
    optionInputs: CategoryOptionInputDto[],
  ): Promise<void> {
    if (!Array.isArray(optionInputs)) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const existingOptions = await tx.categoryOption.findMany({
        where: { categoryId },
        select: {
          id: true,
          name: true,
          additionalPrice: true,
          isAvailable: true,
        },
      });

      if (optionInputs.length === 0) {
        if (existingOptions.length > 0) {
          const optionIds = existingOptions.map((option) => option.id);
          await tx.productOption.deleteMany({
            where: { categoryOptionId: { in: optionIds } },
          });
          await tx.categoryOption.deleteMany({
            where: { id: { in: optionIds } },
          });
        }
        return;
      }

      const existingById = new Map<number, CategoryOptionModel>(
        existingOptions.map((option) => [
          option.id,
          {
            id: option.id,
            name: option.name,
            additionalPrice: option.additionalPrice,
            isAvailable: option.isAvailable,
          },
        ]),
      );

      const payloadIds = new Set<number>();

      const products = await tx.product.findMany({
        where: { categoryId },
        select: { id: true },
      });
      const productIds = products.map((product) => product.id);

      const ensureProductOptions = async (categoryOption: {
        id: number;
        name: string;
        additionalPrice: number;
        isAvailable: boolean;
      }): Promise<void> => {
        if (productIds.length === 0) {
          return;
        }

        const existingProductOptions = await tx.productOption.findMany({
          where: { categoryOptionId: categoryOption.id },
          select: { id: true, productId: true },
        });
        const existingByProduct = new Map<string, number>(
          existingProductOptions.map((option) => [option.productId, option.id]),
        );

        const creations = productIds
          .filter((productId) => !existingByProduct.has(productId))
          .map((productId) =>
            tx.productOption.create({
              data: {
                productId,
                categoryOptionId: categoryOption.id,
                name: categoryOption.name,
                additionalPrice: categoryOption.additionalPrice,
                isAvailable: categoryOption.isAvailable,
              },
            }),
          );

        if (creations.length > 0) {
          await Promise.all(creations);
        }

        await tx.productOption.updateMany({
          where: { categoryOptionId: categoryOption.id },
          data: {
            name: categoryOption.name,
            additionalPrice: categoryOption.additionalPrice,
            isAvailable: categoryOption.isAvailable,
          },
        });
      };

      for (const input of optionInputs) {
        const normalizedName = input.name?.trim();
        const normalizedPriceRaw = input.additionalPrice;
        const normalizedPrice =
          normalizedPriceRaw === undefined || normalizedPriceRaw === null
            ? undefined
            : Math.max(0, Number(normalizedPriceRaw));
        const normalizedAvailability = input.isAvailable;

        if (typeof input.id === 'number') {
          payloadIds.add(input.id);
        }

        if (input.id) {
          const current = existingById.get(input.id);
          if (!current) {
            continue;
          }

          if (input._delete) {
            await tx.productOption.deleteMany({
              where: { categoryOptionId: input.id },
            });
            await tx.categoryOption.delete({ where: { id: input.id } });
            existingById.delete(input.id);
            continue;
          }

          const updatePayload: Prisma.CategoryOptionUncheckedUpdateInput = {};
          if (normalizedName !== undefined) {
            updatePayload.name = normalizedName;
          }
          if (normalizedPrice !== undefined) {
            updatePayload.additionalPrice = normalizedPrice;
          }
          if (normalizedAvailability !== undefined) {
            updatePayload.isAvailable = normalizedAvailability;
          }

          if (Object.keys(updatePayload).length > 0) {
            await tx.categoryOption.update({
              where: { id: input.id },
              data: updatePayload,
            });
          }

          const refreshed = await tx.categoryOption.findUnique({
            where: { id: input.id },
            select: {
              id: true,
              name: true,
              additionalPrice: true,
              isAvailable: true,
            },
          });

          if (refreshed) {
            await ensureProductOptions({
              id: refreshed.id,
              name: refreshed.name,
              additionalPrice: refreshed.additionalPrice,
              isAvailable: refreshed.isAvailable,
            });
          }

          continue;
        }

        if (input._delete) {
          continue;
        }

        const created = await tx.categoryOption.create({
          data: {
            categoryId,
            name: normalizedName ?? 'افزودنی',
            additionalPrice: normalizedPrice ?? 0,
            isAvailable: normalizedAvailability ?? true,
          },
        });

        await ensureProductOptions({
          id: created.id,
          name: created.name,
          additionalPrice: created.additionalPrice,
          isAvailable: created.isAvailable,
        });
      }

      if (payloadIds.size < existingOptions.length) {
        const staleIds = existingOptions
          .map((option) => option.id)
          .filter((id) => !payloadIds.has(id));

        if (staleIds.length > 0) {
          await tx.productOption.deleteMany({
            where: { categoryOptionId: { in: staleIds } },
          });
          await tx.categoryOption.deleteMany({
            where: { id: { in: staleIds } },
          });
        }
      }
    });
  }

  private resolveCategoryType(
    type?: CategoryTypeOption | CategoryType | null,
  ): CategoryType {
    const normalized = String(type ?? CategoryType.CAFE);
    if (normalized === CategoryType.RESTAURANT) {
      return CategoryType.RESTAURANT;
    }
    if (normalized === 'BREAKFAST' || normalized === CategoryType.BREAKFAST) {
      return CategoryType.BREAKFAST;
    }
    return CategoryType.CAFE;
  }

  private toDecimalNumber(
    value: Prisma.Decimal | number | null | undefined,
  ): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    return value.toNumber();
  }
}
