import { internalMutation, internalQuery, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { hashPassword } from "./lib/password";
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  DEMO_WORKER_SEEDS,
} from "./lib/demoUsers";
import {
  ALLERGIES,
  BLOOD_GROUPS,
  CONDITIONS,
  DEMO_ALLOW_REQUESTED_AT,
  DEMO_BLOCK_REQUESTED_AT,
  DEMO_PATIENT_DOB_MS,
  DEMO_PATIENT_INDEX,
  DEMO_PATIENT_PUBLIC_ID,
  DEPARTMENTS,
  FACILITIES,
  FIRST_NAMES,
  GENDERS,
  IBRAHIM_EMAIL,
  LAST_NAMES,
  MEDICATIONS,
  NORMAL_PURPOSES,
  RECORD_TYPES,
  SEED_ACCESS_EVENT_BATCH_SIZE,
  SEED_ACCESS_EVENT_COUNT,
  SEED_CLEAR_BATCH_SIZE,
  SEED_EVENT_BASE_MS,
  SEED_PATIENT_BATCH_SIZE,
  SEED_PATIENT_COUNT,
  SEED_WORKER_COUNT,
  WORKER_ROLE_POOL,
  mulberry32,
  normalizeSearchName,
  pad,
  pick,
  randInt,
  unixDateOfBirth,
} from "./lib/synthetic";
import {
  DecisionOutcome,
  Purpose,
  RecordType,
} from "./lib/domain";
import { UserRole } from "./lib/roles";

export const seedFacilities = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;
    for (const facility of FACILITIES) {
      const existing = await ctx.db
        .query("facilities")
        .withIndex("by_code", (q) => q.eq("code", facility.code))
        .first();
      if (existing) {
        skipped += 1;
        continue;
      }
      await ctx.db.insert("facilities", facility);
      inserted += 1;
    }
    return { inserted, skipped };
  },
});

async function loadFacilities(ctx: MutationCtx): Promise<Doc<"facilities">[]> {
  const facilities = await ctx.db.query("facilities").collect();
  if (facilities.length === 0) {
    throw new Error(
      "No facilities found — run internal.seed.seedFacilities first.",
    );
  }
  return facilities;
}

function requireFacility(
  facilities: Doc<"facilities">[],
  code: string,
): Doc<"facilities"> {
  const facility = facilities.find((row) => row.code === code);
  if (!facility) {
    throw new Error(`Facility ${code} is missing.`);
  }
  return facility;
}

function facilityByHospitalName(
  facilities: Doc<"facilities">[],
  hospital: string,
): Doc<"facilities"> | undefined {
  return facilities.find((row) => row.name === hospital);
}

function volumeForRole(role: UserRole): number {
  if (role === "doctor") return 20;
  if (role === "nurse") return 35;
  if (role === "pharmacist") return 25;
  if (role === "laboratory") return 30;
  if (role === "hospital_admin") return 8;
  if (role === "security_officer") return 5;
  return 15;
}

