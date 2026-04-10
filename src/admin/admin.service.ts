import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        email: true,
        role: true,
        bannedAt: true,
        createdAt: true,
      },
      orderBy: { nickname: 'asc' },
    });
  }

  async banUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date() },
    });
    return { ok: true };
  }

  async unbanUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null },
    });
    return { ok: true };
  }

  listBlocks() {
    return this.prisma.assignmentBlock.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        blocker: { select: { id: true, nickname: true, email: true } },
        blockedUser: { select: { id: true, nickname: true, email: true } },
      },
    });
  }

  async removeBlock(
    actorId: string,
    blockerId: string,
    blockedUserId: string,
    comment?: string,
  ) {
    try {
      await this.prisma.assignmentBlock.delete({
        where: {
          blockerId_blockedUserId: { blockerId, blockedUserId },
        },
      });
    } catch {
      throw new NotFoundException();
    }
    await this.prisma.blockAudit.create({
      data: {
        action: 'ADMIN_DELETE_BLOCK',
        actorId,
        blockerId,
        blockedUserId,
        comment: comment ?? null,
      },
    });
    return { ok: true };
  }
}
