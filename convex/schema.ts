import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole } from "./lib/roles";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    hashedPassword: v.string(),
    roles: v.array(userRole),
    hospital: v.string(),
    department: v.optional(v.string()),
    accountStatus: v.union(v.literal("active"), v.literal("suspended")),
    profile: v.object({
      firstName: v.string(),
      lastName: v.string(),
      middleName: v.optional(v.string()),
    }),
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
