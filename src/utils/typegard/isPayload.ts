export function isPayload(
  payload: any
): payload is { id: string; iat: number; exp: number } {
  return (
    typeof payload === 'object' &&
    'id' in payload &&
    'iat' in payload &&
    'exp' in payload &&
    payload.id &&
    payload.iat &&
    payload.exp
  );
}
