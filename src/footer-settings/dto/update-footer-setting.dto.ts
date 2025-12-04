import { IsOptional, IsString } from 'class-validator';

export class UpdateFooterSettingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  url?: string;
}
