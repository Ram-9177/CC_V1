import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { MealIntentStatus } from '../entities/meal-intent.entity';

export class SubmitIntentDto {
  @ApiProperty()
  @IsUUID()
  menuId!: string;

  @ApiProperty({ enum: MealIntentStatus })
  @IsEnum(MealIntentStatus)
  intent!: MealIntentStatus;
}
