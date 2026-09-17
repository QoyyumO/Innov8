/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_CONSENT_DURATION_MS } from "./lib/consentConstants";
import { loginDemoUser } from "./lib/loginForTests";
import { PERMISSION_DENIED_MESSAGE } from "./lib/authConstants";
import type { RecordType } from "./lib/domain";
import { ALLOW_EXPIRED_REASON, ALLOW_VALIDITY_MS } from "./lib/accessWindow";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const LAGOS_SUMMARY = "Lagos: stable hypertension, reviewed quarterly";
const ABUJA_SUMMARY = "ABUJA-ONLY note that must never be released";
const LAGOS_CONDITION = "LAGOS-CONDITION-NOT-A-RECORD-TYPE";
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

async function seedDemoWorld(
  testBackend: TestBackend,
  options: { withLagosSummary?: boolean } = {},
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
      recordTypes: ALL_RECORD_TYPES,
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
    if (options.withLagosSummary ?? true) {
      await ctx.db.insert("clinicalSummaries", {
        patientId,
        facilityId: lagosId,
        medicalSummary: LAGOS_SUMMARY,
        allergies: ["Penicillin"],
        medications: ["Lisinopril 10mg"],
        diagnoses: ["Hypertension"],
        conditions: [LAGOS_CONDITION],
        updatedAt: 1_700_000_000_000,
      });
    }
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: abujaId,
      medicalSummary: ABUJA_SUMMARY,
      allergies: ["ABUJA-ALLERGY"],
      medications: ["ABUJA-MED"],
      diagnoses: ["ABUJA-DIAGNOSIS"],
      conditions: [],
      updatedAt: Date.now(),
    });
    return { abujaId, lagosId, patientId };
  });
}

async function createRequest(
  testBackend: TestBackend,
  token: string,
  recordTypes: RecordType[] = ALL_RECORD_TYPES,
) {
  return await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "treatment",
    recordTypes,
  });
}

/**
 * `createAccessRequest` always scores one patient (ALLOW 8 for Ibrahim), so
 * tests that need a BLOCK or VERIFY decision rewrite the stored decision.
 */
async function createDecidedRequest(
  testBackend: TestBackend,
  token: string,
  decision: { outcome: "BLOCK" | "VERIFY"; riskScore: number; reasons: string[] },
  recordTypes: RecordType[] = ALL_RECORD_TYPES,
) {
  const request = await createRequest(testBackend, token, recordTypes);
  await testBackend.run(async (ctx) => {
    const stored = await ctx.db
      .query("accessDecisions")
      .withIndex("by_requestId", (query) => query.eq("requestId", request.requestId))
      .unique();
    await ctx.db.patch(stored!._id, decision);
  });
  return request;
}

const HARVEST_DECISION = {
  outcome: "BLOCK" as const,
  riskScore: 94,
  reasons: ["Harvest pattern: one request covers 500 patient records"],
};
const VERIFY_DECISION = {
  outcome: "VERIFY" as const,
  riskScore: 43,
  reasons: ["21 records, far above normal volume (20)"],
};

async function viewSummary(testBackend: TestBackend, token: string | undefined, requestId: string) {
  return await testBackend.mutation(api.records.viewAuthorisedSummary, {
    token,
    requestId,
  });
}

async function recordViewedEvents(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) =>
    (await ctx.db.query("auditEvents").take(100)).filter(
      (event) => event.action === "RecordViewed",
    ),
  );
}

function assertNoSummaryText(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const secret of [
    LAGOS_SUMMARY,
    ABUJA_SUMMARY,
    "Penicillin",
    "Lisinopril",
    "Hypertension",
    LAGOS_CONDITION,
    "ABUJA-",
  ]) {
    expect(serialized).not.toContain(secret);
  }
}

