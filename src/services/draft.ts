import '../config/env';
import { InternalServerError } from '../errors/internalServerError';
import { mongodb } from '../loaders/mongodb';
import { ObjectId } from 'mongodb';
import { BasicResponse } from '../interfaces/response';
import { DraftDto, DraftIdDto, UpdateDraftDto } from '../interfaces/draft';
import { NotFoundError } from '../errors/notFoundError';
import { replaceImageUrlsWithS3Links } from '../utils/string/replaceImageUrlsWithS3Links';

export class DraftService {
  static saveDraft = async (draftDto: DraftDto): Promise<BasicResponse> => {
    const draftCollection = mongodb.db('board_db').collection('drafts');
    const draftId = new ObjectId();

    let content = draftDto.content;
    if (draftDto.fileUrls && draftDto.fileUrls.length > 0 && content) {
      const urlReplaced: false | string = replaceImageUrlsWithS3Links(
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

    if (!result.acknowledged) {
      throw new InternalServerError('임시 저장 중 오류가 발생하였습니다.');
    }
    return { result: true, message: '임시 저장에 성공하였습니다.' };
  };

  static modifyDraft = async (
    updateDraftDto: UpdateDraftDto
  ): Promise<BasicResponse> => {
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
    if (
      updateDraftDto.fileUrls &&
      updateDraftDto.fileUrls.length > 0 &&
      content
    ) {
      const urlReplaced: false | string = replaceImageUrlsWithS3Links(
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

    if (result.modifiedCount === 0)
      throw new InternalServerError(
        '임시 저장된 게시글이 수정되지 않았습니다.'
      );

    return {
      result: true,
      message: '임시 저장된 게시글 수정에 성공하였습니다.'
    };
  };

  static getDraft = async (draftIdDto: DraftIdDto) => {
    const objectId = new ObjectId(draftIdDto.draftId);
    const draftCollection = mongodb.db('board_db').collection('drafts');

    const draft = await draftCollection.findOne({
      _id: objectId
    });

    if (!draft)
      throw new NotFoundError(
        '해당 id의 임시 저장된 게시글을 찾지 못하였습니다.'
      );

    return {
      result: true,
      data: draft,
      message: '임시 저장된 게시글 반환에 성공하였습니다.'
    };
  };
}
