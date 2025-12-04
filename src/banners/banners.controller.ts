// backend/src/banners/banners.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiConsumes,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerResponseDto } from './dto/banner-response.dto';

type SwapRequestDto = {
  idA: string;
  idB: string;
};

type ReorderRequestDto = {
  ids: string[];
};

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOkResponse({ type: [BannerResponseDto] })
  async list(): Promise<BannerResponseDto[]> {
    return this.bannersService.listActive();
  }

  @Get('all')
  @ApiOkResponse({ type: [BannerResponseDto] })
  async listAll(): Promise<BannerResponseDto[]> {
    return this.bannersService.listAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: BannerResponseDto })
  async get(@Param('id') id: string): Promise<BannerResponseDto> {
    return this.bannersService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiCreatedResponse({ type: BannerResponseDto })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBannerDto,
  ): Promise<BannerResponseDto> {
    return this.bannersService.createWithFile(dto, file);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOkResponse({ type: BannerResponseDto })
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateBannerDto,
  ): Promise<BannerResponseDto> {
    return this.bannersService.update(id, dto, file);
  }

  @Post('swap')
  async swap(@Body() body: SwapRequestDto): Promise<void> {
    const { idA, idB } = body;
    return this.bannersService.swapOrders(idA, idB);
  }

  @Post('reorder')
  async reorder(@Body() body: ReorderRequestDto): Promise<void> {
    return this.bannersService.reorder(body.ids);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.bannersService.remove(id);
  }
}
