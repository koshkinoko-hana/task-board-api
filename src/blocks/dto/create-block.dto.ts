import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBlockDto {
  @IsString()
  @MinLength(1)
  blockedUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
