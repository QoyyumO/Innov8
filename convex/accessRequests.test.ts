/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_CONSENT_DURATION_MS } from "./lib/consentConstants";
import { loginDemoUser } from "./lib/loginForTests";
import { appErrorCode } from "./lib/appError.testing";
import {
  ACCOUNT_SUSPENDED_CODE,
  PERMISSION_DENIED_CODE,
  SESSION_EXPIRED_CODE,
} from "./lib/authConstants";
import {
  NO_RECORD_TYPES_CODE,
  PATIENT_NOT_FOUND_CODE,
  RECORD_TYPE_NOT_ALLOWED_CODE,
  RECORDS_NOT_HELD_CODE,
} from "./lib/accessRequestMessages";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const CHINEDU_EMAIL = "chinedu@fmc.lagos.ng";
const AISHA_EMAIL = "aisha@fmc.lagos.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const CHIOMA_EMAIL = "chioma@patient.innov8.ng";
const SECRET_SUMMARY = "SECRET clinical summary must never leak";
const ALL_RECORD_TYPES = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
  "lab_results",
] as const;

type TestBackend = ReturnType<typeof createTest>;

function createTest() {
  return convexTest(schema, modules);
}

async function seedDemoWorld(
  testBackend: TestBackend,
  options: { lagosRecordTypes?: (typeof ALL_RECORD_TYPES)[number][] } = {},
) {
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
      recordTypes: options.lagosRecordTypes ?? [...ALL_RECORD_TYPES],
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
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: lagosId,
      medicalSummary: SECRET_SUMMARY,
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg"],
      diagnoses: ["Hypertension"],
      conditions: ["Hypertension"],
      updatedAt: Date.now(),
    });
    return { abujaId, lagosId, patientId };
  });
}

function assertNoClinicalLeak(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const secret of [
    SECRET_SUMMARY,
    "Penicillin",
    "Lisinopril",
    "Hypertension",
    "medicalSummary",
    "dateOfBirth",
    "bloodGroup",
  ]) {
    expect(serialized).not.toContain(secret);
  }
}

async function requestTreatment(
  testBackend: TestBackend,
  token: string,
  overrides: { publicId?: string } = {},
) {
  return await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: overrides.publicId ?? "PAT-002391",
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
  });
}