export const seedHealthcareWorkers = internalMutation({
  args: { count: v.optional(v.number()) },
  returns: v.object({ inserted: v.number(), updated: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const total = args.count ?? SEED_WORKER_COUNT;
    const facilities = await loadFacilities(ctx);
    const rand = mulberry32(42);
    const hashedPassword = await hashPassword(DEMO_PASSWORD);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const demoUser of DEMO_USERS) {
      const workerSeed = DEMO_WORKER_SEEDS.find(
        (seed) => seed.email === demoUser.email,
      );
      const matchedFacility = facilityByHospitalName(
        facilities,
        demoUser.hospital,
      );
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", demoUser.email))
        .first();

      const workerFields: {
        facilityId?: Id<"facilities">;
        workerId?: string;
        normalAccessHours?: { start: string; end: string };
        normalPatientVolume?: number;
      } = {};
      if (matchedFacility) {
        workerFields.facilityId = matchedFacility._id;
      }
      if (workerSeed) {
        workerFields.workerId = workerSeed.workerId;
        workerFields.normalAccessHours = workerSeed.normalAccessHours;
        workerFields.normalPatientVolume = workerSeed.normalPatientVolume;
      }

      if (existing) {
        await ctx.db.patch(existing._id, workerFields);
        updated += 1;
        continue;
      }

      await ctx.db.insert("users", {
        email: demoUser.email,
        hashedPassword,
        roles: demoUser.roles,
        hospital: demoUser.hospital,
        department: demoUser.department,
        accountStatus: "active",
        profile: demoUser.profile,
        ...workerFields,
      });
      inserted += 1;
    }

    for (let workerIndex = 1; workerIndex <= total; workerIndex += 1) {
      const workerId = `WRK-${pad(workerIndex, 5)}`;
      const existingByWorkerId = await ctx.db
        .query("users")
        .withIndex("by_workerId", (q) => q.eq("workerId", workerId))
        .first();
      if (existingByWorkerId) {
        skipped += 1;
        continue;
      }

      const role = pick(rand, WORKER_ROLE_POOL);
      const facility = pick(rand, facilities);
      const firstName = pick(rand, FIRST_NAMES);
      const lastName = pick(rand, LAST_NAMES);
      const department = pick(rand, DEPARTMENTS[role]);
      const email =
        `${firstName}.${lastName}.${workerIndex}@${facility.code
          .toLowerCase()
          .replace("fmc-", "fmc.")}.ng`.toLowerCase();

      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existingByEmail) {
        await ctx.db.patch(existingByEmail._id, {
          facilityId: facility._id,
          workerId,
          department,
          normalAccessHours: { start: "08:00", end: "18:00" },
          normalPatientVolume: volumeForRole(role),
        });
        updated += 1;
        continue;
      }

      await ctx.db.insert("users", {
        email,
        hashedPassword,
        roles: [role],
        hospital: facility.name,
        department,
        accountStatus: "active",
        profile: { firstName, lastName },
        facilityId: facility._id,
        workerId,
        normalAccessHours: { start: "08:00", end: "18:00" },
        normalPatientVolume: volumeForRole(role),
      });
      inserted += 1;
    }

    return { inserted, updated, skipped };
  },
});

async function upsertRecordIndexAndSummary(
  ctx: MutationCtx,
  args: {
    patientId: Id<"patients">;
    facilityId: Id<"facilities">;
    recordTypes: RecordType[];
    medicalSummary: string;
    allergies: string[];
    medications: string[];
    diagnoses: string[];
    conditions: string[];
    updatedAt: number;
  },
) {
  const existingIndex = await ctx.db
    .query("recordIndexes")
    .withIndex("by_patientId_facilityId", (q) =>
      q.eq("patientId", args.patientId).eq("facilityId", args.facilityId),
    )
    .first();
  if (existingIndex) {
    await ctx.db.patch(existingIndex._id, {
      recordTypes: args.recordTypes,
      updatedAt: args.updatedAt,
    });
  } else {
    await ctx.db.insert("recordIndexes", {
      patientId: args.patientId,
      facilityId: args.facilityId,
      recordTypes: args.recordTypes,
      updatedAt: args.updatedAt,
    });
  }

  const existingSummary = await ctx.db
    .query("clinicalSummaries")
    .withIndex("by_patientId_facilityId", (q) =>
      q.eq("patientId", args.patientId).eq("facilityId", args.facilityId),
    )
    .first();
  if (existingSummary) {
    await ctx.db.patch(existingSummary._id, {
      medicalSummary: args.medicalSummary,
      allergies: args.allergies,
      medications: args.medications,
      diagnoses: args.diagnoses,
      conditions: args.conditions,
      updatedAt: args.updatedAt,
    });
  } else {
    await ctx.db.insert("clinicalSummaries", {
      patientId: args.patientId,
      facilityId: args.facilityId,
      medicalSummary: args.medicalSummary,
      allergies: args.allergies,
      medications: args.medications,
      diagnoses: args.diagnoses,
      conditions: args.conditions,
      updatedAt: args.updatedAt,
    });
  }
}

