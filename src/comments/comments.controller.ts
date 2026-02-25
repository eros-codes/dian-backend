import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async createComment(@Body() createCommentDto: CreateCommentDto) {
    return await this.commentsService.createComment(createCommentDto);
  }

  @Get('public')
  async getPublicComments() {
    return await this.commentsService.getPublicComments();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getAllCommentsForAdmin() {
    return await this.commentsService.getAllCommentsForAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getCommentById(@Param('id') id: string) {
    return await this.commentsService.getCommentById(id);
  }

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async replyToComment(
    @Param('id') id: string,
    @Body() replyDto: ReplyCommentDto,
  ) {
    return await this.commentsService.replyToComment(id, replyDto);
  }

  @Patch(':id/update-reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateReply(
    @Param('id') id: string,
    @Body() replyDto: ReplyCommentDto,
  ) {
    return await this.commentsService.updateReply(id, replyDto);
  }

  @Patch(':id/remove-reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async removeReply(@Param('id') id: string) {
    return await this.commentsService.removeReply(id);
  }
}
