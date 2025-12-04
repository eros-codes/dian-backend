import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FooterSettingsService } from './footer-settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MinRole } from '../common/decorators/min-role.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { CreateFooterSettingDto } from './dto/create-footer-setting.dto';
import { UpdateFooterSettingDto } from './dto/update-footer-setting.dto';

@ApiTags('footer-settings')
@Controller('footer-settings')
export class FooterSettingsController {
  constructor(private readonly service: FooterSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all footer settings' })
  async findAll() {
    const data = await this.service.findAll();
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @MinRole(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Create a new footer setting (admin only)' })
  async create(@Body() dto: CreateFooterSettingDto) {
    const created = await this.service.create(dto);
    return { success: true, data: created };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @MinRole(RoleEnum.PRIMARY)
  @ApiOperation({ summary: 'Update footer setting value/link flag' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFooterSettingDto,
  ) {
    const updated = await this.service.update(id, dto);
    return { success: true, data: updated };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @MinRole(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Delete footer setting (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.service.remove(id);
  }
}
