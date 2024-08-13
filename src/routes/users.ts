import { Router, Request, Response } from 'express';
import { ensureError } from '../errors/ensureError';
import { BasicResponse } from '../interfaces/response';
import { UsersService } from '../services/user/userInfo';
import { FollowService } from '../services/user/follow';
import { header, param, body } from 'express-validator';
import { validate } from '../middleware/express-validation';
import { DbColumnDto } from '../interfaces/dbColumn';
import { UserInfoDto, UserProfileDto } from '../interfaces/user/userInfo';
import { upload } from '../middleware/multer';
import { jwtAuth } from '../middleware/passport-jwt-checker';
export const usersRouter = Router();

usersRouter.post(
  '/duplication',
  validate([
    body('column').isIn(['user_email', 'user_nickname', 'user_password']),
    body('data')
      .isString()
      .custom((value, { req }) => {
        if (
          req.body.column === 'user_password' &&
          (value.length < 8 ||
            !/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/.test(value))
        ) {
          throw new Error(
            '비밀번호는 최소 8자 이상이면서 최소 하나의 소문자, 숫자, 특수 문자를 포함해야 합니다.'
          );
        }

        return true;
      })
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

// 팔로우/팔로워 목록 조회 (GET : /users//follow)
usersRouter.get(
  '/:nickname/follow',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('nickname').isString()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userInfoDto: UserInfoDto = {
        userId: req.id,
        nickname: req.params.nickname.split(':')[1]
      };

      const result: BasicResponse =
        await FollowService.getfollowList(userInfoDto);

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
    body('nickname').isString()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userInfoDto: UserInfoDto = {
        userId: req.id,
        nickname: req.body.nickname
      };
      console.log(userInfoDto);

      const result: BasicResponse = await FollowService.addfollow(userInfoDto);

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

// 팔로우 취소 (DELETE : /users/follow)
usersRouter.delete(
  '/follow',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('nickname').isString()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userInfoDto: UserInfoDto = {
        userId: req.id,
        nickname: req.body.nickname
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
  '/:nickname',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('nickname').isString()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const userInfoDto: UserInfoDto = {
        userId: req.id,
        nickname: req.params.nickname.split(':')[1]
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