async function upsertSyntheticPatient(
  ctx: MutationCtx,
  facilities: Doc<"facilities">[],
  patientIndex: number,
) {
  const lagos = requireFacility(facilities, "FMC-LOS");
  const publicId = `PAT-${pad(patientIndex, 6)}`;
  const isDemoPatient = patientIndex === DEMO_PATIENT_INDEX;
  const rand = mulberry32(1_000_003 * patientIndex + 7);
  const facility = isDemoPatient ? lagos : pick(rand, facilities);
  const firstName = isDemoPatient ? "Chioma" : pick(rand, FIRST_NAMES);
  const lastName = isDemoPatient ? "Okonkwo" : pick(rand, LAST_NAMES);
  const gender = isDemoPatient ? "female" : pick(rand, GENDERS);
  const bloodGroup = isDemoPatient ? "O+" : pick(rand, BLOOD_GROUPS);
  const dateOfBirth = isDemoPatient
    ? DEMO_PATIENT_DOB_MS
    : unixDateOfBirth(rand);
  const searchName = normalizeSearchName(firstName, lastName);
  const updatedAt = SEED_EVENT_BASE_MS - patientIndex * 86_400_000;

  const existing = await ctx.db
    .query("patients")
    .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
    .first();

  const patientId = existing
    ? existing._id
    : await ctx.db.insert("patients", {
        publicId,
        homeFacilityId: facility._id,
        profile: { firstName, lastName },
        dateOfBirth,
        gender,
        bloodGroup,
        searchName,
      });

  if (existing && isDemoPatient) {
    await ctx.db.patch(existing._id, {
      homeFacilityId: lagos._id,
      profile: { firstName: "Chioma", lastName: "Okonkwo" },
      dateOfBirth: DEMO_PATIENT_DOB_MS,
      gender: "female",
      bloodGroup: "O+",
      searchName: "chioma okonkwo",
    });
  }

  const condition = isDemoPatient ? "Hypertension" : pick(rand, CONDITIONS);
  const allergies = isDemoPatient ? ["Penicillin"] : [pick(rand, ALLERGIES)];
  const medications = isDemoPatient
    ? ["Lisinopril 10mg"]
    : [pick(rand, MEDICATIONS)];

  await upsertRecordIndexAndSummary(ctx, {
    patientId,
    facilityId: isDemoPatient ? lagos._id : facility._id,
    recordTypes: [...RECORD_TYPES],
    medicalSummary: isDemoPatient
      ? "Chioma Okonkwo is usually treated at FMC Lagos. Synthetic summary for the Track C demo: stable hypertension, no acute distress."
      : `Synthetic summary for ${publicId}. Stable; routine follow-up recommended.`,
    allergies,
    medications,
    diagnoses: [condition],
    conditions: [condition],
    updatedAt,
  });
}

export const seedPatientsBatch = internalMutation({
  args: {
    cursor: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    total: v.optional(v.number()),
    continueToEvents: v.optional(v.boolean()),
  },
  returns: v.object({ cursor: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    const batchSize = args.batchSize ?? SEED_PATIENT_BATCH_SIZE;
    const total = args.total ?? SEED_PATIENT_COUNT;
    const continueToEvents = args.continueToEvents ?? false;
    const facilities = await loadFacilities(ctx);
    const end = Math.min(cursor + batchSize, total);

    if (cursor === 0) {
      await upsertSyntheticPatient(ctx, facilities, DEMO_PATIENT_INDEX);
    }

    for (
      let patientIndex = cursor + 1;
      patientIndex <= end;
      patientIndex += 1
    ) {
      if (patientIndex === DEMO_PATIENT_INDEX) {
        continue;
      }
      await upsertSyntheticPatient(ctx, facilities, patientIndex);
    }

    const done = end >= total;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.seed.seedPatientsBatch, {
        cursor: end,
        batchSize,
        total,
        continueToEvents,
      });
    } else if (continueToEvents) {
      await ctx.scheduler.runAfter(0, internal.seed.seedAccessEventsBatch, {
        cursor: 0,
        batchSize: SEED_ACCESS_EVENT_BATCH_SIZE,
        total: SEED_ACCESS_EVENT_COUNT,
        patientCount: total,
        workerCount: SEED_WORKER_COUNT,
      });
    }
    return { cursor: end, done };
  },
});

