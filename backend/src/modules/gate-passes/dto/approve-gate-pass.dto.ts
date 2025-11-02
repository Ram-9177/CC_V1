import { IsOptional, IsString } from 'class-validator';

export class ApproveGatePassDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
