/**
 * How long an ALLOW decision releases records (INN-51).
 * Fixed on the server; clients never choose it. Safe to import from the
 * Next.js client.
 */

export const ALLOW_VALIDITY_MS = 24 * 60 * 60 * 1000;

export const ALLOW_EXPIRED_REASON =
  "Allowed access for this request has expired. Request access again.";

/** When an ALLOW decision made at `decidedAt` stops releasing records. */
export function allowedUntil(decidedAt: number): number {
  return decidedAt + ALLOW_VALIDITY_MS;
}

export function isAllowExpired(decidedAt: number, now: number): boolean {
  return now >= allowedUntil(decidedAt);
}
