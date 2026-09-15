import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { accountStatus, facilityStatus, personName } from "./lib/domain";
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

  // Participating hospitals. Users still store `hospital` as a display string
  // so existing demo logins keep working. Optional `facilityId` lands in INN-30.
  facilities: defineTable({
    code: v.string(),
    name: v.string(),
    city: v.string(),
    status: facilityStatus,
  })
    .index("by_code", ["code"])
    .index("by_name", ["name"]),
});
