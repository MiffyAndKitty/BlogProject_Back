import { TagCacheJobService } from './tagCacheJob';
import { BoardUpdateJobService } from './boardUpdateJob';
import { CommentUpdateJobService } from './commentUpdateJob';
import { TopFollowersCacheJobService } from './topFollowerCacheJob';
import { CacheKeys } from '../../constants/cacheKeys';

export class JobScheduler {
  private static _logJobResult(jobName: string, isSuccess: boolean) {
    isSuccess
      ? console.log(`${jobName} 작업 성공 [${new Date()}]`)
      : console.error(`${jobName} 작업 실패 [${new Date()}]`);
  }

  public static updateBoardMetrics = async () => {
    try {
      const jobNames = ['게시글 조회수 업데이트', '게시글 좋아요 업데이트'];
      const results = await Promise.allSettled([
        BoardUpdateJobService.updateBoard(CacheKeys.BOARD_VIEW),
        BoardUpdateJobService.updateBoard(CacheKeys.BOARD_LIKE)
      ]);

      results.forEach((result, index) => {
        this._logJobResult(
          jobNames[index],
          result.status === 'fulfilled' && result.value
        );
      });
    } catch (err) {
      console.error('[ERROR] 게시글 메트릭 업데이트 중 에러 발생:', err);
    }
  };

  public static updateCommentMetrics = async () => {
    try {
      const jobName = '댓글 좋아요 업데이트';
      const result = await CommentUpdateJobService.updateCommentLikes();
      this._logJobResult(jobName, result);
    } catch (err) {
      console.error('[ERROR] 댓글 메트릭 업데이트 중 에러 발생:', err);
    }
  };

  public static cachePopularTags = async () => {
    const jobName = '인기 태그 캐싱';
    try {
      const isSuccess = await TagCacheJobService.cacheTags();
      this._logJobResult(jobName, isSuccess);
    } catch (err) {
      console.error(`[ERROR] ${jobName} 작업 중 에러 발생:`, err);
    }
  };

  public static cacheTopFollowersWeekly = async () => {
    const jobName = '최다 팔로워 보유 블로거 캐싱';
    try {
      const isSuccess = await TopFollowersCacheJobService.cacheTopFollowers();
      this._logJobResult(jobName, isSuccess);
    } catch (err) {
      console.error(`[ERROR] ${jobName} 작업 중 에러 발생:`, err);
    }
  };
}
