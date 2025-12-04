import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createComment(createCommentDto: CreateCommentDto) {
    return await this.prisma.comment.create({
      data: {
        name: createCommentDto.name || null,
        message: createCommentDto.message,
        isReplied: false,
      },
    });
  }

  async getPublicComments() {
    return await this.prisma.comment.findMany({
      where: { isReplied: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllCommentsForAdmin() {
    return await this.prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCommentById(id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('کامنت یافت نشد');
    }
    return comment;
  }

  async replyToComment(id: string, replyDto: ReplyCommentDto) {
    await this.getCommentById(id);
    return await this.prisma.comment.update({
      where: { id },
      data: {
        adminReply: replyDto.adminReply,
        isReplied: true,
      },
    });
  }

  async updateReply(id: string, replyDto: ReplyCommentDto) {
    const comment = await this.getCommentById(id);
    if (!comment.isReplied) {
      throw new NotFoundException('این کامنت هنوز پاسخی ندارد');
    }
    return await this.prisma.comment.update({
      where: { id },
      data: {
        adminReply: replyDto.adminReply,
      },
    });
  }

  async removeReply(id: string) {
    await this.getCommentById(id);
    return await this.prisma.comment.update({
      where: { id },
      data: {
        adminReply: null,
        isReplied: false,
      },
    });
  }
}
