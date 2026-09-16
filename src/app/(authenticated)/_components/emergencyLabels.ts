import { formatRequestTime } from "./accessLabels";

export type GrantState = {
  expiresAt: number;
  revokedAt?: number;
};

export function isGrantLive(grant: GrantState, now: number): boolean {
  return grant.revokedAt === undefined && grant.expiresAt > now;
}

export function minutesLeft(expiresAt: number, now: number): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 60_000));
}

export function describeGrantStatus(grant: GrantState, now: number): string {
  if (grant.revokedAt !== undefined) {
    return `Ended early ${formatRequestTime(grant.revokedAt)}`;
  }
  if (grant.expiresAt <= now) {
    return `Expired ${formatRequestTime(grant.expiresAt)}`;
  }
  return `Active until ${formatRequestTime(grant.expiresAt)} (${minutesLeft(grant.expiresAt, now)} min left)`;
}
