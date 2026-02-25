import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsumeTokenParamsDto {
  @ApiProperty({
    description: 'Session token to consume',
    example: 'aB3xY9mN4pQ7wR2vK5sT8uL1',
  })
  @IsString()
  token: string;
}

export class ConsumeTokenResponseDto {
  @ApiProperty({ description: 'Table ID associated with this session' })
  tableId: string;

  @ApiProperty({ description: 'Human-readable table number' })
  tableNumber: string;

  @ApiProperty({ description: 'Session established timestamp' })
  establishedAt: Date;
}
