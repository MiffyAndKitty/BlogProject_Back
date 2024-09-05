export const transformToZaddEntries = (
  results:
    | Array<Record<string, string | number>>
    | Record<string, string | number>, // 객체 또는 배열 지원
  nameKey: string,
  countKey: string
): Array<string | number> => {
  // 객체일 경우 배열로 변환
  if (typeof results === 'object') results = Object.values(results);

  // [ score1 member1 score2 member2 .. ] 의 형태로 변환 처리
  return results.reduce((zaddEntries: (string | number)[], item) => {
    const count = Number(item[countKey]) || 0;
    zaddEntries.push(count, item[nameKey]);
    return zaddEntries;
  }, []);
};
