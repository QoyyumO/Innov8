/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import {
  DEMO_PATIENT_PUBLIC_ID,
  SEED_WORKER_COUNT,
  pad,
} from "./lib/synthetic";

function createTest() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("demo-scale seed", () => {
  test("inserts PAT-002391 even when total is below 2391", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    await testBackend.mutation(internal.seed.seedPatientsBatch, {
      cursor: 0,
      batchSize: 10,
      total: 5,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    const verified = await testBackend.query(internal.seed.verifyDemoSeed, {});
    expect(verified.facilities).toBe(3);
    expect(verified.demoPatient).toMatchObject({
      publicId: DEMO_PATIENT_PUBLIC_ID,
      firstName: "Chioma",
      lastName: "Okonkwo",
      homeFacilityCode: "FMC-LOS",
      hasClinicalSummary: true,
    });
    expect(verified.demoPatient?.recordTypes).toEqual(
      expect.arrayContaining([
        "medical_summary",
        "allergies",
        "medications",
        "diagnoses",
      ]),
    );

    const sequential = await testBackend.run(async (ctx) => {
      return await ctx.db
        .query("patients")
        .withIndex("by_publicId", (q) => q.eq("publicId", "PAT-000005"))
        .first();
    });
    expect(sequential?.publicId).toBe("PAT-000005");
    vi.useRealTimers();
  });

  test("clearSeedDataBatch wipes events and extra workers, keeps demo logins", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    await testBackend.mutation(internal.seed.seedHealthcareWorkers, {
      count: SEED_WORKER_COUNT + 6,
    });
    await testBackend.mutation(internal.seed.seedPatientsBatch, {
      cursor: 0,
      batchSize: 10,
      total: 5,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    await testBackend.mutation(internal.seed.seedAccessEventsBatch, {
      cursor: 0,
      batchSize: 5,
      total: 5,
      patientCount: 5,
      workerCount: SEED_WORKER_COUNT,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    const before = await testBackend.query(internal.seed.verifyDemoSeed, {});
    expect(before.allowRiskScore).toBe(8);
    expect(before.blockRiskScore).toBe(94);

    await testBackend.mutation(internal.seed.clearSeedDataBatch, {
      tableIndex: 0,
      batchSize: 50,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    const leftover = await testBackend.run(async (ctx) => {
      const audits = await ctx.db.query("auditEvents").take(1);
      const auditLinks = await ctx.db.query("auditEventFacilities").take(1);
      const alertLinks = await ctx.db.query("alertFacilities").take(1);
      const requests = await ctx.db.query("accessRequests").take(1);
      const patients = await ctx.db.query("patients").take(1);
      const extraWorker = await ctx.db
        .query("users")
        .withIndex("by_workerId", (q) =>
          q.eq("workerId", `WRK-${pad(SEED_WORKER_COUNT + 1, 5)}`),
        )
        .first();
      const ibrahim = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "ibrahim@fmc.abuja.ng"))
        .first();
      const facilities = await ctx.db.query("facilities").collect();
      return {
        audits: audits.length,
        auditLinks: auditLinks.length,
        alertLinks: alertLinks.length,
        requests: requests.length,
        patients: patients.length,
        extraWorker: extraWorker?.workerId ?? null,
        ibrahimWorkerId: ibrahim?.workerId ?? null,
        facilities: facilities.length,
      };
    });

    expect(leftover.audits).toBe(0);
    expect(leftover.auditLinks).toBe(0);
    expect(leftover.alertLinks).toBe(0);
    expect(leftover.requests).toBe(0);
    expect(leftover.patients).toBe(0);
    expect(leftover.extraWorker).toBeNull();
    expect(leftover.ibrahimWorkerId).toBe("WRK-00001");
    expect(leftover.facilities).toBe(3);
    vi.useRealTimers();
  });

  test("links the Chioma login to PAT-002391", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    await testBackend.mutation(internal.seed.seedHealthcareWorkers, {
      count: SEED_WORKER_COUNT,
    });
    await testBackend.mutation(internal.seed.seedPatientsBatch, {
      cursor: 0,
      batchSize: 10,
      total: 5,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);

    const linked = await testBackend.run(async (ctx) => {
      const chioma = await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", "chioma@patient.innov8.ng"))
        .unique();
      const demoPatient = await ctx.db
        .query("patients")
        .withIndex("by_publicId", (query) => query.eq("publicId", DEMO_PATIENT_PUBLIC_ID))
        .unique();
      return { patientId: chioma?.patientId ?? null, demoId: demoPatient?._id ?? null };
    });
    expect(linked.patientId).toBe(linked.demoId);
    expect(linked.patientId).not.toBeNull();
    vi.useRealTimers();
  });

  test("seeded SecurityAlertRaised rows point at the alert, not the decision", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    await testBackend.mutation(internal.seed.seedHealthcareWorkers, {
      count: SEED_WORKER_COUNT,
    });
    await testBackend.mutation(internal.seed.seedPatientsBatch, {
      cursor: 0,
      batchSize: 10,
      total: 5,
    });
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    await testBackend.mutation(internal.seed.seedAccessEventsBatch, {
      cursor: 0,
      batchSize: 1,
      total: 1,
      patientCount: 5,
      workerCount: SEED_WORKER_COUNT,
    });

    const check = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(20);
      const raised = events.filter((event) => event.action === "SecurityAlertRaised");
      const alerts = await ctx.db.query("securityAlerts").take(20);
      return {
        raised,
        alertIds: alerts.map((alert) => alert._id),
        decisionIds: alerts.map((alert) => alert.decisionId),
      };
    });

    expect(check.raised.length).toBeGreaterThan(0);
    for (const event of check.raised) {
      expect(check.alertIds).toContain(event.entityId);
      expect(check.decisionIds).not.toContain(event.entityId);
    }

    const again = await testBackend.mutation(internal.seed.seedAccessEventsBatch, {
      cursor: 0,
      batchSize: 1,
      total: 1,
      patientCount: 5,
      workerCount: SEED_WORKER_COUNT,
    });
    expect(again.skipped).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
