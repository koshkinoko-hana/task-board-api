import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskVisibility)
  visibility?: TaskVisibility;

  /** Used when `visibility` is LIST */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  viewerUserIds?: string[];

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
