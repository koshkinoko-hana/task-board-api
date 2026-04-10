import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddTagDto } from './dto/add-tag.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { RejectAssignmentDto } from './dto/reject-assignment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListTasksQueryDto) {
    return this.tasks.list(user, query);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasks.getById(user, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }

  @Post(':id/assignment')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasks.assign(user, id, dto);
  }

  @Post(':id/assignment/approve')
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasks.approveAssignment(user, id);
  }

  @Post(':id/assignment/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectAssignmentDto,
  ) {
    return this.tasks.rejectAssignment(user, id, dto);
  }

  @Post(':id/tags')
  addTag(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddTagDto,
  ) {
    return this.tasks.addTag(user, id, dto.name);
  }

  @Delete(':id/tags/:tagId')
  removeTag(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.tasks.removeTag(user, id, tagId);
  }
}
