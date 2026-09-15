/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";
const SECRET_SUMMARY = "SECRET clinical summary must never leak";

function createTest() {
  return convexTest(schema, modules);
}

async function loginIbrahim(testBackend: ReturnType<typeof createTest>) {
  const loginResult = await testBackend.mutation(api.auth.login, {
    email: IBRAHIM_EMAIL,
    password: DEMO_PASSWORD,
  });
  expect(loginResult.success).toBe(true);
  expect(loginResult.token).toBeDefined();
  return loginResult.token as string;
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
      searchLastName: "okonkwo",
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
    const token = await loginIbrahim(testBackend);

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
    const token = await loginIbrahim(testBackend);

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
  });

  test("last-name prefix uses the searchLastName B-tree", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginIbrahim(testBackend);

    const results = await testBackend.mutation(api.patients.searchPatients, {
      token,
      query: "okon",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.publicId).toBe("PAT-002391");
  });

  test("full searchName is an exact B-tree equality lookup", async () => {
    const testBackend = createTest();
    await seedDemoPatient(testBackend);
    const token = await loginIbrahim(testBackend);

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
    const token = await loginIbrahim(testBackend);

    const discovery = await testBackend.mutation(
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

  test("unknown publicId returns null and does not audit", async () => {
    const testBackend = createTest();
    const token = await loginIbrahim(testBackend);

    const discovery = await testBackend.mutation(
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
    ).rejects.toThrow(SESSION_EXPIRED_MESSAGE);

    await expect(
      testBackend.mutation(api.patients.searchPatients, {
        token: "not-a-session",
        query: "PAT-002391",
      }),
    ).rejects.toThrow(SESSION_EXPIRED_MESSAGE);

    await expect(
      testBackend.mutation(api.patients.getPatientDiscovery, {
        token: "not-a-session",
        publicId: "PAT-002391",
      }),
    ).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
  });
});
