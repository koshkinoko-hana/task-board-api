import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private normalizeNickname(raw: string): string {
    return raw.trim().toLowerCase();
  }

  async register(dto: RegisterDto) {
    const nickname = this.normalizeNickname(dto.nickname);
    const existingNick = await this.prisma.user.findUnique({
      where: { nickname },
    });
    if (existingNick) {
      throw new ConflictException({
        code: 'NICKNAME_TAKEN',
        message: 'This nickname is already taken.',
      });
    }

    const email =
      dto.email?.trim().length ? dto.email.trim().toLowerCase() : null;
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'This email is already registered.',
        });
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nickname,
        email,
        passwordHash,
        role: Role.USER,
      },
    });
    return this.issueTokens(user.id, user.nickname, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const nickname = this.normalizeNickname(dto.nickname);
    const user = await this.prisma.user.findUnique({
      where: { nickname },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid nickname or password.',
      });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid nickname or password.',
      });
    }
    if (user.bannedAt) {
      throw new ForbiddenException({
        code: 'BANNED',
        message: 'Account is banned.',
      });
    }
    return this.issueTokens(user.id, user.nickname, user.email, user.role);
  }

  private issueTokens(
    userId: string,
    nickname: string,
    email: string | null,
    role: Role,
  ) {
    const payload: JwtPayload = { sub: userId, nickname, email, role };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      user: { id: userId, nickname, email, role },
    };
  }
}
