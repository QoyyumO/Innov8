import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthErrorMessage } from "./lib/authConstants";
import {
  alertSeverity,
  alertStatus,
  decisionOutcome,
  purpose,
} from "./lib/domain";
import { ADMIN_ROLES, SECURITY_ROLES, requireRole } from "./lib/roles";
import { requireSession } from "./lib/session";
import {
  ALERT_NOT_FOUND_MESSAGE,
  isHarvestCount,
  transitionAlert,
} from "./lib/services/alertService";

const ALERT_REVIEWER_ROLES = [...SECURITY_ROLES, ...ADMIN_ROLES];

const alertViewValidator = v.object({
  alertId: v.id("securityAlerts"),
  severity: alertSeverity,
  status: alertStatus,
  title: v.string(),
  message: v.string(),
  createdAt: v.number(),
  isHarvest: v.boolean(),
  requestId: v.union(v.null(), v.id("accessRequests")),
  publicId: v.union(v.null(), v.string()),
  purpose: v.union(v.null(), purpose),
  recordCount: v.union(v.null(), v.number()),
  outcome: v.union(v.null(), decisionOutcome),
  riskScore: v.union(v.null(), v.number()),
  requester: v.union(
    v.null(),
    v.object({
      name: v.string(),
      email: v.string(),
      hospital: v.string(),
    }),
  ),
});

const transitionResultValidator = v.object({
  alertId: v.id("securityAlerts"),
  status: alertStatus,
});

async function requireAlertReviewer(
  ctx: Parameters<typeof requireSession>[0],
  token: string | undefined,
) {
  const sessionContext = await requireSession(ctx, token);
  requireRole(sessionContext.user, ALERT_REVIEWER_ROLES);
  return sessionContext;
}

async function toAlertView(ctx: QueryCtx, alert: Doc<"securityAlerts">) {
  const decision = alert.decisionId ? await ctx.db.get(alert.decisionId) : null;
  const request = decision ? await ctx.db.get(decision.requestId) : null;
  const [patient, requester] = request
    ? await Promise.all([ctx.db.get(request.patientId), ctx.db.get(request.actorId)])
    : [null, null];
  const recordCount = request ? (request.recordCount ?? 1) : null;

  return {
    alertId: alert._id,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt,
    isHarvest: recordCount !== null && isHarvestCount(recordCount),
    requestId: request?._id ?? null,
    publicId: patient?.publicId ?? null,
    purpose: request?.purpose ?? null,
    recordCount,
    outcome: decision?.outcome ?? null,
    riskScore: decision?.riskScore ?? null,
    requester: requester
      ? {
          name: `${requester.profile.firstName} ${requester.profile.lastName}`.trim(),
          email: requester.email,
          hospital: requester.hospital,
        }
      : null,
  };
}

/** Security officers and admins only. Newest first, paginated. */
export const listSecurityAlerts = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(alertStatus),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(alertViewValidator),
  handler: async (ctx, args) => {
    try {
      await requireAlertReviewer(ctx, args.token);
    } catch (error) {
      if (error instanceof Error && isAuthErrorMessage(error.message)) {
        return { page: [], isDone: true, continueCursor: "" };
      }
      throw error;
    }

    const status = args.status;
    const results = status
      ? await ctx.db
          .query("securityAlerts")
          .withIndex("by_status", (query) => query.eq("status", status))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("securityAlerts")
          .withIndex("by_createdAt")
          .order("desc")
          .paginate(args.paginationOpts);

    const page = await Promise.all(
      results.page.map((alert) => toAlertView(ctx, alert)),
    );
    return { ...results, page };
  },
});

function normalizeAlertId(ctx: MutationCtx, alertId: string): Id<"securityAlerts"> {
  const normalized = ctx.db.normalizeId("securityAlerts", alertId);
  if (!normalized) {
    throw new Error(ALERT_NOT_FOUND_MESSAGE);
  }
  return normalized;
}

export const acknowledgeAlert = mutation({
  args: {
    token: v.optional(v.string()),
    alertId: v.string(),
  },
  returns: transitionResultValidator,
  handler: async (ctx, args) => {
    await requireAlertReviewer(ctx, args.token);
    const alert = await transitionAlert(
      ctx.db,
      normalizeAlertId(ctx, args.alertId),
      "acknowledged",
    );
    return { alertId: alert._id, status: alert.status };
  },
});

export const closeAlert = mutation({
  args: {
    token: v.optional(v.string()),
    alertId: v.string(),
  },
  returns: transitionResultValidator,
  handler: async (ctx, args) => {
    await requireAlertReviewer(ctx, args.token);
    const alert = await transitionAlert(
      ctx.db,
      normalizeAlertId(ctx, args.alertId),
      "closed",
    );
    return { alertId: alert._id, status: alert.status };
  },
});
