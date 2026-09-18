import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE } from "../authConstants";
import {
  NO_SOURCE_FACILITY_CODE,
  NO_SOURCE_FACILITY_MESSAGE,
  PATIENT_NOT_FOUND_CODE,
  PATIENT_NOT_FOUND_MESSAGE,
} from "../accessRequestMessages";
import { throwAppError } from "../appError";
import {
  CONSENT_ALREADY_ACTIVE_CODE,
  CONSENT_ALREADY_ACTIVE_MESSAGE,
  CONSENT_ALREADY_ACTIVE_PATIENT_MESSAGE,
  CONSENT_ALREADY_ENDED_CODE,
  CONSENT_ALREADY_ENDED_MESSAGE,
  CONSENT_DURATION_MS,
  CONSENT_NOTE_MAX_LENGTH,
  CONSENT_NOTE_MIN_LENGTH,
  CONSENT_NOTE_TOO_LONG_CODE,
  CONSENT_NOTE_TOO_LONG_MESSAGE,
  CONSENT_NOTE_TOO_SHORT_CODE,
  CONSENT_NOTE_TOO_SHORT_MESSAGE,
  CONSENT_NOT_FOUND_CODE,
  CONSENT_NOT_FOUND_MESSAGE,
  CONSENT_NOT_NEEDED_CODE,
  CONSENT_NOT_NEEDED_MESSAGE,
  CONSENT_NOT_NEEDED_PATIENT_MESSAGE,
  FACILITY_NOT_FOUND_CODE,
  FACILITY_NOT_FOUND_MESSAGE,
  PATIENT_NOT_LINKED_CODE,
  PATIENT_NOT_LINKED_MESSAGE,
} from "../consentConstants";
import { ConsentCheck, Purpose } from "../domain";
import { resolveReviewerScope, resolveUserFacilityId } from "../facilityScope";
import { normalizePublicId, resolvePatientRecordFacilityId } from "./accessControlService";
import { appendAuditEvent } from "./auditLogService";

/**
 * Consent service (INN-45).
 *
 * A consent lets one facility request a patient's records held at another
 * facility. It applies to single-patient, cross-facility, non-emergency
 * requests; without an active consent the risk engine returns VERIFY.
 * Break-glass never needs consent. Clinicians record consent for their own
 * facility (30 days, with a note); security officers and admins in scope
 * can revoke it. Patients linked by `users.patientId` can list, grant, and
 * revoke their own consents (INN-77). Every change is audited.
 */

/** Newest live consent: `active` rows only, walked with `.take()` (Convex allows `.paginate()` once per function). */
const CONSENT_LOOKUP_PAGE_SIZE = 20;

type SessionContext = { user: Doc<"users">; session: Doc<"sessions"> };

export function isConsentLive(consent: Doc<"consents">, now: number): boolean {
  return consent.status === "active" && consent.expiresAt > now;
}

export function consentApplies(input: {
  purpose: Purpose;
  sameHospital: boolean;
  recordCount: number;
}): boolean {
  return !input.sameHospital && input.purpose !== "emergency" && input.recordCount === 1;
}

/** The newest live consent letting `facilityId` request this patient's records, or null. */
export async function findActiveConsent(
  db: DatabaseReader,
  patientId: Id<"patients">,
  facilityId: Id<"facilities">,
  now: number,
): Promise<Doc<"consents"> | null> {
  let beforeCreationTime: number | undefined;
  for (;;) {
    const page = await db
      .query("consents")
      .withIndex("by_patientId_facilityId_status", (query) => {
        const activeForPair = query
          .eq("patientId", patientId)
          .eq("facilityId", facilityId)
          .eq("status", "active");
        return beforeCreationTime === undefined
          ? activeForPair
          : activeForPair.lt("_creationTime", beforeCreationTime);
      })
      .order("desc")
      .take(CONSENT_LOOKUP_PAGE_SIZE);
    const live = page.find((consent) => isConsentLive(consent, now));
    if (live) {
      return live;
    }
    const oldestOnPage = page[page.length - 1];
    if (page.length < CONSENT_LOOKUP_PAGE_SIZE || oldestOnPage === undefined) {
      return null;
    }
    beforeCreationTime = oldestOnPage._creationTime;
  }
}

