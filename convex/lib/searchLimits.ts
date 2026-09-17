export const NAME_SEARCH_LIMIT = 20;
export const NAME_PREFIX_MIN_LENGTH = 3;
export const RECORD_INDEX_LIMIT = 20;
export const PUBLIC_ID_PATTERN = /^pat-\d+$/i;

export function isPatientPublicIdQuery(query: string): boolean {
  return PUBLIC_ID_PATTERN.test(query.trim());
}

/** Collapse whitespace and lowercase so the B-tree key is stable. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True when this query reaches an index — a public ID, or a name prefix long
 * enough to search on. Everything else is rejected before any lookup runs,
 * so it is not a search and must not be audited as one.
 */
export function isSearchableQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed === "") {
    return false;
  }
  if (isPatientPublicIdQuery(trimmed)) {
    return true;
  }
  return normalizeSearchQuery(trimmed).length >= NAME_PREFIX_MIN_LENGTH;
}
