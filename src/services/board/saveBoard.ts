import '../../config/env';
import { db } from '../../loaders/mariadb';
import { mongodb } from '../../loaders/mongodb';
import { ObjectId } from 'mongodb';
import { ensureError } from '../../errors/ensureError';
import { boardDto, modifiedBoardDto } from '../../interfaces/board/board';
import { v4 as uuidv4 } from 'uuid';
import {
  BasicResponse,
  SingleNotificationResponse
} from '../../interfaces/response';
import {
  DraftDto,
  DraftIdDto,
  UpdateDraftDto
} from '../../interfaces/board/draft';

export class saveBoardService {
  static modifyBoard = async (
    boardDto: modifiedBoardDto
  ): Promise<SingleNotificationResponse> => {
    try {
      // content의 사진 url를 s3에 저장된 url로 변경
      const [original] = await db.query(
        'SELECT * from Board WHERE board_id = ?  AND deleted_at IS NULL LIMIT 1',
        [boardDto.boardId]
      );

      let query = 'UPDATE Board SET';
      const params = [];

      if (boardDto.title !== original.board_title) {
        query += params.length > 0 ? ', board_title = ?' : ' board_title = ?';
        params.push(boardDto.title);
      }

      if (boardDto.content !== original.board_content) {
        let content: string = boardDto.content;
        if (boardDto.fileUrls) {
          const urlReplaced: false | string =
            await saveBoardService._savedImage(
              boardDto.content,
              boardDto.fileUrls
            );
          if (urlReplaced !== undefined && urlReplaced !== false)
            content = urlReplaced;
        }
        query +=
          params.length > 0 ? ', board_content = ?' : ' board_content = ?';
        params.push(content);
      }

      if (boardDto.public !== original.board_public) {
        query += params.length > 0 ? ', board_public = ?' : ' board_public = ?';
        params.push(boardDto.public);
      }

      if (boardDto.categoryId !== original.board_category_id) {
        query += params.length > 0 ? ', category_id = ?' : ' category_id = ?';
        params.push(boardDto.categoryId);
      }

      query += ' WHERE board_id = ? AND user_id = ? AND deleted_at IS NULL;';
      params.push(boardDto.boardId, boardDto.userId);

      console.log('query : ', query);
      console.log('params : ', params);

      const modified = await db.query(query, params);
      console.log(modified);

      if (modified.affectedRows < 0)
        return { result: false, message: '게시글 수정 실패' };

      if (boardDto.tagNames && boardDto.tagNames.length > 0) {
        // 기존 태그 삭제 후 새로 저장
        await db.query(
          'DELETE FROM Board_Tag WHERE board_id = ?',
          boardDto.boardId!
        );
        const savedTag = await saveBoardService._savedTags(
          boardDto.boardId,
          boardDto.tagNames
        );
        savedTag.result
          ? { result: true, message: '태그와 게시글 수정 성공' }
          : { result: false, message: '태그와 게시글 수정 실패' };
      }
      return { result: true, message: '게시글 수정 성공' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static createBoard = async (
    boardDto: boardDto
  ): Promise<SingleNotificationResponse> => {
    try {
      const boardId = uuidv4().replace(/-/g, '');
      // content의 사진 url를 s3에 저장된 url로 변경
      console.log('boardId', boardId);
      let content: string = boardDto.content;
      if (boardDto.fileUrls) {
        const urlReplaced: false | string = await saveBoardService._savedImage(
          boardDto.content,
          boardDto.fileUrls
        );
        if (urlReplaced !== undefined && urlReplaced !== false)
          content = urlReplaced;
      }

      const saved = await db.query(
        'INSERT INTO Board (board_id, user_id, board_title, board_content, board_public, category_id) VALUES (?, ?, ?, ?, ?, ?)',
        [
          boardId,
          boardDto.userId,
          boardDto.title,
          content,
          boardDto.public,
          boardDto.categoryId
        ]
      );

      if (saved.affectedRows !== 1)
        return { result: false, message: '게시글 저장 실패' };

      if (boardDto.tagNames && boardDto.tagNames.length > 0) {
        const savedTag = await saveBoardService._savedTags(
          boardId,
          boardDto.tagNames
        );
        savedTag.result
          ? { result: true, message: '태그와 게시글 저장 성공' }
          : { result: false, message: '태그와 게시글 저장 실패' };
      }

      const [writer] = await db.query(
        'SELECT user_id, user_nickname, user_email, user_image From User WHERE user_id =?;',
        [boardDto.userId]
      );

      return {
        result: true,
        notifications: {
          type: 'following-new-board',
          trigger: {
            id: writer.user_id,
            nickname: writer.user_nickname,
            email: writer.user_email,
            image: writer.user_image
          },
          location: {
            boardId: boardId,
            boardTitle: boardDto.title
          }
        },
        message: '게시글 저장 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
  static saveDraft = async (draftDto: DraftDto): Promise<BasicResponse> => {
    try {
      const draftCollection = mongodb.db('board_db').collection('drafts');
      const draftId = new ObjectId();

      let content = draftDto.content;
      if (draftDto.fileUrls && draftDto.fileUrls.length > 0 && content) {
        const urlReplaced: false | string = await saveBoardService._savedImage(
          content,
          draftDto.fileUrls
        );
        if (urlReplaced) content = urlReplaced;
      }

      const result = await draftCollection.insertOne({
        _id: draftId,
        userId: draftDto.userId,
        title: draftDto.title,
        content: content,
        public: draftDto.public,
        categoryId: draftDto.categoryId,
        tagNames: draftDto.tagNames || [],
        updatedAt: new Date()
      });

      return result.acknowledged
        ? { result: true, message: '임시 저장 성공' }
        : { result: false, message: '임시 저장 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static modifyDraft = async (
    updateDraftDto: UpdateDraftDto
  ): Promise<BasicResponse> => {
    try {
      const draftCollection = mongodb.db('board_db').collection('drafts');
      const draftId = new ObjectId(updateDraftDto.draftId);

      const existingDraftCount = await draftCollection.countDocuments({
        _id: draftId
      });
      if (existingDraftCount === 0) {
        return {
          result: false,
          message: '해당 ID의 임시 저장된 문서를 찾을 수 없습니다.'
        };
      }

      let content = updateDraftDto.content;
      if (
        updateDraftDto.fileUrls &&
        updateDraftDto.fileUrls.length > 0 &&
        content
      ) {
        const urlReplaced: false | string = await saveBoardService._savedImage(
          content,
          updateDraftDto.fileUrls
        );
        if (urlReplaced) content = urlReplaced;
      }

      const result = await draftCollection.updateOne(
        { _id: draftId },
        {
          $set: {
            userId: updateDraftDto.userId,
            title: updateDraftDto.title,
            content: content,
            public: updateDraftDto.public,
            categoryId: updateDraftDto.categoryId,
            tagNames: updateDraftDto.tagNames || [],
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount === 0
        ? { result: false, message: '문서가 수정되지 않았습니다.' }
        : { result: true, message: '임시 저장 성공' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static getDraft = async (draftIdDto: DraftIdDto) => {
    try {
      const objectId = new ObjectId(draftIdDto.draftId);
      const draftCollection = mongodb.db('board_db').collection('drafts');

      const draft = await draftCollection.findOne({
        _id: objectId
      });

      return draft
        ? {
            result: true,
            data: draft,
            message: '임시 저장된 게시글 반환 성공'
          }
        : {
            result: false,
            message: '임시 저장된 게시글 반환 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  private static _savedTags = async (
    boardId: string,
    tagNames: Array<string>
  ) => {
    try {
      for (const tag of tagNames) {
        // 게시판 태그 테이블에 태그 이름 + 게시글 아이디 저장
        const savedBoardTag = await db.query(
          'INSERT INTO Board_Tag (tag_name, board_id) VALUES (?, ?)',
          [tag, boardId]
        );

        if (savedBoardTag.affectedRows !== 1) {
          break; // 게시글 태그 저장 실패
        }
      }

      return { result: true, message: '게시글 태그 저장 성공' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  private static _savedImage = async (
    content: string,
    fileUrls: Array<string>
  ) => {
    try {
      const pattern = /(<img[^>]*src=['"])([^'"]+)(['"][^>]*>)/g; // p1, p2, p3
      const skipUrlPrefix = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`;

      let index = 0;
      let replacedContent = content;

      replacedContent = replacedContent.replace(
        pattern,
        (match, p1, p2, p3) => {
          if (p2.startsWith(skipUrlPrefix)) {
            return match; // Return the original match without modification
          }
          const imageUrl = fileUrls[index];
          index++;
          return `${p1}${imageUrl}${p3}`;
        }
      );

      return replacedContent;
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return false;
    }
  };
}
