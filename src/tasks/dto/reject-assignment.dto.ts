import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAssignmentDto {
  @IsOptional()
  @IsBoolean()
  blockAssigner?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
