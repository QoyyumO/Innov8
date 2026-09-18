/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { loginDemoUser } from "./lib/loginForTests";
import { appErrorCode } from "./lib/appError";
import {
  PERMISSION_DENIED_CODE,
  SESSION_EXPIRED_CODE,
} from "./lib/authConstants";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const SECRET_SUMMARY = "SECRET clinical summary must never leak";

function createTest() {
  return convexTest(schema, modules);
}

async function seedDemoPatient(testBackend: ReturnType<typeof createTest>) {
  await testBackend.run(async (ctx) => {
    const facilityId = await ctx.db.insert("facilities", {
      code: "FMC-LOS",
      name: "FMC Lagos",
      city: "Lagos",
      status: "active",
    });
    const patientId = await ctx.db.insert("patients", {
      publicId: "PAT-002391",
      homeFacilityId: facilityId,
      profile: { firstName: "Chioma", lastName: "Okonkwo" },
      dateOfBirth: Date.UTC(1984, 2, 12),
      gender: "female",
      bloodGroup: "O+",
      searchName: "chioma okonkwo",
    });
    await ctx.db.insert("recordIndexes", {
      patientId,
      facilityId,
      recordTypes: [
        "medical_summary",
        "allergies",
        "medications",
        "diagnoses",
      ],
      updatedAt: Date.now(),
    });
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId,
      medicalSummary: SECRET_SUMMARY,
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg"],
      diagnoses: ["Hypertension"],
      conditions: ["Hypertension"],
      updatedAt: Date.now(),
    });
  });
}

function assertNoClinicalLeak(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain(SECRET_SUMMARY);
  expect(serialized).not.toContain("Penicillin");
  expect(serialized).not.toContain("Lisinopril");
  expect(serialized).not.toContain("Hypertension");
  expect(serialized).not.toContain("medicalSummary");
  expect(serialized).not.toContain("bloodGroup");
  expect(serialized).not.toContain("dateOfBirth");
}

describe("patient discovery", () => {
  test("Ibrahim finds PAT-002391 by publicId without clinical fields", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "pat-002391",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.publicId).toBe("PAT-002391");
    expect(results[0]?.profile.firstName).toBe("Chioma");
    expect(results[0]?.profile.lastName).toBe("Okonkwo");
    expect(results[0]?.homeFacility.name).toBe("FMC Lagos");
    assertNoClinicalLeak(results);
  });

  test("name prefix search is bounded and audited", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "chioma",
    });

    expect(results[0]?.publicId).toBe("PAT-002391");

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(1);
    expect(searchAudits[0]?.entity).toBe("patients");
    expect(searchAudits[0]?.entityId).toBe("PAT-002391");
    expect(searchAudits[0]?.details).toMatchObject({
      query: "chioma",
      resultCount: 1,
      publicIds: ["PAT-002391"],
    });
  });

  test("name prefixes below the minimum never reach an index and do not audit", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    for (const query of ["c", "ch"]) {
      const results = await testBackend.mutation(api.patients.searchPatients, {
        token,
        query,
      });
      expect(results).toHaveLength(0);
    }

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(0);
  });

  test("a name search long enough to run, that matches nothing, still audits", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "  zzzzzz  ",
    });
    expect(results).toHaveLength(0);

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(1);
    expect(searchAudits[0]?.entityId).toBeUndefined();
    expect(searchAudits[0]?.details).toEqual({
      query: "zzzzzz",
      resultCount: 0,
      publicIds: [],
    });
  });

  test("full searchName is an exact B-tree equality lookup", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "Chioma Okonkwo",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.profile.lastName).toBe("Okonkwo");
  });

  test("discovery returns record existence at Lagos, not summary text", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const discovery = await testBackend.query(
      api.patients.getPatientDiscovery,
      { token, publicId: "PAT-002391" },
    );

    expect(discovery?.homeFacility.name).toBe("FMC Lagos");
    expect(discovery?.recordsByFacility).toEqual([
      {
        code: "FMC-LOS",
        name: "FMC Lagos",
        recordTypes: [
          "medical_summary",
          "allergies",
          "medications",
          "diagnoses",
        ],
      },
    ]);
    assertNoClinicalLeak(discovery);
  });

  test("a search with zero results still writes PatientSearched", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "  PAT-000001  ",
    });
    expect(results).toHaveLength(0);

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(1);
    expect(searchAudits[0]?.entity).toBe("patients");
    expect(searchAudits[0]?.entityId).toBeUndefined();
    expect(searchAudits[0]?.details).toEqual({
      query: "PAT-000001",
      resultCount: 0,
      publicIds: [],
    });
  });

  test("whitespace-only query returns nothing and does not audit", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "   ",
    });
    expect(results).toHaveLength(0);

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(0);
  });

  test("unknown publicId returns null and does not audit", async () => {
    const testBackend = createTest();
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const discovery = await testBackend.query(
      api.patients.getPatientDiscovery,
      { token, publicId: "PAT-000000" },
    );
    expect(discovery).toBeNull();

    const searchAudits = await testBackend.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").take(50);
      return events.filter((event) => event.action === "PatientSearched");
    });
    expect(searchAudits).toHaveLength(0);
  });

  test("missing or bad token does not return patient data", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);

    await expect(
      testBackend.mutation(api.patients.searchPatients, {
        query: "PAT-002391",
      }),
    ).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));

    await expect(
      testBackend.mutation(api.patients.searchPatients, {
        token: "not-a-session",
        query: "PAT-002391",
      }),
    ).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));

    const discovery = await testBackend.query(
      api.patients.getPatientDiscovery,
      { token: "not-a-session", publicId: "PAT-002391" },
    );
    expect(discovery).toBeNull();
  });

  test("patient role cannot search or discover records", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginDemoUser(testBackend, CHIOMA_EMAIL);

    await expect(
      testBackend.mutation(api.patients.searchPatients, {
        token,
        query: "PAT-002391",
      }),
    ).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));

    const discovery = await testBackend.query(
      api.patients.getPatientDiscovery,
      { token, publicId: "PAT-002391" },
    );
    expect(discovery).toBeNull();
  });
});
