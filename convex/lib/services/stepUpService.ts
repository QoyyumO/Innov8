import { DatabaseWriter } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { allowedUntil } from "../accessWindow";
import { verifyPassword } from "../password";
import {
  STEP_UP_ESCALATED_REASON,
  STEP_UP_MAX_FAILURES,
  STEP_UP_NOT_ELIGIBLE_MESSAGE,
  STEP_UP_PASSWORD_REQUIRED_MESSAGE,
  STEP_UP_VERIFIED_REASON,
} from "../stepUpConstants";
import { raiseBlockAlert } from "./alertService";
import { appendAuditEvent } from "./auditLogService";

/**
 * Step-up verification (INN-44).
 *
 * A VERIFY decision is completed by the requesting clinician re-entering
 * their password. Success turns the decision into ALLOW (the 24-hour window
 * starts at `verifiedAt`). Wrong passwords are counted and audited; the
 * `STEP_UP_MAX_FAILURES`th turns the request into BLOCK and raises an alert.
 *
 * Wrong passwords return a result instead of throwing, because a thrown
 * error would roll back the failure count and its audit row.
 */

export type StepUpResult =
  | { status: "verified"; allowedUntil: number }
  | { status: "failed"; attemptsLeft: number }
  | { status: "blocked" };

type SessionContext = {
  user: Doc<"users">;
  session: Doc<"sessions">;
};

export function stepUpAttemptsLeft(decision: Doc<"accessDecisions">): number {
  return Math.max(0, STEP_UP_MAX_FAILURES - (decision.stepUpFailures ?? 0));
}

async function requireChallengedRequest(
  db: DatabaseWriter,
  user: Doc<"users">,
  requestId: Id<"accessRequests">,
) {
  const request = await db.get(requestId);
  const decision = request
    ? await db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request._id))
        .unique()
    : null;
  if (
    !request ||
    !decision ||
    request.actorId !== user._id ||
    (request.recordCount ?? 1) !== 1 ||
    decision.outcome !== "VERIFY"
  ) {
    throw new Error(STEP_UP_NOT_ELIGIBLE_MESSAGE);
  }
  return { request, decision };
}

export async function completeStepUp(
  db: DatabaseWriter,
  { user, session }: SessionContext,
  requestId: Id<"accessRequests">,
  password: string,
  now: number,
): Promise<StepUpResult> {
  const { request, decision } = await requireChallengedRequest(db, user, requestId);
  if (password === "") {
    throw new Error(STEP_UP_PASSWORD_REQUIRED_MESSAGE);
  }
  const patient = await db.get(request.patientId);
  const patientPublicId = patient?.publicId ?? "Unknown patient";

  if (await verifyPassword(password, user.hashedPassword)) {
    await db.patch(decision._id, {
      outcome: "ALLOW",
      verifiedAt: now,
      reasons: [...decision.reasons, STEP_UP_VERIFIED_REASON],
    });
    await appendAuditEvent(db, {
      actorId: user._id,
      sessionId: session._id,
      action: "StepUpCompleted",
      entity: "accessDecisions",
      entityId: decision._id,
      details: {
        requestId,
        patientPublicId,
        riskScore: decision.riskScore,
        failedAttempts: decision.stepUpFailures ?? 0,
      },
      createdAt: now,
    });
    await appendAuditEvent(db, {
      actorId: user._id,
      sessionId: session._id,
      action: "AccessAllowed",
      entity: "accessDecisions",
      entityId: decision._id,
      details: {
        requestId,
        patientPublicId,
        outcome: "ALLOW",
        riskScore: decision.riskScore,
        viaStepUp: true,
      },
      createdAt: now,
    });
    return { status: "verified", allowedUntil: allowedUntil(now) };
  }

  const failures = (decision.stepUpFailures ?? 0) + 1;
  const attemptsLeft = Math.max(0, STEP_UP_MAX_FAILURES - failures);
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "StepUpFailed",
    entity: "accessDecisions",
    entityId: decision._id,
    details: { requestId, patientPublicId, attempt: failures, attemptsLeft },
    createdAt: now,
  });

  if (attemptsLeft > 0) {
    await db.patch(decision._id, { stepUpFailures: failures });
    return { status: "failed", attemptsLeft };
  }

  const reasons = [...decision.reasons, STEP_UP_ESCALATED_REASON];
  await db.patch(decision._id, {
    outcome: "BLOCK",
    stepUpFailures: failures,
    escalatedAt: now,
    reasons,
  });
  await appendAuditEvent(db, {
    actorId: user._id,
    sessionId: session._id,
    action: "AccessBlocked",
    entity: "accessDecisions",
    entityId: decision._id,
    details: {
      requestId,
      patientPublicId,
      outcome: "BLOCK",
      riskScore: decision.riskScore,
      escalatedFromVerify: true,
    },
    createdAt: now,
  });
  await raiseBlockAlert(db, {
    decisionId: decision._id,
    actor: user,
    sessionId: session._id,
    patientPublicId,
    recordCount: request.recordCount ?? 1,
    riskScore: decision.riskScore,
    reasons,
    createdAt: now,
  });
  return { status: "blocked" };
}
