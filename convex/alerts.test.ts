/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import {
  BLOCK_ALERT_TITLE,
  HARVEST_ALERT_TITLE,
  raiseBlockAlert,
} from "./lib/services/alertService";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const ADMIN_EMAIL = "admin@fmc.abuja.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const SECRET_SUMMARY = "SECRET clinical summary must never leak";
const ALL_RECORD_TYPES = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
] as const;
const FIRST_PAGE = { numItems: 20, cursor: null };

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
      medicalSummary: SECRET_SUMMARY,
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg"],
      diagnoses: ["Hypertension"],
      conditions: [],
      updatedAt: Date.now(),
    });
  });
}

async function requestOnePatient(testBackend: TestBackend, token: string) {
  return await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
  });
}

async function simulateHarvest(testBackend: TestBackend, token: string) {
  return await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
    token,
    publicId: "PAT-002391",
  });
}

async function listAlerts(
  testBackend: TestBackend,
  token: string | undefined,
  status?: "open" | "acknowledged" | "closed",
  paginationOpts: { numItems: number; cursor: string | null } = FIRST_PAGE,
) {
  return await testBackend.query(api.alerts.listSecurityAlerts, {
    token,
    status,
    paginationOpts,
  });
}

async function storedAlerts(testBackend: TestBackend) {
  return await testBackend.run((ctx) => ctx.db.query("securityAlerts").take(50));
}

describe("alerts raised by blocked requests", () => {
  test("a 500-record harvest is BLOCK 94 with one open high alert and both audits", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    const harvest = await simulateHarvest(testBackend, token);

    expect(harvest).toMatchObject({ outcome: "BLOCK", riskScore: 94 });
    const alerts = await storedAlerts(testBackend);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: "high",
      status: "open",
      title: HARVEST_ALERT_TITLE,
    });
    expect(alerts[0].message).toContain("Ibrahim Abdullahi (FMC Abuja)");
    expect(alerts[0].message).toContain("500 patient records (PAT-002391)");
    expect(alerts[0].message).toContain("Risk 94/100");

    const decision = await testBackend.run((ctx) =>
      ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", harvest.requestId))
        .unique(),
    );
    expect(alerts[0].decisionId).toBe(decision!._id);

    const actions = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(20)).map((event) => ({
        action: event.action,
        entityId: event.entityId,
        sessionId: event.sessionId,
      })),
    );
    expect(actions.map((event) => event.action)).toEqual([
      "UserLoggedIn",
      "AccessRequested",
      "AccessBlocked",
      "SecurityAlertRaised",
    ]);
    const alertAudit = actions.find((event) => event.action === "SecurityAlertRaised");
    expect(alertAudit?.entityId).toBe(alerts[0]._id);
    expect(alertAudit?.sessionId).toBeDefined();
  });

  test("ALLOW and VERIFY decisions raise no alert", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    expect((await requestOnePatient(testBackend, token)).outcome).toBe("ALLOW");

    const ibrahim = await testBackend.query(api.auth.getCurrentUser, { token });
    await testBackend.run((ctx) =>
      ctx.db.patch(ibrahim!._id, {
        normalAccessHours: { start: "08:00", end: "18:00" },
      }),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 22:00 West Africa Time: administrative + cross-facility + after hours = 43.
      vi.setSystemTime(Date.UTC(2026, 8, 16, 21, 0));
      const nightToken = await loginUser(testBackend, IBRAHIM_EMAIL);
      const verify = await testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: nightToken,
        publicId: "PAT-002391",
        purpose: "administrative",
        recordTypes: ["allergies"],
      });
      expect(verify).toMatchObject({ outcome: "VERIFY", riskScore: 43 });
    } finally {
      vi.useRealTimers();
    }

    expect(await storedAlerts(testBackend)).toHaveLength(0);
  });

  test("a non-harvest BLOCK uses the generic title and singular wording", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const allowed = await requestOnePatient(testBackend, token);

    await testBackend.run(async (ctx) => {
      const decision = await ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", allowed.requestId))
        .unique();
      const request = await ctx.db.get(allowed.requestId);
      const actor = await ctx.db.get(request!.actorId);
      await raiseBlockAlert(ctx.db, {
        decisionId: decision!._id,
        actor: actor!,
        patientPublicId: "PAT-002391",
        recordCount: 1,
        riskScore: 82,
        reasons: ["Role is not permitted to request clinical records"],
        createdAt: Date.now(),
      });
    });

    const [alert] = await storedAlerts(testBackend);
    expect(alert.title).toBe(BLOCK_ALERT_TITLE);
    expect(alert.message).toBe(
      "Ibrahim Abdullahi (FMC Abuja) requested 1 patient record (PAT-002391). Risk 82/100. Role is not permitted to request clinical records.",
    );
  });

  test("alert text never contains clinical content", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    await simulateHarvest(testBackend, token);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    const listed = await listAlerts(testBackend, securityToken);
    const serialized = JSON.stringify([listed, await storedAlerts(testBackend)]);
    for (const secret of [SECRET_SUMMARY, "Penicillin", "Lisinopril", "Hypertension"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});

describe("simulateBulkHarvest", () => {
  test("the server fixes the harvest volume and stores one request row", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    const harvest = await simulateHarvest(testBackend, token);

    expect(harvest).toMatchObject({
      publicId: "PAT-002391",
      purpose: "treatment",
      recordTypes: [...ALL_RECORD_TYPES],
      recordCount: 500,
      outcome: "BLOCK",
      riskScore: 94,
    });
    expect(harvest.reasons.some((reason) => reason.startsWith("Harvest pattern"))).toBe(true);
    const requests = await testBackend.run((ctx) => ctx.db.query("accessRequests").take(10));
    expect(requests).toHaveLength(1);
    expect(requests[0].recordCount).toBe(500);
  });

  test("rejects a client-supplied record count", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    await expect(
      testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
        token,
        publicId: "PAT-002391",
        recordCount: 1,
      } as never),
    ).rejects.toThrow();
    expect(await storedAlerts(testBackend)).toHaveLength(0);
  });

  test("is limited to clinicians with a live session", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const patientToken = await loginUser(testBackend, CHIOMA_EMAIL);

    for (const token of [securityToken, patientToken]) {
      await expect(simulateHarvest(testBackend, token)).rejects.toThrow(
        PERMISSION_DENIED_MESSAGE,
      );
    }
    await expect(
      testBackend.mutation(api.accessRequests.simulateBulkHarvest, { publicId: "PAT-002391" }),
    ).rejects.toThrow(/session has expired/);
    expect(await storedAlerts(testBackend)).toHaveLength(0);
  });

  test("createAccessRequest still refuses a record count", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["allergies"],
        recordCount: 500,
      } as never),
    ).rejects.toThrow();
    expect(await storedAlerts(testBackend)).toHaveLength(0);
  });
});

