import { TagCacheJobService } from './tagCacheJob';
import { BoardUpdateJobService } from './boardUpdateJob';
import { CommentUpdateJobService } from './commentUpdateJob';

export class JobScheduler {
  public static dailyUpdate = async () => {
    try {
      console.log(
        '[24시간 마다 실행] 조회수/좋아요수 DB에 업데이트 : ',
        new Date()
      );

      // 작업을 병렬로 실행, 실패하더라도 나머지 작업이 성공하도록 기다림
      const results = await Promise.allSettled([
        BoardUpdateJobService.updateBoard('board_view'),
        BoardUpdateJobService.updateBoard('board_like'),
        CommentUpdateJobService.updateComment('comment_like')
      ]);

      // 각 작업의 결과를 처리
      results.forEach((result, index) => {
        const jobNames = [
          '게시글 조회수 업데이트',
          '게시글 좋아요 업데이트',
          '댓글 좋아요 업데이트'
        ];

        console.log(
          `${jobNames[index]} ${result.status === 'fulfilled' && result.value ? '성공' : '실패'}`
        );
      });
    } catch (err) {
      console.error('DB 업데이트 작업을 병렬로 실행하는 중 오류가 발생', err);
    }
  };

  public static hourlyUpdate = async (limit: number = 10) => {
    try {
      await TagCacheJobService.cacheTags('tag_popular', limit);
      console.log('인기 태그 캐싱 성공');
    } catch (err) {
      console.error('인기 태그 캐싱 중 오류 발생:', err);
    }
  };
}
