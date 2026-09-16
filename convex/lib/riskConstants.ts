/**
 * Risk thresholds shared by the risk engine (INN-38) and the UI.
 * Safe to import from the Next.js client.
 */

/** Requests covering at least this many records are treated as harvesting. */
export const HARVEST_RECORD_COUNT = 500;
/** Minimum score for a harvest request. */
export const HARVEST_SCORE = 94;
