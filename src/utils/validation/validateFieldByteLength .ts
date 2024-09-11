export function validateFieldByteLength(
  fieldName: string,
  value: string,
  maxByteLength: number
) {
  // TextEncoder로 바이트 길이 계산
  const byteLength = new TextEncoder().encode(value).length;

  if (byteLength > maxByteLength) {
    throw new Error(
      `${fieldName}은(는) 최대 ${maxByteLength}바이트까지 허용됩니다.`
    );
  }
  return true;
}
