/**
 * Wire format: `keyLookupId.rawSecret` (first dot between lookup and secret).
 * lookup id is nanoid without dots; secret may be arbitrary.
 */
export function parseBearerApiKey(authorization: string | null): { keyLookupId: string; secret: string } | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }
  const dot = token.indexOf('.');
  if (dot < 0) {
    return null;
  }
  const keyLookupId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!keyLookupId || !secret) {
    return null;
  }
  return { keyLookupId, secret };
}
