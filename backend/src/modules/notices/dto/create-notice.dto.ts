import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { NoticePriority } from '../entities/notice.entity';

export class CreateNoticeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ enum: NoticePriority, required: false, default: NoticePriority.NORMAL })
  @IsEnum(NoticePriority)
  @IsOptional()
  priority?: NoticePriority = NoticePriority.NORMAL;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  roles?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  hostelIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  blockIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  attachments?: string[];

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
