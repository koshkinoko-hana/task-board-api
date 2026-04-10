import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  listForPicker() {
    return this.prisma.user.findMany({
      where: { bannedAt: null },
      select: { id: true, nickname: true, email: true, role: true },
      orderBy: { nickname: 'asc' },
    });
  }
}
