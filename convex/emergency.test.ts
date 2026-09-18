/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_CONSENT_DURATION_MS } from "./lib/consentConstants";
import { loginDemoUser } from "./lib/loginForTests";
import type { AppErrorCode } from "./lib/appError";
import { appErrorCode } from "./lib/appError.testing";
import {
  ACCOUNT_SUSPENDED_CODE,
  PERMISSION_DENIED_CODE,
  SESSION_EXPIRED_CODE,
} from "./lib/authConstants";
import {
  EMERGENCY_ACCESS_TTL_MS,
  EMERGENCY_ALREADY_ACTIVE_CODE,
  EMERGENCY_GRANT_ALREADY_ENDED_CODE,
  EMERGENCY_GRANT_NOT_FOUND_CODE,
  EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE,
  JUSTIFICATION_TOO_LONG_CODE,
  JUSTIFICATION_TOO_SHORT_CODE,
} from "./lib/emergencyConstants";
import { RECORD_TYPE_NOT_ALLOWED_CODE } from "./lib/accessRequestMessages";
import { EMERGENCY_ALERT_TITLE } from "./lib/services/alertService";
import type { RecordType } from "./lib/domain";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const ADMIN_EMAIL = "admin@fmc.abuja.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const AISHA_EMAIL = "aisha@fmc.lagos.ng";
const JUSTIFICATION = "Unconscious patient in A&E, no consent possible";
const LAGOS_SUMMARY = "Lagos: stable hypertension, reviewed quarterly";
const ALL_RECORD_TYPES: RecordType[] = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
];

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.useRealTimers();
});

async function seedDemoWorld(testBackend: TestBackend) {
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
    const patientIds: Id<"patients">[] = [];
    for (const [publicId, firstName] of [
      ["PAT-002391", "Chioma"],
      ["PAT-000777", "Tunde"],
    ] as const) {
      const patientId = await ctx.db.insert("patients", {
        publicId,
        homeFacilityId: lagosId,
        profile: { firstName, lastName: "Test" },
        dateOfBirth: Date.UTC(1984, 2, 12),
        gender: "female",
        bloodGroup: "O+",
        searchName: `${firstName.toLowerCase()} test`,
      });
      await ctx.db.insert("recordIndexes", {
        patientId,
        facilityId: lagosId,
        recordTypes: ALL_RECORD_TYPES,
        updatedAt: Date.now(),
      });
      if (publicId === "PAT-002391") {
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
      }
      await ctx.db.insert("clinicalSummaries", {
        patientId,
        facilityId: lagosId,
        medicalSummary: LAGOS_SUMMARY,
        allergies: ["Penicillin"],
        medications: ["Lisinopril 10mg"],
        diagnoses: ["Hypertension"],
        conditions: [],
        updatedAt: Date.now(),
      });
      patientIds.push(patientId);
    }
    return { lagosId, patientIds };
  });
}

async function breakGlass(
  testBackend: TestBackend,
  token: string | undefined,
  overrides: Partial<{
    publicId: string;
    justification: string;
    recordTypes: RecordType[];
    requestId: string;
  }> = {},
) {
  return await testBackend.mutation(api.emergency.grantEmergencyAccess, {
    token,
    publicId: overrides.publicId ?? "PAT-002391",
    justification: overrides.justification ?? JUSTIFICATION,
    recordTypes: overrides.recordTypes ?? ALL_RECORD_TYPES,
    requestId: overrides.requestId,
  });
}

async function auditActions(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) =>
    (await ctx.db.query("auditEvents").take(100)).map((event) => event.action),
  );
}

async function setDecisionOutcome(
  testBackend: TestBackend,
  requestId: Id<"accessRequests">,
  outcome: "BLOCK" | "VERIFY",
) {
  await testBackend.run(async (ctx) => {
    const decision = await ctx.db
      .query("accessDecisions")
      .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
      .unique();
    await ctx.db.patch(decision!._id, {
      outcome,
      riskScore: outcome === "BLOCK" ? 82 : 43,
      reasons: ["Test decision"],
    });
  });
}