describe("viewAuthorisedSummary after ALLOW", () => {
  test("Ibrahim sees every requested Lagos section, and only Lagos", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token);
    expect(request.outcome).toBe("ALLOW");

    const view = await viewSummary(testBackend, token, request.requestId);

    const storedDecision = await testBackend.run((ctx) =>
      ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request.requestId))
        .unique(),
    );
    expect(view).toEqual({
      status: "authorised",
      grantedBy: "decision",
      allowedUntil: storedDecision!.decidedAt + ALLOW_VALIDITY_MS,
      publicId: "PAT-002391",
      facility: { code: "FMC-LOS", name: "FMC Lagos" },
      recordTypes: ALL_RECORD_TYPES,
      sections: {
        medicalSummary: LAGOS_SUMMARY,
        allergies: ["Penicillin"],
        medications: ["Lisinopril 10mg"],
        diagnoses: ["Hypertension"],
      },
      summaryUpdatedAt: 1_700_000_000_000,
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("ABUJA-");
    expect(serialized).not.toContain(ABUJA_SUMMARY);
    expect(serialized).not.toContain(LAGOS_CONDITION);
  });

  test("only the requested record types are returned", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    const allergiesOnly = await createRequest(testBackend, token, ["allergies"]);
    const allergiesView = await viewSummary(testBackend, token, allergiesOnly.requestId);
    expect(allergiesView?.status).toBe("authorised");
    if (allergiesView?.status === "authorised") {
      expect(allergiesView.sections).toEqual({ allergies: ["Penicillin"] });
    }
    expect(JSON.stringify(allergiesView)).not.toContain(LAGOS_SUMMARY);
    expect(JSON.stringify(allergiesView)).not.toContain("Lisinopril");

    const summaryAndMeds = await createRequest(testBackend, token, [
      "medical_summary",
      "medications",
    ]);
    const secondView = await viewSummary(testBackend, token, summaryAndMeds.requestId);
    if (secondView?.status !== "authorised") {
      throw new Error("expected authorised view");
    }
    expect(Object.keys(secondView.sections).sort()).toEqual(["medicalSummary", "medications"]);
    expect(JSON.stringify(secondView)).not.toContain("Penicillin");
  });

  test("each successful view is audited as RecordViewed with the session", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token, ["allergies", "diagnoses"]);

    await viewSummary(testBackend, token, request.requestId);
    await viewSummary(testBackend, token, request.requestId);

    const events = await recordViewedEvents(testBackend);
    expect(events).toHaveLength(2);
    const session = await testBackend.run((ctx) =>
      ctx.db
        .query("sessions")
        .withIndex("by_token", (query) => query.eq("token", token))
        .unique(),
    );
    expect(events[0]).toMatchObject({
      entity: "clinicalSummaries",
      sessionId: session!._id,
      details: {
        requestId: request.requestId,
        patientPublicId: "PAT-002391",
        facility: "FMC-LOS",
        recordTypes: ["allergies", "diagnoses"],
        grantedBy: "decision",
      },
    });
    assertNoSummaryText(events);
  });

  test("authorised but no summary at the target facility is unavailable and not audited", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend, { withLagosSummary: false });
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token);

    const view = await viewSummary(testBackend, token, request.requestId);

    expect(view).toEqual({
      status: "unavailable",
      publicId: "PAT-002391",
      facility: { code: "FMC-LOS", name: "FMC Lagos" },
    });
    assertNoSummaryText(view);
    expect(await recordViewedEvents(testBackend)).toHaveLength(0);
  });
});

