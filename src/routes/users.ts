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
  UserInfoDto,
  UserEmailLookupDto,
  UserNicknameLookupDto,
  UserProfileDto,
  UserPwDto
} from '../interfaces/user/userInfo';
import { FollowListDto } from '../interfaces/user/follow';
import { LimitRequestDto } from '../interfaces/limitRequestDto';
import { upload } from '../middleware/multer';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { SaveNotificationService } from '../services/Notification/saveNotifications';
import { validateFieldByteLength } from '../utils/validation/validateFieldByteLength ';
import {
  USER_NICKNAME_MAX,
  USER_STATUS_MESSAGE_MAX
} from '../constants/validation';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';
import { resizeImage } from '../middleware/resizeImage';
export const usersRouter = Router();

// 특정 이메일/닉네임의 중복 여부 확인 (POST : /users/duplication)
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
      handleError(err, res);
    }
  }
);

// 사용자의 비밀번호 일치 여부 조회 (POST : /users/duplication/password)
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
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 사용자가 존재하지 않습니다.'
        );
      }

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
      handleError(err, res);
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
      .toInt()
      .isInt({ min: 1 })
      .withMessage(
        'page의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt()
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
      handleError(err, res);
    }
  }
);

// 이번 주 최다 팔로워 보유 블로거 리스트 조회 (GET: /users/top-followers)
usersRouter.get(
  '/top-followers',
  validate([
    query('limit')
      .optional()
      .toInt()
      .isInt({ min: 1 })
      .withMessage('limit 값은 1 이상의 양수여야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const limitRequestDto: LimitRequestDto = {
        limit: req.query.limit as unknown as number
      };
      const result: BasicResponse =
        await FollowService.getTopFollowersList(limitRequestDto);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      handleError(err, res);
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
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 사용자만 팔로우 추가를 할 수 있습니다.'
        );
      }

      const userInfoDto: UserInfoDto = {
        userId: req.id,
        email: req.body.email
      };

      const result: SingleNotificationResponse =
        await FollowService.addfollow(userInfoDto);

      if (result.result === true && result.notifications) {
        const notified =
          await SaveNotificationService.createSingleUserNotification(
            result.notifications
          );
        return notified.result
          ? res.status(200).send(notified)
          : res.status(500).send(notified);
      } else {
        return res.status(500).send(result);
      }
    } catch (err) {
      handleError(err, res);
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
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 사용자만 팔로우 취소를 할 수 있습니다.'
        );
      }

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
      handleError(err, res);
    }
  }
);

// 이메일을 이용하여 사용자 상세 정보 조회 (GET : /users/:email)
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
      const userEmailLookupDto: UserEmailLookupDto = {
        userId: req.id,
        email: req.params.email.split(':')[1]
      };

      const result: BasicResponse =
        await UsersService.getUserInfoByEmail(userEmailLookupDto);

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

// 닉네임을 이용하여 사용자 기본 정보 조회 (GET : /users/nickname/:nickname)
usersRouter.get(
  '/nickname/:nickname',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('nickname').custom((nickname) =>
      validateFieldByteLength('nickname', nickname, USER_NICKNAME_MAX)
    )
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userNicknameLookupDto: UserNicknameLookupDto = {
        userId: req.id,
        nickname: req.params.nickname.split(':')[1]
      };

      const result: BasicResponse = await UsersService.getUserInfoByNickname(
        userNicknameLookupDto
      );

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
  resizeImage(),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('nickname')
      .optional({ checkFalsy: true })
      .custom((nickname) =>
        validateFieldByteLength('nickname', nickname, USER_NICKNAME_MAX)
      ),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/)
      .withMessage('비밀번호는 문자열이어야 합니다.'),
    body('statusMessage')
      .optional({ checkFalsy: true })
      .custom((statusMessage) =>
        validateFieldByteLength(
          'statusMessage',
          statusMessage,
          USER_STATUS_MESSAGE_MAX
        )
      )
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 사용자만 정보를 수정할 수 있습니다.'
        );
      }
      let fileUrl;
      if (Array.isArray(req.fileURL)) fileUrl = req.fileURL[0];

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
      handleError(err, res);
    }
  }
);
