# Task board API

NestJS + Prisma 7 + SQLite backend for a course-style task board: roles (user/admin), task lifecycle, visibility, assignments (approve/reject + block), tags, and admin ban/block tools.

## Prerequisites

- Node.js 20+
- If `npm install` fails with `EPERM` on the global npm cache, use a project-local cache:

```bash
npm install --cache ./.npm-cache
```

## Setup

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Default URL: `http://localhost:3000`

## Seeded accounts

| Nickname | Password      | Role  | Email (optional, for future mail) |
|----------|---------------|-------|-----------------------------------|
| admin    | password123   | ADMIN | admin@example.com                 |
| user     | password123   | USER  | user@example.com                  |

## Auth

Login and registration use a **nickname** (3–24 chars: `a-z`, `0-9`, `_`, stored lowercase). **Email** is optional on register and kept for a possible future verification / notification flow.

- `POST /auth/register` — body: `{ "nickname", "password", "email?" }`
- `POST /auth/login` — body: `{ "nickname", "password" }` — returns `{ accessToken, user: { id, nickname, email, role } }`
- `PATCH /auth/password` — body: `{ "currentPassword", "newPassword" }` (min 8 chars); **Bearer** required; returns `{ "ok": true }`
- Send `Authorization: Bearer <accessToken>` on protected routes.

Banned users receive **403** with `{ "code": "BANNED" }`.

## Main routes

- `GET/POST /tasks`, `GET/PUT/DELETE /tasks/:id` — **PUT** replaces full task metadata (`title`, `description`, `status`, `priority`, `visibility`, `viewerUserIds`); creator or admin only
- `PATCH /tasks/:id/assignee-status` — body `{ "status" }` (approved assignee or admin; workflow status only)
- `POST /tasks/:id/assignment` — body `{ "assigneeId" }` (self-assign when unassigned; creator/admin assigns others)
- `POST /tasks/:id/assignment/approve` | `.../reject` — reject body may include `blockAssigner`, `comment`
- `POST /tasks/:id/tags` — `{ "name" }` · `DELETE /tasks/:id/tags/:tagId`
- `GET /tags` — all tags (`id`, `name`) for filters; use `name` with `GET /tasks?tag=…`
- `GET /users` — id/email list for pickers
- `POST /blocks` — `{ "blockedUserId", "comment?" }` · `GET /blocks/me` · `DELETE /blocks/me/:blockedUserId`
- Admin: `GET /admin/users` (all users, including banned — `bannedAt`, no passwords) · `POST /admin/users/:userId/ban` · `.../unban` · `GET /admin/blocks` · `DELETE /admin/blocks?blockerId=&blockedUserId=&comment?`

## Query params (optional)

`GET /tasks` supports `page`, `pageSize`, **`status`**, **`priority`**, and **`tag`** each **repeatable** (OR within that dimension: e.g. `?status=TODO&status=DONE` matches either status; multiple `tag` = task has **at least one** of those tags), `assignmentStatus`, `q`, `sort` (`createdAt` | `updatedAt` | `title`), `order` (`asc` | `desc`), and **`mine`**: `created` / `assigned` / `involved` / omit. Listing applies visibility + pairwise block rules; illegal filter combinations yield **200** with an empty page where applicable.

## Prisma

- Schema: `prisma/schema.prisma`
- DB URL and migrations: `prisma.config.ts` (Prisma 7)
- Runtime client uses `@prisma/adapter-better-sqlite3` (see `src/prisma/prisma.service.ts`)
