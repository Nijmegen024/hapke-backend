import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller()
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('chats')
  create(@Body() dto: CreateChatDto) {
    return this.chatsService.createChat(dto);
  }

  @Post('chats/:chatId/messages')
  addMessage(@Param('chatId') chatId: string, @Body() dto: SendMessageDto) {
    return this.chatsService.addMessage(chatId, dto);
  }

  @Get('chats/:chatId')
  getChat(@Param('chatId') chatId: string) {
    return this.chatsService.getChat(chatId);
  }

  @Get('users/:userId/chats')
  listChatsForUser(@Param('userId') userId: string) {
    return this.chatsService.listChatsForUser(userId);
  }
}