describe("createAccessRequest", () => {
  test("Ibrahim treatment request for PAT-002391 is ALLOW 8 with reasons", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const result = await requestTreatment(testBackend, token);

    expect(result.outcome).toBe("ALLOW");
    expect(result.riskScore).toBe(8);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons).toContain("Records are held at another facility");
    expect(result.publicId).toBe("PAT-002391");
    expect(result.targetFacility).toEqual({ code: "FMC-LOS", name: "FMC Lagos" });
    expect(result.recordCount).toBe(1);
    assertNoClinicalLeak(result);
  });

  test("stores the request, decision, and factors", async () => {
    const testBackend = createTest();
    const { abujaId, lagosId, patientId } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const result = await requestTreatment(testBackend, token);

    const stored = await testBackend.run(async (ctx) => {
      const request = await ctx.db.get(result.requestId);
      const decision = await ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", result.requestId))
        .unique();
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (query) => query.eq("token", token))
        .unique();
      return { request, decision, session };
    });

    expect(stored.request).toMatchObject({
      actorId: expect.any(String),
      sessionId: stored.session!._id,
      patientId,
      sourceFacilityId: abujaId,
      targetFacilityId: lagosId,
      purpose: "treatment",
      recordTypes: [...ALL_RECORD_TYPES],
      recordCount: 1,
      requestedAt: result.requestedAt,
    });
    expect(stored.decision).toMatchObject({
      outcome: "ALLOW",
      riskScore: 8,
      reasons: result.reasons,
      factors: {
        role: "doctor",
        purpose: "treatment",
        sameHospital: false,
        recordCount: 1,
      },
    });
  });

  test("audits AccessRequested and AccessAllowed", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const result = await requestTreatment(testBackend, token);

    const events = await testBackend.run((ctx) =>
      ctx.db.query("auditEvents").take(20),
    );
    const requestEvents = events.filter(
      (event) => event.action !== "UserLoggedIn",
    );
    expect(requestEvents.map((event) => event.action)).toEqual([
      "AccessRequested",
      "AccessAllowed",
    ]);
    expect(requestEvents[0]).toMatchObject({
      entity: "accessRequests",
      entityId: result.requestId,
      details: { patientPublicId: "PAT-002391", purpose: "treatment" },
    });
    expect(requestEvents[1]).toMatchObject({
      entity: "accessDecisions",
      details: { outcome: "ALLOW", riskScore: 8 },
    });
    expect(requestEvents.every((event) => event.sessionId !== undefined)).toBe(true);
    assertNoClinicalLeak(events);
  });

  test("always scores a single patient; harvest volume is not a client argument", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const result = await requestTreatment(testBackend, token);

    expect(result.recordCount).toBe(1);
    expect(result.outcome).toBe("ALLOW");
    expect(result.riskScore).toBe(8);
  });

  test("falls back to the facility named on the user when facilityId is missing", async () => {
    const testBackend = createTest();
    const { abujaId } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const user = await testBackend.query(api.auth.getCurrentUser, { token });
    const storedUser = await testBackend.run((ctx) => ctx.db.get(user!._id));
    expect(storedUser?.facilityId).toBeUndefined();

    const result = await requestTreatment(testBackend, token);
    const request = await testBackend.run((ctx) => ctx.db.get(result.requestId));
    expect(request?.sourceFacilityId).toBe(abujaId);
  });

  test("same-facility request is not marked cross-facility", async () => {
    const testBackend = createTest();
    const { lagosId } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const user = await testBackend.query(api.auth.getCurrentUser, { token });
    await testBackend.run((ctx) => ctx.db.patch(user!._id, { facilityId: lagosId }));

    const result = await requestTreatment(testBackend, token);
    expect(result.riskScore).toBe(5);
    expect(result.reasons).toContain("Records are held at the requester's facility");
  });

  test("duplicate record types are collapsed", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const result = await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token,
      publicId: "pat-002391",
      purpose: "referral",
      recordTypes: ["allergies", "allergies", "medications"],
    });
    expect(result.recordTypes).toEqual(["allergies", "medications"]);
    expect(result.publicId).toBe("PAT-002391");
  });

  test("rejects non-clinicians, patients, and missing or suspended sessions", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const patientToken = await loginDemoUser(testBackend, CHIOMA_EMAIL);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    await expect(requestTreatment(testBackend, securityToken)).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));
    await expect(requestTreatment(testBackend, patientToken)).rejects.toSatisfy(appErrorCode(PERMISSION_DENIED_CODE));
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["allergies"],
      }),
    ).rejects.toSatisfy(appErrorCode(SESSION_EXPIRED_CODE));

    const ibrahim = await testBackend.query(api.auth.getCurrentUser, { token: ibrahimToken });
    await testBackend.run((ctx) =>
      ctx.db.patch(ibrahim!._id, { accountStatus: "suspended" }),
    );
    await expect(requestTreatment(testBackend, ibrahimToken)).rejects.toSatisfy(appErrorCode(ACCOUNT_SUSPENDED_CODE));

    const requests = await testBackend.run((ctx) => ctx.db.query("accessRequests").take(5));
    expect(requests).toHaveLength(0);
  });

  test("rejects unknown patients, empty types, and types not held", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend, { lagosRecordTypes: ["allergies"] });
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    await expect(
      requestTreatment(testBackend, token, { publicId: "PAT-999999" }),
    ).rejects.toSatisfy(appErrorCode(PATIENT_NOT_FOUND_CODE));
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: [],
      }),
    ).rejects.toSatisfy(appErrorCode(NO_RECORD_TYPES_CODE));
    await expect(requestTreatment(testBackend, token)).rejects.toSatisfy(
      appErrorCode(RECORDS_NOT_HELD_CODE),
    );

    const requests = await testBackend.run((ctx) => ctx.db.query("accessRequests").take(5));
    expect(requests).toHaveLength(0);
  });
});

