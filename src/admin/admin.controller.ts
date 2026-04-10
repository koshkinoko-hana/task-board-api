import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { DeleteBlockQueryDto } from './dto/delete-block.query.dto';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Post('users/:userId/ban')
  ban(@Param('userId') userId: string) {
    return this.admin.banUser(userId);
  }

  @Post('users/:userId/unban')
  unban(@Param('userId') userId: string) {
    return this.admin.unbanUser(userId);
  }

  @Get('blocks')
  listBlocks() {
    return this.admin.listBlocks();
  }

  @Delete('blocks')
  removeBlock(
    @CurrentUser() user: JwtPayload,
    @Query() query: DeleteBlockQueryDto,
  ) {
    return this.admin.removeBlock(
      user.sub,
      query.blockerId,
      query.blockedUserId,
      query.comment,
    );
  }
}
