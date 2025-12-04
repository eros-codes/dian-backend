import { PartialType } from '@nestjs/mapped-types';
import { CreateDiningTableDto } from './create-dining-table.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDiningTableDto extends PartialType(CreateDiningTableDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
