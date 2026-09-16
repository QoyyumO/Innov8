import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accountStatus,
  alertSeverity,
  alertStatus,
  auditAction,
  auditDetails,
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
    // Worker identity stays on users (no second table). All new fields are
    // optional so ibrahim@fmc.abuja.ng and other demo logins keep working.
    facilityId: v.optional(v.id("facilities")),
    workerId: v.optional(v.string()),
    normalAccessHours: v.optional(
      v.object({
        start: v.string(),
        end: v.string(),
      }),
    ),
    normalPatientVolume: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_workerId", ["workerId"])
    .index("by_facilityId", ["facilityId"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  passwordResetTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  // Participating hospitals. Users still store `hospital` as a display string
  // so existing demo logins keep working. Seed/login can later set optional
  // `users.facilityId` without rewriting those rows first.
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
    .index("by_actorId_requestedAt", ["actorId", "requestedAt"])
    // Facility-scoped admin views (INN-52).
    .index("by_sourceFacilityId_requestedAt", ["sourceFacilityId", "requestedAt"])
    .index("by_targetFacilityId_requestedAt", ["targetFacilityId", "requestedAt"]),

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
    // Step-up (INN-44): set when a VERIFY decision is completed or escalated.
    verifiedAt: v.optional(v.number()),
    stepUpFailures: v.optional(v.number()),
    escalatedAt: v.optional(v.number()),
  })
    .index("by_requestId", ["requestId"])
    .index("by_outcome_decidedAt", ["outcome", "decidedAt"])
    .index("by_decidedAt", ["decidedAt"]),

  emergencyAccess: defineTable({
    requestId: v.id("accessRequests"),
    actorId: v.id("users"),
    patientId: v.id("patients"),
    justification: v.string(),
    grantedAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    // INN-52: copied from the request so facility dashboards can index live grants.
    sourceFacilityId: v.optional(v.id("facilities")),
    targetFacilityId: v.optional(v.id("facilities")),
  })
    .index("by_actorId", ["actorId"])
    .index("by_actorId_and_patientId", ["actorId", "patientId"])
    .index("by_patientId", ["patientId"])
    .index("by_requestId", ["requestId"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_sourceFacilityId_expiresAt", ["sourceFacilityId", "expiresAt"])
    .index("by_targetFacilityId_expiresAt", ["targetFacilityId", "expiresAt"]),

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

  auditEvents: defineTable({
    actorId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("sessions")),
    action: auditAction,
    entity: v.string(),
    entityId: v.optional(v.string()),
    details: auditDetails,
    createdAt: v.number(),
  })
    .index("by_actorId_createdAt", ["actorId", "createdAt"])
    .index("by_action_createdAt", ["action", "createdAt"])
    .index("by_actorId_action_createdAt", ["actorId", "action", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  // INN-53: stored per-facility totals, so dashboards never count users or
  // patients live. Maintained by `convex/lib/facilityStats.ts`.
  facilityStats: defineTable({
    facilityId: v.id("facilities"),
    workerCount: v.number(),
    patientCount: v.number(),
    updatedAt: v.number(),
  }).index("by_facilityId", ["facilityId"]),

  // INN-52: one row per facility an audit event involves (the actor's
  // facility plus the source/target of the request it is about), so a
  // hospital admin's trail is a single indexed, paginated stream.
  auditEventFacilities: defineTable({
    eventId: v.id("auditEvents"),
    facilityId: v.id("facilities"),
    actorId: v.optional(v.id("users")),
    action: auditAction,
    createdAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_facilityId_createdAt", ["facilityId", "createdAt"])
    .index("by_facilityId_action_createdAt", ["facilityId", "action", "createdAt"])
    .index("by_facilityId_actorId_createdAt", ["facilityId", "actorId", "createdAt"])
    .index("by_facilityId_actorId_action_createdAt", [
      "facilityId",
      "actorId",
      "action",
      "createdAt",
    ]),

  // INN-52: one row per facility an alert involves (source/target of its request).
  alertFacilities: defineTable({
    alertId: v.id("securityAlerts"),
    facilityId: v.id("facilities"),
    status: alertStatus,
    createdAt: v.number(),
  })
    .index("by_alertId", ["alertId"])
    .index("by_facilityId_createdAt", ["facilityId", "createdAt"])
    .index("by_facilityId_status_createdAt", ["facilityId", "status", "createdAt"]),
});