type SeedAccessArgs = {
  worker: Doc<"users">;
  patient: Doc<"patients">;
  purpose: Purpose;
  recordTypes: RecordType[];
  recordCount?: number;
  device?: string;
  location?: string;
  requestedAt: number;
  outcome: DecisionOutcome;
  riskScore: number;
  reasons: string[];
};

async function seedAccessEvent(
  ctx: MutationCtx,
  args: SeedAccessArgs,
): Promise<"inserted" | "skipped"> {
  const existingRequest = await ctx.db
    .query("accessRequests")
    .withIndex("by_actorId_requestedAt", (q) =>
      q.eq("actorId", args.worker._id).eq("requestedAt", args.requestedAt),
    )
    .first();
  if (existingRequest) {
    return "skipped";
  }

  const sourceFacilityId =
    args.worker.facilityId ?? args.patient.homeFacilityId;
  const sameHospital = sourceFacilityId === args.patient.homeFacilityId;
  const recordCount = args.recordCount ?? 1;
  const actorRole = args.worker.roles[0] ?? "doctor";

  const requestId = await ctx.db.insert("accessRequests", {
    actorId: args.worker._id,
    patientId: args.patient._id,
    sourceFacilityId,
    targetFacilityId: args.patient.homeFacilityId,
    purpose: args.purpose,
    recordTypes: args.recordTypes,
    recordCount,
    device: args.device,
    location: args.location,
    requestedAt: args.requestedAt,
  });

  const decisionId = await ctx.db.insert("accessDecisions", {
    requestId,
    outcome: args.outcome,
    riskScore: args.riskScore,
    reasons: args.reasons,
    decidedAt: args.requestedAt + 1000,
    factors: {
      role: actorRole,
      purpose: args.purpose,
      sameHospital,
      recordCount,
    },
  });

  const followUpAction =
    args.outcome === "ALLOW"
      ? "AccessAllowed"
      : args.outcome === "VERIFY"
        ? "AccessChallenged"
        : "AccessBlocked";

  await ctx.db.insert("auditEvents", {
    actorId: args.worker._id,
    action: "AccessRequested",
    entity: "accessRequests",
    entityId: requestId,
    details: {
      patientPublicId: args.patient.publicId,
      purpose: args.purpose,
    },
    createdAt: args.requestedAt,
  });

  await ctx.db.insert("auditEvents", {
    actorId: args.worker._id,
    action: followUpAction,
    entity: "accessDecisions",
    entityId: decisionId,
    details: {
      outcome: args.outcome,
      riskScore: args.riskScore,
      reasons: args.reasons,
    },
    createdAt: args.requestedAt + 1000,
  });

  if (args.outcome === "BLOCK") {
    await ctx.db.insert("securityAlerts", {
      decisionId,
      severity: "high",
      status: "open",
      title: "Blocked high-risk access request",
      message: args.reasons.join(" "),
      createdAt: args.requestedAt + 1000,
    });
    await ctx.db.insert("auditEvents", {
      actorId: args.worker._id,
      action: "SecurityAlertRaised",
      entity: "securityAlerts",
      entityId: decisionId,
      details: {
        outcome: args.outcome,
        riskScore: args.riskScore,
      },
      createdAt: args.requestedAt + 2000,
    });
  }

  return "inserted";
}

