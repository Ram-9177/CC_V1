import { IsNotEmpty, IsString, IsBoolean, IsISO8601 } from 'class-validator';

export class CreateGatePassDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsNotEmpty()
  @IsString()
  destination!: string;

  @IsNotEmpty()
  @IsISO8601()
  fromDate!: string;

  @IsNotEmpty()
  @IsISO8601()
  toDate!: string;

  @IsBoolean()
  isEmergency?: boolean;
}
