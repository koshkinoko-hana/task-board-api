import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class BannedGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: { sub: string } }>();
    const userId = request.user?.sub;
    if (!userId) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true },
    });
    if (user?.bannedAt) {
      throw new ForbiddenException({
        code: 'BANNED',
        message: 'Account is banned.',
      });
    }
    return true;
  }
}
