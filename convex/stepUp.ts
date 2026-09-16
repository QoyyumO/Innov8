import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireClinicianSession } from "./lib/roles";
import { STEP_UP_NOT_ELIGIBLE_MESSAGE } from "./lib/stepUpConstants";
import { completeStepUp } from "./lib/services/stepUpService";

/**
 * INN-44: finish a VERIFY decision by re-entering your password.
 * Returns `verified`, `failed` (with attempts left), or `blocked`.
 */
export const completeVerification = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("verified"), allowedUntil: v.number() }),
    v.object({ status: v.literal("failed"), attemptsLeft: v.number() }),
    v.object({ status: v.literal("blocked") }),
  ),
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    const requestId = ctx.db.normalizeId("accessRequests", args.requestId);
    if (!requestId) {
      throw new Error(STEP_UP_NOT_ELIGIBLE_MESSAGE);
    }
    return await completeStepUp(ctx.db, sessionContext, requestId, args.password, Date.now());
  },
});
