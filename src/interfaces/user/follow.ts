interface FollowListUser {
  user_nickname: string;
  user_email: string;
  user_image: string;
  IsFollowingThisUser: number;
  IsFollowedMe: number;
}

export interface FollowedListUser extends FollowListUser {
  following_id: string;
}

export interface FollowingListUser extends FollowListUser {
  followed_id: string;
}
