/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import {
  CONSENT_ACTIVE_REASON,
  CONSENT_ALREADY_ACTIVE_MESSAGE,
  CONSENT_ALREADY_ENDED_MESSAGE,
  CONSENT_DURATION_MS,
  CONSENT_MISSING_REASON,
  CONSENT_NOTE_TOO_SHORT_MESSAGE,
  CONSENT_NOT_FOUND_MESSAGE,
  CONSENT_NOT_NEEDED_MESSAGE,
} from "./lib/consentConstants";
import { hashPassword } from "./lib/password";
import { STEP_UP_CONSENT_REQUIRED_MESSAGE } from "./lib/stepUpConstants";
import type { UserRole } from "./lib/roles";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const AISHA_EMAIL = "aisha@fmc.lagos.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const ABUJA_ADMIN_EMAIL = "admin@fmc.abuja.ng";
const LAGOS_ADMIN_EMAIL = "admin@fmc.lagos.ng";
const ABEOKUTA_ADMIN_EMAIL = "admin@fmc.abeokuta.ng";
const NOTE = "Patient agreed verbally at the bedside, witnessed by the charge nurse";
const PAGE = { numItems: 100, cursor: null };

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

async function addUser(testBackend: TestBackend, email: string, roles: UserRole[], hospital: string) {
  const hashedPassword = await hashPassword(DEMO_PASSWORD);
  await testBackend.run(async (ctx) => {
    await ctx.db.insert("users", {
      email,
      hashedPassword,
      roles,
      hospital,
      accountStatus: "active",
      profile: { firstName: "Test", lastName: "Admin" },
    });
  });
}

/** Abuja, Lagos, Abeokuta; PAT-002391's records are at Lagos. No consent yet. */
async function seedWorld(testBackend: TestBackend) {
  await addUser(testBackend, LAGOS_ADMIN_EMAIL, ["hospital_admin"], "FMC Lagos");
  await addUser(testBackend, ABEOKUTA_ADMIN_EMAIL, ["hospital_admin"], "FMC Abeokuta");
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
      recordTypes: ["medical_summary", "allergies", "medications", "diagnoses"],
      updatedAt: Date.now(),
    });
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: lagosId,
      medicalSummary: "Stable hypertension",
      allergies: ["Penicillin"],
      medications: [],
      diagnoses: [],
      conditions: [],
      updatedAt: Date.now(),
    });
    return { abujaId, lagosId, patientId };
  });
}

async function requestAccess(
  testBackend: TestBackend,
  token: string,
  purpose: "treatment" | "follow-up" | "referral" | "administrative" = "treatment",
) {
  return await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose,
    recordTypes: ["allergies"],
  });
}

async function recordConsent(testBackend: TestBackend, token: string, note = NOTE) {
  return await testBackend.mutation(api.consents.recordPatientConsent, {
    token,
    publicId: "PAT-002391",
    note,
  });
}

async function auditActions(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) =>
    (await ctx.db.query("auditEvents").take(300)).map((event) => event.action),
  );
}

