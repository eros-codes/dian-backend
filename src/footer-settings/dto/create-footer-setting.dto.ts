import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFooterSettingDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  url?: string;
}
