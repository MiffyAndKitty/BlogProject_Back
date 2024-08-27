import { Router, Request, Response } from 'express';
import { ensureError } from '../errors/ensureError';
import {
  BasicResponse,
  SingleNotificationResponse
} from '../interfaces/response';
import { UsersService } from '../services/user/userInfo';
import { FollowService } from '../services/user/follow';
import { header, param, query, body } from 'express-validator';
import { validate } from '../middleware/express-validation';
import { DbColumnDto } from '../interfaces/dbColumn';
import {
  CommentListDto,
  FollowListDto,
  UserInfoDto,
  UserProfileDto,
  UserPwDto
} from '../interfaces/user/userInfo';
import { upload } from '../middleware/multer';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { saveNotificationService } from '../services/Notification/saveNotifications';
import { UserCommentService } from '../services/comment/userCommentList';
export const usersRouter = Router();

usersRouter.post(
  '/duplication',
  validate([
    body('column').isIn(['user_email', 'user_nickname']),
    body('data').isString()
  ]),
  async (req: Request, res: Response) => {
    try {
      const data: DbColumnDto = req.body;
      const result: BasicResponse = await UsersService.isDuplicated(data);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

usersRouter.post(
  '/duplication/password',
  validate([
    body('password')
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/)
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res
          .status(401)
          .send({ message: req.tokenMessage || '사용자 존재하지 않음' });

      const userPwDto: UserPwDto = {
        userId: req.id,
        password: req.body.password
      };
      const result: BasicResponse =
        await UsersService.checkDuplicatePassword(userPwDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 유저의 댓글 목록 조회 (GET : /users/comments)
usersRouter.get(
  '/comments',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    query('email')
      .optional({ checkFalsy: true })
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .withMessage('올바른 이메일 형식이 아닙니다.'),
    query('sort')
      .optional({ checkFalsy: true })
      .isIn(['oldest'])
      .withMessage('sort의 값이 존재한다면 "oldest" 이어야합니다.'),
    query('cursor').optional({ checkFalsy: true }).isString(),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('is-before')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value !== 'true' && value !== 'false') {
          throw new Error(
            'is-before 값이 존재한다면 true/false의 문자열이어야합니다.'
          );
        }
        return true;
      })
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const commentList: CommentListDto = {
        userId: req.id,
        email: !req.params.email ? undefined : req.params.email.split(':')[1],
        sort: req.query.sort as string,
        pageSize: req.query['page-size'] as unknown as number,
        cursor: req.query.cursor as string,
        isBefore: req.query['is-before'] === 'true' ? true : false
      };

      const result: BasicResponse =
        await UserCommentService.getAllCommentsByUserId(commentList);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 팔로우/팔로워 목록 조회 (GET : /users/follow)
usersRouter.get(
  '/:email/follow',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    query('page')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'page의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'page-size의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    param('email')
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .withMessage('올바른 이메일 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const followListDto: FollowListDto = {
        userId: req.id,
        email: req.params.email.split(':')[1],
        page: req.query.page as unknown as number,
        pageSize: req.query['page-size'] as unknown as number
      };

      const result: BasicResponse =
        await FollowService.getFollowList(followListDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 팔로우 추가 (POST : /users/follow)
usersRouter.post(
  '/follow',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('email')
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .withMessage('올바른 이메일 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res
          .status(401)
          .send({ message: req.tokenMessage || '현재 사용자 존재하지 않음' });

      const userInfoDto: UserInfoDto = {
        userId: req.id,
        email: req.body.email
      };

      const result: SingleNotificationResponse =
        await FollowService.addfollow(userInfoDto);

      if (result.result === true && result.notifications) {
        const notified =
          await saveNotificationService.createSingleUserNotification(
            result.notifications
          );
        return notified.result
          ? res.status(200).send(notified)
          : res.status(500).send(notified);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 팔로우 취소 (DELETE : /users/follow)
usersRouter.delete(
  '/follow',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('email')
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .withMessage('올바른 이메일 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res
          .status(401)
          .send({ message: req.tokenMessage || '현재 사용자 존재하지 않음' });

      const userInfoDto: UserInfoDto = {
        userId: req.id,
        email: req.body.email
      };

      const result: BasicResponse =
        await FollowService.deletefollow(userInfoDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 사용자 정보 조회 (GET : /users/:nickname)
usersRouter.get(
  '/:email',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('email')
      .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .withMessage('올바른 이메일 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userInfoDto: UserInfoDto = {
        userId: req.id,
        email: req.params.email.split(':')[1]
      };

      const result: BasicResponse = await UsersService.getUserInfo(userInfoDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res
        .status(500)
        .send({ result: false, data: [], message: error.message });
    }
  }
);

// 사용자 정보 수정 (PUT : /users)
usersRouter.put(
  '/',
  upload('user-profile-image').array('uploaded_files', 1),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('nickname')
      .optional({ checkFalsy: true })
      .isString()
      .withMessage('닉네임은 문자열이어야 합니다.'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/)
      .withMessage('비밀번호는 문자열이어야 합니다.'),
    body('statusMessage')
      .optional({ checkFalsy: true })
      .isString()
      .withMessage('상태 메시지는 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '정보를 수정할 사용자가 존재하지 않음'
        });
      }

      let fileUrl = '';
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          if ('location' in file && typeof file.location === 'string') {
            fileUrl = file.location;
          }
        });
      }

      const userProfileDto: UserProfileDto = {
        userId: req.id,
        nickname: req.body.nickname,
        password: req.body.password,
        profilePicture: fileUrl,
        statusMessage: req.body.statusMessage
      };
      const result: BasicResponse =
        await UsersService.modifyUserProfile(userProfileDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
