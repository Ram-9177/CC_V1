import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class RangeDto {
  @ApiPropertyOptional({ description: 'ISO date for start of range' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date for end of range' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