describe("grantEmergencyAccess", () => {
  test("creates an emergency request, a 15-minute grant, audits, and a medium alert", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const before = Date.now();

    const grant = await breakGlass(testBackend, token, { justification: `  ${JUSTIFICATION}  ` });

    expect(grant).toMatchObject({
      publicId: "PAT-002391",
      targetFacility: { code: "FMC-LOS", name: "FMC Lagos" },
      recordTypes: ALL_RECORD_TYPES,
      justification: JUSTIFICATION,
    });
    expect(grant.expiresAt - grant.grantedAt).toBe(EMERGENCY_ACCESS_TTL_MS);
    expect(grant.grantedAt).toBeGreaterThanOrEqual(before);
    expect(JSON.stringify(grant)).not.toContain(LAGOS_SUMMARY);

    const stored = await testBackend.run(async (ctx) => ({
      request: await ctx.db.get(grant.requestId),
      decision: await ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", grant.requestId))
        .unique(),
      grant: await ctx.db.get(grant.grantId),
      alerts: await ctx.db.query("securityAlerts").take(10),
      scheduled: await ctx.db.system.query("_scheduled_functions").take(10),
    }));
    expect(stored.request).toMatchObject({ purpose: "emergency", recordCount: 1 });
    expect(stored.decision).toBeNull();
    expect(stored.grant).toMatchObject({ justification: JUSTIFICATION, requestId: grant.requestId });
    expect(stored.alerts).toHaveLength(1);
    expect(stored.alerts[0]).toMatchObject({
      emergencyAccessId: grant.grantId,
      severity: "medium",
      status: "open",
      title: EMERGENCY_ALERT_TITLE,
    });
    expect(stored.alerts[0].message).toContain(JUSTIFICATION);
    // Login also schedules a session expiry (INN-61), so assert on the
    // emergency job rather than the total.
    const expiryJobs = stored.scheduled.filter(
      (job) => job.name === "emergency:expireEmergencyAccess",
    );
    expect(expiryJobs).toHaveLength(1);
    expect(expiryJobs[0]).toMatchObject({ scheduledTime: grant.expiresAt });

    expect(await auditActions(testBackend)).toEqual([
      "UserLoggedIn",
      "AccessRequested",
      "EmergencyGranted",
      "SecurityAlertRaised",
    ]);
  });

  test.each<[string, AppErrorCode]>([
    ["", JUSTIFICATION_TOO_SHORT_CODE],
    ["   ", JUSTIFICATION_TOO_SHORT_CODE],
    ["urgent", JUSTIFICATION_TOO_SHORT_CODE],
    ["x".repeat(501), JUSTIFICATION_TOO_LONG_CODE],
  ])("rejects justification %j", async (justification, code) => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    await expect(breakGlass(testBackend, token, { justification })).rejects.toSatisfy(
      appErrorCode(code),
    );
    const grants = await testBackend.run((ctx) => ctx.db.query("emergencyAccess").take(5));
    expect(grants).toHaveLength(0);
  });

  test("refuses a second live grant for the same patient but allows another patient", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    await breakGlass(testBackend, token);
    await expect(breakGlass(testBackend, token)).rejects.toSatisfy(appErrorCode(EMERGENCY_ALREADY_ACTIVE_CODE));
    const other = await breakGlass(testBackend, token, { publicId: "PAT-000777" });
    expect(other.publicId).toBe("PAT-000777");
  });

  test("rejects a client-chosen duration", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    await expect(
      testBackend.mutation(api.emergency.grantEmergencyAccess, {
        token,
        publicId: "PAT-002391",
        justification: JUSTIFICATION,
        recordTypes: ALL_RECORD_TYPES,
        ttlMs: 24 * 60 * 60 * 1000,
      } as never),
    ).rejects.toThrow();
  });

  test("new grants refuse record types the clinician role cannot request", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const aishaToken = await loginDemoUser(testBackend, AISHA_EMAIL);

    await expect(
      breakGlass(testBackend, aishaToken, { recordTypes: ["allergies"] }),
    ).rejects.toSatisfy(appErrorCode(RECORD_TYPE_NOT_ALLOWED_CODE));
    await expect(
      breakGlass(testBackend, aishaToken, { recordTypes: ["diagnoses"] }),
    ).resolves.toMatchObject({ recordTypes: ["diagnoses"] });
  });

  test("is clinicians only and rejects suspended accounts", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    for (const email of [SECURITY_EMAIL, ADMIN_EMAIL, CHIOMA_EMAIL]) {
      const token = await loginDemoUser(testBackend, email);
      await expect(breakGlass(testBackend, token)).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));
    }
    await expect(breakGlass(testBackend, undefined)).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));

    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const user = await testBackend.query(api.auth.getCurrentUser, { token });
    await testBackend.run((ctx) => ctx.db.patch(user!._id, { accountStatus: "suspended" }));
    await expect(breakGlass(testBackend, token)).rejects.toSatisfy(appErrorCode(ACCOUNT_SUSPENDED_CODE));
  });
});

