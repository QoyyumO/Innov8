/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_CONSENT_DURATION_MS } from "./lib/consentConstants";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import {
  AUDIT_TODAY_COUNT_LIMIT,
  clampDashboardSince,
  OPEN_ALERT_COUNT_LIMIT,
  TODAY_COUNT_LIMIT,
  startOfLagosDay,
} from "./lib/dashboardConstants";
import { appendAuditEvent } from "./lib/services/auditLogService";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const ADMIN_EMAIL = "admin@fmc.abuja.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const ALL_RECORD_TYPES = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type TestBackend = ReturnType<typeof createTest>;

type DemoWorld = {
  lagosId: Id<"facilities">;
  abujaId: Id<"facilities">;
  patientId: Id<"patients">;
};

function createTest() {
  return convexTest(schema, modules);
}

function today() {
  return startOfLagosDay(Date.now());
}

async function loginUser(testBackend: TestBackend, email: string) {
  const loginResult = await testBackend.mutation(api.auth.login, {
    email,
    password: DEMO_PASSWORD,
  });
  return loginResult.token as string;
}

async function userIdFor(testBackend: TestBackend, email: string) {
  return await testBackend.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", email))
      .unique();
    if (!user) {
      throw new Error(`Missing demo user ${email}`);
    }
    return user._id;
  });
}

async function seedDemoWorld(testBackend: TestBackend): Promise<DemoWorld> {
  return await testBackend.run(async (ctx) => {
    const abujaId = await ctx.db.insert("facilities", {
      code: "FMC-ABJ",
      name: "FMC Abuja",
      city: "Abuja",
      status: "active",
    });
    const lagosId = await ctx.db.insert("facilities", {
      code: "FMC-LOS",
      name: "FMC Lagos",
      city: "Lagos",
      status: "active",
    });
    await ctx.db.insert("facilities", {
      code: "FMC-ABK",
      name: "FMC Abeokuta",
      city: "Abeokuta",
      status: "pilot",
    });
    const patientId = await ctx.db.insert("patients", {
      publicId: "PAT-002391",
      homeFacilityId: lagosId,
      profile: { firstName: "Chioma", lastName: "Okonkwo" },
      dateOfBirth: Date.UTC(1984, 2, 12),
      gender: "female",
      bloodGroup: "O+",
      searchName: "chioma okonkwo",
    });
    await ctx.db.insert("recordIndexes", {
      patientId,
      facilityId: lagosId,
      recordTypes: [...ALL_RECORD_TYPES],
      updatedAt: Date.now(),
    });
    // INN-45: the demo consent for PAT-002391 at FMC Abuja (as in the real seed).
    await ctx.db.insert("consents", {
      patientId,
      facilityId: abujaId,
      patientFacilityId: lagosId,
      status: "active",
      note: "Test consent for FMC Abuja",
      grantedAt: Date.now(),
      expiresAt: Date.now() + DEMO_CONSENT_DURATION_MS,
    });
    return { lagosId, abujaId, patientId };
  });
}

/** ALLOW, harvest BLOCK, then break-glass — newest last. */
async function walkDemo(testBackend: TestBackend, token: string) {
  await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
  });
  await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
    token,
    publicId: "PAT-002391",
  });
  await testBackend.mutation(api.emergency.grantEmergencyAccess, {
    token,
    publicId: "PAT-002391",
    justification: "Unconscious patient in A&E, no consent possible",
    recordTypes: ["allergies"],
  });
}

async function insertRequest(
  testBackend: TestBackend,
  world: DemoWorld,
  actorId: Id<"users">,
  requestedAt: number,
  decision?: { outcome: "ALLOW" | "VERIFY" | "BLOCK"; riskScore: number },
) {
  return await testBackend.run(async (ctx) => {
    const requestId = await ctx.db.insert("accessRequests", {
      actorId,
      patientId: world.patientId,
      sourceFacilityId: world.abujaId,
      targetFacilityId: world.lagosId,
      purpose: "treatment",
      recordTypes: ["allergies"],
      recordCount: 1,
      requestedAt,
    });
    if (decision) {
      await ctx.db.insert("accessDecisions", {
        requestId,
        outcome: decision.outcome,
        riskScore: decision.riskScore,
        reasons: [],
        decidedAt: requestedAt,
      });
    }
    return requestId;
  });
}

