/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_PASSWORD } from "./lib/demoUsers";
import { ALLOW_VALIDITY_MS } from "./lib/accessWindow";
import {
  STEP_UP_ESCALATED_REASON,
  STEP_UP_MAX_FAILURES,
  STEP_UP_NOT_ELIGIBLE_MESSAGE,
  STEP_UP_PASSWORD_REQUIRED_MESSAGE,
  STEP_UP_VERIFIED_REASON,
} from "./lib/stepUpConstants";

const IBRAHIM_EMAIL = "ibrahim@fmc.abuja.ng";
const FATIMA_EMAIL = "fatima@fmc.abuja.ng";
const SECURITY_EMAIL = "security@innov8.ng";
const LAGOS_SUMMARY = "Lagos: stable hypertension, reviewed quarterly";
const WRONG_PASSWORD = "not-my-password";
const DAY_MS = 24 * 60 * 60 * 1000;

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
      recordTypes: ["medical_summary", "allergies", "medications", "diagnoses"],
      updatedAt: Date.now(),
    });
    await ctx.db.insert("clinicalSummaries", {
      patientId,
      facilityId: lagosId,
      medicalSummary: LAGOS_SUMMARY,
      allergies: ["Penicillin"],
      medications: [],
      diagnoses: [],
      conditions: [],
      updatedAt: Date.now(),
    });
  });
}

/** A one-patient request whose stored decision is rewritten to VERIFY 43. */
async function createChallengedRequest(
  testBackend: TestBackend,
  token: string,
  overrides: { decidedAt?: number; recordCount?: number } = {},
) {
  const created = await testBackend.mutation(api.accessRequests.createAccessRequest, {
    token,
    publicId: "PAT-002391",
    purpose: "administrative",
    recordTypes: ["medical_summary"],
  });
  await testBackend.run(async (ctx) => {
    const decision = await ctx.db
      .query("accessDecisions")
      .withIndex("by_requestId", (query) => query.eq("requestId", created.requestId))
      .unique();
    await ctx.db.patch(decision!._id, {
      outcome: "VERIFY",
      riskScore: 43,
      reasons: ["Administrative purpose outside normal hours"],
      ...(overrides.decidedAt !== undefined ? { decidedAt: overrides.decidedAt } : {}),
    });
    if (overrides.recordCount !== undefined) {
      await ctx.db.patch(created.requestId, { recordCount: overrides.recordCount });
    }
  });
  return created.requestId;
}

async function verify(
  testBackend: TestBackend,
  token: string | undefined,
  requestId: string,
  password: string,
) {
  return await testBackend.mutation(api.stepUp.completeVerification, {
    token,
    requestId,
    password,
  });
}

async function storedDecision(testBackend: TestBackend, requestId: Id<"accessRequests">) {
  return await testBackend.run((ctx) =>
    ctx.db
      .query("accessDecisions")
      .withIndex("by_requestId", (query) => query.eq("requestId", requestId))
      .unique(),
  );
}

async function auditActions(testBackend: TestBackend) {
  return await testBackend.run(async (ctx) =>
    (await ctx.db.query("auditEvents").take(200)).map((event) => event.action),
  );
}

function countOf(actions: string[], action: string) {
  return actions.filter((candidate) => candidate === action).length;
}

describe("the risk engine challenges mid-risk requests", () => {
  test("administrative access after hours is VERIFY with reasons and releases nothing", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const setupToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const ibrahim = await testBackend.query(api.auth.getCurrentUser, { token: setupToken });
    await testBackend.run((ctx) =>
      ctx.db.patch(ibrahim!._id, { normalAccessHours: { start: "08:00", end: "18:00" } }),
    );

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 8, 16, 21, 0));
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const challenged = await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token,
      publicId: "PAT-002391",
      purpose: "administrative",
      recordTypes: ["allergies"],
    });

    expect(challenged.outcome).toBe("VERIFY");
    expect(challenged.reasons.length).toBeGreaterThan(0);
    const view = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId: challenged.requestId,
    });
    expect(view).toMatchObject({ status: "denied", outcome: "VERIFY" });
    expect(JSON.stringify(view)).not.toContain("Penicillin");
    expect(await auditActions(testBackend)).toContain("AccessChallenged");

    const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId: challenged.requestId,
    });
    expect(detail?.decision?.stepUpAttemptsLeft).toBe(STEP_UP_MAX_FAILURES);
  });
});

