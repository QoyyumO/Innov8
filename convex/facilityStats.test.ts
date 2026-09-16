/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { startOfLagosDay } from "./lib/dashboardConstants";
import {
  getFacilityTotals,
  insertCountedPatient,
  isFacilityWorker,
  patchCountedUser,
} from "./lib/facilityStats";
import { DEMO_PATIENT_INDEX } from "./lib/synthetic";

const SECURITY_EMAIL = "security@innov8.ng";
const ABUJA_ADMIN_EMAIL = "admin@fmc.abuja.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const WORKER_COUNT = 40;
const PATIENT_COUNT = 60;

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

afterEach(() => {
  vi.useRealTimers();
});

async function loginUser(testBackend: TestBackend, email: string) {
  const loginResult = await testBackend.mutation(api.auth.login, {
    email,
    password: DEMO_PASSWORD,
  });
  if (!("token" in loginResult) || !loginResult.token) {
    throw new Error(`Login failed for ${email}`);
  }
  return loginResult.token;
}

async function seed(testBackend: TestBackend, patientTotal = PATIENT_COUNT) {
  await testBackend.mutation(internal.seed.seedFacilities, {});
  await testBackend.mutation(internal.seed.seedHealthcareWorkers, { count: WORKER_COUNT });
  await testBackend.mutation(internal.seed.seedPatientsBatch, {
    cursor: 0,
    batchSize: 25,
    total: patientTotal,
  });
  await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
}

/** Totals counted the slow way, straight from the tables. */
async function countDirectly(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) => {
    const facilities = await ctx.db.query("facilities").take(10);
    const counts: Record<string, { workerCount: number; patientCount: number }> = {};
    for (const facility of facilities) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_facilityId", (query) => query.eq("facilityId", facility._id))
        .take(1000);
      const patients = await ctx.db
        .query("patients")
        .withIndex("by_homeFacilityId", (query) => query.eq("homeFacilityId", facility._id))
        .take(1000);
      counts[facility.code] = {
        workerCount: users.filter(isFacilityWorker).length,
        patientCount: patients.length,
      };
    }
    return counts;
  });
}

async function storedTotals(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) => {
    const facilities = await ctx.db.query("facilities").take(10);
    const totals: Record<string, { workerCount: number; patientCount: number }> = {};
    for (const facility of facilities) {
      totals[facility.code] = await getFacilityTotals(ctx.db, facility._id);
    }
    return totals;
  });
}

function sum(totals: Record<string, { workerCount: number; patientCount: number }>) {
  return Object.values(totals).reduce(
    (total, row) => ({
      workerCount: total.workerCount + row.workerCount,
      patientCount: total.patientCount + row.patientCount,
    }),
    { workerCount: 0, patientCount: 0 },
  );
}

