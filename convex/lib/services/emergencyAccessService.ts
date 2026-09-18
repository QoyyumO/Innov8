import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { RecordType } from "../domain";
import {
  EMERGENCY_ACCESS_TTL_MS,
  EMERGENCY_ALREADY_ACTIVE_CODE,
  EMERGENCY_ALREADY_ACTIVE_MESSAGE,
  EMERGENCY_GRANT_ALREADY_ENDED_CODE,
  EMERGENCY_GRANT_ALREADY_ENDED_MESSAGE,
  EMERGENCY_GRANT_NOT_FOUND_CODE,
  EMERGENCY_GRANT_NOT_FOUND_MESSAGE,
  EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE,
  EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE,
  JUSTIFICATION_MAX_LENGTH,
  JUSTIFICATION_MIN_LENGTH,
  JUSTIFICATION_TOO_LONG_CODE,
  JUSTIFICATION_TOO_LONG_MESSAGE,
  JUSTIFICATION_TOO_SHORT_CODE,
  JUSTIFICATION_TOO_SHORT_MESSAGE,
} from "../emergencyConstants";
import { resolveReviewerScope, scopeIncludesRequest } from "../facilityScope";
import { PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE } from "../authConstants";
import { throwAppError } from "../appError";
import {
  normalizePublicId,
  normalizeRecordTypes,
  assertRecordTypesAllowedForRoles,
  resolveAccessTarget,
} from "./accessControlService";
import { raiseEmergencyAlert } from "./alertService";
import { appendAuditEvent } from "./auditLogService";

/**
 * Emergency access service (INN-41).
 *
 * Break-glass is the explicit override when normal ALLOW cannot complete.
 * It must be justified, short-lived, audited, and visible to security.
 * The grant — not a risk decision — governs access to its request
 * (see `recordExchangeService.resolveViewAuthorisation`).
 */

const GRANT_LOOKUP_LIMIT = 50;
const SINGLE_PATIENT_RECORD_COUNT = 1;

export type SessionContext = {
  user: Doc<"users">;
  session: Doc<"sessions">;
};

export type GrantInput = {
  publicId: string;
  justification: string;
  recordTypes: RecordType[];
  requestId?: Id<"accessRequests">;
};

export function isLiveGrant(grant: Doc<"emergencyAccess">, now: number): boolean {
  return grant.revokedAt === undefined && grant.expiresAt > now;
}

export function normalizeJustification(justification: string): string {
  const trimmed = justification.trim();
  if (trimmed.length < JUSTIFICATION_MIN_LENGTH) {
    throwAppError(JUSTIFICATION_TOO_SHORT_CODE, JUSTIFICATION_TOO_SHORT_MESSAGE);
  }
  if (trimmed.length > JUSTIFICATION_MAX_LENGTH) {
    throwAppError(JUSTIFICATION_TOO_LONG_CODE, JUSTIFICATION_TOO_LONG_MESSAGE);
  }
  return trimmed;
}

export async function listGrantsForRequest(
  db: DatabaseReader,
  requestId: Id<"accessRequests">,
): Promise<Doc<"emergencyAccess">[]> {
  return await db
    .query("emergencyAccess")
    .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
    .order("desc")
    .take(GRANT_LOOKUP_LIMIT);
}

/**
 * The newest grant on a request, or null. A request can carry several: once a
 * 15-minute grant lapses the clinician may break glass on it again, and only
 * the latest one says whether emergency access is live right now. `.first()`
 * without an order returns the OLDEST row, so every caller must share this.
 *
 * "Newest" here is insertion order (`by_requestId` tiebreaks on
 * `_creationTime`), not the largest `grantedAt`. They agree because
 * `grantBreakGlass` is the only writer and stamps `grantedAt: now` as it
 * inserts. A back-dated grant would break that, so if one is ever written,
 * this needs a `by_requestId_grantedAt` index rather than a sort here.
 */
export async function findLatestGrantForRequest(
  db: DatabaseReader,
  requestId: Id<"accessRequests">,
): Promise<Doc<"emergencyAccess"> | null> {
  return await db
    .query("emergencyAccess")
    .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
    .order("desc")
    .first();
}

/** The caller's live grant for a patient, newest first, or null. */
export async function findLiveGrantForPatient(
  db: DatabaseReader,
  actorId: Id<"users">,
  patientId: Id<"patients">,
  now: number,
): Promise<Doc<"emergencyAccess"> | null> {
  const grants = await db
    .query("emergencyAccess")
    .withIndex("by_actorId_and_patientId", (query) =>
      query.eq("actorId", actorId).eq("patientId", patientId),
    )
    .order("desc")
    .take(GRANT_LOOKUP_LIMIT);
  return grants.find((grant) => isLiveGrant(grant, now)) ?? null;
}

async function requireEligibleRequest(
  db: DatabaseReader,
  user: Doc<"users">,
  requestId: Id<"accessRequests">,
  publicId: string,
): Promise<Doc<"accessRequests">> {
  const request = await db.get(requestId);
  const patient = request ? await db.get(request.patientId) : null;
  const decision = request
    ? await db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
        .unique()
    : null;
  const isEligible =
    request !== null &&
    request.actorId === user._id &&
    patient?.publicId === normalizePublicId(publicId) &&
    (request.recordCount ?? 1) === SINGLE_PATIENT_RECORD_COUNT &&
    decision !== null &&
    decision.outcome !== "ALLOW";
  if (!isEligible || !request) {
    throwAppError(EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE, EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE);
  }
  return request;
}

