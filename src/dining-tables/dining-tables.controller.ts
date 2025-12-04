import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DiningTablesService } from './dining-tables.service';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';

@ApiTags('dining-tables')
@Controller('dining-tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleEnum.ADMIN)
@ApiBearerAuth()
export class DiningTablesController {
  constructor(private readonly service: DiningTablesService) {}

  @Post()
  @ApiOperation({ summary: 'ایجاد میز جدید' })
  @ApiBody({ type: CreateDiningTableDto })
  @ApiResponse({ status: 201, description: 'میز ایجاد شد' })
  async create(@Body() dto: CreateDiningTableDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'نمایش همه میزها' })
  @ApiResponse({ status: 200, description: 'لیست میزها' })
  async findAll() {
    return this.service.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'نمایش میزهای فعال' })
  @ApiResponse({ status: 200, description: 'لیست میزهای فعال' })
  async findActive() {
    return this.service.findActive();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش میز' })
  @ApiBody({ type: UpdateDiningTableDto })
  @ApiResponse({ status: 200, description: 'میز بروزرسانی شد' })
  async update(@Param('id') id: string, @Body() dto: UpdateDiningTableDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف میز' })
  @ApiResponse({ status: 204, description: 'میز حذف شد' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