describe("viewAuthorisedSummary refusals", () => {
  test("BLOCK is denied with reasons and no clinical content", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const harvest = await createDecidedRequest(testBackend, token, HARVEST_DECISION);

    const view = await viewSummary(testBackend, token, harvest.requestId);

    expect(view).toMatchObject({ status: "denied", outcome: "BLOCK", riskScore: 94 });
    if (view?.status === "denied") {
      expect(view.reasons.length).toBeGreaterThan(0);
    }
    assertNoSummaryText(view);
    expect(await recordViewedEvents(testBackend)).toHaveLength(0);
  });

  test("VERIFY is denied", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const aboveBaseline = await createDecidedRequest(testBackend, token, VERIFY_DECISION);

    const view = await viewSummary(testBackend, token, aboveBaseline.requestId);

    expect(view).toMatchObject({ status: "denied", outcome: "VERIFY", riskScore: 43 });
    assertNoSummaryText(view);
  });

  test("another clinician gets null for someone else's allowed request", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginDemoUser(testBackend, FATIMA_EMAIL);
    const request = await createRequest(testBackend, ibrahimToken);

    expect(await viewSummary(testBackend, fatimaToken, request.requestId)).toBeNull();
    expect(await recordViewedEvents(testBackend)).toHaveLength(0);
  });

  test("security officers and anonymous callers cannot read clinical content", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const securityToken = await loginDemoUser(testBackend, SECURITY_EMAIL);
    const request = await createRequest(testBackend, ibrahimToken);

    await expect(viewSummary(testBackend, securityToken, request.requestId)).rejects.toThrow(
      PERMISSION_DENIED_MESSAGE,
    );
    await expect(viewSummary(testBackend, undefined, request.requestId)).rejects.toThrow(
      /session has expired/,
    );
  });

  test("suspended requester is rejected", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token);
    const user = await testBackend.query(api.auth.getCurrentUser, { token });
    await testBackend.run((ctx) => ctx.db.patch(user!._id, { accountStatus: "suspended" }));

    await expect(viewSummary(testBackend, token, request.requestId)).rejects.toThrow(/suspended/);
  });

  test("malformed and unknown request ids return null", async () => {
    const testBackend = createTest();
    const { patientId } = await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);

    for (const requestId of ["", "nope", patientId as Id<"patients"> as string]) {
      expect(await viewSummary(testBackend, token, requestId)).toBeNull();
    }
  });
});

describe("emergency grants", () => {
  async function blockedRequestWithGrant(
    testBackend: TestBackend,
    grant: { expiresInMs: number; revoked?: boolean; forOtherRequest?: boolean },
  ) {
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const blocked = await createDecidedRequest(testBackend, token, HARVEST_DECISION, ["allergies"]);
    const other = await createDecidedRequest(testBackend, token, HARVEST_DECISION, ["medications"]);
    await testBackend.run(async (ctx) => {
      const request = await ctx.db.get(blocked.requestId);
      const now = Date.now();
      await ctx.db.insert("emergencyAccess", {
        requestId: grant.forOtherRequest ? other.requestId : blocked.requestId,
        actorId: request!.actorId,
        patientId: request!.patientId,
        justification: "Unconscious patient in A&E",
        grantedAt: now,
        expiresAt: now + grant.expiresInMs,
        revokedAt: grant.revoked ? now : undefined,
      });
    });
    return { token, blocked };
  }

  test("a live grant on the request authorises the requested sections", async () => {
    const testBackend = createTest();
    const { token, blocked } = await blockedRequestWithGrant(testBackend, {
      expiresInMs: 15 * 60 * 1000,
    });

    const view = await viewSummary(testBackend, token, blocked.requestId);

    expect(view).toMatchObject({
      status: "authorised",
      grantedBy: "emergency",
      sections: { allergies: ["Penicillin"] },
    });
    if (view?.status === "authorised") {
      expect(view.emergencyExpiresAt).toBeGreaterThan(Date.now());
      expect(Object.keys(view.sections)).toEqual(["allergies"]);
    }
    const events = await recordViewedEvents(testBackend);
    expect(events[0]?.details).toMatchObject({ grantedBy: "emergency" });
  });

  test.each([
    ["expired", { expiresInMs: -1 }],
    ["revoked", { expiresInMs: 15 * 60 * 1000, revoked: true }],
    ["for a different request", { expiresInMs: 15 * 60 * 1000, forOtherRequest: true }],
  ])("a grant that is %s does not authorise", async (_label, grant) => {
    const testBackend = createTest();
    const { token, blocked } = await blockedRequestWithGrant(testBackend, grant);

    const view = await viewSummary(testBackend, token, blocked.requestId);

    expect(view).toMatchObject({ status: "denied", outcome: "BLOCK" });
    assertNoSummaryText(view);
  });
});