/**
 * Creates (or links) the request, inserts the grant, audits, and raises a
 * security alert. The caller schedules expiry.
 */
export async function grantBreakGlass(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  input: GrantInput,
  now: number,
) {
  const justification = normalizeJustification(input.justification);
  // A linked grant covers exactly what the earlier request asked for;
  // the client's record types only apply to a new emergency request.
  const linked = input.requestId
    ? await requireEligibleRequest(db, user, input.requestId, input.publicId)
    : null;
  const recordTypes = linked?.recordTypes ?? normalizeRecordTypes(input.recordTypes);
  if (!linked) {
    assertRecordTypesAllowedForRoles(user.roles, recordTypes);
  }
  const target = await resolveAccessTarget(db, user, input.publicId, recordTypes);

  if (await findLiveGrantForPatient(db, user._id, target.patient._id, now)) {
    throwAppError(EMERGENCY_ALREADY_ACTIVE_CODE, EMERGENCY_ALREADY_ACTIVE_MESSAGE);
  }

  let requestId: Id<"accessRequests">;
  if (linked) {
    requestId = linked._id;
  } else {
    requestId = await db.insert("accessRequests", {
      actorId: user._id,
      sessionId: session._id,
      patientId: target.patient._id,
      sourceFacilityId: target.sourceFacilityId,
      targetFacilityId: target.targetFacility._id,
      purpose: "emergency",
      recordTypes,
      recordCount: SINGLE_PATIENT_RECORD_COUNT,
      requestedAt: now,
    });
    await appendAuditEvent(db, {
      actorId: user._id,
      sessionId: session._id,
      action: "AccessRequested",
      entity: "accessRequests",
      entityId: requestId,
      details: {
        patientPublicId: target.patient.publicId,
        purpose: "emergency",
        recordTypes,
        recordCount: SINGLE_PATIENT_RECORD_COUNT,
        targetFacility: target.targetFacility.code,
        breakGlass: true,
      },
      createdAt: now,
    });
  }

  const expiresAt = now + EMERGENCY_ACCESS_TTL_MS;
  const grantId = await db.insert("emergencyAccess", {
    requestId,
    actorId: user._id,
    patientId: target.patient._id,
    justification,
    grantedAt: now,
    expiresAt,
    sourceFacilityId: target.sourceFacilityId,
    targetFacilityId: target.targetFacility._id,
  });

  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "EmergencyGranted",
    entity: "emergencyAccess",
    entityId: grantId,
    details: {
      requestId,
      patientPublicId: target.patient.publicId,
      targetFacility: target.targetFacility.code,
      recordTypes,
      justification,
      expiresAt,
      linkedToExistingRequest: input.requestId !== undefined,
    },
    createdAt: now,
  });

  await raiseEmergencyAlert(db, {
    emergencyAccessId: grantId,
    requestId,
    actor: user,
    sessionId: session._id,
    patientPublicId: target.patient.publicId,
    justification,
    expiresAt,
    createdAt: now,
  });

  return {
    grantId,
    requestId,
    publicId: target.patient.publicId,
    targetFacility: {
      code: target.targetFacility.code,
      name: target.targetFacility.name,
    },
    recordTypes,
    justification,
    grantedAt: now,
    expiresAt,
  };
}

export async function revokeGrant(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  grantId: Id<"emergencyAccess">,
  now: number,
) {
  const grant = await db.get(grantId);
  if (!grant) {
    throwAppError(EMERGENCY_GRANT_NOT_FOUND_CODE, EMERGENCY_GRANT_NOT_FOUND_MESSAGE);
  }
  const request = await db.get(grant.requestId);
  const scope = await resolveReviewerScope(db, user);
  const isReviewer = request !== null && scopeIncludesRequest(scope, request);
  if (grant.actorId !== user._id && !isReviewer) {
    throwAppError(PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE);
  }
  if (!isLiveGrant(grant, now)) {
    throwAppError(EMERGENCY_GRANT_ALREADY_ENDED_CODE, EMERGENCY_GRANT_ALREADY_ENDED_MESSAGE);
  }

  await db.patch(grantId, { revokedAt: now });
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "EmergencyRevoked",
    entity: "emergencyAccess",
    entityId: grantId,
    details: {
      requestId: grant.requestId,
      grantHolderId: grant.actorId,
      revokedBySelf: grant.actorId === user._id,
    },
    createdAt: now,
  });
  return { grantId, revokedAt: now };
}

export type ExpireGrantResult =
  | "expired"
  | "skipped"
  | { status: "not_due"; expiresAt: number };

/** Scheduled at `expiresAt`. Audits once; revoked grants are skipped. */
export async function expireGrant(
  db: DatabaseWriter,
  grantId: Id<"emergencyAccess">,
  now: number,
): Promise<ExpireGrantResult> {
  const grant = await db.get(grantId);
  if (!grant || grant.revokedAt !== undefined) {
    return "skipped";
  }
  if (grant.expiresAt > now) {
    return { status: "not_due", expiresAt: grant.expiresAt };
  }
  await appendAuditEvent(db, {
    actorId: grant.actorId,
    action: "EmergencyExpired",
    entity: "emergencyAccess",
    entityId: grantId,
    details: {
      requestId: grant.requestId,
      expiresAt: grant.expiresAt,
    },
    createdAt: now,
  });
  return "expired";
}

export function toGrantView(grant: Doc<"emergencyAccess">) {
  return {
    grantId: grant._id,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    justification: grant.justification,
  };
}