describe("consent in access decisions (INN-45)", () => {
  test("without consent a cross-facility request is VERIFY; recording consent makes it ALLOW 8", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);

    const before = await testBackend.query(api.consents.getConsentStatus, {
      token,
      publicId: "PAT-002391",
    });
    expect(before).toEqual({
      isRequired: true,
      facility: "FMC Abuja",
      patientFacility: "FMC Lagos",
      consent: null,
    });

    const challenged = await requestAccess(testBackend, token);
    expect(challenged).toMatchObject({ outcome: "VERIFY", riskScore: 43 });
    expect(challenged.reasons).toContain(CONSENT_MISSING_REASON);
    expect(challenged.factors.consent).toBe("missing");
    const view = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId: challenged.requestId,
    });
    expect(view).toMatchObject({ status: "denied", outcome: "VERIFY" });

    const recorded = await recordConsent(testBackend, token);
    const status = await testBackend.query(api.consents.getConsentStatus, {
      token,
      publicId: "PAT-002391",
    });
    expect(status?.consent).toMatchObject({
      consentId: recorded.consentId,
      publicId: "PAT-002391",
      facility: "FMC Abuja",
      patientFacility: "FMC Lagos",
      status: "active",
      isLive: true,
      note: NOTE,
      recordedBy: "Ibrahim Abdullahi",
    });
    expect(recorded.expiresAt - status!.consent!.grantedAt).toBe(CONSENT_DURATION_MS);

    const allowed = await requestAccess(testBackend, token);
    expect(allowed).toMatchObject({ outcome: "ALLOW", riskScore: 8 });
    expect(allowed.reasons).toContain(CONSENT_ACTIVE_REASON);
    expect(allowed.factors.consent).toBe("active");

    const consentEvent = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(100)).find(
        (event) => event.action === "ConsentRecorded",
      ),
    );
    expect(consentEvent).toMatchObject({
      entity: "consents",
      entityId: recorded.consentId,
      details: { patientPublicId: "PAT-002391", facility: "FMC-ABJ", note: NOTE },
    });
  });

  test("every cross-facility purpose needs consent; same-facility, bulk, and break-glass do not", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const aishaToken = await loginUser(testBackend, AISHA_EMAIL);

    for (const purpose of ["follow-up", "referral", "administrative"] as const) {
      const result = await requestAccess(testBackend, ibrahimToken, purpose);
      expect(result.outcome).not.toBe("ALLOW");
      expect(result.reasons).toContain(CONSENT_MISSING_REASON);
    }

    const emergencyPurpose = await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
      purpose: "emergency",
      recordTypes: ["allergies"],
    });
    expect(emergencyPurpose.factors.consent).toBe("not_required");
    expect(emergencyPurpose.outcome).toBe("ALLOW");

    const sameFacility = await requestAccess(testBackend, aishaToken);
    expect(sameFacility).toMatchObject({ outcome: "ALLOW" });
    expect(sameFacility.factors.consent).toBe("not_required");
    await expect(recordConsent(testBackend, aishaToken)).rejects.toThrow(
      CONSENT_NOT_NEEDED_MESSAGE,
    );
    const aishaStatus = await testBackend.query(api.consents.getConsentStatus, {
      token: aishaToken,
      publicId: "PAT-002391",
    });
    expect(aishaStatus).toMatchObject({ isRequired: false, consent: null });

    const harvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
    });
    expect(harvest).toMatchObject({ outcome: "BLOCK", riskScore: 94 });
    expect(harvest.reasons).not.toContain(CONSENT_MISSING_REASON);

    const grant = await testBackend.mutation(api.emergency.grantEmergencyAccess, {
      token: ibrahimToken,
      publicId: "PAT-002391",
      justification: "Unconscious patient in resus, no consent possible",
      recordTypes: ["allergies"],
    });
    const emergencyView = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token: ibrahimToken,
      requestId: grant.requestId,
    });
    expect(emergencyView).toMatchObject({ status: "authorised", grantedBy: "emergency" });
  });

  test("step-up cannot stand in for consent, but works once consent is recorded", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const challenged = await requestAccess(testBackend, token);

    await expect(
      testBackend.mutation(api.stepUp.completeVerification, {
        token,
        requestId: challenged.requestId,
        password: DEMO_PASSWORD,
      }),
    ).rejects.toThrow(STEP_UP_CONSENT_REQUIRED_MESSAGE);
    const untouched = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId: challenged.requestId,
    });
    expect(untouched?.decision).toMatchObject({ outcome: "VERIFY", stepUpAttemptsLeft: 3 });

    await recordConsent(testBackend, token);
    const verified = await testBackend.mutation(api.stepUp.completeVerification, {
      token,
      requestId: challenged.requestId,
      password: DEMO_PASSWORD,
    });
    expect(verified.status).toBe("verified");
  });

  test("recording is validated and limited to one live consent per facility", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    await expect(recordConsent(testBackend, token, "   ok   ")).rejects.toThrow(
      CONSENT_NOTE_TOO_SHORT_MESSAGE,
    );
    await expect(
      testBackend.mutation(api.consents.recordPatientConsent, {
        token,
        publicId: "PAT-999999",
        note: NOTE,
      }),
    ).rejects.toThrow("Patient not found");
    await expect(recordConsent(testBackend, securityToken)).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE,
    );
    await expect(
      testBackend.mutation(api.consents.recordPatientConsent, {
        publicId: "PAT-002391",
        note: NOTE,
      }),
    ).rejects.toThrow();

    await recordConsent(testBackend, token);
    await expect(recordConsent(testBackend, token)).rejects.toThrow(
      CONSENT_ALREADY_ACTIVE_MESSAGE,
    );
    const consents = await testBackend.run((ctx) => ctx.db.query("consents").take(10));
    expect(consents).toHaveLength(1);
    expect(await auditActions(testBackend)).toContain("ConsentRecorded");
  });

  test("consent expires after 30 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const startedAt = Date.UTC(2026, 8, 16, 9, 0);
    vi.setSystemTime(startedAt);
    const testBackend = createTest();
    await seedWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    await recordConsent(testBackend, token);

    vi.setSystemTime(startedAt + CONSENT_DURATION_MS - 1);
    const lateToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    expect((await requestAccess(testBackend, lateToken)).outcome).toBe("ALLOW");

    vi.setSystemTime(startedAt + CONSENT_DURATION_MS);
    const expiredToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    expect((await requestAccess(testBackend, expiredToken)).outcome).toBe("VERIFY");
    const status = await testBackend.query(api.consents.getConsentStatus, {
      token: expiredToken,
      publicId: "PAT-002391",
    });
    expect(status?.consent).toBeNull();
    await recordConsent(testBackend, expiredToken);
    expect((await requestAccess(testBackend, expiredToken)).outcome).toBe("ALLOW");
  });
});

