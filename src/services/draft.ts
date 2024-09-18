import '../config/env';
import { InternalServerError } from '../errors/internalServerError';
import { mongodb } from '../loaders/mongodb';
import { ObjectId, Filter } from 'mongodb';
import { BasicResponse } from '../interfaces/response';
import {
  DraftDto,
  DraftIdDto,
  DraftListDto,
  UpdateDraftDto,
  DraftFilterDto
} from '../interfaces/draft';
import { NotFoundError } from '../errors/notFoundError';
import { replaceImageUrlsWithS3Links } from '../utils/string/replaceImageUrlsWithS3Links';
import { BadRequestError } from '../errors/badRequestError';
import { db } from '../loaders/mariadb';

export class DraftService {
  static getDraftList = async (draftListDto: DraftListDto) => {
    const draftCollection = mongodb.db('board_db').collection('drafts');

    const { userId, cursor, isBefore } = draftListDto;
    const pageSize = draftListDto.pageSize ?? 100;

    // 기본 검색 조건: 유저 ID
    const query: Filter<DraftFilterDto> = { userId };

    let cursorBoard = null;

    if (cursor) {
      cursorBoard = await draftCollection.findOne(
        { _id: new ObjectId(cursor), userId: userId },
        { projection: { updatedAt: 1, _id: 1 } } // updatedAt과 _id만 가져오기
      );

      if (!cursorBoard)
        throw new NotFoundError(
          '해당 커서에 해당하는 게시글을 찾을 수 없습니다.'
        );
    }

    if (cursorBoard) {
      query.$or = [
        {
          updatedAt: isBefore
            ? { $lt: cursorBoard.updatedAt }
            : { $gt: cursorBoard.updatedAt }
        },
        {
          updatedAt: cursorBoard.updatedAt, // 같은 updatedAt을 가진 경우
          _id: isBefore ? { $lt: cursorBoard._id } : { $gt: cursorBoard._id }
        }
      ];
    }

    // 전체 글 개수 계산
    const totalCount = await draftCollection.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    let draftList;

    if (cursor && isBefore == true) {
      draftList = await draftCollection
        .find(query)
        .sort({ updatedAt: 1, _id: -1 })
        .toArray();

      draftList = draftList.slice(-pageSize);
    } else {
      draftList = await draftCollection
        .find(query)
        .sort({ updatedAt: 1, _id: -1 }) // updatedAt은 내림차순, updatedAt이 동일할 때는 _id를 기준으로 오름차순 정렬
        .limit(pageSize)
        .toArray();
    }

    if (!draftList || draftList.length === 0) {
      throw new NotFoundError('저장된 게시글 목록이 없습니다.');
    }

    return {
      result: true,
      data: {
        list: draftList,
        totalCount: totalCount, // 전체 글 개수
        totalPages: totalPages // 페이지 개수
      },
      message: '임시 저장된 게시글 목록을 반환 성공했습니다.'
    };
  };

  static saveDraft = async (draftDto: DraftDto): Promise<BasicResponse> => {
    this._validateDraftFields(draftDto);

    const draftCollection = mongodb.db('board_db').collection('drafts');
    const draftId = new ObjectId();

    let content = draftDto.content;
    if (draftDto.fileUrls?.length && content) {
      content =
        replaceImageUrlsWithS3Links(content, draftDto.fileUrls) || content;
    }

    if (draftDto.categoryId)
      this._validateCategoryOwnership(draftDto.categoryId, draftDto.userId);

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

    if (!result.acknowledged) {
      throw new InternalServerError(
        '임시 저장된 게시글 저장 중 오류가 발생하였습니다.'
      );
    }
    return { result: true, message: '임시 저장에 성공하였습니다.' };
  };

  static modifyDraft = async (
    updateDraftDto: UpdateDraftDto
  ): Promise<BasicResponse> => {
    this._validateDraftFields(updateDraftDto);

    const draftCollection = mongodb.db('board_db').collection('drafts');
    const draftId = new ObjectId(updateDraftDto.draftId);

    const existingDraftCount = await draftCollection.countDocuments({
      _id: draftId
    });
    if (existingDraftCount === 0)
      throw new NotFoundError(
        '해당 ID의 임시 저장된 게시글을 찾을 수 없습니다.'
      );

    let content = updateDraftDto.content;
    if (updateDraftDto.fileUrls?.length && content) {
      content =
        replaceImageUrlsWithS3Links(content, updateDraftDto.fileUrls) ||
        content;
    }

    if (updateDraftDto.categoryId)
      this._validateCategoryOwnership(
        updateDraftDto.categoryId,
        updateDraftDto.userId
      );

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

    if (result.modifiedCount === 0)
      throw new InternalServerError(
        '임시 저장된 게시글이 수정되지 않았습니다.'
      );

    return {
      result: true,
      message: '임시 저장된 게시글 수정에 성공하였습니다.'
    };
  };

  private static _validateDraftFields(
    draftData: DraftDto | UpdateDraftDto
  ): void {
    const {
      title,
      content,
      public: isPublic,
      categoryId,
      tagNames
    } = draftData;

    if (
      !title ||
      !content ||
      isPublic === undefined ||
      !categoryId ||
      !tagNames
    ) {
      throw new BadRequestError(
        '저장할 내용이 없습니다. 최소 하나의 필드를 입력해주세요.'
      );
    }
  }

  private static async _validateCategoryOwnership(
    categoryId: string,
    userId: string
  ): Promise<void> {
    const category = await db.query(
      `SELECT 1 FROM Board_Category WHERE category_id = ? AND user_id = ?`,
      [categoryId, userId]
    );
    if (!category) {
      throw new BadRequestError('해당 유저가 소유한 카테고리 id가 아닙니다.');
    }
  }

  static getDraft = async (draftIdDto: DraftIdDto) => {
    const objectId = new ObjectId(draftIdDto.draftId);
    const draftCollection = mongodb.db('board_db').collection('drafts');

    const draft = await draftCollection.findOne({
      _id: objectId,
      userId: draftIdDto.userId
    });

    if (!draft)
      throw new NotFoundError(
        '현재 로그인한 유저가 작성한 해당 id의 임시 저장된 게시글을 찾지 못하였습니다.'
      );

    return {
      result: true,
      data: draft,
      message: '임시 저장된 게시글 반환에 성공하였습니다.'
    };
  };

  static deleteDraft = async (
    draftIdDto: DraftIdDto
  ): Promise<BasicResponse> => {
    const objectId = new ObjectId(draftIdDto.draftId);
    const draftCollection = mongodb.db('board_db').collection('drafts');

    const result = await draftCollection.deleteOne({
      _id: objectId,
      userId: draftIdDto.userId
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('임시 저장된 게시글을 찾을 수 없습니다.');
    }

    return { result: true, message: '임시 저장된 게시글이 삭제되었습니다.' };
  };
}
