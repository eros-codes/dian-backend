import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IssueTokenParamsDto {
  @ApiProperty({
    description: 'Static table ID (small integer or slug)',
    example: 4,
  })
  @IsString()
  tableStaticId: string;
}

export class IssueTokenResponseDto {
  @ApiProperty({ description: 'Deep link to consume token' })
  deepLink: string;

  @ApiProperty({ description: 'Session token' })
  token: string;

  @ApiProperty({ description: 'Token TTL in seconds' })
  ttl: number;
}
