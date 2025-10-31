import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

@UseGuards(AuthGuard('jwt'))
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) return [];
    return this.chatsService.listChatsForUser(userId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateChatDto) {
    const userId = req.user?.id;
    if (!userId) return;
    return this.chatsService.createChat(userId, dto);
  }

  @Post('direct/:userId')
  getOrCreateDirectChat(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    const currentUserId = req.user?.id;
    if (!currentUserId) return;
    return this.chatsService.getOrCreateDirectChat(currentUserId, userId);
  }

  @Get(':chatId')
  getChat(
    @Req() req: AuthenticatedRequest,
    @Param('chatId') chatId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) return;
    return this.chatsService.getChatForUser(userId, chatId);
  }

  @Post(':chatId/messages')
  addMessage(
    @Req() req: AuthenticatedRequest,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    const userId = req.user?.id;
    if (!userId) return;
    return this.chatsService.addMessage(chatId, userId, dto.content);
  }
}
