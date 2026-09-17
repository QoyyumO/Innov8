/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import { startOfLagosDay } from "./lib/dashboardConstants";
import { hashPassword } from "./lib/password";
import type { UserRole } from "./lib/roles";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const AISHA_EMAIL = "aisha@fmc.lagos.ng";
const YUSUF_EMAIL = "yusuf@fmc.abeokuta.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const ABUJA_ADMIN_EMAIL = "admin@fmc.abuja.ng";
const SYSTEM_ADMIN_EMAIL = "sysadmin@innov8.ng";
const ORPHAN_ADMIN_EMAIL = "admin@unknown.ng";
const JUSTIFICATION = "Unconscious patient in resus, no consent possible";
const PAGE = { numItems: 100, cursor: null };

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

async function addUser(
  testBackend: TestBackend,
  email: string,
  roles: UserRole[],
  hospital: string,
) {
  const hashedPassword = await hashPassword(DEMO_PASSWORD);
  await testBackend.run(async (ctx) => {
    await ctx.db.insert("users", {
      email,
      hashedPassword,
      roles,
      hospital,
      accountStatus: "active",
      profile: { firstName: "Test", lastName: roles[0] ?? "user" },
    });
  });
}

/** Lagos, Abuja, and Abeokuta, with one patient at Lagos and one at Abuja. */
async function seedWorld(testBackend: TestBackend) {
  await addUser(testBackend, SYSTEM_ADMIN_EMAIL, ["system_admin"], "Innov8 Exchange");
  await addUser(testBackend, ORPHAN_ADMIN_EMAIL, ["hospital_admin"], "Nowhere General");
  return await testBackend.run(async (ctx) => {
    const facilityIds: Record<string, Id<"facilities">> = {};
    for (const [code, name, city] of [
      ["FMC-ABJ", "FMC Abuja", "Abuja"],
      ["FMC-LOS", "FMC Lagos", "Lagos"],
      ["FMC-ABK", "FMC Abeokuta", "Abeokuta"],
    ] as const) {
      facilityIds[city] = await ctx.db.insert("facilities", {
        code,
        name,
        city,
        status: "active",
      });
    }
    for (const [publicId, city] of [
      ["PAT-002391", "Lagos"],
      ["PAT-000900", "Abuja"],
    ] as const) {
      const patientId = await ctx.db.insert("patients", {
        publicId,
        homeFacilityId: facilityIds[city],
        profile: { firstName: "Test", lastName: publicId },
        dateOfBirth: Date.UTC(1984, 2, 12),
        gender: "female",
        bloodGroup: "O+",
        searchName: `test ${publicId.toLowerCase()}`,
      });
      await ctx.db.insert("recordIndexes", {
        patientId,
        facilityId: facilityIds[city],
        recordTypes: ["medical_summary", "allergies", "medications", "diagnoses"],
        updatedAt: Date.now(),
      });
    }
    return facilityIds;
  });
}

/**
 * Three flows:
 * - Ibrahim (Abuja) → PAT-002391 (Lagos): harvest BLOCK + break-glass — involves Abuja.
 * - Aisha (Lagos) → PAT-002391 (Lagos): harvest BLOCK + break-glass — Lagos only.
 * - Yusuf (Abeokuta) → PAT-000900 (Abuja): treatment ALLOW — incoming to Abuja.
 */
async function runFlows(testBackend: TestBackend) {
  const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
  const aishaToken = await loginUser(testBackend, AISHA_EMAIL);
  const yusufToken = await loginUser(testBackend, YUSUF_EMAIL);

  const ibrahimHarvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
    token: ibrahimToken,
    publicId: "PAT-002391",
  });
  const aishaHarvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
    token: aishaToken,
    publicId: "PAT-002391",
  });
  const ibrahimGrant = await testBackend.mutation(api.emergency.grantEmergencyAccess, {
    token: ibrahimToken,
    publicId: "PAT-002391",
    justification: JUSTIFICATION,
    recordTypes: ["allergies"],
  });
  const aishaGrant = await testBackend.mutation(api.emergency.grantEmergencyAccess, {
    token: aishaToken,
    publicId: "PAT-002391",
    justification: JUSTIFICATION,
    recordTypes: ["allergies"],
  });
  const yusufRequest = await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token: yusufToken,
    publicId: "PAT-000900",
    purpose: "treatment",
    recordTypes: ["allergies"],
  });
  return { ibrahimHarvest, aishaHarvest, ibrahimGrant, aishaGrant, yusufRequest };
}