describe("stored facility totals (INN-53)", () => {
  test("seeding keeps totals equal to the rows, and re-seeding changes nothing", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    // Logging in first creates the demo users unlinked (as in real use), so
    // the seed links them through the "existing user" path.
    await loginUser(testBackend, SECURITY_EMAIL);
    await seed(testBackend);

    const direct = await countDirectly(testBackend);
    expect(await storedTotals(testBackend)).toEqual(direct);
    const overall = sum(direct);
    expect(overall.patientCount).toBe(PATIENT_COUNT);
    // Every user linked to a facility counts except the patient login (Chioma).
    const linked = await testBackend.run(async (ctx) => {
      const users = await ctx.db.query("users").take(1000);
      return users
        .filter((user) => user.facilityId !== undefined)
        .map((user) => user.email);
    });
    expect(linked).toContain(CHIOMA_EMAIL);
    expect(overall.workerCount).toBe(linked.length - 1);
    expect(overall.workerCount).toBeGreaterThan(WORKER_COUNT / 2);

    await seed(testBackend);
    expect(await storedTotals(testBackend)).toEqual(direct);
  });

  test("moving the demo patient to Lagos moves the count", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    const facilityIds = await testBackend.run(async (ctx) => {
      const byCode = async (code: string) => {
        const facility = await ctx.db
          .query("facilities")
          .withIndex("by_code", (query) => query.eq("code", code))
          .unique();
        return facility!._id;
      };
      const abuja = await byCode("FMC-ABJ");
      const lagos = await byCode("FMC-LOS");
      await insertCountedPatient(ctx.db, {
        publicId: `PAT-${String(DEMO_PATIENT_INDEX).padStart(6, "0")}`,
        homeFacilityId: abuja,
        profile: { firstName: "Wrong", lastName: "Home" },
        dateOfBirth: 0,
        gender: "female",
        bloodGroup: "O+",
        searchName: "wrong home",
      });
      return { abuja, lagos };
    });
    const before = await storedTotals(testBackend);
    expect(before["FMC-ABJ"]?.patientCount).toBe(1);

    await testBackend.mutation(internal.seed.seedPatientsBatch, {
      cursor: DEMO_PATIENT_INDEX - 1,
      batchSize: 1,
      total: DEMO_PATIENT_INDEX,
    });

    const after = await storedTotals(testBackend);
    expect(after["FMC-ABJ"]?.patientCount).toBe(0);
    expect(after["FMC-LOS"]?.patientCount).toBe(1);
    expect(after).toEqual(await countDirectly(testBackend));
    const moved = await testBackend.run((ctx) => ctx.db.query("patients").take(5));
    expect(moved[0]?.homeFacilityId).toBe(facilityIds.lagos);
  });

  test("role and facility changes move worker counts; patient-only users never count", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seed(testBackend, 0);
    const [lagosId, abujaId] = await testBackend.run(async (ctx) => {
      const byCode = async (code: string) => {
        const facility = await ctx.db
          .query("facilities")
          .withIndex("by_code", (query) => query.eq("code", code))
          .unique();
        return facility!._id;
      };
      return [await byCode("FMC-LOS"), await byCode("FMC-ABJ")] as const;
    });
    const before = await storedTotals(testBackend);

    await testBackend.run(async (ctx) => {
      const chioma = (await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", CHIOMA_EMAIL))
        .unique())!;
      // A patient-only user moving facility changes nothing.
      await patchCountedUser(ctx.db, chioma, { facilityId: abujaId });
    });
    expect(await storedTotals(testBackend)).toEqual(before);

    await testBackend.run(async (ctx) => {
      const chioma = (await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", CHIOMA_EMAIL))
        .unique())!;
      // Gaining a staff role makes them a worker at their facility.
      await patchCountedUser(ctx.db, chioma, { roles: ["patient", "nurse"] });
      const admin = (await ctx.db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", ABUJA_ADMIN_EMAIL))
        .unique())!;
      // A worker moving facility moves one count.
      await patchCountedUser(ctx.db, admin, { facilityId: lagosId });
    });

    const after = await storedTotals(testBackend);
    // Abuja: +1 (Chioma became a nurse there) and -1 (the admin moved away).
    expect(after["FMC-ABJ"]?.workerCount).toBe(before["FMC-ABJ"]!.workerCount);
    expect(after["FMC-LOS"]?.workerCount).toBe(before["FMC-LOS"]!.workerCount + 1);
    expect(after).toEqual(await countDirectly(testBackend));
  });

  test("recount rebuilds wrong or missing totals in batches, and is idempotent", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seed(testBackend, 120);
    const direct = await countDirectly(testBackend);

    await testBackend.run(async (ctx) => {
      const rows = await ctx.db.query("facilityStats").take(10);
      await ctx.db.delete(rows[0]!._id);
      for (const row of rows.slice(1)) {
        await ctx.db.patch(row._id, { workerCount: 999, patientCount: 7 });
      }
    });
    expect(await storedTotals(testBackend)).not.toEqual(direct);

    // Small batches so every facility needs several pages.
    const facilityCount = await testBackend.mutation(internal.facilityStatsRecount.start, {
      batchSize: 7,
    });
    expect(facilityCount).toBe(3);
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storedTotals(testBackend)).toEqual(direct);
    expect(sum(direct).patientCount).toBe(120);

    await testBackend.mutation(internal.facilityStatsRecount.start, {});
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await storedTotals(testBackend)).toEqual(direct);
    const rows = await testBackend.run((ctx) => ctx.db.query("facilityStats").take(10));
    expect(rows).toHaveLength(3);
  });

  test("facilities and dashboards read the stored totals", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await seed(testBackend);
    vi.useRealTimers();
    const direct = await countDirectly(testBackend);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const adminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const chiomaToken = await loginUser(testBackend, CHIOMA_EMAIL);

    const facilities = await testBackend.query(api.dashboards.listFacilities, {
      token: chiomaToken,
    });
    expect(
      Object.fromEntries(
        facilities.map((facility) => [
          facility.code,
          { workerCount: facility.workerCount, patientCount: facility.patientCount },
        ]),
      ),
    ).toEqual(direct);

    const since = startOfLagosDay(Date.now());
    const security = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: securityToken,
      since,
    });
    expect(security?.population).toEqual(sum(direct));

    const admin = await testBackend.query(api.dashboards.getSecurityDashboard, {
      token: adminToken,
      since,
    });
    expect(admin?.population).toEqual(direct["FMC-ABJ"]);
  });
});

