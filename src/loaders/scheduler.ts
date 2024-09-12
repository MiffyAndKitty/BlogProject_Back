import schedule from 'node-schedule';
import { createScheduleConfig } from '../config/schedule';
import { JobScheduler } from '../services/scheduler/index';

export const loadAllSchedules = () => {
  // 게시글 메트릭 업데이트 작업 (매일)
  schedule.scheduleJob(
    createScheduleConfig('daily', { hour: 0, minute: 0 }),
    JobScheduler.updateBoardMetrics
  );

  // 댓글 메트릭 업데이트 작업 (매일)
  schedule.scheduleJob(
    createScheduleConfig('daily', { hour: 0, minute: 0 }),
    JobScheduler.updateCommentMetrics // 댓글 관련 작업 추가
  );

  // 인기 태그 캐싱 작업 (매 시간마다)
  schedule.scheduleJob(createScheduleConfig('hourly', { hour: 1 }), () =>
    JobScheduler.cachePopularTags()
  );

  // 최다 팔로워 보유 블로거 캐싱 작업 (매주)
  schedule.scheduleJob(
    createScheduleConfig('weekly', { dayOfWeek: 1, hour: 0, minute: 0 }),
    () => JobScheduler.cacheTopFollowersWeekly()
  );
};
