import { formatRequestTime } from "./accessLabels";

export type GrantState = {
  expiresAt: number;
  revokedAt?: number;
};

export function isGrantLive(grant: GrantState, now: number): boolean {
  return grant.revokedAt === undefined && grant.expiresAt > now;
}

export function describeGrantStatus(grant: GrantState, now: number): string {
  if (grant.revokedAt !== undefined) {
    return `Ended early ${formatRequestTime(grant.revokedAt)}`;
  }
  if (grant.expiresAt <= now) {
    return `Expired ${formatRequestTime(grant.expiresAt)}`;
  }
  const minutesLeft = Math.max(1, Math.ceil((grant.expiresAt - now) / 60_000));
  return `Active until ${formatRequestTime(grant.expiresAt)} (${minutesLeft} min left)`;
}
