import { Role } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  nickname: string;
  email: string | null;
  role: Role;
};
