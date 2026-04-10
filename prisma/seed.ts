import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { loadEnvFile } from '../src/load-env';

loadEnvFile();

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { nickname: 'admin' },
    update: {
      passwordHash,
      role: Role.ADMIN,
      bannedAt: null,
      email: 'admin@example.com',
    },
    create: {
      nickname: 'admin',
      email: 'admin@example.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { nickname: 'user' },
    update: {
      passwordHash,
      role: Role.USER,
      bannedAt: null,
      email: 'user@example.com',
    },
    create: {
      nickname: 'user',
      email: 'user@example.com',
      passwordHash,
      role: Role.USER,
    },
  });

  console.log(
    'Seeded nicknames admin / user (password: password123). Emails kept for future mail features.',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