async function seedDemoScenarioEvents(ctx: MutationCtx) {
  const ibrahim = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", IBRAHIM_EMAIL))
    .first();
  const demoPatient = await ctx.db
    .query("patients")
    .withIndex("by_publicId", (q) => q.eq("publicId", DEMO_PATIENT_PUBLIC_ID))
    .first();
  if (!ibrahim || !demoPatient) {
    throw new Error(
      "Demo access events need Ibrahim and PAT-002391 — seed workers and patients first.",
    );
  }

  await seedAccessEvent(ctx, {
    worker: ibrahim,
    patient: demoPatient,
    purpose: "treatment",
    recordTypes: [...RECORD_TYPES],
    requestedAt: DEMO_ALLOW_REQUESTED_AT,
    outcome: "ALLOW",
    riskScore: 8,
    reasons: [
      "Treatment purpose with a doctor role",
      "Requested fields limited to summary, allergies, medications, and diagnoses",
      "No mass-access pattern",
    ],
  });

  await seedAccessEvent(ctx, {
    worker: ibrahim,
    patient: demoPatient,
    purpose: "administrative",
    recordTypes: [...RECORD_TYPES],
    recordCount: 500,
    location: "off-site",
    requestedAt: DEMO_BLOCK_REQUESTED_AT,
    outcome: "BLOCK",
    riskScore: 94,
    reasons: [
      "Sudden request covering about 500 patient records",
      "Volume far above the clinician's normal patient volume",
      "Harvest-style access pattern",
    ],
  });
}

