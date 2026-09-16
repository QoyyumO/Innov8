import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { isAuthErrorMessage } from "./lib/authConstants";
import { recordType } from "./lib/domain";
import {
  EMERGENCY_GRANT_NOT_FOUND_MESSAGE,
  EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE,
} from "./lib/emergencyConstants";
import { requireClinicianSession } from "./lib/roles";
import { requireSession } from "./lib/session";
import { normalizePublicId } from "./lib/services/accessControlService";
import {
  expireGrant,
  findLiveGrantForPatient,
  grantBreakGlass,
  revokeGrant,
  toGrantView,
} from "./lib/services/emergencyAccessService";

const grantResultValidator = v.object({
  grantId: v.id("emergencyAccess"),
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  targetFacility: v.object({ code: v.string(), name: v.string() }),
  recordTypes: v.array(recordType),
  justification: v.string(),
  grantedAt: v.number(),
  expiresAt: v.number(),
});

const activeGrantValidator = v.union(
  v.null(),
  v.object({
    grantId: v.id("emergencyAccess"),
    requestId: v.id("accessRequests"),
    grantedAt: v.number(),
    expiresAt: v.number(),
    justification: v.string(),
  }),
);

/**
 * Demo step 7: break-glass. Clinicians only. The server fixes how long
 * access lasts; the grant is audited, reported to security, and expires on
 * a schedule. `requestId` links the grant to the caller's own blocked or
 * challenged request instead of creating a new emergency request.
 */
export const grantEmergencyAccess = mutation({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
    justification: v.string(),
    recordTypes: v.array(recordType),
    requestId: v.optional(v.string()),
  },
  returns: grantResultValidator,
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    const linkedRequestId =
      args.requestId === undefined
        ? undefined
        : (ctx.db.normalizeId("accessRequests", args.requestId) ?? undefined);
    if (args.requestId !== undefined && linkedRequestId === undefined) {
      throw new Error(EMERGENCY_REQUEST_NOT_ELIGIBLE_MESSAGE);
    }

    const now = Date.now();
    const grant = await grantBreakGlass(
      ctx.db,
      sessionContext,
      {
        publicId: args.publicId,
        justification: args.justification,
        recordTypes: args.recordTypes,
        requestId: linkedRequestId,
      },
      now,
    );
    await ctx.scheduler.runAt(grant.expiresAt, internal.emergency.expireEmergencyAccess, {
      grantId: grant.grantId,
    });
    return grant;
  },
});

/** The caller's live grant for a patient, or null. */
export const getActiveEmergencyAccess = query({
  args: {
    token: v.optional(v.string()),
    publicId: v.string(),
  },
  returns: activeGrantValidator,
  handler: async (ctx, args) => {
    let userId: Id<"users">;
    try {
      userId = (await requireClinicianSession(ctx, args.token)).user._id;
    } catch (error) {
      if (error instanceof Error && isAuthErrorMessage(error.message)) {
        return null;
      }
      throw error;
    }

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_publicId", (query) =>
        query.eq("publicId", normalizePublicId(args.publicId)),
      )
      .unique();
    if (!patient) {
      return null;
    }

    const grant = await findLiveGrantForPatient(ctx.db, userId, patient._id, Date.now());
    if (!grant) {
      return null;
    }
    const { grantId, grantedAt, expiresAt, justification } = toGrantView(grant);
    return { grantId, requestId: grant.requestId, grantedAt, expiresAt, justification };
  },
});

/** The grant holder, security officers, and admins can end access early. */
export const revokeEmergencyAccess = mutation({
  args: {
    token: v.optional(v.string()),
    grantId: v.string(),
  },
  returns: v.object({
    grantId: v.id("emergencyAccess"),
    revokedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const sessionContext = await requireSession(ctx, args.token);
    const grantId = ctx.db.normalizeId("emergencyAccess", args.grantId);
    if (!grantId) {
      throw new Error(EMERGENCY_GRANT_NOT_FOUND_MESSAGE);
    }
    return await revokeGrant(ctx.db, sessionContext, grantId, Date.now());
  },
});

/** Scheduled by `grantEmergencyAccess` at the grant's expiry time. */
export const expireEmergencyAccess = internalMutation({
  args: {
    grantId: v.id("emergencyAccess"),
  },
  returns: v.union(
    v.literal("expired"),
    v.literal("skipped"),
    v.literal("rescheduled"),
  ),
  handler: async (ctx, args) => {
    const result = await expireGrant(ctx.db, args.grantId, Date.now());
    if (typeof result === "object") {
      await ctx.scheduler.runAt(
        result.expiresAt,
        internal.emergency.expireEmergencyAccess,
        { grantId: args.grantId },
      );
      return "rescheduled";
    }
    return result;
  },
});
