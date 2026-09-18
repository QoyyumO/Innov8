import { query, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthAppError, throwAppError } from "./lib/appError";
import {
  PERMISSION_DENIED_CODE,
  PERMISSION_DENIED_MESSAGE,
} from "./lib/authConstants";
import { AuditAction, DecisionOutcome, auditAction, auditDetails, decisionOutcome } from "./lib/domain";
import { resolveReviewerScope } from "./lib/facilityScope";
import { normalizePublicId } from "./lib/services/accessControlService";
import { requireSession } from "./lib/session";

const EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

const auditEventViewValidator = v.object({
  eventId: v.id("auditEvents"),
  createdAt: v.number(),
  action: auditAction,
  entity: v.string(),
  entityId: v.union(v.null(), v.string()),
  /** Stored audit payload (metadata, including break-glass justification). Not clinical sections. */
  details: auditDetails,
  actor: v.union(
    v.null(),
    v.object({
      actorId: v.id("users"),
      name: v.string(),
      email: v.string(),
      hospital: v.string(),
    }),
  ),
});

type ActorView = {
  actorId: Id<"users">;
  name: string;
  email: string;
  hospital: string;
};

type ActorCache = Map<Id<"users">, Promise<ActorView | null>>;

async function fetchActor(ctx: QueryCtx, actorId: Id<"users">): Promise<ActorView | null> {
  const actor = await ctx.db.get(actorId);
  return actor
    ? {
        actorId,
        name: `${actor.profile.firstName} ${actor.profile.lastName}`.trim(),
        email: actor.email,
        hospital: actor.hospital,
      }
    : null;
}

/** One read per actor per page, even when rows load in parallel. */
async function loadActor(
  ctx: QueryCtx,
  actorId: Id<"users"> | undefined,
  actorCache: ActorCache,
): Promise<ActorView | null> {
  if (!actorId) {
    return null;
  }
  const cached = actorCache.get(actorId) ?? fetchActor(ctx, actorId);
  actorCache.set(actorId, cached);
  return await cached;
}

async function toEventView(
  ctx: QueryCtx,
  event: Doc<"auditEvents">,
  actorCache: ActorCache,
) {
  return {
    eventId: event._id,
    createdAt: event.createdAt,
    action: event.action,
    entity: event.entity,
    entityId: event.entityId ?? null,
    details: event.details,
    actor: await loadActor(ctx, event.actorId, actorCache),
  };
}

const OUTCOME_AUDIT_ACTION: Record<DecisionOutcome, AuditAction> = {
  ALLOW: "AccessAllowed",
  VERIFY: "AccessChallenged",
  BLOCK: "AccessBlocked",
};

type CreatedAtRange = {
  createdFrom?: number;
  createdTo?: number;
};

type EventFilters = CreatedAtRange & {
  actorId?: Id<"users">;
  action?: AuditAction;
};

function boundCreatedAt<TQuery>(
  query: TQuery & {
    gte: (field: "createdAt", value: number) => TQuery;
    lte: (field: "createdAt", value: number) => TQuery;
  },
  range: CreatedAtRange,
): TQuery {
  let bounded: TQuery & {
    gte: (field: "createdAt", value: number) => TQuery;
    lte: (field: "createdAt", value: number) => TQuery;
  } = query;
  if (range.createdFrom !== undefined) {
    bounded = bounded.gte("createdAt", range.createdFrom) as typeof bounded;
  }
  if (range.createdTo !== undefined) {
    bounded = bounded.lte("createdAt", range.createdTo) as typeof bounded;
  }
  return bounded;
}

