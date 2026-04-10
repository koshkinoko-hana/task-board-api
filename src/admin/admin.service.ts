import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
