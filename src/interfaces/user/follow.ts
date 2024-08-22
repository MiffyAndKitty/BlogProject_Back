interface FollowListUser {
  user_nickname: string;
  user_email: string;
  user_image: string;
  IsFollowingThisUser: number;
  IsFollowedMe: number;
}

interface FollowedListUser extends FollowListUser {
  following_id: string;
}

interface FollowingListUser extends FollowListUser {
  followed_id: string;
}

interface multerListUser extends FollowListUser {
  mutual_id: string;
}