function queryEvents(ctx: QueryCtx, filters: EventFilters) {
  const table = ctx.db.query("auditEvents");
  const { actorId, action } = filters;
  if (actorId && action) {
    return table.withIndex("by_actorId_action_createdAt", (query) =>
      boundCreatedAt(query.eq("actorId", actorId).eq("action", action), filters),
    );
  }
  if (actorId) {
    return table.withIndex("by_actorId_createdAt", (query) =>
      boundCreatedAt(query.eq("actorId", actorId), filters),
    );
  }
  if (action) {
    return table.withIndex("by_action_createdAt", (query) =>
      boundCreatedAt(query.eq("action", action), filters),
    );
  }
  return table.withIndex("by_createdAt", (query) => boundCreatedAt(query, filters));
}

function queryPatientEvents(
  ctx: QueryCtx,
  patientId: Id<"patients">,
  filters: EventFilters,
) {
  const table = ctx.db.query("auditEvents");
  const { actorId, action } = filters;
  if (actorId && action) {
    return table.withIndex("by_patientId_actorId_action_createdAt", (query) =>
      boundCreatedAt(
        query.eq("patientId", patientId).eq("actorId", actorId).eq("action", action),
        filters,
      ),
    );
  }
  if (actorId) {
    return table.withIndex("by_patientId_actorId_createdAt", (query) =>
      boundCreatedAt(query.eq("patientId", patientId).eq("actorId", actorId), filters),
    );
  }
  if (action) {
    return table.withIndex("by_patientId_action_createdAt", (query) =>
      boundCreatedAt(query.eq("patientId", patientId).eq("action", action), filters),
    );
  }
  return table.withIndex("by_patientId_createdAt", (query) =>
    boundCreatedAt(query.eq("patientId", patientId), filters),
  );
}

/** INN-52: a hospital admin's trail, via the facility index. */
function queryFacilityEvents(
  ctx: QueryCtx,
  facilityId: Id<"facilities">,
  filters: EventFilters,
) {
  const table = ctx.db.query("auditEventFacilities");
  const { actorId, action } = filters;
  if (actorId && action) {
    return table.withIndex("by_facilityId_actorId_action_createdAt", (query) =>
      boundCreatedAt(
        query.eq("facilityId", facilityId).eq("actorId", actorId).eq("action", action),
        filters,
      ),
    );
  }
  if (actorId) {
    return table.withIndex("by_facilityId_actorId_createdAt", (query) =>
      boundCreatedAt(query.eq("facilityId", facilityId).eq("actorId", actorId), filters),
    );
  }
  if (action) {
    return table.withIndex("by_facilityId_action_createdAt", (query) =>
      boundCreatedAt(query.eq("facilityId", facilityId).eq("action", action), filters),
    );
  }
  return table.withIndex("by_facilityId_createdAt", (query) =>
    boundCreatedAt(query.eq("facilityId", facilityId), filters),
  );
}

async function findPatientIdByPublicId(ctx: QueryCtx, publicId: string) {
  const patient = await ctx.db
    .query("patients")
    .withIndex("by_publicId", (query) => query.eq("publicId", normalizePublicId(publicId)))
    .unique();
  return patient?._id ?? null;
}

async function eventTouchesFacility(
  ctx: QueryCtx,
  eventId: Id<"auditEvents">,
  facilityId: Id<"facilities">,
): Promise<boolean> {
  const links = await ctx.db
    .query("auditEventFacilities")
    .withIndex("by_eventId", (query) => query.eq("eventId", eventId))
    .take(8);
  return links.some((link) => link.facilityId === facilityId);
}

/**
 * Read-only audit trail (INN-42), newest first.
 *
 * Everyone sees their own events, so this query uses `requireSession` without
 * `requireRole`. Security officers and system admins see every event; hospital
 * admins see events involving their facility (INN-52). Reviewers may filter by
 * actor, patient publicId, facility, decision outcome, and createdAt range
 * (INN-78). There is deliberately no function that updates or deletes audit rows.
 */
