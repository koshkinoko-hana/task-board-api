import { IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateAssigneeStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