describe("listSecurityAlerts", () => {
  test("security officers and admins see the harvest alert with its context", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const harvest = await simulateHarvest(testBackend, ibrahimToken);

    for (const email of [SECURITY_EMAIL, ADMIN_EMAIL]) {
      const reviewerToken = await loginUser(testBackend, email);
      const listed = await listAlerts(testBackend, reviewerToken, "open");
      expect(listed.page).toHaveLength(1);
      expect(listed.page[0]).toMatchObject({
        severity: "high",
        status: "open",
        isHarvest: true,
        requestId: harvest.requestId,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordCount: 500,
        outcome: "BLOCK",
        riskScore: 94,
        requester: {
          name: "Ibrahim Abdullahi",
          email: IBRAHIM_EMAIL,
          hospital: "FMC Abuja",
        },
      });
    }
  });

  test("clinicians, patients, and anonymous callers get an empty finished page", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const patientToken = await loginUser(testBackend, CHIOMA_EMAIL);
    await simulateHarvest(testBackend, ibrahimToken);

    for (const token of [ibrahimToken, patientToken, undefined, "not-a-token"]) {
      expect(await listAlerts(testBackend, token)).toEqual({
        page: [],
        isDone: true,
        continueCursor: "",
      });
    }
  });

  test("filters by status and pages newest first", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const oldest = await simulateHarvest(testBackend, ibrahimToken);
    const middle = await simulateHarvest(testBackend, ibrahimToken);
    const newest = await simulateHarvest(testBackend, ibrahimToken);

    const firstPage = await listAlerts(testBackend, securityToken, undefined, {
      numItems: 2,
      cursor: null,
    });
    expect(firstPage.page.map((alert) => alert.requestId)).toEqual([
      newest.requestId,
      middle.requestId,
    ]);
    expect(firstPage.isDone).toBe(false);
    const secondPage = await listAlerts(testBackend, securityToken, undefined, {
      numItems: 2,
      cursor: firstPage.continueCursor,
    });
    expect(secondPage.page.map((alert) => alert.requestId)).toEqual([oldest.requestId]);

    await testBackend.mutation(api.alerts.acknowledgeAlert, {
      token: securityToken,
      alertId: firstPage.page[0].alertId,
    });
    const openAlerts = await listAlerts(testBackend, securityToken, "open");
    const acknowledged = await listAlerts(testBackend, securityToken, "acknowledged");
    expect(openAlerts.page.map((alert) => alert.requestId)).toEqual([
      middle.requestId,
      oldest.requestId,
    ]);
    expect(acknowledged.page.map((alert) => alert.requestId)).toEqual([newest.requestId]);
    expect((await listAlerts(testBackend, securityToken, "closed")).page).toHaveLength(0);
  });

  test("seed-style alerts without a decision still list", async () => {
    const testBackend = createTest();
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    await testBackend.run((ctx) =>
      ctx.db.insert("securityAlerts", {
        severity: "medium",
        status: "open",
        title: "Manual alert",
        message: "Raised by an operator",
        createdAt: Date.now(),
      }),
    );

    const listed = await listAlerts(testBackend, securityToken);
    expect(listed.page[0]).toMatchObject({
      title: "Manual alert",
      isHarvest: false,
      requestId: null,
      requester: null,
      riskScore: null,
    });
  });
});

