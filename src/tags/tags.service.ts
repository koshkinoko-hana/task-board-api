import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
}
