import { IsArray, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import {
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@prisma/client';

/** Full task metadata replacement (creator/admin). Does not change assignee or tags. */
export class ReplaceTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsEnum(TaskPriority)
  priority!: TaskPriority;

  @IsEnum(TaskVisibility)
  visibility!: TaskVisibility;

  @IsArray()
  @IsString({ each: true })
  viewerUserIds!: string[];
}
