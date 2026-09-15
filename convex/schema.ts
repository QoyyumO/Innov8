import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { accountStatus, personName } from "./lib/domain";
import { userRole } from "./lib/roles";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    hashedPassword: v.string(),
    roles: v.array(userRole),
    hospital: v.string(),
    department: v.optional(v.string()),
    accountStatus,
    profile: personName,
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),
});
