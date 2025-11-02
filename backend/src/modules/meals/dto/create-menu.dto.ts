import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsEnum, IsISO8601, IsOptional, IsBoolean } from 'class-validator';
import { MealType } from '../entities/meal-menu.entity';

export class CreateMenuDto {
  @ApiProperty({ description: 'Menu date (YYYY-MM-DD)', example: '2025-10-31' })
  @IsISO8601({ strict: false })
  date!: string;

  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  items!: string[];

  @ApiProperty({ required: false, description: 'Set true to mark mess closed for this meal' })
  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}
