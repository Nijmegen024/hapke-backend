import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { FriendsService } from './friends.service';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

@UseGuards(AuthGuard('jwt'))
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get('search')
  async search(
    @Req() req: AuthenticatedRequest,
    @Query('q') query: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return [];
    }
    return this.friendsService.searchUsers(userId, query ?? '');
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      return [];
    }
    return this.friendsService.listFriends(userId);
  }

  @Get('requests')
  async pending(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      return { incoming: [], outgoing: [] };
    }
    return this.friendsService.listPending(userId);
  }

  @Post('requests')
  async send(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFriendRequestDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return;
    }
    return this.friendsService.sendRequest(userId, dto.targetUserId);
  }

  @Patch('requests/:id')
  async respond(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return;
    }
    return this.friendsService.respond(userId, id, dto.action);
  }
}
