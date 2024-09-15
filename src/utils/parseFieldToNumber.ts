// 배열 또는 객체 내 특정 필드를 숫자로 변환
export function parseFieldToNumber<T extends Record<string, any>>(
  data: T | T[],
  fieldName: keyof T
): T | T[] {
  try {
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
  } catch (err) {
    console.error(
      `필드 "${String(fieldName)}"를 숫자로 변환하는 중 오류 발생:`,
      err
    );
    return data; // 변환 실패 시 원래 데이터를 반환
  }
}