describe("listMyAccessRequests", () => {
  test("returns only my requests, newest first, paginated, with decisions", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);

    const first = await requestTreatment(testBackend, ibrahimToken);
    const second = await requestTreatment(testBackend, ibrahimToken);
    await requestTreatment(testBackend, fatimaToken);

    const firstPage = await testBackend.query(api.accessRequests.listMyAccessRequests, {
      token: ibrahimToken,
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(firstPage.page).toHaveLength(1);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.page[0].requestId).toBe(second.requestId);
    expect(firstPage.page[0].decision?.outcome).toBe("ALLOW");
    expect(firstPage.page[0].isOwnRequest).toBe(true);

    const secondPage = await testBackend.query(api.accessRequests.listMyAccessRequests, {
      token: ibrahimToken,
      paginationOpts: { numItems: 5, cursor: firstPage.continueCursor },
    });
    expect(secondPage.page.map((row) => row.requestId)).toEqual([first.requestId]);
    expect(secondPage.page[0]).toMatchObject({
      publicId: "PAT-002391",
      sourceFacility: { code: "FMC-ABJ", name: "FMC Abuja" },
      targetFacility: { code: "FMC-LOS", name: "FMC Lagos" },
      purpose: "treatment",
      recordCount: 1,
      decision: { outcome: "ALLOW", riskScore: 8 },
    });
    assertNoClinicalLeak([firstPage, secondPage]);
  });

  test("returns an empty finished page without a valid clinician session", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const emptyPage = { page: [], isDone: true, continueCursor: "" };

    for (const token of [undefined, "not-a-token", securityToken]) {
      const result = await testBackend.query(api.accessRequests.listMyAccessRequests, {
        token,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result).toEqual(emptyPage);
    }
  });
});

describe("getAccessRequest", () => {
  test("is visible to the requester, security, and admins only", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const adminToken = await loginDemoUser(testBackend, "admin@fmc.abuja.ng");
    const patientToken = await loginDemoUser(testBackend, CHIOMA_EMAIL);
    const created = await requestTreatment(testBackend, ibrahimToken);

    const asOwner = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: ibrahimToken,
      requestId: created.requestId,
    });
    expect(asOwner).toMatchObject({
      requestId: created.requestId,
      isOwnRequest: true,
      decision: { outcome: "ALLOW", riskScore: 8, reasons: created.reasons },
    });
    assertNoClinicalLeak(asOwner);

    const asSecurity = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: securityToken,
      requestId: created.requestId,
    });
    expect(asSecurity?.isOwnRequest).toBe(false);
    const asAdmin = await testBackend.query(api.accessRequests.getAccessRequest, {
      token: adminToken,
      requestId: created.requestId,
    });
    expect(asAdmin?.requestId).toBe(created.requestId);

    for (const token of [fatimaToken, patientToken, undefined]) {
      const hidden = await testBackend.query(api.accessRequests.getAccessRequest, {
        token,
        requestId: created.requestId,
      });
      expect(hidden).toBeNull();
    }
  });

  test("returns null for malformed or unknown ids", async () => {
    const testBackend = createTest();
    const { patientId } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    for (const requestId of ["not-an-id", "", patientId as Id<"patients"> as string]) {
      const result = await testBackend.query(api.accessRequests.getAccessRequest, {
        token,
        requestId,
      });
      expect(result).toBeNull();
    }
  });
});

describe("record types by clinician role (INN-79 / INN-80)", () => {
  test("Fatima (nurse) may request the five types; Chinedu and Aisha cannot request out-of-role types", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const chineduToken = await loginDemoUser(testBackend, CHINEDU_EMAIL);
    const aishaToken = await loginDemoUser(testBackend, AISHA_EMAIL);

    await expect(requestTreatment(testBackend, fatimaToken)).resolves.toMatchObject({
      recordTypes: [...ALL_RECORD_TYPES],
    });

    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: chineduToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["medical_summary"],
      }),
    ).rejects.toSatisfy(appErrorCode(RECORD_TYPE_NOT_ALLOWED_CODE));
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: chineduToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["medications", "allergies"],
      }),
    ).resolves.toMatchObject({ recordTypes: ["medications", "allergies"] });

    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: aishaToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["medications"],
      }),
    ).rejects.toSatisfy(appErrorCode(RECORD_TYPE_NOT_ALLOWED_CODE));
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: aishaToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["diagnoses"],
      }),
    ).resolves.toMatchObject({ recordTypes: ["diagnoses"] });
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: aishaToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["lab_results"],
      }),
    ).resolves.toMatchObject({ recordTypes: ["lab_results"] });
    await expect(
      testBackend.mutation(api.accessRequests.createAccessRequest, {
        token: chineduToken,
        publicId: "PAT-002391",
        purpose: "treatment",
        recordTypes: ["lab_results"],
      }),
    ).rejects.toSatisfy(appErrorCode(RECORD_TYPE_NOT_ALLOWED_CODE));
  });
});
