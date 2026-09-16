/**
 * Dashboard limits and day boundaries (INN-43).
 * Safe to import from the Next.js client.
 */

/** West Africa Time is UTC+1 all year (no daylight saving). */
const LAGOS_UTC_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows in a dashboard's recent-requests table. */
export const RECENT_REQUEST_LIMIT = 10;
/** How many of a clinician's newest requests are searched for a blocked harvest. */
export const HARVEST_LOOKBACK_LIMIT = 50;
/** Cap for "requests today" and "blocked today". */
export const TODAY_COUNT_LIMIT = 100;
/** Cap for the open-alert count. */
export const OPEN_ALERT_COUNT_LIMIT = 200;
/** Cap for "audit events today". */
export const AUDIT_TODAY_COUNT_LIMIT = 200;
/** Live break-glass grants listed on a dashboard. */
export const ACTIVE_GRANT_LIMIT = 20;
/** Live grants scanned (soonest expiry first) when filtering to one facility (INN-52). */
export const ACTIVE_GRANT_SCAN_LIMIT = 100;
/** Facilities listed on `/facilities`. */
export const FACILITY_LIST_LIMIT = 50;

/** Midnight in Lagos for the day containing `timestamp`, as epoch ms. */
export function startOfLagosDay(timestamp: number): number {
  const lagosTime = timestamp + LAGOS_UTC_OFFSET_MS;
  return lagosTime - (lagosTime % DAY_MS) - LAGOS_UTC_OFFSET_MS;
}

/**
 * Clients pass `since` so the query cache key is the calendar day. Never
 * honour a window that starts before the current Lagos midnight.
 */
export function clampDashboardSince(requestedSince: number, now: number): number {
  return Math.max(requestedSince, startOfLagosDay(now));
}

/** "12", or "100+" when a bounded count hit its cap. */
export function formatBoundedCount(count: number, isCapped: boolean): string {
  return isCapped ? `${count}+` : String(count);
}
