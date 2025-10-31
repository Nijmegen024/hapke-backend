import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChat(initiatorId: string, dto: CreateChatDto) {
    const participantIds = Array.from(new Set(dto.participantIds || []))
      .map((id) => id.trim())
      .filter(Boolean);
    if (!participantIds.includes(initiatorId)) {
      participantIds.push(initiatorId);
    }
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

  async addMessage(chatId: string, senderId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException('bericht mag niet leeg zijn');

    const chat = await this.ensureParticipant(chatId, senderId);

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        content: trimmed,
      },
      include: {
        sender: { select: { id: true, email: true, name: true } },
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return {
      ...message,
      chat: {
        id: chat.id,
      },
    };
  }

  async getChatForUser(userId: string, chatId: string) {
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
    if (!chat.participants.some((p) => p.id === userId)) {
      throw new ForbiddenException('Geen toegang tot deze chat');
    }
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
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
  }

  async getOrCreateDirectChat(currentUserId: string, otherUserId: string) {
    if (currentUserId === otherUserId) {
      throw new BadRequestException('Je kunt geen chat met jezelf starten');
    }

    await this.assertFriendship(currentUserId, otherUserId);

    const existing = await this.prisma.chat.findFirst({
      where: {
        participants: {
          every: {
            id: { in: [currentUserId, otherUserId] },
          },
        },
        AND: [
          { participants: { some: { id: currentUserId } } },
          { participants: { some: { id: otherUserId } } },
        ],
      },
      include: {
        participants: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
    if (existing && existing.participants.length === 2) {
      return existing;
    }

    return this.prisma.chat.create({
      data: {
        participants: {
          connect: [{ id: currentUserId }, { id: otherUserId }],
        },
      },
      include: {
        participants: { select: { id: true, email: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });
  }

  private async ensureParticipant(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: { select: { id: true } } },
    });
    if (!chat) {
      throw new NotFoundException('chat niet gevonden');
    }
    if (!chat.participants.some((p) => p.id === userId)) {
      throw new BadRequestException('gebruiker hoort niet bij deze chat');
    }
    return chat;
  }

  private async assertFriendship(
    currentUserId: string,
    otherUserId: string,
  ) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: currentUserId, recipientId: otherUserId },
          { requesterId: otherUserId, recipientId: currentUserId },
        ],
      },
    });
    if (!friendship) {
      throw new BadRequestException(
        'Je kunt pas chatten nadat je vrienden bent geworden',
      );
    }
  }
}
