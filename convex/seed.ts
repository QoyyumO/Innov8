import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { hashPassword } from "./lib/password";
import {
  mulberry32,
  pick,
  randInt,
  pad,
  FIRST_NAMES,
  LAST_NAMES,
  CONDITIONS,
  RECORD_TYPES,
  ACCESS_REASONS,
  WORKER_ROLE_POOL,
  SPECIALTIES,
  ALERT_TYPES,
  AUDIT_ACTIONS,
  isoDateOfBirth,
  FACILITIES,
} from "./lib/synthetic";

const DEMO_PASSWORD = "password123";

// ── 0. Facilities fixture (small, run first) ───────────────────────────

export const seedFacilities = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;
    for (const f of FACILITIES) {
      const existing = await ctx.db
        .query("facilities")
        .withIndex("by_code", (q) => q.eq("code", f.code))
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("facilities", f);
      inserted++;
    }
    return { inserted, skipped };
  },
});

async function getFacilityIds(ctx: any) {
  const facilities = await ctx.db.query("facilities").collect();
  if (facilities.length === 0) {
    throw new Error(
      "No facilities found — run internal.seed.seedFacilities first.",
    );
  }
  return facilities;
}

// ── 1. Healthcare workers (INN-32, 500 rows — single pass is fine) ─────

export const seedHealthcareWorkers = internalMutation({
  args: { count: v.optional(v.number()) },
  returns: v.object({ inserted: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const total = args.count ?? 500;
    const facilities = await getFacilityIds(ctx);
    const rand = mulberry32(42);
    let hashedPassword: string | null = null;
    let inserted = 0;
    let skipped = 0;

    for (let i = 1; i <= total; i++) {
      const workerId = `WRK-${pad(i, 5)}`;
      const existing = await ctx.db
        .query("users")
        .withIndex("by_workerId", (q) => q.eq("workerId", workerId))
        .first();
      if (existing) {
        skipped++;
        continue;
      }

      const role = pick(rand, WORKER_ROLE_POOL);
      const facility = pick(rand, facilities);
      const firstName = pick(rand, FIRST_NAMES);
      const lastName = pick(rand, LAST_NAMES);
      const specialty = pick(rand, SPECIALTIES[role]);
      const email = `${firstName}.${lastName}.${i}@${facility.code
        .toLowerCase()
        .replace("fmc-", "fmc.")}.ng`.toLowerCase();

      hashedPassword ??= await hashPassword(DEMO_PASSWORD);

      await ctx.db.insert("users", {
        email,
        hashedPassword,
        roles: [role],
        hospital: facility.name,
        department: specialty,
        accountStatus: "active",
        profile: { firstName, lastName },
        facilityId: facility._id,
        workerId,
        specialty,
        licenseNumber: `LIC-${pad(randInt(rand, 10000, 99999), 5)}`,
        yearsOfExperience: randInt(rand, 1, 30),
      });
      inserted++;
    }

    return { inserted, skipped };
  },
});

// ── 2. Patients + recordIndexes + clinicalSummaries (INN-31, 10,000) ───
// Batched via scheduler self-chaining so no single mutation inserts more
// than `batchSize` documents. Must include PAT-002391.

export const seedPatientsBatch = internalMutation({
  args: {
    cursor: v.number(),
    batchSize: v.number(),
    total: v.number(),
  },
  returns: v.object({ cursor: v.number(), done: v.boolean() }),
  handler: async (ctx, { cursor, batchSize, total }) => {
    const facilities = await getFacilityIds(ctx);
    const end = Math.min(cursor + batchSize, total);

    for (let i = cursor + 1; i <= end; i++) {
      const publicId = `PAT-${pad(i, 6)}`; // i = 2391 => PAT-002391
      const existing = await ctx.db
        .query("patients")
        .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
        .first();
      if (existing) continue;

      const rand = mulberry32(1_000_003 * i + 7); // deterministic per-patient
      const facility = pick(rand, facilities);
      const firstName = pick(rand, FIRST_NAMES);
      const lastName = pick(rand, LAST_NAMES);

      const patientId = await ctx.db.insert("patients", {
        publicId,
        facilityId: facility._id,
        firstName,
        lastName,
        dateOfBirth: isoDateOfBirth(rand),
        sex: rand() < 0.5 ? "male" : "female",
        phone: `080${randInt(rand, 10000000, 99999999)}`,
        bloodType: pick(rand, ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]),
        createdAt: Date.now(),
      });

      const recordCount = randInt(rand, 1, 3);
      for (let r = 0; r < recordCount; r++) {
        await ctx.db.insert("recordIndexes", {
          patientId,
          facilityId: facility._id,
          recordType: pick(rand, RECORD_TYPES),
          recordDate: Date.now() - randInt(rand, 0, 365) * 86_400_000,
          title: `${pick(rand, RECORD_TYPES)} record for ${publicId}`,
        });
      }

      await ctx.db.insert("clinicalSummaries", {
        patientId,
        facilityId: facility._id,
        condition: pick(rand, CONDITIONS),
        notes: `Synthetic summary for ${publicId}. Stable, routine follow-up recommended.`,
        lastUpdated: Date.now(),
      });
    }

    const done = end >= total;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.seed.seedPatientsBatch, {
        cursor: end,
        batchSize,
        total,
      });
    }
    return { cursor: end, done };
  },
});

