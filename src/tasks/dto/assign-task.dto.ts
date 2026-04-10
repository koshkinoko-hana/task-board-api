import { IsString, MinLength } from 'class-validator';

export class AssignTaskDto {
  @IsString()
  @MinLength(1)
  assigneeId!: string;
}