describe("acknowledgeAlert and closeAlert", () => {
  async function openHarvestAlert(testBackend: TestBackend) {
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    await simulateHarvest(testBackend, ibrahimToken);
    const [alert] = await storedAlerts(testBackend);
    return { ibrahimToken, securityToken, alertId: alert._id };
  }

  test("open → acknowledged → closed updates status without deleting", async () => {
    const testBackend = createTest();
    const { securityToken, alertId } = await openHarvestAlert(testBackend);

    expect(
      await testBackend.mutation(api.alerts.acknowledgeAlert, { token: securityToken, alertId }),
    ).toEqual({ alertId, status: "acknowledged" });
    expect(
      await testBackend.mutation(api.alerts.closeAlert, { token: securityToken, alertId }),
    ).toEqual({ alertId, status: "closed" });

    const alerts = await storedAlerts(testBackend);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ _id: alertId, status: "closed", severity: "high" });
  });

  test("open alerts can be closed directly", async () => {
    const testBackend = createTest();
    const { securityToken, alertId } = await openHarvestAlert(testBackend);
    const closed = await testBackend.mutation(api.alerts.closeAlert, {
      token: securityToken,
      alertId,
    });
    expect(closed.status).toBe("closed");
  });

  test("invalid transitions are rejected", async () => {
    const testBackend = createTest();
    const { securityToken, alertId } = await openHarvestAlert(testBackend);
    await testBackend.mutation(api.alerts.acknowledgeAlert, { token: securityToken, alertId });

    await expect(
      testBackend.mutation(api.alerts.acknowledgeAlert, { token: securityToken, alertId }),
    ).rejects.toThrow("Alert is already acknowledged");
    await testBackend.mutation(api.alerts.closeAlert, { token: securityToken, alertId });
    await expect(
      testBackend.mutation(api.alerts.closeAlert, { token: securityToken, alertId }),
    ).rejects.toThrow("Alert is already closed");
    await expect(
      testBackend.mutation(api.alerts.acknowledgeAlert, { token: securityToken, alertId }),
    ).rejects.toThrow("Alert is already closed");
  });

  test("clinicians cannot change alert status", async () => {
    const testBackend = createTest();
    const { ibrahimToken, alertId } = await openHarvestAlert(testBackend);
    const fatimaToken = await loginUser(testBackend, FATIMA_EMAIL);

    for (const token of [ibrahimToken, fatimaToken]) {
      await expect(
        testBackend.mutation(api.alerts.acknowledgeAlert, { token, alertId }),
      ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);
      await expect(
        testBackend.mutation(api.alerts.closeAlert, { token, alertId }),
      ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);
    }
    await expect(
      testBackend.mutation(api.alerts.closeAlert, { alertId }),
    ).rejects.toThrow(/session has expired/);
    const [alert] = await storedAlerts(testBackend);
    expect(alert.status).toBe("open");
  });

  test("unknown and malformed ids are rejected", async () => {
    const testBackend = createTest();
    const { securityToken } = await openHarvestAlert(testBackend);
    const requestId = await testBackend.run(async (ctx) =>
      (await ctx.db.query("accessRequests").first())!._id as Id<"accessRequests">,
    );
    for (const alertId of ["nope", "", requestId as string]) {
      await expect(
        testBackend.mutation(api.alerts.acknowledgeAlert, { token: securityToken, alertId }),
      ).rejects.toThrow("Alert not found");
    }
  });
});
