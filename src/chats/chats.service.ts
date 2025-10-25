import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChat(dto: CreateChatDto) {
    const participantIds = Array.from(new Set(dto.participantIds || []))
      .map((id) => id.trim())
      .filter(Boolean);
    if (participantIds.length < 2) {
      throw new BadRequestException(
        'chat heeft minstens twee deelnemers nodig',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: participantIds } },
    });
    if (users.length !== participantIds.length) {
      throw new NotFoundException('één of meer gebruikers bestaan niet');
    }

    return this.prisma.chat.create({
      data: {
        participants: {
          connect: participantIds.map((id) => ({ id })),
        },
      },
      include: {
        participants: {
          select: { id: true, email: true, name: true },
        },
        messages: true,
      },
    });
  }

  async addMessage(chatId: string, dto: SendMessageDto) {
    const content = dto.content?.trim();
    if (!content) throw new BadRequestException('bericht mag niet leeg zijn');

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });
    if (!chat) throw new NotFoundException('chat niet gevonden');
    if (!chat.participants.some((p) => p.id === dto.senderId)) {
      throw new BadRequestException('gebruiker hoort niet bij deze chat');
    }

    return this.prisma.message.create({
      data: {
        chatId,
        senderId: dto.senderId,
        content,
      },
      include: {
        sender: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async getChat(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          select: { id: true, email: true, name: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (!chat) throw new NotFoundException('chat niet gevonden');
    return chat;
  }

  async listChatsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('gebruiker niet gevonden');

    return this.prisma.chat.findMany({
      where: { participants: { some: { id: userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { select: { id: true, email: true, name: true } },
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
  }
}
