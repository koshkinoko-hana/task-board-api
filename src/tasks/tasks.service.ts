import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto, TaskSortField } from './dto/list-tasks.query.dto';
import { RejectAssignmentDto } from './dto/reject-assignment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const LIST_FETCH_CAP = 1000;

type TaskDbRow = Prisma.TaskGetPayload<{
  include: {
    viewers: true;
    tags: { include: { tag: true } };
    creator: { select: { id: true; nickname: true; email: true } };
    assignee: { select: { id: true; nickname: true; email: true } };
  };
}>;

/** Task row for list/detail (narrow assignee/creator for API). */
export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  visibility: TaskVisibility;
  creatorId: string;
  assigneeId: string | null;
  assignmentStatus: AssignmentStatus;
  assignedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  viewers: { userId: string }[];
  tags: { tag: { id: string; name: string } }[];
  creator: { id: string; nickname: string; email: string | null };
  assignee: { id: string; nickname: string; email: string | null } | null;
};

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private normalizeTagName(name: string): string {
    return name.trim().toLowerCase();
  }

  private isAssignmentGrandfathered(task: {
    status: TaskStatus;
    assigneeId: string | null;
    assignmentStatus: AssignmentStatus;
  }): boolean {
    if (task.status === TaskStatus.DONE) return false;
    if (!task.assigneeId) return false;
    return (
      task.assignmentStatus === AssignmentStatus.PENDING ||
      task.assignmentStatus === AssignmentStatus.APPROVED
    );
  }

  private canReadTask(
    user: JwtPayload,
    task: { creatorId: string; assigneeId: string | null; visibility: TaskVisibility; viewers: { userId: string }[] },
  ): boolean {
    if (user.role === Role.ADMIN) return true;
    if (task.visibility === TaskVisibility.ANYONE) return true;
    if (task.visibility === TaskVisibility.ONLY_ME) {
      return (
        task.creatorId === user.sub ||
        task.assigneeId === user.sub
      );
    }
    if (task.visibility === TaskVisibility.LIST) {
      return (
        task.creatorId === user.sub ||
        task.viewers.some((v) => v.userId === user.sub)
      );
    }
    return false;
  }

  private passesBlockFilter(
    viewerId: string,
    task: {
      creatorId: string;
      assigneeId: string | null;
      status: TaskStatus;
      assignmentStatus: AssignmentStatus;
    },
    neighbors: Set<string>,
  ): boolean {
    if (this.isAssignmentGrandfathered(task)) return true;
    if (
      task.creatorId !== viewerId &&
      neighbors.has(task.creatorId)
    ) {
      return false;
    }
    if (
      task.assigneeId &&
      task.assigneeId !== viewerId &&
      neighbors.has(task.assigneeId)
    ) {
      return false;
    }
    return true;
  }

  private visibilityWhereForUser(userId: string): Prisma.TaskWhereInput {
    return {
      OR: [
        {
          AND: [
            { visibility: TaskVisibility.ONLY_ME },
            { OR: [{ creatorId: userId }, { assigneeId: userId }] },
          ],
        },
        {
          AND: [
            { visibility: TaskVisibility.LIST },
            {
              OR: [
                { creatorId: userId },
                { viewers: { some: { userId } } },
              ],
            },
          ],
        },
        { visibility: TaskVisibility.ANYONE },
      ],
    };
  }

  private buildFilterWhere(query: ListTasksQueryDto): Prisma.TaskWhereInput {
    const parts: Prisma.TaskWhereInput[] = [];
    if (query.status) parts.push({ status: query.status });
    if (query.priority) parts.push({ priority: query.priority });
    if (query.assignmentStatus) {
      parts.push({ assignmentStatus: query.assignmentStatus });
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      parts.push({
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      });
    }
    if (query.tag?.trim()) {
      const name = this.normalizeTagName(query.tag);
      parts.push({
        tags: { some: { tag: { name } } },
      });
    }
    if (!parts.length) return {};
    return { AND: parts };
  }

  private async blockNeighbors(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.assignmentBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedUserId: userId }],
      },
      select: { blockerId: true, blockedUserId: true },
    });
    const set = new Set<string>();
    for (const r of rows) {
      set.add(r.blockerId === userId ? r.blockedUserId : r.blockerId);
    }
    return set;
  }

  async pairBlocked(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const row = await this.prisma.assignmentBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedUserId: b },
          { blockerId: b, blockedUserId: a },
        ],
      },
    });
    return !!row;
  }

  private async assertBecomeAssigneeAllowed(
    taskCreatorId: string,
    assigneeId: string,
  ): Promise<void> {
    const blocked = await this.pairBlocked(taskCreatorId, assigneeId);
    if (blocked) {
      throw new ConflictException({
        code: 'ASSIGNMENT_BLOCKED',
        message: 'Cannot assign or accept assignment due to a user block.',
      });
    }
  }

  private async assertPairCanAssign(
    assignerId: string,
    assigneeId: string,
  ): Promise<void> {
    if (assignerId === assigneeId) return;
    const blocked = await this.pairBlocked(assignerId, assigneeId);
    if (blocked) {
      throw new ConflictException({
        code: 'ASSIGNMENT_BLOCKED',
        message: 'Cannot assign due to a user block.',
      });
    }
  }

  private hasActiveAssignment(task: {
    assigneeId: string | null;
    assignmentStatus: AssignmentStatus;
  }): boolean {
    if (!task.assigneeId) return false;
    return (
      task.assignmentStatus === AssignmentStatus.PENDING ||
      task.assignmentStatus === AssignmentStatus.APPROVED
    );
  }

  private mapTask(task: TaskRow) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      visibility: task.visibility,
      creator: task.creator,
      assignee: task.assignee,
      assignmentStatus: task.assignmentStatus,
      assignedById: task.assignedById,
      viewerUserIds: task.viewers.map((v: { userId: string }) => v.userId),
      tags: task.tags.map((t: TaskRow['tags'][number]) => ({
        id: t.tag.id,
        name: t.tag.name,
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private includeTask() {
    return {
      viewers: true,
      tags: { include: { tag: true } },
      creator: { select: { id: true, nickname: true, email: true } },
      assignee: { select: { id: true, nickname: true, email: true } },
    } as const;
  }

  /** Normalize Prisma payload (assignee select) to TaskRow for mapping. */
  private asTaskRow(t: TaskDbRow): TaskRow {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      visibility: t.visibility,
      creatorId: t.creatorId,
      assigneeId: t.assigneeId,
      assignmentStatus: t.assignmentStatus,
      assignedById: t.assignedById,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      viewers: t.viewers.map((v) => ({ userId: v.userId })),
      tags: t.tags.map((x) => ({
        tag: { id: x.tag.id, name: x.tag.name },
      })),
      creator: t.creator,
      assignee: t.assignee,
    };
  }

  async list(user: JwtPayload, query: ListTasksQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sort = query.sort ?? TaskSortField.updatedAt;
    const order = query.order ?? 'desc';

    const filterWhere = this.buildFilterWhere(query);
    const hasFilters = Object.keys(filterWhere).length > 0;

    const where: Prisma.TaskWhereInput =
      user.role === Role.ADMIN
        ? hasFilters
          ? filterWhere
          : {}
        : {
            AND: [
              ...(hasFilters ? [filterWhere] : []),
              this.visibilityWhereForUser(user.sub),
            ],
          };

    const orderBy =
      sort === TaskSortField.title
        ? { title: order }
        : { [sort]: order };

    const rows = await this.prisma.task.findMany({
      where,
      include: this.includeTask(),
      orderBy,
      take: LIST_FETCH_CAP,
    });

    const neighbors =
      user.role === Role.ADMIN ? new Set<string>() : await this.blockNeighbors(user.sub);

    const filtered =
      user.role === Role.ADMIN
        ? rows
        : rows.filter((t: TaskDbRow) =>
            this.passesBlockFilter(user.sub, t, neighbors),
          );

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered
      .slice(start, start + pageSize)
      .map((t: TaskDbRow) => this.mapTask(this.asTaskRow(t)));

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async getById(user: JwtPayload, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.includeTask(),
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }
    return this.mapTask(this.asTaskRow(task));
  }

  async create(user: JwtPayload, dto: CreateTaskDto) {
    const visibility = dto.visibility ?? TaskVisibility.ANYONE;
    const viewerIds = [...new Set(dto.viewerUserIds ?? [])].filter(
      (id) => id && id !== user.sub,
    );
    if (visibility === TaskVisibility.LIST && viewerIds.length) {
      const count = await this.prisma.user.count({
        where: { id: { in: viewerIds }, bannedAt: null },
      });
      if (count !== viewerIds.length) {
        throw new ForbiddenException({
          code: 'INVALID_VIEWERS',
          message: 'One or more viewer user ids are invalid.',
        });
      }
    }

    const assigneeIdRaw = dto.assigneeId?.trim();
    let assigneeId: string | null = assigneeIdRaw ? assigneeIdRaw : null;
    let assignmentStatus: AssignmentStatus = AssignmentStatus.NONE;
    let assignedById: string | null = null;

    if (assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: assigneeId, bannedAt: null },
      });
      if (!assignee) {
        throw new ForbiddenException({
          code: 'INVALID_ASSIGNEE',
          message: 'Assignee not found.',
        });
      }
      await this.assertBecomeAssigneeAllowed(user.sub, assigneeId);
      await this.assertPairCanAssign(user.sub, assigneeId);
      if (assigneeId === user.sub) {
        assignmentStatus = AssignmentStatus.APPROVED;
        assignedById = user.sub;
      } else {
        assignmentStatus = AssignmentStatus.PENDING;
        assignedById = user.sub;
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        visibility,
        creatorId: user.sub,
        assigneeId,
        assignmentStatus,
        assignedById,
        ...(visibility === TaskVisibility.LIST && viewerIds.length > 0
          ? {
              viewers: {
                create: viewerIds.map((uid) => ({ userId: uid })),
              },
            }
          : {}),
      },
      include: this.includeTask(),
    });

    return this.mapTask(this.asTaskRow(task));
  }

  private assertCanEditTaskMeta(user: JwtPayload, task: { creatorId: string }) {
    if (user.role === Role.ADMIN) return;
    if (task.creatorId !== user.sub) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_EDIT',
        message: 'Only the creator or an admin can modify this task.',
      });
    }
  }

  async update(user: JwtPayload, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }

    this.assertCanEditTaskMeta(user, task);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    if (dto.visibility === TaskVisibility.LIST && dto.viewerUserIds !== undefined) {
      const viewerIds = [...new Set(dto.viewerUserIds)].filter(Boolean);
      const count = await this.prisma.user.count({
        where: { id: { in: viewerIds }, bannedAt: null },
      });
      if (count !== viewerIds.length) {
        throw new ForbiddenException({
          code: 'INVALID_VIEWERS',
          message: 'One or more viewer user ids are invalid.',
        });
      }
      await this.prisma.taskViewer.deleteMany({ where: { taskId: id } });
      if (viewerIds.length) {
        await this.prisma.taskViewer.createMany({
          data: viewerIds.map((uid) => ({ taskId: id, userId: uid })),
        });
      }
    } else if (
      dto.visibility !== undefined &&
      dto.visibility !== TaskVisibility.LIST
    ) {
      await this.prisma.taskViewer.deleteMany({ where: { taskId: id } });
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
      include: this.includeTask(),
    });
    return this.mapTask(this.asTaskRow(updated));
  }

  async remove(user: JwtPayload, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN && task.creatorId !== user.sub) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DELETE',
        message: 'Only the creator or an admin can delete this task.',
      });
    }
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  async assign(user: JwtPayload, taskId: string, dto: AssignTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, bannedAt: null },
    });
    if (!assignee) {
      throw new ForbiddenException({
        code: 'INVALID_ASSIGNEE',
        message: 'Assignee not found.',
      });
    }

    const active = this.hasActiveAssignment(task);
    const isCreatorOrAdmin =
      user.role === Role.ADMIN || task.creatorId === user.sub;

    if (active && !isCreatorOrAdmin) {
      throw new ConflictException({
        code: 'ALREADY_ASSIGNED',
        message: 'Task already has an active assignment.',
      });
    }

    if (dto.assigneeId === user.sub) {
      if (active && !isCreatorOrAdmin) {
        throw new ConflictException({
          code: 'ALREADY_ASSIGNED',
          message: 'Task already has an active assignment.',
        });
      }
      if (active && isCreatorOrAdmin) {
        // reassign to self
        await this.assertBecomeAssigneeAllowed(task.creatorId, user.sub);
        const updated = await this.prisma.task.update({
          where: { id: taskId },
          data: {
            assigneeId: user.sub,
            assignmentStatus: AssignmentStatus.APPROVED,
            assignedById: user.sub,
          },
          include: this.includeTask(),
        });
        return this.mapTask(this.asTaskRow(updated));
      }
      if (!active) {
        await this.assertBecomeAssigneeAllowed(task.creatorId, user.sub);
        const updated = await this.prisma.task.update({
          where: { id: taskId },
          data: {
            assigneeId: user.sub,
            assignmentStatus: AssignmentStatus.APPROVED,
            assignedById: user.sub,
          },
          include: this.includeTask(),
        });
        return this.mapTask(this.asTaskRow(updated));
      }
    }

    if (!isCreatorOrAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ASSIGN_OTHERS',
        message: 'Only the creator or an admin can assign another user.',
      });
    }

    await this.assertBecomeAssigneeAllowed(task.creatorId, dto.assigneeId);
    await this.assertPairCanAssign(user.sub, dto.assigneeId);

    let assignmentStatus: AssignmentStatus;
    let assignedById: string;
    if (dto.assigneeId === task.creatorId) {
      assignmentStatus = AssignmentStatus.APPROVED;
      assignedById = user.sub;
    } else {
      assignmentStatus = AssignmentStatus.PENDING;
      assignedById = user.sub;
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assigneeId: dto.assigneeId,
        assignmentStatus,
        assignedById,
      },
      include: this.includeTask(),
    });
    return this.mapTask(this.asTaskRow(updated));
  }

  async approveAssignment(user: JwtPayload, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }

    if (task.assignmentStatus !== AssignmentStatus.PENDING) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_PENDING',
        message: 'No pending assignment to approve.',
      });
    }
    if (
      user.role !== Role.ADMIN &&
      task.assigneeId !== user.sub
    ) {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNEE',
        message: 'Only the assignee or an admin can approve.',
      });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { assignmentStatus: AssignmentStatus.APPROVED },
      include: this.includeTask(),
    });
    return this.mapTask(this.asTaskRow(updated));
  }

  async rejectAssignment(
    user: JwtPayload,
    taskId: string,
    dto: RejectAssignmentDto,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }

    if (task.assignmentStatus !== AssignmentStatus.PENDING) {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_PENDING',
        message: 'No pending assignment to reject.',
      });
    }
    if (
      user.role !== Role.ADMIN &&
      task.assigneeId !== user.sub
    ) {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNEE',
        message: 'Only the assignee or an admin can reject.',
      });
    }

    const assignerId = task.assignedById;
    if (dto.blockAssigner) {
      if (!assignerId) {
        throw new ConflictException({
          code: 'NO_ASSIGNER',
          message: 'Cannot block: unknown assigner.',
        });
      }
      await this.prisma.assignmentBlock.upsert({
        where: {
          blockerId_blockedUserId: {
            blockerId: user.sub,
            blockedUserId: assignerId,
          },
        },
        create: {
          blockerId: user.sub,
          blockedUserId: assignerId,
          comment: dto.comment ?? null,
        },
        update: {
          comment: dto.comment ?? undefined,
        },
      });
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assigneeId: null,
        assignmentStatus: AssignmentStatus.REJECTED,
        assignedById: null,
      },
      include: this.includeTask(),
    });
    return this.mapTask(this.asTaskRow(updated));
  }

  async addTag(user: JwtPayload, taskId: string, name: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }
    this.assertCanEditTaskMeta(user, task);

    const normalized = this.normalizeTagName(name);
    if (!normalized.length) {
      throw new ForbiddenException({ message: 'Invalid tag name.' });
    }

    const tag = await this.prisma.tag.upsert({
      where: { name: normalized },
      create: { name: normalized },
      update: {},
    });

    try {
      await this.prisma.taskTag.create({
        data: { taskId, tagId: tag.id },
      });
    } catch {
      throw new ConflictException({
        code: 'TAG_ALREADY_ON_TASK',
        message: 'Tag already attached.',
      });
    }

    return this.getById(user, taskId);
  }

  async removeTag(user: JwtPayload, taskId: string, tagId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { viewers: true },
    });
    if (!task) throw new NotFoundException();
    if (!this.canReadTask(user, task)) throw new NotFoundException();
    if (user.role !== Role.ADMIN) {
      const neighbors = await this.blockNeighbors(user.sub);
      if (!this.passesBlockFilter(user.sub, task, neighbors)) {
        throw new NotFoundException();
      }
    }
    this.assertCanEditTaskMeta(user, task);

    try {
      await this.prisma.taskTag.delete({
        where: { taskId_tagId: { taskId, tagId } },
      });
    } catch {
      throw new NotFoundException();
    }
    return this.getById(user, taskId);
  }
}
