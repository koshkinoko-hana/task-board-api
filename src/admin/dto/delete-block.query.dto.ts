import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteBlockQueryDto {
  @IsString()
  @MinLength(1)
  blockerId!: string;

  @IsString()
  @MinLength(1)
  blockedUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
