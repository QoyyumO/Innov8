import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accountStatus,
  alertSeverity,
  alertStatus,
  bloodGroup,
  decisionOutcome,
  facilityStatus,
  gender,
  personName,
  purpose,
  recordType,
} from "./lib/domain";
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

  patients: defineTable({
    publicId: v.string(),
    homeFacilityId: v.id("facilities"),
    profile: personName,
    dateOfBirth: v.number(),
    gender,
    bloodGroup,
    searchName: v.string(),
  })
    .index("by_publicId", ["publicId"])
    .index("by_homeFacilityId", ["homeFacilityId"])
    .index("by_searchName", ["searchName"]),

  recordIndexes: defineTable({
    patientId: v.id("patients"),
    facilityId: v.id("facilities"),
    recordTypes: v.array(recordType),
    updatedAt: v.number(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_facilityId", ["facilityId"])
    .index("by_patientId_facilityId", ["patientId", "facilityId"]),

  clinicalSummaries: defineTable({
    patientId: v.id("patients"),
    facilityId: v.id("facilities"),
    medicalSummary: v.string(),
    allergies: v.array(v.string()),
    medications: v.array(v.string()),
    diagnoses: v.array(v.string()),
    conditions: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_patientId_facilityId", ["patientId", "facilityId"]),

  accessRequests: defineTable({
    actorId: v.id("users"),
    sessionId: v.optional(v.id("sessions")),
    patientId: v.id("patients"),
    sourceFacilityId: v.id("facilities"),
    targetFacilityId: v.id("facilities"),
    purpose,
    recordTypes: v.array(recordType),
    recordCount: v.optional(v.number()),
    device: v.optional(v.string()),
    location: v.optional(v.string()),
    requestedAt: v.number(),
  })
    .index("by_actorId", ["actorId"])
    .index("by_patientId", ["patientId"])
    .index("by_requestedAt", ["requestedAt"])
    .index("by_actorId_requestedAt", ["actorId", "requestedAt"]),

  accessDecisions: defineTable({
    requestId: v.id("accessRequests"),
    outcome: decisionOutcome,
    riskScore: v.number(),
    reasons: v.array(v.string()),
    decidedAt: v.number(),
    factors: v.optional(
      v.object({
        role: userRole,
        purpose,
        sameHospital: v.boolean(),
        recordCount: v.number(),
      }),
    ),
  })
    .index("by_requestId", ["requestId"])
    .index("by_outcome", ["outcome"])
    .index("by_decidedAt", ["decidedAt"]),

  emergencyAccess: defineTable({
    requestId: v.id("accessRequests"),
    actorId: v.id("users"),
    patientId: v.id("patients"),
    justification: v.string(),
    grantedAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_actorId", ["actorId"])
    .index("by_patientId", ["patientId"])
    .index("by_expiresAt", ["expiresAt"]),

  securityAlerts: defineTable({
    decisionId: v.optional(v.id("accessDecisions")),
    emergencyAccessId: v.optional(v.id("emergencyAccess")),
    severity: alertSeverity,
    status: alertStatus,
    title: v.string(),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_severity", ["severity"])
    .index("by_createdAt", ["createdAt"]),
});
