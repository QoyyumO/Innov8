import { query, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAuthErrorMessage, PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import { AuditAction, auditAction, auditDetails } from "./lib/domain";
import { isAuditReviewer } from "./lib/roles";
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

function queryEvents(
  ctx: QueryCtx,
  actorId: Id<"users"> | undefined,
  action: AuditAction | undefined,
) {
  const table = ctx.db.query("auditEvents");
  if (actorId && action) {
    return table.withIndex("by_actorId_action_createdAt", (query) =>
      query.eq("actorId", actorId).eq("action", action),
    );
  }
  if (actorId) {
    return table.withIndex("by_actorId_createdAt", (query) =>
      query.eq("actorId", actorId),
    );
  }
  if (action) {
    return table.withIndex("by_action_createdAt", (query) => query.eq("action", action));
  }
  return table.withIndex("by_createdAt");
}

/**
 * Read-only audit trail (INN-42), newest first.
 *
 * Everyone sees their own events, so this query uses `requireSession` without
 * `requireRole`. Reviewers (`isAuditReviewer`) see every event and may filter
 * to one actor; facility-scoped hospital-admin views are INN-52. There is
 * deliberately no function that updates or deletes audit rows.
 */
export const listAuditEvents = query({
  args: {
    token: v.optional(v.string()),
    action: v.optional(auditAction),
    /** String so a malformed id is an empty page (`normalizeId`), not a `v.id` validator error. */
    actorId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(auditEventViewValidator),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = (await requireSession(ctx, args.token)).user;
    } catch (error) {
      if (error instanceof Error && isAuthErrorMessage(error.message)) {
        return EMPTY_PAGE;
      }
      throw error;
    }

    const isReviewer = isAuditReviewer(user);
    let actorId: Id<"users"> | undefined = isReviewer ? undefined : user._id;
    if (args.actorId !== undefined) {
      const requestedActorId = ctx.db.normalizeId("users", args.actorId);
      if (!requestedActorId) {
        return EMPTY_PAGE;
      }
      if (!isReviewer && requestedActorId !== user._id) {
        throw new Error(PERMISSION_DENIED_MESSAGE);
      }
      actorId = requestedActorId;
    }

    const results = await queryEvents(ctx, actorId, args.action)
      .order("desc")
      .paginate(args.paginationOpts);

    const actorCache: ActorCache = new Map();
    const page = await Promise.all(
      results.page.map((event) => toEventView(ctx, event, actorCache)),
    );
    return { ...results, page };
  },
});