describe("revoking and reviewing consents", () => {
  test("security officers and in-scope admins revoke; others cannot", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const abujaAdminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const lagosAdminToken = await loginUser(testBackend, LAGOS_ADMIN_EMAIL);
    const abeokutaAdminToken = await loginUser(testBackend, ABEOKUTA_ADMIN_EMAIL);

    const revoke = (token: string, consentId: string) =>
      testBackend.mutation(api.consents.revokePatientConsent, { token, consentId });

    const first = await recordConsent(testBackend, ibrahimToken);
    await expect(revoke(ibrahimToken, first.consentId)).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE,
    );
    await expect(revoke(abeokutaAdminToken, first.consentId)).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE,
    );
    await expect(revoke(securityToken, "nope")).rejects.toThrow(CONSENT_NOT_FOUND_MESSAGE);

    await revoke(securityToken, first.consentId);
    await expect(revoke(securityToken, first.consentId)).rejects.toThrow(
      CONSENT_ALREADY_ENDED_MESSAGE,
    );
    expect((await requestAccess(testBackend, ibrahimToken)).outcome).toBe("VERIFY");

    const second = await recordConsent(testBackend, ibrahimToken);
    await revoke(abujaAdminToken, second.consentId);
    const third = await recordConsent(testBackend, ibrahimToken);
    await revoke(lagosAdminToken, third.consentId);

    const revoked = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(300)).filter(
        (event) => event.action === "ConsentRevoked",
      ),
    );
    expect(revoked).toHaveLength(3);
    const securityUser = await testBackend.query(api.auth.getCurrentUser, { token: securityToken });
    expect(revoked[0]?.actorId).toBe(securityUser!._id);
    const stored = await testBackend.run((ctx) => ctx.db.get(first.consentId));
    expect(stored).toMatchObject({ status: "revoked", revokedBy: securityUser!._id });
  });

  test("the consent list and audit trail follow reviewer scope", async () => {
    const testBackend = createTest();
    await seedWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);
    const abujaAdminToken = await loginUser(testBackend, ABUJA_ADMIN_EMAIL);
    const lagosAdminToken = await loginUser(testBackend, LAGOS_ADMIN_EMAIL);
    const abeokutaAdminToken = await loginUser(testBackend, ABEOKUTA_ADMIN_EMAIL);
    const recorded = await recordConsent(testBackend, ibrahimToken);

    for (const token of [securityToken, abujaAdminToken, lagosAdminToken]) {
      const list = await testBackend.query(api.consents.listConsents, { token });
      expect(list.map((consent) => consent.consentId)).toEqual([recorded.consentId]);

      const trail = await testBackend.query(api.audit.listAuditEvents, {
        token,
        action: "ConsentRecorded",
        paginationOpts: PAGE,
      });
      expect(trail.page).toHaveLength(1);
    }
    for (const token of [abeokutaAdminToken, ibrahimToken]) {
      expect(await testBackend.query(api.consents.listConsents, { token })).toEqual([]);
    }
    const abeokutaTrail = await testBackend.query(api.audit.listAuditEvents, {
      token: abeokutaAdminToken,
      action: "ConsentRecorded",
      paginationOpts: PAGE,
    });
    expect(abeokutaTrail.page).toEqual([]);
  });
});

describe("demo seed", () => {
  test("PAT-002391 gets one active consent for FMC Abuja, and the demo request stays ALLOW 8", async () => {
    vi.useFakeTimers();
    const testBackend = createTest();
    await testBackend.mutation(internal.seed.seedFacilities, {});
    await testBackend.mutation(internal.seed.seedHealthcareWorkers, { count: 5 });
    for (let run = 0; run < 2; run += 1) {
      await testBackend.mutation(internal.seed.seedPatientsBatch, {
        cursor: 2390,
        batchSize: 2,
        total: 2392,
      });
    }
    await testBackend.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const consents = await testBackend.run((ctx) => ctx.db.query("consents").take(10));
    expect(consents).toHaveLength(1);
    const abuja = await testBackend.run((ctx) =>
      ctx.db
        .query("facilities")
        .withIndex("by_code", (query) => query.eq("code", "FMC-ABJ"))
        .unique(),
    );
    expect(consents[0]).toMatchObject({ facilityId: abuja!._id, status: "active" });

    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    expect(await requestAccess(testBackend, token)).toMatchObject({
      outcome: "ALLOW",
      riskScore: 8,
    });
    const otherPatient = await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token,
      publicId: "PAT-002392",
      purpose: "treatment",
      recordTypes: ["allergies"],
    });
    expect(otherPatient.factors.consent).not.toBe("active");
  });
});