/** How consent bears on a request, for the risk engine and the decision snapshot. */
export async function evaluateConsent(
  db: DatabaseReader,
  request: {
    patientId: Id<"patients">;
    facilityId: Id<"facilities">;
    purpose: Purpose;
    sameHospital: boolean;
    recordCount: number;
  },
  now: number,
): Promise<ConsentCheck> {
  if (!consentApplies(request)) {
    return "not_required";
  }
  const consent = await findActiveConsent(db, request.patientId, request.facilityId, now);
  return consent ? "active" : "missing";
}

export function normalizeConsentNote(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length < CONSENT_NOTE_MIN_LENGTH) {
    throwAppError(CONSENT_NOTE_TOO_SHORT_CODE, CONSENT_NOTE_TOO_SHORT_MESSAGE);
  }
  if (trimmed.length > CONSENT_NOTE_MAX_LENGTH) {
    throwAppError(CONSENT_NOTE_TOO_LONG_CODE, CONSENT_NOTE_TOO_LONG_MESSAGE);
  }
  return trimmed;
}

async function requirePatient(db: DatabaseReader, publicId: string) {
  const patient = await db
    .query("patients")
    .withIndex("by_publicId", (query) => query.eq("publicId", normalizePublicId(publicId)))
    .unique();
  if (!patient) {
    throwAppError(PATIENT_NOT_FOUND_CODE, PATIENT_NOT_FOUND_MESSAGE);
  }
  return patient;
}

export type ConsentContext = {
  patient: Doc<"patients">;
  facilityId: Id<"facilities">;
  patientFacilityId: Id<"facilities">;
  isRequired: boolean;
};

/** The caller's facility and where the patient's records are held. */
export async function resolveConsentContext(
  db: DatabaseReader,
  user: Doc<"users">,
  publicId: string,
): Promise<ConsentContext> {
  const patient = await requirePatient(db, publicId);
  const facilityId = await resolveUserFacilityId(db, user);
  if (!facilityId) {
    throwAppError(NO_SOURCE_FACILITY_CODE, NO_SOURCE_FACILITY_MESSAGE);
  }
  const patientFacilityId = await resolvePatientRecordFacilityId(db, patient);
  return {
    patient,
    facilityId,
    patientFacilityId,
    isRequired: facilityId !== patientFacilityId,
  };
}

/** A clinician records the patient's consent for their own facility. */
export async function recordConsent(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  input: { publicId: string; note: string },
  now: number,
): Promise<Doc<"consents">> {
  const note = normalizeConsentNote(input.note);
  const context = await resolveConsentContext(db, user, input.publicId);
  if (!context.isRequired) {
    throwAppError(CONSENT_NOT_NEEDED_CODE, CONSENT_NOT_NEEDED_MESSAGE);
  }
  return await insertActiveConsent(
    db,
    { user, session },
    {
      patient: context.patient,
      facilityId: context.facilityId,
      patientFacilityId: context.patientFacilityId,
      note,
      alreadyActiveMessage: CONSENT_ALREADY_ACTIVE_MESSAGE,
    },
    now,
  );
}

export function requireLinkedPatientId(user: Doc<"users">): Id<"patients"> {
  if (!user.patientId) {
    throwAppError(PATIENT_NOT_LINKED_CODE, PATIENT_NOT_LINKED_MESSAGE);
  }
  return user.patientId;
}

