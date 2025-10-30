import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RelationshipState =
  | 'NONE'
  | 'FRIEND'
  | 'PENDING_OUTGOING'
  | 'PENDING_INCOMING';

type PendingFriendPayload = {
  friendshipId: string;
  createdAt: Date;
  requester: { id: string; email: string; name: string | null };
  addressee: { id: string; email: string; name: string | null };
};

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(currentUserId: string, query: string) {
    const term = query?.trim();
    if (!term) {
      return [];
    }

    const matches = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: [
        { name: 'asc' },
        { email: 'asc' },
      ],
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    if (matches.length === 0) {
      return [];
    }

    const friendshipRows = await this.prisma.friendship.findMany({
      where: {
        OR: [
          {
            requesterId: currentUserId,
            addresseeId: { in: matches.map((m) => m.id) },
          },
          {
            addresseeId: currentUserId,
            requesterId: { in: matches.map((m) => m.id) },
          },
        ],
      },
    });

    const relationshipByUser = new Map<
      string,
      { status: RelationshipState; friendshipId: string | null }
    >();

    for (const row of friendshipRows) {
      const status = this.mapStatus(currentUserId, row);
      relationshipByUser.set(row.requesterId === currentUserId ? row.addresseeId : row.requesterId, {
        status,
        friendshipId: row.id,
      });
    }

    return matches.map((user) => {
      const relationship =
        relationshipByUser.get(user.id) ?? { status: 'NONE', friendshipId: null };
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        relationship: relationship.status,
        friendshipId: relationship.friendshipId,
      };
    });
  }

  async listFriends(currentUserId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: currentUserId },
          { addresseeId: currentUserId },
        ],
      },
      orderBy: [{ respondedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        requester: { select: { id: true, email: true, name: true } },
        addressee: { select: { id: true, email: true, name: true } },
      },
    });

    return friendships.map((friendship) => {
      const otherUser =
        friendship.requesterId === currentUserId
          ? friendship.addressee
          : friendship.requester;
      return {
        friendshipId: friendship.id,
        user: otherUser,
      };
    });
  }

  async listPending(currentUserId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        OR: [
          { requesterId: currentUserId },
          { addresseeId: currentUserId },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        requester: { select: { id: true, email: true, name: true } },
        addressee: { select: { id: true, email: true, name: true } },
      },
    });

    const incoming: PendingFriendPayload[] = [];
    const outgoing: PendingFriendPayload[] = [];
    for (const row of rows) {
      const payload = {
        friendshipId: row.id,
        createdAt: row.createdAt,
        requester: row.requester,
        addressee: row.addressee,
      };
      if (row.addresseeId === currentUserId) {
        incoming.push(payload);
      } else {
        outgoing.push(payload);
      }
    }

    return { incoming, outgoing };
  }

  async sendRequest(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Je kunt jezelf niet toevoegen');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Gebruiker niet gevonden');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: currentUserId },
        ],
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new BadRequestException('Jullie zijn al vrienden');
      }
      if (existing.status === FriendshipStatus.PENDING) {
        if (existing.requesterId === currentUserId) {
          throw new BadRequestException('Je hebt al een verzoek verstuurd');
        }
        throw new BadRequestException(
          'Deze persoon heeft jou al een verzoek gestuurd',
        );
      }
      return this.prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: currentUserId,
          addresseeId: targetUserId,
          status: FriendshipStatus.PENDING,
          respondedAt: null,
        },
      });
    }

    return this.prisma.friendship.create({
      data: {
        requesterId: currentUserId,
        addresseeId: targetUserId,
      },
    });
  }

  async respond(
    currentUserId: string,
    friendshipId: string,
    action: 'accept' | 'decline',
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) {
      throw new NotFoundException('Verzoek niet gevonden');
    }
    if (friendship.addresseeId !== currentUserId) {
      throw new BadRequestException('Je kunt dit verzoek niet wijzigen');
    }
    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Dit verzoek is al afgehandeld');
    }

    const status =
      action === 'accept'
        ? FriendshipStatus.ACCEPTED
        : FriendshipStatus.DECLINED;

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status,
        respondedAt: new Date(),
      },
    });
  }

  async ensureFriendship(currentUserId: string, otherUserId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: currentUserId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: currentUserId },
        ],
      },
    });
    return Boolean(friendship);
  }

  private mapStatus(
    currentUserId: string,
    row: { requesterId: string; addresseeId: string; status: FriendshipStatus },
  ): RelationshipState {
    if (row.status === FriendshipStatus.ACCEPTED) {
      return 'FRIEND';
    }
    if (row.status === FriendshipStatus.PENDING) {
      return row.requesterId === currentUserId
        ? 'PENDING_OUTGOING'
        : 'PENDING_INCOMING';
    }
    return 'NONE';
  }
}
