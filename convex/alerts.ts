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
import { toGrantView } from "./lib/services/emergencyAccessService";
import { resolveReviewerScope } from "./lib/facilityScope";

const ALERT_REVIEWER_ROLES = [...SECURITY_ROLES, ...ADMIN_ROLES];

const EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

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
  /** Set for break-glass alerts (INN-41). */
  emergency: v.union(
    v.null(),
    v.object({
      grantId: v.id("emergencyAccess"),
      grantedAt: v.number(),
      expiresAt: v.number(),
      revokedAt: v.optional(v.number()),
      justification: v.string(),
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
  const grant = alert.emergencyAccessId
    ? await ctx.db.get(alert.emergencyAccessId)
    : null;
  const decision = alert.decisionId ? await ctx.db.get(alert.decisionId) : null;
  const requestId = decision?.requestId ?? grant?.requestId ?? null;
  const request = requestId ? await ctx.db.get(requestId) : null;
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
    emergency: grant ? toGrantView(grant) : null,
  };
}

/**
 * Security officers and admins only. Newest first, paginated. Hospital admins
 * see alerts involving their facility (INN-52).
 */
export const listSecurityAlerts = query({
  args: {
    token: v.optional(v.string()),
    status: v.optional(alertStatus),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(alertViewValidator),
  handler: async (ctx, args) => {
    let reviewer: Doc<"users">;
    try {
      reviewer = (await requireAlertReviewer(ctx, args.token)).user;
    } catch (error) {
      if (error instanceof Error && isAuthErrorMessage(error.message)) {
        return EMPTY_PAGE;
      }
      throw error;
    }

    const status = args.status;
    const scope = await resolveReviewerScope(ctx.db, reviewer);
    if (scope.kind === "facility") {
      const facilityId = scope.facilityId;
      if (!facilityId) {
        return EMPTY_PAGE;
      }
      const links = await (status
        ? ctx.db
            .query("alertFacilities")
            .withIndex("by_facilityId_status_createdAt", (query) =>
              query.eq("facilityId", facilityId).eq("status", status),
            )
        : ctx.db
            .query("alertFacilities")
            .withIndex("by_facilityId_createdAt", (query) => query.eq("facilityId", facilityId))
      )
        .order("desc")
        .paginate(args.paginationOpts);
      const alerts = await Promise.all(links.page.map((link) => ctx.db.get(link.alertId)));
      const page = await Promise.all(
        alerts.filter((alert) => alert !== null).map((alert) => toAlertView(ctx, alert)),
      );
      return { ...links, page };
    }

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
    const reviewer = await requireAlertReviewer(ctx, args.token);
    const alert = await transitionAlert(
      ctx.db,
      reviewer,
      normalizeAlertId(ctx, args.alertId),
      "acknowledged",
      Date.now(),
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
    const reviewer = await requireAlertReviewer(ctx, args.token);
    const alert = await transitionAlert(
      ctx.db,
      reviewer,
      normalizeAlertId(ctx, args.alertId),
      "closed",
      Date.now(),
    );
    return { alertId: alert._id, status: alert.status };
  },
});