/** The signed-in patient grants consent for one participating facility. */
export async function recordOwnedConsent(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  input: { facilityId: Id<"facilities">; note: string },
  now: number,
): Promise<Doc<"consents">> {
  const note = normalizeConsentNote(input.note);
  const patientId = requireLinkedPatientId(user);
  const patient = await db.get(patientId);
  if (!patient) {
    throwAppError(PATIENT_NOT_FOUND_CODE, PATIENT_NOT_FOUND_MESSAGE);
  }
  const facility = await db.get(input.facilityId);
  if (!facility) {
    throwAppError(FACILITY_NOT_FOUND_CODE, FACILITY_NOT_FOUND_MESSAGE);
  }
  const patientFacilityId = await resolvePatientRecordFacilityId(db, patient);
  if (facility._id === patientFacilityId) {
    throwAppError(CONSENT_NOT_NEEDED_CODE, CONSENT_NOT_NEEDED_PATIENT_MESSAGE);
  }
  return await insertActiveConsent(
    db,
    { user, session },
    {
      patient,
      facilityId: facility._id,
      patientFacilityId,
      note,
      alreadyActiveMessage: CONSENT_ALREADY_ACTIVE_PATIENT_MESSAGE,
    },
    now,
  );
}

async function insertActiveConsent(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  input: {
    patient: Doc<"patients">;
    facilityId: Id<"facilities">;
    patientFacilityId: Id<"facilities">;
    note: string;
    alreadyActiveMessage: string;
  },
  now: number,
): Promise<Doc<"consents">> {
  if (await findActiveConsent(db, input.patient._id, input.facilityId, now)) {
    throwAppError(CONSENT_ALREADY_ACTIVE_CODE, input.alreadyActiveMessage);
  }

  const row = {
    patientId: input.patient._id,
    facilityId: input.facilityId,
    patientFacilityId: input.patientFacilityId,
    status: "active" as const,
    note: input.note,
    recordedBy: user._id,
    grantedAt: now,
    expiresAt: now + CONSENT_DURATION_MS,
  };
  const consentId = await db.insert("consents", row);
  const facility = await db.get(input.facilityId);
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "ConsentRecorded",
    entity: "consents",
    entityId: consentId,
    details: {
      patientPublicId: input.patient.publicId,
      facility: facility?.code ?? null,
      note: input.note,
      expiresAt: row.expiresAt,
    },
    createdAt: now,
  });
  return { _id: consentId, _creationTime: now, ...row };
}

export type ConsentRevokeActor =
  | { kind: "reviewer" }
  | { kind: "owner"; patientId: Id<"patients"> };

/** Reviewers in scope, or the patient the consent belongs to, can revoke. */
export async function revokeConsent(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  consentId: Id<"consents">,
  now: number,
  actor: ConsentRevokeActor = { kind: "reviewer" },
): Promise<Doc<"consents">> {
  const consent = await db.get(consentId);
  if (!consent) {
    throwAppError(CONSENT_NOT_FOUND_CODE, CONSENT_NOT_FOUND_MESSAGE);
  }
  const canRevoke =
    actor.kind === "owner"
      ? consent.patientId === actor.patientId
      : await reviewerCanRevokeConsent(db, user, consent);
  if (!canRevoke) {
    throwAppError(PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE);
  }
  if (!isConsentLive(consent, now)) {
    throwAppError(CONSENT_ALREADY_ENDED_CODE, CONSENT_ALREADY_ENDED_MESSAGE);
  }

  await db.patch(consentId, { status: "revoked", revokedAt: now, revokedBy: user._id });
  const patient = await db.get(consent.patientId);
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "ConsentRevoked",
    entity: "consents",
    entityId: consentId,
    details: {
      patientPublicId: patient?.publicId ?? null,
      grantedAt: consent.grantedAt,
    },
    createdAt: now,
  });
  return { ...consent, status: "revoked", revokedAt: now, revokedBy: user._id };
}

async function reviewerCanRevokeConsent(
  db: DatabaseReader,
  user: Doc<"users">,
  consent: Doc<"consents">,
): Promise<boolean> {
  const scope = await resolveReviewerScope(db, user);
  return (
    scope.kind === "global" ||
    (scope.kind === "facility" &&
      scope.facilityId !== null &&
      (consent.facilityId === scope.facilityId ||
        consent.patientFacilityId === scope.facilityId))
  );
}