async function listAlertRequestIds(testBackend: TestBackend, token: string) {
  const alerts = await testBackend.query(api.alerts.listSecurityAlerts, {
    token,
    paginationOpts: PAGE,
  });
  return alerts.page.map((alert) => alert.requestId);
}

async function listAuditRequestIds(testBackend: TestBackend, token: string) {
  const events = await testBackend.query(api.audit.listAuditEvents, {
    token,
    paginationOpts: PAGE,
  });
  return {
    events: events.page,
    requestIds: new Set(
      events.page.flatMap((event) =>
        typeof event.details.requestId === "string"
          ? [event.details.requestId]
          : event.entity === "accessRequests" && event.entityId
            ? [event.entityId]
            : [],
      ),
    ),
  };
}

describe("hospital admin scope (INN-52)", () => {
  test("the audit trail shows own staff and requests to or from the facility only", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    // The exchange officer (no hospital) ends Abuja's outgoing grant: the admin
    // must still see it, via the request's source facility.
    await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token: securityToken,
      grantId: flows.ibrahimGrant.grantId,
    });

    const admin = await listAuditRequestIds(testBackend, adminToken);
    expect(admin.requestIds.has(flows.ibrahimHarvest.requestId)).toBe(true);
    expect(admin.requestIds.has(flows.ibrahimGrant.requestId)).toBe(true);
    expect(admin.requestIds.has(flows.yusufRequest.requestId)).toBe(true);
    expect(admin.requestIds.has(flows.aishaHarvest.requestId)).toBe(false);
    expect(admin.requestIds.has(flows.aishaGrant.requestId)).toBe(false);

    const actorEmails = new Set(admin.events.map((event) => event.actor?.email));
    expect(actorEmails).toEqual(
      new Set([IBRAHIM_EMAIL, YUSUF_EMAIL, ABUJA_ADMIN_EMAIL, SECURITY_EMAIL]),
    );
    const securityEvents = admin.events.filter((event) => event.actor?.email === SECURITY_EMAIL);
    expect(securityEvents.map((event) => event.action)).toEqual(["EmergencyRevoked"]);
    const yusufSignIns = admin.events.filter(
      (event) => event.action === "UserLoggedIn" && event.actor?.email === YUSUF_EMAIL,
    );
    expect(yusufSignIns).toEqual([]);

    const security = await listAuditRequestIds(testBackend, securityToken);
    expect(security.requestIds.has(flows.aishaHarvest.requestId)).toBe(true);
    expect(security.events.length).toBeGreaterThan(admin.events.length);

    const aishaId = await testBackend.run(async (ctx) => {
      const aisha = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", AISHA_EMAIL))
        .unique();
      return aisha!._id;
    });
    const aishaForAdmin = await testBackend.query(api.audit.listAuditEvents, {
      token: adminToken,
      actorId: aishaId,
      paginationOpts: PAGE,
    });
    expect(aishaForAdmin.page).toEqual([]);

    const blocksForAdmin = await testBackend.query(api.audit.listAuditEvents, {
      token: adminToken,
      action: "AccessBlocked",
      paginationOpts: PAGE,
    });
    expect(blocksForAdmin.page).toHaveLength(1);
    expect(blocksForAdmin.page[0]?.details.requestId).toBe(flows.ibrahimHarvest.requestId);
  });

  test("alerts are limited to the facility, including status filters and transitions", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    const adminAlerts = await listAlertRequestIds(testBackend, adminToken);
    expect(new Set(adminAlerts)).toEqual(
      new Set([flows.ibrahimHarvest.requestId, flows.ibrahimGrant.requestId]),
    );
    expect(await listAlertRequestIds(testBackend, securityToken)).toHaveLength(4);

    const allAlerts = await testBackend.query(api.alerts.listSecurityAlerts, {
      token: securityToken,
      paginationOpts: PAGE,
    });
    const aishaAlert = allAlerts.page.find(
      (alert) => alert.requestId === flows.aishaHarvest.requestId,
    )!;
    const ibrahimAlert = allAlerts.page.find(
      (alert) => alert.requestId === flows.ibrahimHarvest.requestId,
    )!;

    await expect(
      testBackend.mutation(api.alerts.acknowledgeAlert, {
        token: adminToken,
        alertId: aishaAlert.alertId,
      }),
    ).rejects.toThrow("Alert not found");

    await testBackend.mutation(api.alerts.acknowledgeAlert, {
      token: adminToken,
      alertId: ibrahimAlert.alertId,
    });
    const acknowledged = await testBackend.query(api.alerts.listSecurityAlerts, {
      token: adminToken,
      status: "acknowledged",
      paginationOpts: PAGE,
    });
    expect(acknowledged.page.map((alert) => alert.alertId)).toEqual([ibrahimAlert.alertId]);
    const stillOpen = await testBackend.query(api.alerts.listSecurityAlerts, {
      token: adminToken,
      status: "open",
      paginationOpts: PAGE,
    });
    expect(stillOpen.page.map((alert) => alert.requestId)).toEqual([flows.ibrahimGrant.requestId]);

    const aishaStatus = await testBackend.run(
      async (ctx) => (await ctx.db.get(aishaAlert.alertId))!.status,
    );
    expect(aishaStatus).toBe("open");
  });

  test("request details and break-glass revocation respect the facility", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    for (const [requestId, isVisible] of [
      [flows.ibrahimHarvest.requestId, true],
      [flows.yusufRequest.requestId, true],
      [flows.aishaHarvest.requestId, false],
      [flows.aishaGrant.requestId, false],
    ] as const) {
      const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
        token: adminToken,
        requestId,
      });
      expect(detail !== null).toBe(isVisible);
      const securityDetail = await testBackend.query(api.accessRequests.getAccessRequest, {
        token: securityToken,
        requestId,
      });
      expect(securityDetail).not.toBeNull();
    }

    await expect(
      testBackend.mutation(api.emergency.revokeEmergencyAccess, {
        token: adminToken,
        grantId: flows.aishaGrant.grantId,
      }),
    ).rejects.toThrow(PERMISSION_DENIED_MESSAGE);
    await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token: adminToken,
      grantId: flows.ibrahimGrant.grantId,
    });
    await testBackend.mutation(api.emergency.revokeEmergencyAccess, {
      token: securityToken,
      grantId: flows.aishaGrant.grantId,
    });
  });

  test("the admin dashboard counts only the facility's activity", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const since = startOfLagosDay(Date.now());

    const admin = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: adminToken,
      since,
    });
    expect(admin?.openAlerts).toEqual({
      total: { count: 2, isCapped: false },
      high: 1,
      medium: 1,
      low: 0,
    });
    expect(admin?.blockedToday).toEqual({ count: 1, isCapped: false });
    expect(admin?.activeGrants.map((grant) => grant.grantId)).toEqual([flows.ibrahimGrant.grantId]);
    expect(new Set(admin?.recentDecisions.map((row) => row.requestId))).toEqual(
      new Set([flows.ibrahimHarvest.requestId, flows.yusufRequest.requestId]),
    );
    const adminAudit = await listAuditRequestIds(testBackend, adminToken);
    expect(admin?.auditEventsToday.count).toBe(adminAudit.events.length);

    const security = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: securityToken,
      since,
    });
    expect(security?.openAlerts.total.count).toBe(4);
    expect(security?.blockedToday.count).toBe(2);
    expect(security?.activeGrants).toHaveLength(2);
    expect(security?.auditEventsToday.count).toBeGreaterThan(admin!.auditEventsToday.count);
  });

  test("system admins see everything; an admin matching no facility sees nothing", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    const systemToken = await loginUser(testBackend, SYSTEM_ADMIN_EMAIL);
    const orphanToken = await loginUser(testBackend, ORPHAN_ADMIN_EMAIL);

    expect(await listAlertRequestIds(testBackend, systemToken)).toHaveLength(4);
    const systemDetail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: systemToken,
      requestId: flows.aishaHarvest.requestId,
    });
    expect(systemDetail).not.toBeNull();

    expect(await listAlertRequestIds(testBackend, orphanToken)).toEqual([]);
    const orphanAudit = await testBackend.query(api.audit.listAuditEvents, {
      token: orphanToken,
      paginationOpts: PAGE,
    });
    expect(orphanAudit.page).toEqual([]);
    const orphanDashboard = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: orphanToken,
      since: startOfLagosDay(Date.now()),
    });
    expect(orphanDashboard).toEqual({
      openAlerts: { total: { count: 0, isCapped: false }, high: 0, medium: 0, low: 0 },
      blockedToday: { count: 0, isCapped: false },
      auditEventsToday: { count: 0, isCapped: false },
      activeGrants: [],
      recentDecisions: [],
      population: { workerCount: 0, patientCount: 0 },
    });
    const orphanDetail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: orphanToken,
      requestId: flows.ibrahimHarvest.requestId,
    });
    expect(orphanDetail).toBeNull();
  });

  test("a colliding hospital name does not guess a facility", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    await testBackend.run(async (ctx) => {
      await ctx.db.insert("facilities", {
        code: "FMC-ABJ-DUP",
        name: "FMC Abuja",
        city: "Abuja",
        status: "active",
      });
    });
    await addUser(testBackend, "admin-dup@fmc.abuja.ng", ["hospital_admin"], "FMC Abuja");
    const duplicateToken = await loginUser(testBackend, "admin-dup@fmc.abuja.ng");

    expect(await listAlertRequestIds(testBackend, duplicateToken)).toEqual([]);
    const dashboard = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: duplicateToken,
      since: startOfLagosDay(Date.now()),
    });
    expect(dashboard?.activeGrants).toEqual([]);
    expect(dashboard?.recentDecisions).toEqual([]);
  });

  test("a linked facilityId wins over the hospital name", async () => {
    const testBackend = createTest();
    const facilityIds = await seedWorld(testBackend);
    const flows = await runFlows(testBackend);
    await testBackend.run(async (ctx) => {
      const admin = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", ABUJA_ADMIN_EMAIL))
        .unique();
      await ctx.db.patch(admin!._id, { facilityId: facilityIds.Lagos });
    });
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);

    expect(new Set(await listAlertRequestIds(testBackend, adminToken))).toEqual(
      new Set([
        flows.ibrahimHarvest.requestId,
        flows.ibrahimGrant.requestId,
        flows.aishaHarvest.requestId,
        flows.aishaGrant.requestId,
      ]),
    );
  });
});

