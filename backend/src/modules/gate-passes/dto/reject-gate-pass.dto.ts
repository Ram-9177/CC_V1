import { IsNotEmpty, IsString } from 'class-validator';

export class RejectGatePassDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