export const seedAccessEventsBatch = internalMutation({
  args: {
    cursor: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    total: v.optional(v.number()),
    patientCount: v.optional(v.number()),
    workerCount: v.optional(v.number()),
  },
  returns: v.object({
    cursor: v.number(),
    done: v.boolean(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? 0;
    const batchSize = args.batchSize ?? SEED_ACCESS_EVENT_BATCH_SIZE;
    const total = args.total ?? SEED_ACCESS_EVENT_COUNT;
    const patientCount = args.patientCount ?? SEED_PATIENT_COUNT;
    const workerCount = args.workerCount ?? SEED_WORKER_COUNT;
    if (cursor === 0) {
      await seedDemoScenarioEvents(ctx);
    }

    const end = Math.min(cursor + batchSize, total);
    let skipped = 0;

    for (let eventIndex = cursor + 1; eventIndex <= end; eventIndex += 1) {
      const rand = mulberry32(2_000_017 * eventIndex + 11);
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
      if (!patient || !worker) {
        throw new Error(
          `Missing ${patientPublicId} or ${workerId} — finish patient and worker seed first.`,
        );
      }

      const isSuspicious = rand() < 0.05;
      const requestedAt = isSuspicious
        ? Date.UTC(2026, 5, 1, 2, 47, 0, 0) + eventIndex
        : SEED_EVENT_BASE_MS + eventIndex * 60_000;

      const anomalyKind = randInt(rand, 0, 3);
      const isMassAccess = isSuspicious && anomalyKind === 0;
      const isCrossFacility = isSuspicious && anomalyKind === 3;
      const outcome: DecisionOutcome = !isSuspicious
        ? "ALLOW"
        : isMassAccess || anomalyKind === 2
          ? "BLOCK"
          : "VERIFY";
      const purpose: Purpose = !isSuspicious
        ? pick(rand, NORMAL_PURPOSES)
        : isCrossFacility
          ? "administrative"
          : pick(rand, ["emergency", "administrative"] as const);

      const result = await seedAccessEvent(ctx, {
        worker,
        patient,
        purpose,
        recordTypes: [...RECORD_TYPES],
        recordCount: isMassAccess ? 500 : 1,
        location: isSuspicious && anomalyKind === 2 ? "unknown-device-site" : undefined,
        requestedAt,
        outcome,
        riskScore: !isSuspicious
          ? randInt(rand, 4, 18)
          : outcome === "BLOCK"
            ? randInt(rand, 88, 98)
            : randInt(rand, 45, 70),
        reasons: !isSuspicious
          ? [
              "Purpose is clinically appropriate",
              "Request volume is within the worker baseline",
            ]
          : outcome === "BLOCK"
            ? [
                "Suspicious access pattern",
                isMassAccess
                  ? "Mass record request (~500)"
                  : "High-risk context (time, location, or relationship)",
              ]
            : [
                "Access occurred outside normal hours or department context",
                "Step-up verification required",
              ],
      });
      if (result === "skipped") {
        skipped += 1;
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
    return { cursor: end, done, skipped };
  },
});

const CLEAR_TABLES = [
  "auditEvents",
  "securityAlerts",
  "emergencyAccess",
  "accessDecisions",
  "accessRequests",
  "clinicalSummaries",
  "recordIndexes",
  "patients",
  "passwordResetTokens",
  "sessions",
] as const;

type ClearTable = (typeof CLEAR_TABLES)[number];

const DEMO_EMAILS = new Set(DEMO_USERS.map((demoUser) => demoUser.email));

function workerIndexFromId(workerId: string | undefined): number | null {
  if (workerId === undefined) {
    return null;
  }
  const match = /^WRK-(\d+)$/.exec(workerId);
  if (match === null) {
    return null;
  }
  const digits = match[1];
  if (digits === undefined) {
    return null;
  }
  return Number(digits);
}

function shouldKeepUser(user: Doc<"users">): boolean {
  if (DEMO_EMAILS.has(user.email)) {
    return true;
  }
  const workerIndex = workerIndexFromId(user.workerId);
  return (
    workerIndex !== null &&
    workerIndex >= 1 &&
    workerIndex <= SEED_WORKER_COUNT
  );
}

async function deleteTableBatch(
  ctx: MutationCtx,
  table: ClearTable,
  batchSize: number,
): Promise<number> {
  const rows = await ctx.db.query(table).take(batchSize);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

export const clearSeedDataBatch = internalMutation({
  args: {
    tableIndex: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    table: v.string(),
    deleted: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const tableIndex = args.tableIndex ?? 0;
    const batchSize = args.batchSize ?? SEED_CLEAR_BATCH_SIZE;

    if (tableIndex < CLEAR_TABLES.length) {
      const table = CLEAR_TABLES[tableIndex];
      if (table === undefined) {
        throw new Error(`Unknown clear table index ${tableIndex}`);
      }
      const deleted = await deleteTableBatch(ctx, table, batchSize);
      const tableDone = deleted < batchSize;
      const nextIndex = tableDone ? tableIndex + 1 : tableIndex;
      await ctx.scheduler.runAfter(0, internal.seed.clearSeedDataBatch, {
        tableIndex: nextIndex,
        batchSize,
      });
      return { table, deleted, done: false };
    }

    const users = await ctx.db.query("users").take(batchSize);
    let deleted = 0;
    for (const user of users) {
      if (!shouldKeepUser(user)) {
        await ctx.db.delete(user._id);
        deleted += 1;
      }
    }
    const scannedAll = users.length < batchSize;
    if (!scannedAll && deleted === 0) {
      throw new Error(
        "clearSeedDataBatch cannot progress: keeper count is >= batchSize.",
      );
    }
    if (!scannedAll) {
      await ctx.scheduler.runAfter(0, internal.seed.clearSeedDataBatch, {
        tableIndex,
        batchSize,
      });
    }
    return { table: "users", deleted, done: scannedAll };
  },
});

export const seedDemoDataset = internalMutation({
  args: {},
  returns: v.object({ started: v.boolean() }),
  handler: async (ctx) => {
    const facilitiesResult: { inserted: number; skipped: number } =
      await ctx.runMutation(internal.seed.seedFacilities, {});
    const workersResult: {
      inserted: number;
      updated: number;
      skipped: number;
    } = await ctx.runMutation(internal.seed.seedHealthcareWorkers, {
      count: SEED_WORKER_COUNT,
    });
    void facilitiesResult;
    void workersResult;
    await ctx.scheduler.runAfter(0, internal.seed.seedPatientsBatch, {
      cursor: 0,
      batchSize: SEED_PATIENT_BATCH_SIZE,
      total: SEED_PATIENT_COUNT,
      continueToEvents: true,
    });
    return { started: true };
  },
});

export const verifyDemoSeed = internalQuery({
  args: {},
  returns: v.object({
    facilities: v.number(),
    ibrahimWorkerId: v.union(v.string(), v.null()),
    demoPatient: v.union(
      v.null(),
      v.object({
        publicId: v.string(),
        firstName: v.string(),
        lastName: v.string(),
        homeFacilityCode: v.union(v.string(), v.null()),
        recordTypes: v.array(v.string()),
        hasClinicalSummary: v.boolean(),
      }),
    ),
    allowRiskScore: v.union(v.number(), v.null()),
    blockRiskScore: v.union(v.number(), v.null()),
    blockAlertSeverity: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const facilities = await ctx.db.query("facilities").collect();
    const ibrahim = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", IBRAHIM_EMAIL))
      .first();
    const demoPatient = await ctx.db
      .query("patients")
      .withIndex("by_publicId", (q) => q.eq("publicId", DEMO_PATIENT_PUBLIC_ID))
      .first();

    let homeFacilityCode: string | null = null;
    let recordTypes: string[] = [];
    let hasClinicalSummary = false;
    if (demoPatient) {
      const homeFacility = await ctx.db.get(demoPatient.homeFacilityId);
      homeFacilityCode = homeFacility?.code ?? null;
      const recordIndex = await ctx.db
        .query("recordIndexes")
        .withIndex("by_patientId_facilityId", (q) =>
          q
            .eq("patientId", demoPatient._id)
            .eq("facilityId", demoPatient.homeFacilityId),
        )
        .first();
      recordTypes = recordIndex?.recordTypes ?? [];
      const summary = await ctx.db
        .query("clinicalSummaries")
        .withIndex("by_patientId_facilityId", (q) =>
          q
            .eq("patientId", demoPatient._id)
            .eq("facilityId", demoPatient.homeFacilityId),
        )
        .first();
      hasClinicalSummary = summary !== null;
    }

    let allowRiskScore: number | null = null;
    let blockRiskScore: number | null = null;
    let blockAlertSeverity: string | null = null;
    if (ibrahim) {
      const allowRequest = await ctx.db
        .query("accessRequests")
        .withIndex("by_actorId_requestedAt", (q) =>
          q.eq("actorId", ibrahim._id).eq("requestedAt", DEMO_ALLOW_REQUESTED_AT),
        )
        .first();
      if (allowRequest) {
        const allowDecision = await ctx.db
          .query("accessDecisions")
          .withIndex("by_requestId", (q) => q.eq("requestId", allowRequest._id))
          .first();
        allowRiskScore = allowDecision?.riskScore ?? null;
      }
      const blockRequest = await ctx.db
        .query("accessRequests")
        .withIndex("by_actorId_requestedAt", (q) =>
          q.eq("actorId", ibrahim._id).eq("requestedAt", DEMO_BLOCK_REQUESTED_AT),
        )
        .first();
      if (blockRequest) {
        const blockDecision = await ctx.db
          .query("accessDecisions")
          .withIndex("by_requestId", (q) => q.eq("requestId", blockRequest._id))
          .first();
        blockRiskScore = blockDecision?.riskScore ?? null;
        if (blockDecision) {
          const recentAlerts = await ctx.db
            .query("securityAlerts")
            .withIndex("by_createdAt")
            .order("desc")
            .take(25);
          const matchingAlert = recentAlerts.find(
            (alert) => alert.decisionId === blockDecision._id,
          );
          blockAlertSeverity = matchingAlert?.severity ?? null;
        }
      }
    }

    return {
      facilities: facilities.length,
      ibrahimWorkerId: ibrahim?.workerId ?? null,
      demoPatient: demoPatient
        ? {
            publicId: demoPatient.publicId,
            firstName: demoPatient.profile.firstName,
            lastName: demoPatient.profile.lastName,
            homeFacilityCode,
            recordTypes,
            hasClinicalSummary,
          }
        : null,
      allowRiskScore,
      blockRiskScore,
      blockAlertSeverity,
    };
  },
});