describe("startOfLagosDay", () => {
  test("uses West Africa Time (UTC+1)", () => {
    expect(startOfLagosDay(Date.UTC(2026, 8, 16, 12))).toBe(Date.UTC(2026, 8, 15, 23));
    expect(startOfLagosDay(Date.UTC(2026, 8, 16, 23, 30))).toBe(Date.UTC(2026, 8, 16, 23));
    expect(startOfLagosDay(Date.UTC(2026, 8, 16, 22, 59))).toBe(Date.UTC(2026, 8, 15, 23));
  });

  test("clampDashboardSince never starts before the current Lagos midnight", () => {
    const now = Date.UTC(2026, 8, 16, 12);
    const dayStart = startOfLagosDay(now);
    expect(clampDashboardSince(0, now)).toBe(dayStart);
    expect(clampDashboardSince(dayStart, now)).toBe(dayStart);
    expect(clampDashboardSince(dayStart + DAY_MS, now)).toBe(dayStart + DAY_MS);
  });
});

describe("getClinicianDashboard", () => {
  test("reflects Ibrahim's own demo walk", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    await walkDemo(testBackend, token);

    const dashboard = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since: today(),
    });

    expect(dashboard?.today).toEqual({
      total: { count: 3, isCapped: false },
      allowed: 1,
      challenged: 0,
      blocked: 1,
      undecided: 1,
    });
    expect(dashboard?.lastDecision).toMatchObject({
      publicId: "PAT-002391",
      outcome: "BLOCK",
      riskScore: 94,
    });
    expect(dashboard?.latestBlockedHarvest).toMatchObject({
      recordCount: 500,
      outcome: "BLOCK",
      riskScore: 94,
      requester: { name: "Ibrahim Abdullahi" },
      targetFacility: "FMC Lagos",
    });
    expect(dashboard?.activeGrants).toHaveLength(1);
    expect(dashboard?.activeGrants[0]).toMatchObject({
      publicId: "PAT-002391",
      holderName: "Ibrahim Abdullahi",
    });
    expect(dashboard?.recentRequests.map((row) => row.outcome)).toEqual([
      null,
      "BLOCK",
      "ALLOW",
    ]);
    expect(dashboard?.recentRequests[0]).toMatchObject({
      purpose: "emergency",
      isBreakGlass: true,
    });
  });

  test("counts only today and only the caller, capped at the limit", async () => {
    const testBackend = createTest();
    const world = await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);
    const fatimaId = await userIdFor(testBackend, FATIMA_EMAIL);
    const since = today();

    await insertRequest(testBackend, world, ibrahimId, since - DAY_MS, {
      outcome: "VERIFY",
      riskScore: 45,
    });
    await insertRequest(testBackend, world, fatimaId, since + 1000, {
      outcome: "BLOCK",
      riskScore: 85,
    });

    const beforeToday = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since,
    });
    expect(beforeToday?.today.total).toEqual({ count: 0, isCapped: false });
    expect(beforeToday?.recentRequests).toHaveLength(1);
    expect(beforeToday?.lastDecision).toMatchObject({ outcome: "VERIFY", riskScore: 45 });
    expect(beforeToday?.latestBlockedHarvest).toBeNull();

    const inflated = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since: 0,
    });
    expect(inflated?.today.total).toEqual({ count: 0, isCapped: false });

    for (let index = 0; index <= TODAY_COUNT_LIMIT; index += 1) {
      await insertRequest(testBackend, world, ibrahimId, since + index, {
        outcome: "ALLOW",
        riskScore: 8,
      });
    }
    const capped = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since,
    });
    expect(capped?.today.total).toEqual({ count: TODAY_COUNT_LIMIT, isCapped: true });
    expect(capped?.today.allowed).toBe(TODAY_COUNT_LIMIT);
    expect(capped?.recentRequests).toHaveLength(10);
  });

  test("latest blocked harvest skips newer harvest-sized requests that were not blocked", async () => {
    const testBackend = createTest();
    const world = await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);
    const blockedId = await insertRequest(testBackend, world, ibrahimId, Date.now() - 2000, {
      outcome: "BLOCK",
      riskScore: 94,
    });
    const challengedId = await insertRequest(testBackend, world, ibrahimId, Date.now() - 1000, {
      outcome: "VERIFY",
      riskScore: 60,
    });
    await testBackend.run(async (ctx) => {
      await ctx.db.patch(blockedId, { recordCount: 500 });
      await ctx.db.patch(challengedId, { recordCount: 600 });
    });

    const dashboard = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since: today(),
    });
    expect(dashboard?.latestBlockedHarvest).toMatchObject({
      requestId: blockedId,
      recordCount: 500,
    });
  });

  test("leaves out expired and revoked grants", async () => {
    const testBackend = createTest();
    const world = await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);
    const requestId = await insertRequest(testBackend, world, ibrahimId, Date.now());
    await testBackend.run(async (ctx) => {
      const base = {
        requestId,
        actorId: ibrahimId,
        patientId: world.patientId,
        justification: "Emergency in resus bay",
        grantedAt: Date.now() - 60_000,
      };
      await ctx.db.insert("emergencyAccess", { ...base, expiresAt: Date.now() - 1 });
      await ctx.db.insert("emergencyAccess", {
        ...base,
        expiresAt: Date.now() + 60_000,
        revokedAt: Date.now() - 1,
      });
    });

    const dashboard = await testBackend.query(api.dashboards.getClinicianDashboard, {
      token,
      since: today(),
    });
    expect(dashboard?.activeGrants).toEqual([]);
    expect(dashboard?.recentRequests[0]?.isBreakGlass).toBe(false);
  });

  test("returns null for non-clinicians and anonymous callers", async () => {
    const testBackend = createTest();
    for (const email of [SECURITY_EMAIL, ADMIN_EMAIL, CHIOMA_EMAIL]) {
      const token = await loginUser(testBackend, email);
      const dashboard = await testBackend.query(api.dashboards.getClinicianDashboard, {
        token,
        since: today(),
      });
      expect(dashboard).toBeNull();
    }
    const anonymous = await testBackend.query(api.dashboards.getClinicianDashboard, {
      since: today(),
    });
    expect(anonymous).toBeNull();
  });
});

