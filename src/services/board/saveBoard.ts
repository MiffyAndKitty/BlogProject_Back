import '../../config/env';
import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { boardDto, modifiedBoardDto } from '../../interfaces/board/board';
import { v4 as uuidv4 } from 'uuid';
import { SingleNotificationResponse } from '../../interfaces/response';

export class saveBoardService {
  static modifyBoard = async (boardDto: modifiedBoardDto) => {
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
      return {
        result: true,
        notifications: {
          trigger: boardDto.userId!,
          type: 'following-new-board',
          location: boardId
        },
        message: '게시글 저장 성공'
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
