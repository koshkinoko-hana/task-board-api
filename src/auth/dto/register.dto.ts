import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Lowercase letters, digits, underscore; 3–24 chars (normalized before validation). */
const NICKNAME_RE = /^[a-z0-9_]{3,24}$/;

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(NICKNAME_RE, {
    message:
      'nickname must be 3–24 chars: lowercase letters, digits, underscore only',
  })
  nickname!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length
      ? value.trim().toLowerCase()
      : undefined,
  )
  @IsEmail()
  email?: string;
}
