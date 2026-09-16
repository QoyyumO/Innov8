/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import { AuditAction } from "./lib/domain";
import { appendAuditEvent } from "./lib/services/auditLogService";
import * as auditModule from "./audit";

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
const FIRST_PAGE = { numItems: 50, cursor: null };

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
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

async function seedDemoWorld(testBackend: TestBackend) {
  await testBackend.run(async (ctx) => {
    await ctx.db.insert("facilities", {
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
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: lagosId,
      medicalSummary: "Stable hypertension",
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg"],
      diagnoses: ["Hypertension"],
      conditions: [],
      updatedAt: Date.now(),
    });
  });
}

/** Demo steps 1–7 as Ibrahim. */
async function walkDemo(testBackend: TestBackend, token: string) {
  await testBackend.mutation(api.patients.searchPatients, { token, query: "PAT-002391" });
  const allowed = await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
  });
  expect(allowed.outcome).toBe("ALLOW");
  await testBackend.mutation(api.records.viewAuthorisedSummary, {
    token,
    requestId: allowed.requestId,
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

async function listEvents(
  testBackend: TestBackend,
  token: string | undefined,
  filters: { action?: AuditAction; actorId?: string } = {},
  paginationOpts: { numItems: number; cursor: string | null } = FIRST_PAGE,
) {
  return await testBackend.query(api.audit.listAuditEvents, {
    token,
    ...filters,
    paginationOpts,
  });
}

describe("listAuditEvents", () => {
  test("after the demo walk, Ibrahim's trail shows every demo step, newest first", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    await walkDemo(testBackend, token);

    const result = await listEvents(testBackend, token);
    const actions = result.page.map((event) => event.action);

    expect(result.isDone).toBe(true);
    for (const action of [
      "UserLoggedIn",
      "PatientSearched",
      "AccessRequested",
      "AccessAllowed",
      "RecordViewed",
      "AccessBlocked",
      "SecurityAlertRaised",
      "EmergencyGranted",
    ] as const) {
      expect(actions).toContain(action);
    }
    expect(actions.at(-1)).toBe("UserLoggedIn");
    const times = result.page.map((event) => event.createdAt);
    expect(times).toEqual([...times].sort((left, right) => right - left));
    expect(result.page[0]?.actor).toMatchObject({
      name: "Ibrahim Abdullahi",
      email: IBRAHIM_EMAIL,
    });
    const viewEvent = result.page.find((event) => event.action === "RecordViewed");
    expect(JSON.stringify(viewEvent)).not.toContain("Stable hypertension");
  });

  test("clinicians and patients only see their own events", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    await walkDemo(testBackend, ibrahimToken);
    const fatimaToken = await loginUser(testBackend, FATIMA_EMAIL);
    const chiomaToken = await loginUser(testBackend, CHIOMA_EMAIL);

    for (const [token, email] of [
      [fatimaToken, FATIMA_EMAIL],
      [chiomaToken, CHIOMA_EMAIL],
    ] as const) {
      const result = await listEvents(testBackend, token);
      expect(result.page.map((event) => event.action)).toEqual(["UserLoggedIn"]);
      expect(result.page[0]?.actor?.email).toBe(email);
    }

    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);
    await expect(
      listEvents(testBackend, fatimaToken, { actorId: ibrahimId }),
    ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);

    const fatimaId = await userIdFor(testBackend, FATIMA_EMAIL);
    const ownFilter = await listEvents(testBackend, fatimaToken, { actorId: fatimaId });
    expect(ownFilter.page).toHaveLength(1);
  });

  test("reviewers see everyone in their scope and can filter to one actor", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    await walkDemo(testBackend, ibrahimToken);
    await loginUser(testBackend, FATIMA_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const adminToken = await loginUser(testBackend, ADMIN_EMAIL);
    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);

    // The exchange security officer belongs to no hospital, so the FMC Abuja
    // admin (INN-52) sees Abuja staff but not the officer's sign-in.
    const expectedEmails = [
      [securityToken, [IBRAHIM_EMAIL, FATIMA_EMAIL, SECURITY_EMAIL, ADMIN_EMAIL]],
      [adminToken, [IBRAHIM_EMAIL, FATIMA_EMAIL, ADMIN_EMAIL]],
    ] as const;
    for (const [token, emails] of expectedEmails) {
      const everything = await listEvents(testBackend, token);
      expect(new Set(everything.page.map((event) => event.actor?.email))).toEqual(
        new Set(emails),
      );

      const ibrahimOnly = await listEvents(testBackend, token, { actorId: ibrahimId });
      expect(ibrahimOnly.page.length).toBeGreaterThan(5);
      expect(ibrahimOnly.page.every((event) => event.actor?.actorId === ibrahimId)).toBe(true);

      const ibrahimBlocks = await listEvents(testBackend, token, {
        actorId: ibrahimId,
        action: "AccessBlocked",
      });
      expect(ibrahimBlocks.page).toHaveLength(1);
      expect(ibrahimBlocks.page[0]?.details).toMatchObject({ riskScore: 94 });
    }
  });

  test("the action filter returns only that action", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    await loginUser(testBackend, FATIMA_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    const logins = await listEvents(testBackend, securityToken, { action: "UserLoggedIn" });
    expect(logins.page).toHaveLength(3);
    expect(logins.page.every((event) => event.action === "UserLoggedIn")).toBe(true);

    const ownLogins = await listEvents(testBackend, ibrahimToken, { action: "UserLoggedIn" });
    expect(ownLogins.page).toHaveLength(1);
    const noViews = await listEvents(testBackend, ibrahimToken, { action: "RecordViewed" });
    expect(noViews.page).toEqual([]);
  });

  test("backdated (seeded) events sort by createdAt, not insertion order, and paginate", async () => {
    const testBackend = createTest();
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const ibrahimId = await userIdFor(testBackend, IBRAHIM_EMAIL);
    const baseTime = Date.UTC(2026, 0, 1);
    await testBackend.run(async (ctx) => {
      for (const dayOffset of [3, 1, 4, 2, 0]) {
        await appendAuditEvent(ctx.db, {
          actorId: ibrahimId,
          action: "AccessRequested",
          entity: "accessRequests",
          details: { dayOffset },
          createdAt: baseTime + dayOffset * 86_400_000,
        });
      }
    });

    const filters = [
      {},
      { action: "AccessRequested" as const },
      { actorId: ibrahimId },
      { actorId: ibrahimId, action: "AccessRequested" as const },
    ];
    for (const filter of filters) {
      const seeded: number[] = [];
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const result = await listEvents(testBackend, securityToken, filter, {
          numItems: 2,
          cursor,
        });
        for (const event of result.page) {
          if (typeof event.details.dayOffset === "number") {
            seeded.push(event.details.dayOffset);
          }
        }
        cursor = result.continueCursor;
        isDone = result.isDone;
      }
      expect(seeded).toEqual([4, 3, 2, 1, 0]);
    }
  });

  test("anonymous callers and malformed actor ids get an empty page", async () => {
    const testBackend = createTest();
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    for (const token of [undefined, "not-a-session"]) {
      const result = await listEvents(testBackend, token);
      expect(result).toMatchObject({ page: [], isDone: true });
    }
    const malformed = await listEvents(testBackend, securityToken, { actorId: "nobody" });
    expect(malformed).toMatchObject({ page: [], isDone: true });
  });

  test("system events without an actor still list, and the module exposes no writes", async () => {
    const testBackend = createTest();
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    await testBackend.run(async (ctx) => {
      await appendAuditEvent(ctx.db, {
        action: "EmergencyExpired",
        entity: "emergencyAccess",
        details: {},
      });
    });

    const result = await listEvents(testBackend, securityToken, { action: "EmergencyExpired" });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({ actor: null, entityId: null });
    expect(Object.keys(auditModule)).toEqual(["listAuditEvents"]);
  });
});
