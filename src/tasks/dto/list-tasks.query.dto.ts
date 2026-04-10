import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AssignmentStatus,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';

export enum TaskSortField {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  title = 'title',
}

/** Narrow list to tasks you created, are assigned to, or both. */
export enum ListTasksMineFilter {
  all = 'all',
  created = 'created',
  assigned = 'assigned',
  involved = 'involved',
}

/** `?foo=a&foo=b` or single `?foo=a` → string array for filters. */
function queryToStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const out = raw.filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  );
  return out.length ? out : undefined;
}

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @Transform(({ value }) => queryToStringArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @IsOptional()
  @Transform(({ value }) => queryToStringArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @IsOptional()
  @IsEnum(AssignmentStatus)
  assignmentStatus?: AssignmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => queryToStringArray(value))
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tag?: string[];

  @IsOptional()
  @IsEnum(TaskSortField)
  sort?: TaskSortField = TaskSortField.updatedAt;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsEnum(ListTasksMineFilter)
  mine?: ListTasksMineFilter;
}
