import { IsString } from 'class-validator';

export class CreateFriendRequestDto {
  @IsString()
  targetUserId!: string;
}
