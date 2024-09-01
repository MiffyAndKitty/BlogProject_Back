import schedule from 'node-schedule';
import { hourlyScheduleConfig, dailyScheduleConfig } from '../config/schedule';
import { JobScheduler } from '../services/scheduler/index';

export const dailyUpdateJob = schedule.scheduleJob(
  dailyScheduleConfig,
  JobScheduler.dailyUpdate
);

export const tagCacheJob = (limit?: number) =>
  schedule.scheduleJob(hourlyScheduleConfig, () =>
    JobScheduler.hourlyUpdate(limit)
  );
