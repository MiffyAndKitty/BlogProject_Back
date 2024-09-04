// 배열 또는 객체 내 특정 필드를 숫자로 변환
export function parseFieldToNumber<T extends Record<string, any>>(
  data: T | T[],
  fieldName: keyof T
): T | T[] {
  if (Array.isArray(data)) {
    return data.map((row) => ({
      ...row,
      [fieldName]: parseInt(row[fieldName] as string, 10)
    }));
  }
  return {
    ...data,
    [fieldName]: parseInt(data[fieldName] as string, 10)
  };
}