// ── 3. Access events (INN-33, 100,000 rows, ~5% anomalous) ─────────────
// accessRequests + accessDecisions + auditEvents + securityAlerts, batched
// via scheduler self-chaining. Requires patients + workers already seeded.

export const seedAccessEventsBatch = internalMutation({
  args: {
    cursor: v.number(),
    batchSize: v.number(),
    total: v.number(),
    patientCount: v.number(),
    workerCount: v.number(),
  },
  returns: v.object({ cursor: v.number(), done: v.boolean() }),
  handler: async (ctx, { cursor, batchSize, total, patientCount, workerCount }) => {
    const end = Math.min(cursor + batchSize, total);

    for (let i = cursor + 1; i <= end; i++) {
      const rand = mulberry32(2_000_017 * i + 11);
      const patientPublicId = `PAT-${pad(randInt(rand, 1, patientCount), 6)}`;
      const workerId = `WRK-${pad(randInt(rand, 1, workerCount), 5)}`;

      const patient = await ctx.db
        .query("patients")
        .withIndex("by_publicId", (q) => q.eq("publicId", patientPublicId))
        .first();
      const worker = await ctx.db
        .query("users")
        .withIndex("by_workerId", (q) => q.eq("workerId", workerId))
        .first();
      if (!patient || !worker) continue; // seeding order issue — skip defensively

      const isAnomalous = rand() < 0.05;
      const now = Date.now() - randInt(rand, 0, 90) * 86_400_000;
      const requestPublicId = `REQ-${pad(i, 8)}`;

      const existingRequest = await ctx.db
        .query("accessRequests")
        .withIndex("by_publicId", (q) => q.eq("publicId", requestPublicId))
        .first();
      if (existingRequest) continue;

      const status = isAnomalous && rand() < 0.6 ? "denied" : "approved";

      const requestId = await ctx.db.insert("accessRequests", {
        publicId: requestPublicId,
        requesterId: worker._id,
        patientId: patient._id,
        facilityId: patient.facilityId,
        reason: pick(rand, ACCESS_REASONS),
        requestedAt: now,
        status,
      });

      await ctx.db.insert("accessDecisions", {
        requestId,
        decidedBy: isAnomalous ? undefined : worker._id,
        decision: status,
        decidedAt: now + 1000,
        reason: isAnomalous ? "Flagged for unusual access pattern" : undefined,
      });

      const auditEventId = await ctx.db.insert("auditEvents", {
        actorId: worker._id,
        patientId: patient._id,
        facilityId: patient.facilityId,
        action: pick(rand, AUDIT_ACTIONS),
        outcome: status === "denied" ? "failure" : "success",
        isAnomalous,
        occurredAt: now,
      });

      if (isAnomalous) {
        await ctx.db.insert("securityAlerts", {
          auditEventId,
          alertType: pick(rand, ALERT_TYPES),
          severity: pick(rand, ["low", "medium", "high"] as const),
          status: "open",
          createdAt: now,
        });
      }
    }

    const done = end >= total;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.seed.seedAccessEventsBatch, {
        cursor: end,
        batchSize,
        total,
        patientCount,
        workerCount,
      });
    }
    return { cursor: end, done };
  },
});
