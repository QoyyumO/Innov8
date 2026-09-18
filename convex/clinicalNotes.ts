import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isAuthAppError, readAppError, throwAppError } from "./lib/appError";
import {
  CLINICAL_WRITE_NOT_ALLOWED_CODE,
  CLINICAL_WRITE_NOT_ALLOWED_MESSAGE,
} from "./lib/clinicalNoteConstants";
import { requireClinicianSession } from "./lib/roles";
import {
  appendClinicalNote,
  loadNotesForRequest,
} from "./lib/services/clinicalNoteService";

const noteViewValidator = v.object({
  noteId: v.id("clinicalNotes"),
  body: v.string(),
  createdAt: v.number(),
});

const appendResultValidator = v.object({
  noteId: v.id("clinicalNotes"),
  requestId: v.id("accessRequests"),
  publicId: v.string(),
  originatingFacility: v.string(),
  body: v.string(),
  createdAt: v.number(),
});

/**
 * INN-81: doctors append a synthetic note after ALLOW. Not an EMR write.
 */
export const appendClinicalNoteAfterAllow = mutation({
  args: {
    token: v.optional(v.string()),
    requestId: v.string(),
    body: v.string(),
  },
  returns: appendResultValidator,
  handler: async (ctx, args) => {
    const sessionContext = await requireClinicianSession(ctx, args.token);
    const requestId = ctx.db.normalizeId("accessRequests", args.requestId);
    if (!requestId) {
      throwAppError(CLINICAL_WRITE_NOT_ALLOWED_CODE, CLINICAL_WRITE_NOT_ALLOWED_MESSAGE);
    }
    return await appendClinicalNote(
      ctx.db,
      sessionContext,
      { requestId, body: args.body },
      Date.now(),
    );
  },
});

export const listClinicalNotesForRequest = query({
  args: {
    token: v.optional(v.string()),
    requestId: v.string(),
  },
  returns: v.array(noteViewValidator),
  handler: async (ctx, args) => {
    let sessionContext;
    try {
      sessionContext = await requireClinicianSession(ctx, args.token);
    } catch (error) {
      if (isAuthAppError(error)) {
        return [];
      }
      throw error;
    }
    const requestId = ctx.db.normalizeId("accessRequests", args.requestId);
    if (!requestId) {
      return [];
    }
    try {
      return await loadNotesForRequest(
        ctx.db,
        sessionContext.user,
        requestId,
        Date.now(),
      );
    } catch (error) {
      if (isAuthAppError(error) || readAppError(error) !== null) {
        return [];
      }
      throw error;
    }
  },
});