export const listAuditEvents = query({
  args: {
    token: v.optional(v.string()),
    action: v.optional(auditAction),
    /** String so a malformed id is an empty page (`normalizeId`), not a `v.id` validator error. */
    actorId: v.optional(v.string()),
    patientPublicId: v.optional(v.string()),
    facilityId: v.optional(v.string()),
    outcome: v.optional(decisionOutcome),
    createdFrom: v.optional(v.number()),
    createdTo: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(auditEventViewValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requireSession(ctx, args.token)).user;
    } catch (error) {
      if (isAuthAppError(error)) {
        return EMPTY_PAGE;
      }
      throw error;
    }

    const scope = await resolveReviewerScope(ctx.db, user);
    const isReviewer = scope.kind !== "none";
    let actorId: Id<"users"> | undefined = isReviewer ? undefined : user._id;
    if (args.actorId !== undefined) {
      const requestedActorId = ctx.db.normalizeId("users", args.actorId);
      if (!requestedActorId) {
        return EMPTY_PAGE;
      }
      if (!isReviewer && requestedActorId !== user._id) {
        throwAppError(PERMISSION_DENIED_CODE, PERMISSION_DENIED_MESSAGE);
      }
      actorId = requestedActorId;
    }

    let action = args.action;
    if (isReviewer && args.outcome !== undefined) {
      const outcomeAction = OUTCOME_AUDIT_ACTION[args.outcome];
      if (action !== undefined && action !== outcomeAction) {
        return EMPTY_PAGE;
      }
      action = outcomeAction;
    }

    const createdFrom = isReviewer ? args.createdFrom : undefined;
    const createdTo = isReviewer ? args.createdTo : undefined;
    if (
      createdFrom !== undefined &&
      createdTo !== undefined &&
      createdFrom > createdTo
    ) {
      return EMPTY_PAGE;
    }

    const filters: EventFilters = { actorId, action, createdFrom, createdTo };

    let patientId: Id<"patients"> | undefined;
    if (isReviewer && args.patientPublicId !== undefined && args.patientPublicId.trim() !== "") {
      const resolvedPatientId = await findPatientIdByPublicId(ctx, args.patientPublicId);
      if (!resolvedPatientId) {
        return EMPTY_PAGE;
      }
      patientId = resolvedPatientId;
    }

    let facilityId: Id<"facilities"> | undefined;
    if (isReviewer && args.facilityId !== undefined && args.facilityId.trim() !== "") {
      const requestedFacilityId = ctx.db.normalizeId("facilities", args.facilityId);
      if (!requestedFacilityId) {
        return EMPTY_PAGE;
      }
      if (scope.kind === "facility" && scope.facilityId !== requestedFacilityId) {
        return EMPTY_PAGE;
      }
      facilityId = requestedFacilityId;
    } else if (scope.kind === "facility") {
      facilityId = scope.facilityId ?? undefined;
      if (!facilityId) {
        return EMPTY_PAGE;
      }
    }

    const actorCache: ActorCache = new Map();

    if (patientId) {
      const results = await queryPatientEvents(ctx, patientId, filters)
        .order("desc")
        .paginate(args.paginationOpts);
      const visible = [];
      for (const event of results.page) {
        if (facilityId && !(await eventTouchesFacility(ctx, event._id, facilityId))) {
          continue;
        }
        visible.push(await toEventView(ctx, event, actorCache));
      }
      return { ...results, page: visible };
    }

    if (facilityId) {
      const links = await queryFacilityEvents(ctx, facilityId, filters)
        .order("desc")
        .paginate(args.paginationOpts);
      const events = await Promise.all(links.page.map((link) => ctx.db.get(link.eventId)));
      const page = await Promise.all(
        events
          .filter((event) => event !== null)
          .map((event) => toEventView(ctx, event, actorCache)),
      );
      return { ...links, page };
    }

    const results = await queryEvents(ctx, filters).order("desc").paginate(args.paginationOpts);
    const page = await Promise.all(
      results.page.map((event) => toEventView(ctx, event, actorCache)),
    );
    return { ...results, page };
  },
});
