//---product.controller.ts---//
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductMapper } from '../domain/mappers/product.mapper';
import { CategoryTypeOption } from '../categories/dto/create-category.dto';
import { Response } from 'express';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ✅ ایجاد محصول (همراه با فایل)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product (with optional images)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage() }))
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateProductDto,
  ) {
    const model = await this.productsService.createWithFiles(dto, files || []);
    return ProductMapper.toResponseDto(model);
  }

  // ✅ اضافه کن برای ساخت محصول فقط با JSON (بدون عکس)
  @Post('json')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create product without images (JSON)' })
  async createJson(@Body() dto: CreateProductDto) {
    const model = await this.productsService.create(dto);
    return ProductMapper.toResponseDto(model);
  }

  // ✅ گرفتن همه محصولات
  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'brand', required: false })
  async findAll(@Query() query: ProductQueryDto) {
    const models = await this.productsService.findAll(query);
    return models.map((model) => ProductMapper.toResponseDto(model));
  }

  // ✅ جدید: دریافت محصولات محبوب بر اساس soldCount
  @Get('popular')
  @ApiOperation({ summary: 'Get popular products ordered by soldCount desc' })
  @ApiQuery({
    name: 'categoryType',
    required: false,
    enum: CategoryTypeOption,
  })
  async getPopular(
    @Query('limit') limitStr?: string,
    @Query('categoryType') categoryType?: CategoryTypeOption,
  ) {
    const limit =
      typeof limitStr === 'string' ? parseInt(limitStr, 10) || 10 : 10;
    const normalizedType =
      categoryType && Object.values(CategoryTypeOption).includes(categoryType)
        ? categoryType
        : undefined;
    const models = await this.productsService.getPopularProducts(
      limit,
      normalizedType,
    );
    return models.map((model) => ProductMapper.toResponseDto(model));
  }

  // ✅ گرفتن محصول با آیدی
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    const model = await this.productsService.findOne(id);
    return model ? ProductMapper.toResponseDto(model) : null;
  }

  // ✅ آپدیت محصول (همراه با فایل)
  @Patch(':id')
  @ApiOperation({ summary: 'Update product details (with optional images)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage() }))
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UpdateProductDto,
  ) {
    const model = await this.productsService.updateWithFiles(
      id,
      dto,
      files || [],
    );
    return model ? ProductMapper.toResponseDto(model) : null;
  }

  // ✅ حذف محصول
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  async remove(@Param('id') id: string) {
    const ok = await this.productsService.remove(id);
    return { success: ok };
  }
  @Delete('images/:imageId')
  @ApiOperation({ summary: 'Delete a single product image' })
  async removeImage(@Param('imageId') imageId: string) {
    return await this.productsService.removeProductImage(imageId);
  }

  // ✅ آپلود عکس‌های محصول به صورت جداگانه (هماهنگ با فرانت)

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload product images' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 30, { storage: memoryStorage() }))
  async uploadImages(
    @Param('id') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response, // ⬅ اضافه شد
  ) {
    if (!productId) throw new BadRequestException('productId is required');
    if (!files || files.length === 0) {
      // 🔑 مستقیم جواب بده
      return res.status(201).json({ success: true, images: [] });
    }

    const createdImages = await this.productsService.addProductImages(
      productId,
      files,
    );

    // 🔑 خروجی نهایی دقیقا چیزی که فرانت میخواد
    return res.status(201).json({
      success: true,
      images: createdImages.map((img) => ({
        id: img.id,
        url: img.url,
        publicId: img.publicId,
      })),
    });
  }
}
