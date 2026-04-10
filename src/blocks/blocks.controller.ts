import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';

@Controller('blocks')
export class BlocksController {
  constructor(private blocks: BlocksService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlockDto) {
    return this.blocks.createBlock(user.sub, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.blocks.listMyBlocks(user.sub);
  }

  @Delete('me/:blockedUserId')
  removeMine(
    @CurrentUser() user: JwtPayload,
    @Param('blockedUserId') blockedUserId: string,
  ) {
    return this.blocks.removeMyBlock(user.sub, blockedUserId);
  }
}
