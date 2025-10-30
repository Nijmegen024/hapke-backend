import { IsIn } from 'class-validator';

export class RespondFriendRequestDto {
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';
}