describe("getSecurityDashboard", () => {
  test("summarises open alerts, blocks, break-glass, audit volume, and latest decisions", async () => {
    const testBackend = createTest();
    const world = await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    await walkDemo(testBackend, ibrahimToken);
    const fatimaId = await userIdFor(testBackend, FATIMA_EMAIL);
    const since = today();
    await insertRequest(testBackend, world, fatimaId, since - DAY_MS, {
      outcome: "BLOCK",
      riskScore: 82,
    });
    await testBackend.run(async (ctx) => {
      await ctx.db.insert("securityAlerts", {
        severity: "low",
        status: "acknowledged",
        title: "Already handled",
        message: "Not open",
        createdAt: Date.now(),
      });
    });

    for (const email of [SECURITY_EMAIL, ADMIN_EMAIL]) {
      const token = await loginUser(testBackend, email);
      const dashboard = await testBackend.query(api.dashboards.getSecurityDashboard, {
        token,
        since,
      });

      const openAlerts = await testBackend.run((ctx) =>
        ctx.db
          .query("securityAlerts")
          .withIndex("by_status", (query) => query.eq("status", "open"))
          .take(50),
      );
      expect(dashboard?.openAlerts).toEqual({
        total: { count: openAlerts.length, isCapped: false },
        high: 1,
        medium: 1,
        low: 0,
      });
      expect(dashboard?.blockedToday).toEqual({ count: 1, isCapped: false });
      expect(dashboard?.activeGrants).toHaveLength(1);
      expect(dashboard?.activeGrants[0]?.holderName).toBe("Ibrahim Abdullahi");
      expect(dashboard?.auditEventsToday.count).toBeGreaterThan(5);
      expect(dashboard?.recentDecisions.map((row) => row.riskScore)).toEqual([94, 8, 82]);
      expect(dashboard?.recentDecisions[0]?.requester?.name).toBe("Ibrahim Abdullahi");
      expect(dashboard?.recentDecisions[2]?.requester?.name).toBe("Fatima Bello");
    }
  });

  test("caps open alerts and today's audit events", async () => {
    const testBackend = createTest();
    const token = await loginUser(testBackend, SECURITY_EMAIL);
    await testBackend.run(async (ctx) => {
      for (let index = 0; index <= OPEN_ALERT_COUNT_LIMIT; index += 1) {
        await ctx.db.insert("securityAlerts", {
          severity: "high",
          status: "open",
          title: "Bulk",
          message: "Bulk",
          createdAt: Date.now(),
        });
      }
      for (let index = 0; index <= AUDIT_TODAY_COUNT_LIMIT; index += 1) {
        await appendAuditEvent(ctx.db, {
          action: "PatientSearched",
          entity: "patients",
          details: {},
        });
      }
      await appendAuditEvent(ctx.db, {
        action: "PatientSearched",
        entity: "patients",
        details: {},
        createdAt: today() - 1,
      });
    });

    const dashboard = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token,
      since: today(),
    });
    expect(dashboard?.openAlerts.total).toEqual({
      count: OPEN_ALERT_COUNT_LIMIT,
      isCapped: true,
    });
    expect(dashboard?.openAlerts.high).toBe(OPEN_ALERT_COUNT_LIMIT);
    expect(dashboard?.auditEventsToday).toEqual({
      count: AUDIT_TODAY_COUNT_LIMIT,
      isCapped: true,
    });

    const tomorrow = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token,
      since: today() + DAY_MS,
    });
    expect(tomorrow?.auditEventsToday).toEqual({ count: 0, isCapped: false });
  });

  test("returns null for clinicians, patients, and anonymous callers", async () => {
    const testBackend = createTest();
    for (const email of [IBRAHIM_EMAIL, CHIOMA_EMAIL]) {
      const token = await loginUser(testBackend, email);
      const dashboard = await testBackend.query(api.dashboards.getSecurityDashboard, {
        token,
        since: today(),
      });
      expect(dashboard).toBeNull();
    }
    const anonymous = await testBackend.query(api.dashboards.getSecurityDashboard, {
      since: today(),
    });
    expect(anonymous).toBeNull();
  });
});

