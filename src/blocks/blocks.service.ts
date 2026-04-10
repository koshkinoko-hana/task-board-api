import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  async createBlock(
    blockerId: string,
    dto: { blockedUserId: string; comment?: string },
  ) {
    if (blockerId === dto.blockedUserId) {
      throw new ForbiddenException({
        code: 'CANNOT_BLOCK_SELF',
        message: 'Cannot block yourself.',
      });
    }
    const target = await this.prisma.user.findFirst({
      where: { id: dto.blockedUserId, bannedAt: null },
    });
    if (!target) throw new NotFoundException();

    try {
      return await this.prisma.assignmentBlock.create({
        data: {
          blockerId,
          blockedUserId: dto.blockedUserId,
          comment: dto.comment ?? null,
        },
      });
    } catch {
      throw new ConflictException({
        code: 'BLOCK_EXISTS',
        message: 'Block already exists.',
      });
    }
  }

  listMyBlocks(blockerId: string) {
    return this.prisma.assignmentBlock.findMany({
      where: { blockerId },
      include: {
        blockedUser: { select: { id: true, nickname: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeMyBlock(blockerId: string, blockedUserId: string) {
    try {
      await this.prisma.assignmentBlock.delete({
        where: {
          blockerId_blockedUserId: { blockerId, blockedUserId },
        },
      });
    } catch {
      throw new NotFoundException();
    }
    return { ok: true };
  }
}