describe("linking to an existing request", () => {
  async function ownRequest(testBackend: TestBackend, token: string, recordTypes = ["allergies"] as RecordType[]) {
    return await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token,
      publicId: "PAT-002391",
      purpose: "referral",
      recordTypes,
    });
  }

  test.each(["BLOCK", "VERIFY"] as const)(
    "links to my own %s request and keeps its record types",
    async (outcome) => {
      const testBackend = createTest();
      await seedDemoWorld(testBackend);
      const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
      const request = await ownRequest(testBackend, token);
      await setDecisionOutcome(testBackend, request.requestId, outcome);

      const grant = await breakGlass(testBackend, token, { requestId: request.requestId });

      expect(grant.requestId).toBe(request.requestId);
      expect(grant.recordTypes).toEqual(["allergies"]);
      const requests = await testBackend.run((ctx) => ctx.db.query("accessRequests").take(5));
      expect(requests).toHaveLength(1);
      const actions = await auditActions(testBackend);
      expect(actions.filter((action) => action === "AccessRequested")).toHaveLength(1);
      expect(actions).toContain("EmergencyGranted");
    },
  );

  test("checks the linked request's record types, not the client's", async () => {
    const testBackend = createTest();
    const { patientIds } = await seedDemoWorld(testBackend);
    await testBackend.run(async (ctx) => {
      const recordIndex = await ctx.db
        .query("recordIndexes")
        .withIndex("by_patientId", (query) => query.eq("patientId", patientIds[0]))
        .first();
      if (recordIndex) {
        await ctx.db.patch(recordIndex._id, { recordTypes: ["allergies"] });
      }
    });
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await ownRequest(testBackend, token);
    await setDecisionOutcome(testBackend, request.requestId, "BLOCK");

    const grant = await breakGlass(testBackend, token, {
      requestId: request.requestId,
      recordTypes: ALL_RECORD_TYPES,
    });

    expect(grant.recordTypes).toEqual(["allergies"]);
  });

  test("refuses allowed, harvest, other clinicians', other patients', and malformed requests", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);

    const allowed = await ownRequest(testBackend, ibrahimToken);
    const harvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
    });
    const fatimaBlocked = await ownRequest(testBackend, fatimaToken);
    await setDecisionOutcome(testBackend, fatimaBlocked.requestId, "BLOCK");
    const ibrahimBlocked = await ownRequest(testBackend, ibrahimToken);
    await setDecisionOutcome(testBackend, ibrahimBlocked.requestId, "BLOCK");

    for (const requestId of [allowed.requestId, harvest.requestId, fatimaBlocked.requestId, "not-an-id"]) {
      await expect(breakGlass(testBackend, ibrahimToken, { requestId })).rejects.toSatisfy(appErrorCode(EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE));
    }
    await expect(
      breakGlass(testBackend, ibrahimToken, {
        requestId: ibrahimBlocked.requestId,
        publicId: "PAT-000777",
      }),
    ).rejects.toSatisfy(appErrorCode(EMERGENCY_REQUEST_NOT_ELIGIBLE_CODE));

    const grants = await testBackend.run((ctx) => ctx.db.query("emergencyAccess").take(5));
    expect(grants).toHaveLength(0);
  });
});

describe("authorised records under break-glass", () => {
  test("records open while live and are refused after scheduled expiry", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const grant = await breakGlass(testBackend, token, { recordTypes: ["allergies"] });

    const live = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId: grant.requestId,
    });
    expect(live).toMatchObject({
      status: "authorised",
      grantedBy: "emergency",
      emergencyExpiresAt: grant.expiresAt,
      sections: { allergies: ["Penicillin"] },
    });

    vi.advanceTimersByTime(EMERGENCY_ACCESS_TTL_MS + 1000);
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    const freshToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const ended = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token: freshToken,
      requestId: grant.requestId,
    });
    expect(ended).toEqual({
      status: "denied",
      outcome: null,
      riskScore: null,
      reasons: ["Emergency access for this request has ended"],
    });
    expect(JSON.stringify(ended)).not.toContain("Penicillin");

    const actions = await auditActions(testBackend);
    expect(actions.filter((action) => action === "EmergencyExpired")).toHaveLength(1);
    expect(actions.filter((action) => action === "RecordViewed")).toHaveLength(1);
    expect(
      await testBackend.query(api.emergency.getActiveEmergencyAccess, {
        token: freshToken,
        publicId: "PAT-002391",
      }),
    ).toBeNull();
  });

  test("an early expiry job reschedules instead of dropping EmergencyExpired", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const grant = await breakGlass(testBackend, token);

    const early = await testBackend.mutation(internal.emergency.expireEmergencyAccess, {
      grantId: grant.grantId,
    });
    expect(early).toBe("rescheduled");
    expect(await auditActions(testBackend)).not.toContain("EmergencyExpired");

    const scheduled = await testBackend.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10),
    );
    expect(
      scheduled.filter(
        (job) =>
          job.name === "emergency:expireEmergencyAccess" &&
          job.scheduledTime === grant.expiresAt,
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("revoking ends access immediately and the expiry job then skips it", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const grant = await breakGlass(testBackend, token);

    const revoked = await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token,
      grantId: grant.grantId,
    });
    expect(revoked.grantId).toBe(grant.grantId);

    const view = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId: grant.requestId,
    });
    expect(view).toMatchObject({ status: "denied" });

    vi.advanceTimersByTime(EMERGENCY_ACCESS_TTL_MS + 1000);
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    const actions = await auditActions(testBackend);
    expect(actions).toContain("EmergencyRevoked");
    expect(actions).not.toContain("EmergencyExpired");
    expect(actions).not.toContain("RecordViewed");
  });
});

