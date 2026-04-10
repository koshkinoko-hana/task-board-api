import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? 'file:./dev.db';
    super({
      adapter: new PrismaBetterSqlite3({ url }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