describe("completeVerification", () => {
  test("the right password turns VERIFY into ALLOW, audited, with the window from verification", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const requestId = await createChallengedRequest(testBackend, token, {
      decidedAt: Date.now() - 2 * DAY_MS,
    });

    expect(await verify(testBackend, token, requestId, WRONG_PASSWORD)).toEqual({
      status: "failed",
      attemptsLeft: STEP_UP_MAX_FAILURES - 1,
    });
    const afterFailure = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId,
    });
    expect(afterFailure?.decision?.stepUpAttemptsLeft).toBe(STEP_UP_MAX_FAILURES - 1);

    const verified = await verify(testBackend, token, requestId, DEMO_PASSWORD);
    expect(verified.status).toBe("verified");

    const decision = await storedDecision(testBackend, requestId);
    expect(decision).toMatchObject({ outcome: "ALLOW", riskScore: 43, stepUpFailures: 1 });
    expect(decision?.reasons).toContain(STEP_UP_VERIFIED_REASON);
    expect(verified).toEqual({
      status: "verified",
      allowedUntil: decision!.verifiedAt! + ALLOW_VALIDITY_MS,
    });

    const view = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId,
    });
    expect(view).toMatchObject({
      status: "authorised",
      grantedBy: "decision",
      allowedUntil: decision!.verifiedAt! + ALLOW_VALIDITY_MS,
      sections: { medicalSummary: LAGOS_SUMMARY },
    });

    const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId,
    });
    expect(detail?.decision).toMatchObject({
      outcome: "ALLOW",
      verifiedAt: decision!.verifiedAt,
      allowedUntil: decision!.verifiedAt! + ALLOW_VALIDITY_MS,
    });
    expect(detail?.decision).not.toHaveProperty("stepUpAttemptsLeft");

    const actions = await auditActions(testBackend);
    expect(countOf(actions, "StepUpFailed")).toBe(1);
    expect(countOf(actions, "StepUpCompleted")).toBe(1);
    const stepUpAllows = await testBackend.run(async (ctx) =>
      (await ctx.db.query("auditEvents").take(200)).filter(
        (event) => event.action === "AccessAllowed" && event.details.viaStepUp === true,
      ),
    );
    expect(stepUpAllows).toHaveLength(1);
    expect(stepUpAllows[0]?.details).toMatchObject({ requestId, outcome: "ALLOW" });

    await expect(verify(testBackend, token, requestId, DEMO_PASSWORD)).rejects.toThrow(
      STEP_UP_NOT_ELIGIBLE_MESSAGE,
    );
  });

  test(`${STEP_UP_MAX_FAILURES} wrong passwords block the request and alert security`, async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const requestId = await createChallengedRequest(testBackend, token);

    expect(await verify(testBackend, token, requestId, WRONG_PASSWORD)).toEqual({
      status: "failed",
      attemptsLeft: 2,
    });
    expect(await verify(testBackend, token, requestId, WRONG_PASSWORD)).toEqual({
      status: "failed",
      attemptsLeft: 1,
    });
    expect(await verify(testBackend, token, requestId, WRONG_PASSWORD)).toEqual({
      status: "blocked",
    });

    const decision = await storedDecision(testBackend, requestId);
    expect(decision).toMatchObject({ outcome: "BLOCK", stepUpFailures: 3 });
    expect(decision?.escalatedAt).toEqual(expect.any(Number));
    expect(decision?.verifiedAt).toBeUndefined();
    expect(decision?.reasons).toContain(STEP_UP_ESCALATED_REASON);

    const alerts = await testBackend.run((ctx) => ctx.db.query("securityAlerts").take(10));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      decisionId: decision!._id,
      severity: "high",
      status: "open",
    });
    expect(alerts[0]?.message).toContain(STEP_UP_ESCALATED_REASON);

    const actions = await auditActions(testBackend);
    expect(countOf(actions, "StepUpFailed")).toBe(3);
    expect(countOf(actions, "StepUpCompleted")).toBe(0);
    expect(countOf(actions, "AccessBlocked")).toBe(1);
    expect(countOf(actions, "SecurityAlertRaised")).toBe(1);

    await expect(verify(testBackend, token, requestId, DEMO_PASSWORD)).rejects.toThrow(
      STEP_UP_NOT_ELIGIBLE_MESSAGE,
    );
    const view = await testBackend.mutation(api.records.viewAuthorisedSummary, {
      token,
      requestId,
    });
    expect(view).toMatchObject({ status: "denied", outcome: "BLOCK" });

    const detail = await testBackend.query(api.accessRequests.getAccessRequest, {
      token,
      requestId,
    });
    expect(detail?.decision?.escalatedAt).toBe(decision?.escalatedAt);
  });

  test("an empty password is rejected without counting as a failure", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const token = await loginUser(testBackend, IBRAHIM_EMAIL);
    const requestId = await createChallengedRequest(testBackend, token);

    await expect(verify(testBackend, token, requestId, "")).rejects.toThrow(
      STEP_UP_PASSWORD_REQUIRED_MESSAGE,
    );
    const decision = await storedDecision(testBackend, requestId);
    expect(decision?.stepUpFailures).toBeUndefined();
    expect(await auditActions(testBackend)).not.toContain("StepUpFailed");
  });

  test("only the requester's own single-patient VERIFY request is eligible", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const fatimaToken = await loginUser(testBackend, FATIMA_EMAIL);

    const allowed = await testBackend.mutation(api.accessRequests.createAccessRequest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
      purpose: "treatment",
      recordTypes: ["allergies"],
    });
    expect(allowed.outcome).toBe("ALLOW");
    const harvest = await testBackend.mutation(api.accessRequests.simulateBulkHarvest, {
      token: ibrahimToken,
      publicId: "PAT-002391",
    });
    const bulkChallenged = await createChallengedRequest(testBackend, ibrahimToken, {
      recordCount: 20,
    });
    const fatimaChallenged = await createChallengedRequest(testBackend, fatimaToken);
    const before = (await auditActions(testBackend)).length;

    for (const requestId of [
      allowed.requestId,
      harvest.requestId,
      bulkChallenged,
      fatimaChallenged,
      "not-a-request-id",
    ]) {
      await expect(
        verify(testBackend, ibrahimToken, requestId, DEMO_PASSWORD),
      ).rejects.toThrow(STEP_UP_NOT_ELIGIBLE_MESSAGE);
    }
    expect((await auditActions(testBackend)).length).toBe(before);
    expect((await storedDecision(testBackend, fatimaChallenged))?.outcome).toBe("VERIFY");
  });

  test("security officers and anonymous callers cannot verify", async () => {
    const testBackend = createTest();
    await seedDemoWorld(testBackend);
    const ibrahimToken = await loginUser(testBackend, IBRAHIM_EMAIL);
    const requestId = await createChallengedRequest(testBackend, ibrahimToken);
    const securityToken = await loginUser(testBackend, SECURITY_EMAIL);

    await expect(verify(testBackend, securityToken, requestId, DEMO_PASSWORD)).rejects.toThrow();
    await expect(verify(testBackend, undefined, requestId, DEMO_PASSWORD)).rejects.toThrow();
    expect((await storedDecision(testBackend, requestId))?.outcome).toBe("VERIFY");
  });
});