describe("facilityScopeBackfill", () => {
  test("links pre-INN-52 alerts and audit events once, then the admin can see them", async () => {
    vi.useFakeTimers();
    try {
      const testBackend = createTest();
      const facilityIds = await seedWorld(testBackend);
      const flows = await runFlows(testBackend);
      const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
      // Simulate data written before INN-52: no facility links at all.
      await testBackend.run(async (ctx) => {
        for (const link of await ctx.db.query("alertFacilities").take(100)) {
          await ctx.db.delete(link._id);
        }
        for (const link of await ctx.db.query("auditEventFacilities").take(500)) {
          await ctx.db.delete(link._id);
        }
      });
      expect(await listAlertRequestIds(testBackend, adminToken)).toEqual([]);
      expect((await listAuditRequestIds(testBackend, adminToken)).events).toEqual([]);

      await testBackend.mutation(internal.facilityScopeBackfill.start, {});
      await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

      expect(new Set(await listAlertRequestIds(testBackend, adminToken))).toEqual(
        new Set([flows.ibrahimHarvest.requestId, flows.ibrahimGrant.requestId]),
      );
      const audit = await listAuditRequestIds(testBackend, adminToken);
      expect(audit.requestIds.has(flows.ibrahimHarvest.requestId)).toBe(true);
      expect(audit.requestIds.has(flows.aishaHarvest.requestId)).toBe(false);

      const countLinks = () =>
        testBackend.run(async (ctx) => ({
          alerts: (await ctx.db.query("alertFacilities").take(100)).length,
          events: (await ctx.db.query("auditEventFacilities").take(500)).length,
        }));
      const afterFirstRun = await countLinks();
      expect(afterFirstRun.alerts).toBe(6);
      await testBackend.mutation(internal.facilityScopeBackfill.start, {});
      await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await countLinks()).toEqual(afterFirstRun);

      const lagosOnly = await testBackend.run(async (ctx) =>
        ctx.db
          .query("alertFacilities")
          .withIndex("by_facilityId_createdAt", (query) => query.eq("facilityId", facilityIds.Lagos))
          .take(10),
      );
      expect(lagosOnly).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
