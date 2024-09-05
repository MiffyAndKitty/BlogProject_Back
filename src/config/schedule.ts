export const createScheduleConfig = (
  type: 'hourly' | 'daily' | 'weekly',
  options?: { dayOfWeek?: number; hour?: number; minute?: number }
) => {
  const baseConfig = {
    hour: options?.hour ?? 0,
    minute: options?.minute ?? 0,
    tz: 'Asia/Seoul'
  };

  if (type === 'weekly') {
    return {
      ...baseConfig,
      dayOfWeek: options?.dayOfWeek ?? 1 // 기본값: 월요일
    };
  }

  return baseConfig;
};
