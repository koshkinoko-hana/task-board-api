import { Controller, Get } from '@nestjs/common';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private tags: TagsService) {}

  @Get()
  list() {
    return this.tags.list();
  }
}