describe("ALLOW validity window (INN-51)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function accessExpiredEvents(testBackend: TestBackend) {
    return await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(100)).filter(
        (event) => event.action === "AccessExpired",
      ),
    );
  }

  test("records open inside the window and are refused, and audited, once it passes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const startedAt = Date.UTC(2026, 8, 16, 9, 0);
    vi.setSystemTime(startedAt);
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token, ["allergies"]);
    expect(request.outcome).toBe("ALLOW");

    vi.setSystemTime(startedAt + ALLOW_VALIDITY_MS - 1);
    const lateToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const lastView = await viewSummary(testBackend, lateToken, request.requestId);
    expect(lastView).toMatchObject({
      status: "authorised",
      grantedBy: "decision",
      allowedUntil: startedAt + ALLOW_VALIDITY_MS,
    });

    vi.setSystemTime(startedAt + ALLOW_VALIDITY_MS);
    const expiredToken = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const refused = await viewSummary(testBackend, expiredToken, request.requestId);
    expect(refused).toEqual({
      status: "denied",
      outcome: "ALLOW",
      riskScore: 8,
      reasons: [ALLOW_EXPIRED_REASON],
      expiredAt: startedAt + ALLOW_VALIDITY_MS,
    });
    assertNoSummaryText(refused);

    expect(await recordViewedEvents(testBackend)).toHaveLength(1);
    const expired = await accessExpiredEvents(testBackend);
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({
      entity: "accessRequests",
      entityId: request.requestId,
      createdAt: startedAt + ALLOW_VALIDITY_MS,
      details: {
        patientPublicId: "PAT-002391",
        recordTypes: ["allergies"],
        expiredAt: startedAt + ALLOW_VALIDITY_MS,
      },
    });
  });

  test("an ALLOW from 25 hours ago (e.g. seeded) no longer releases records", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token);
    await testBackend.run(async (ctx) => {
      const stored = await ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request.requestId))
        .unique();
      // The agreed window is 24 hours.
      await ctx.db.patch(stored!._id, { decidedAt: Date.now() - 25 * 60 * 60 * 1000 });
    });

    const view = await viewSummary(testBackend, token, request.requestId);
    expect(view).toMatchObject({ status: "denied", reasons: [ALLOW_EXPIRED_REASON] });
    assertNoSummaryText(view);

    const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId: request.requestId,
    });
    expect(detail?.decision?.allowedUntil).toBeLessThan(Date.now());
  });

  test("a live emergency grant still decides, even on an expired ALLOW", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    const request = await createRequest(testBackend, token, ["allergies"]);
    await testBackend.run(async (ctx) => {
      const stored = await ctx.db
        .query("accessDecisions")
        .withIndex("by_requestId", (query) => query.eq("requestId", request.requestId))
        .unique();
      await ctx.db.patch(stored!._id, { decidedAt: Date.now() - 2 * ALLOW_VALIDITY_MS });
      const storedRequest = await ctx.db.get(request.requestId);
      await ctx.db.insert("emergencyAccess", {
        requestId: request.requestId,
        actorId: storedRequest!.actorId,
        patientId: storedRequest!.patientId,
        justification: "Unconscious patient in A&E",
        grantedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      });
    });

    const view = await viewSummary(testBackend, token, request.requestId);
    expect(view).toMatchObject({ status: "authorised", grantedBy: "emergency" });
    expect(view).not.toHaveProperty("allowedUntil");
    expect(await accessExpiredEvents(testBackend)).toHaveLength(0);
  });

  test("BLOCK and VERIFY refusals are not expiry and write no AccessExpired", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginDemoUser(testBackend, IBRAHIM_EMAIL);
    for (const decision of [HARVEST_DECISION, VERIFY_DECISION]) {
      const request = await createDecidedRequest(testBackend, token, decision);
      const view = await viewSummary(testBackend, token, request.requestId);
      expect(view).toMatchObject({ status: "denied", outcome: decision.outcome });
      expect(view).not.toHaveProperty("expiredAt");

      const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
        token,
        requestId: request.requestId,
      });
      expect(detail?.decision).not.toHaveProperty("allowedUntil");
    }
    expect(await accessExpiredEvents(testBackend)).toHaveLength(0);
  });
});
