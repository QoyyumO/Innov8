import { GenericDatabaseReader } from "convex/server";
import { DataModel, Id } from "../_generated/dataModel";

type Db = GenericDatabaseReader<DataModel>;

export function assertNonEmptyString(fieldName: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`${fieldName} must not be empty`);
  }
  return trimmed;
}

export function assertDecisionReasons(reasons: string[]): string[] {
  const trimmedReasons: string[] = [];
  for (const reason of reasons) {
    const trimmed = reason.trim();
    if (trimmed !== "") {
      trimmedReasons.push(trimmed);
    }
  }
  if (trimmedReasons.length === 0) {
    throw new Error("access decision requires at least one reason");
  }
  return trimmedReasons;
}

export function assertRiskScore(riskScore: number): number {
  if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
    throw new Error("riskScore must be between 0 and 100");
  }
  return riskScore;
}

export async function requireUnusedFacilityCode(db: Db, code: string) {
  const existing = await db
    .query("facilities")
    .withIndex("by_code", (query) => query.eq("code", code))
    .unique();
  if (existing !== null) {
    throw new Error(`facility code already exists: ${code}`);
  }
}

export async function requireUnusedPatientPublicId(db: Db, publicId: string) {
  const existing = await db
    .query("patients")
    .withIndex("by_publicId", (query) => query.eq("publicId", publicId))
    .unique();
  if (existing !== null) {
    throw new Error(`patient publicId already exists: ${publicId}`);
  }
}

export async function requireUnusedWorkerId(db: Db, workerId: string) {
  const existing = await db
    .query("users")
    .withIndex("by_workerId", (query) => query.eq("workerId", workerId))
    .unique();
  if (existing !== null) {
    throw new Error(`workerId already exists: ${workerId}`);
  }
}

export async function requireUnusedDecisionRequestId(
  db: Db,
  requestId: Id<"accessRequests">,
) {
  const existing = await db
    .query("accessDecisions")
    .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
    .unique();
  if (existing !== null) {
    throw new Error(`access decision already exists for request ${requestId}`);
  }
}
