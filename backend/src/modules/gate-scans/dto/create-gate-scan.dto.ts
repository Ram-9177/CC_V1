import { IsNotEmpty, IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { ScanType } from '../entities/gate-scan.entity';

export class CreateGateScanDto {
  @IsNotEmpty()
  @IsUUID()
  gatePassId!: string;

  @IsNotEmpty()
  @IsEnum(ScanType)
  scanType!: ScanType;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