describe("revokeEmergencyAccess", () => {
  test("security officers and admins can revoke; other clinicians cannot", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const adminToken = await loginDemoUser(testBackend, ADMIN_EMAIL);

    const first = await breakGlass(testBackend, ibrahimToken);
    await expect(
      testBackend.mutation(api.emergency.revokeEmergencyAccess, {
        token: fatimaToken,
        grantId: first.grantId,
      }),
    ).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));
    await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token: securityToken,
      grantId: first.grantId,
    });
    await expect(
      testBackend.mutation(api.emergency.revokeEmergencyAccess, {
        token: securityToken,
        grantId: first.grantId,
      }),
    ).rejects.toSatisfy(appErrorCode(EMERGENCY_GRANT_ALREADY_ENDED_CODE));

    const second = await breakGlass(testBackend, ibrahimToken);
    await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token: adminToken,
      grantId: second.grantId,
    });

    const revokeEvents = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(100)).filter(
        (event) => event.action === "EmergencyRevoked",
      ),
    );
    expect(revokeEvents).toHaveLength(2);
    expect(revokeEvents[0].details).toMatchObject({ revokedBySelf: false });
  });

  test("rejects unknown ids and anonymous callers", async () => {
    const testBackend = createTest();
    const { patientIds } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const grant = await breakGlass(testBackend, token);

    for (const grantId of ["nope", patientIds[0] as string]) {
      await expect(
        testBackend.mutation(api.emergency.revokeEmergencyAccess, { token, grantId }),
      ).rejects.toSatisfy(appErrorCode(EMERGENCY_GRANT_NOT_FOUND_CODE));
    }
    await expect(
      testBackend.mutation(api.emergency.revokeEmergencyAccess, { grantId: grant.grantId }),
    ).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));
  });
});

describe("getActiveEmergencyAccess", () => {
  test("returns only the caller's live grant for that patient", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const grant = await breakGlass(testBackend, ibrahimToken);

    expect(
      await testBackend.query(api.emergency.getActiveEmergencyAccess, {
        token: ibrahimToken,
        publicId: "pat-002391",
      }),
    ).toEqual({
      grantId: grant.grantId,
      requestId: grant.requestId,
      grantedAt: grant.grantedAt,
      expiresAt: grant.expiresAt,
      justification: JUSTIFICATION,
    });
    for (const [token, publicId] of [
      [fatimaToken, "PAT-002391"],
      [ibrahimToken, "PAT-000777"],
      [ibrahimToken, "PAT-999999"],
      [undefined, "PAT-002391"],
    ] as const) {
      expect(
        await testBackend.query(api.emergency.getActiveEmergencyAccess, { token, publicId }),
      ).toBeNull();
    }
  });
});

describe("visibility of break-glass", () => {
  test("request views and the security queue show the grant", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const grant = await breakGlass(testBackend, ibrahimToken);

    const request = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: ibrahimToken,
      requestId: grant.requestId,
    });
    expect(request).toMatchObject({
      purpose: "emergency",
      decision: null,
      emergency: {
        grantId: grant.grantId,
        expiresAt: grant.expiresAt,
        justification: JUSTIFICATION,
      },
    });
    const list = await testBackend.query(api.accessRequests.listMyAccessRequests, {
      token: ibrahimToken,
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(list.page[0].emergency?.grantId).toBe(grant.grantId);

    const alerts = await testBackend.query(api.alerts.listSecurityAlerts, {
      token: securityToken,
      status: "open",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(alerts.page).toHaveLength(1);
    expect(alerts.page[0]).toMatchObject({
      title: EMERGENCY_ALERT_TITLE,
      severity: "medium",
      isHarvest: false,
      requestId: grant.requestId,
      publicId: "PAT-002391",
      purpose: "emergency",
      recordCount: 1,
      outcome: null,
      riskScore: null,
      requester: { name: "Ibrahim Abdullahi" },
      emergency: { grantId: grant.grantId, justification: JUSTIFICATION },
    });
    expect(JSON.stringify([request, list, alerts])).not.toContain(LAGOS_SUMMARY);
  });
});
