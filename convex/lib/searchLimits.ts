export const NAME_SEARCH_LIMIT = 20;
export const NAME_PREFIX_MIN_LENGTH = 3;
export const RECORD_INDEX_LIMIT = 20;
export const PUBLIC_ID_PATTERN = /^pat-\d+$/i;

export function isPatientPublicIdQuery(query: string): boolean {
  return PUBLIC_ID_PATTERN.test(query.trim());
}
