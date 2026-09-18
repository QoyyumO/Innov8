import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { throwAppError } from "../appError";
import { PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE } from "../authConstants";
import {
  CLINICAL_NOTE_LIST_LIMIT,
  CLINICAL_NOTE_MAX_LENGTH,
  CLINICAL_NOTE_MIN_LENGTH,
  CLINICAL_NOTE_TOO_LONG_CODE,
  CLINICAL_NOTE_TOO_LONG_MESSAGE,
  CLINICAL_NOTE_TOO_SHORT_CODE,
  CLINICAL_NOTE_TOO_SHORT_MESSAGE,
  CLINICAL_WRITE_NOT_ALLOWED_CODE,
  CLINICAL_WRITE_NOT_ALLOWED_MESSAGE,
} from "../clinicalNoteConstants";
import { appendAuditEvent } from "./auditLogService";
import { resolveViewAuthorisation } from "./recordExchangeService";

type SessionUser = Doc<"users">;
type SessionRow = Doc<"sessions">;

function normalizeNoteBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < CLINICAL_NOTE_MIN_LENGTH) {
    throwAppError(CLINICAL_NOTE_TOO_SHORT_CODE, CLINICAL_NOTE_TOO_SHORT_MESSAGE);
  }
  if (trimmed.length > CLINICAL_NOTE_MAX_LENGTH) {
    throwAppError(CLINICAL_NOTE_TOO_LONG_CODE, CLINICAL_NOTE_TOO_LONG_MESSAGE);
  }
  return trimmed;
}

async function requireOwnAllowedRequest(
  db: DatabaseReader,
  user: SessionUser,
  requestId: Id<"accessRequests">,
  now: number,
) {
  const request = await db.get(requestId);
  if (!request || request.actorId !== user._id) {
    throwAppError(PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE);
  }
  if (!user.roles.includes("doctor")) {
    throwAppError(PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE);
  }
  const authorisation = await resolveViewAuthorisation(db, request, now);
  if (!authorisation.isAuthorised || authorisation.grantedBy !== "decision") {
    throwAppError(CLINICAL_WRITE_NOT_ALLOWED_CODE, CLINICAL_WRITE_NOT_ALLOWED_MESSAGE);
  }
  return request;
}

export async function canAppendClinicalNote(
  db: DatabaseReader,
  user: SessionUser,
  request: Doc<"accessRequests">,
  now: number,
): Promise<boolean> {
  if (request.actorId !== user._id || !user.roles.includes("doctor")) {
    return false;
  }
  const authorisation = await resolveViewAuthorisation(db, request, now);
  return authorisation.isAuthorised && authorisation.grantedBy === "decision";
}

export async function appendClinicalNote(
  db: DatabaseWriter,
  { user, session }: { user: SessionUser; session: SessionRow },
  input: { requestId: Id<"accessRequests">; body: string },
  now: number,
) {
  const body = normalizeNoteBody(input.body);
  const request = await requireOwnAllowedRequest(db, user, input.requestId, now);
  const sourceFacility = await db.get(request.sourceFacilityId);
  const originatingFacility = sourceFacility?.code ?? "UNKNOWN";
  const patient = await db.get(request.patientId);

  const noteId = await db.insert("clinicalNotes", {
    requestId: request._id,
    patientId: request.patientId,
    actorId: user._id,
    sessionId: session._id,
    sourceFacilityId: request.sourceFacilityId,
    body,
    createdAt: now,
  });

  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "ClinicalNoteAppended",
    entity: "accessRequests",
    entityId: request._id,
    details: {
      noteId,
      originatingFacility,
      createdAt: now,
      noteLength: body.length,
    },
    createdAt: now,
  });

  return {
    noteId,
    requestId: request._id,
    publicId: patient?.publicId ?? "Unknown patient",
    originatingFacility,
    body,
    createdAt: now,
  };
}

export async function loadNotesForRequest(
  db: DatabaseReader,
  user: SessionUser,
  requestId: Id<"accessRequests">,
  now: number,
) {
  const request = await requireOwnAllowedRequest(db, user, requestId, now);
  const notes = await db
    .query("clinicalNotes")
    .withIndex("by_requestId_createdAt", (query) => query.eq("requestId", request._id))
    .order("desc")
    .take(CLINICAL_NOTE_LIST_LIMIT);
  return notes.map((note) => ({
    noteId: note._id,
    body: note.body,
    createdAt: note.createdAt,
  }));
}
