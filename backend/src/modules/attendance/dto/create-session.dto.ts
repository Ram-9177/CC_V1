import { IsString, IsISO8601, IsNotEmpty, IsOptional, IsIn, IsInt, Min } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  // Phase 6 fields
  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string; // ISO date string

  @IsOptional()
  @IsIn(['QR', 'MANUAL', 'MIXED'])
  mode?: 'QR' | 'MANUAL' | 'MIXED';

  @IsOptional()
  @IsInt()
  @Min(0)
  totalExpected?: number;

  // Back-compat with old API
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