describe("listFacilities", () => {
  test("lists the seeded hospitals by code for any signed-in user", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);

    for (const email of [IBRAHIM_EMAIL, SECURITY_EMAIL, CHIOMA_EMAIL]) {
      const token = await loginUser(testBackend, email);
      const facilities = await testBackend.query(api.dashboards.listFacilities, { token });
      expect(facilities.map((facility) => facility.code)).toEqual([
        "FMC-ABJ",
        "FMC-ABK",
        "FMC-LOS",
      ]);
      expect(facilities[1]).toMatchObject({ name: "FMC Abeokuta", status: "pilot" });
    }

    const anonymous = await testBackend.query(api.dashboards.listFacilities, {});
    expect(anonymous).toEqual([]);
  });
});

describe("getPatientDashboard", () => {
  async function linkChioma(testBackend: TestBackend, patientId: Id<"patients">) {
    await testBackend.run(async (ctx) => {
      const chioma = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", CHIOMA_EMAIL))
        .unique();
      if (!chioma) {
        throw new Error("Missing Chioma demo user");
      }
      await ctx.db.patch(chioma._id, { patientId });
    });
  }

  test("Chioma sees PAT-002391 and events that name her, not another patient", async () => {
    const testBackend = createTest();
    const world = await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const chiomaToken = await loginUser(testBackend, CHIOMA_EMAIL);
    await linkChioma(testBackend, world.patientId);
    await walkDemo(testBackend, ibrahimToken);

    const otherPatientId = await testBackend.run(async (ctx) => {
      return await ctx.db.insert("patients", {
        publicId: "PAT-000001",
        homeFacilityId: world.lagosId,
        profile: { firstName: "Other", lastName: "Patient" },
        dateOfBirth: Date.UTC(1990, 0, 1),
        gender: "male",
        bloodGroup: "A+",
        searchName: "other patient",
      });
    });
    await testBackend.run(async (ctx) => {
      await appendAuditEvent(ctx.db, {
        action: "PatientSearched",
        entity: "patients",
        entityId: "PAT-000001",
        details: { publicId: "PAT-000001" },
      });
    });

    const dashboard = await testBackend.query(api.dashboards.getPatientDashboard, {
      token: chiomaToken,
    });

    expect(dashboard).toMatchObject({
      publicId: "PAT-002391",
      profile: { firstName: "Chioma", lastName: "Okonkwo" },
      homeFacility: { code: "FMC-LOS", name: "FMC Lagos", city: "Lagos" },
      isHistoryCapped: false,
    });
    expect(dashboard?.recentEvents.length).toBeGreaterThan(0);
    expect(dashboard?.recentEvents.some((event) => event.action === "AccessRequested")).toBe(
      true,
    );
    expect(
      dashboard?.recentEvents.some((event) => event.actor?.name === "Ibrahim Abdullahi"),
    ).toBe(true);
    expect(dashboard?.recentEvents.every((event) => event.eventId)).toBe(true);

    const otherEvents = await testBackend.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_patientId_createdAt", (query) => query.eq("patientId", otherPatientId))
        .collect();
    });
    expect(otherEvents).toHaveLength(1);
    expect(dashboard?.recentEvents.map((event) => event.eventId)).not.toContain(
      otherEvents[0]?._id,
    );
  });

  test("returns null for clinicians, unlinked patients, and anonymous callers", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const chiomaToken = await loginUser(testBackend, CHIOMA_EMAIL);

    expect(
      await testBackend.query(api.dashboards.getPatientDashboard, { token: ibrahimToken }),
    ).toBeNull();
    expect(
      await testBackend.query(api.dashboards.getPatientDashboard, { token: chiomaToken }),
    ).toBeNull();
    expect(await testBackend.query(api.dashboards.getPatientDashboard, {})).toBeNull();
  });
});
