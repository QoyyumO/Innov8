import { describe, expect, test } from "vitest";
import { DEMO_WORKER_SEEDS } from "./lib/demoUsers";
import { CONSENT_ACTIVE_REASON, CONSENT_MISSING_REASON } from "./lib/consentConstants";
import type { Purpose } from "./lib/domain";
import type { UserRole } from "./lib/roles";
import {
  BLOCK_THRESHOLD,
  CONSENT_MISSING_POINTS,
  HARVEST_RECORD_COUNT,
  HARVEST_SCORE,
  UNUSUAL_LOCATION_POINTS,
  BEHAVIOUR_DEVIATION_POINTS,
  VERIFY_THRESHOLD,
  isLocationMismatch,
  isOutsideAccessHours,
  outcomeForScore,
  scoreAccessRequest,
  type RiskInput,
} from "./lib/services/riskScoringService";

const ALL_RECORD_TYPES = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
] as const;

const ibrahimSeed = DEMO_WORKER_SEEDS.find(
  (seed) => seed.email === "ibrahim@fmc.abuja.ng",
)!;

/** 10:00 West Africa Time (UTC+1). */
const DAYTIME = Date.UTC(2026, 8, 15, 9, 0);
/** 22:00 West Africa Time. */
const NIGHTTIME = Date.UTC(2026, 8, 15, 21, 0);

/** Ibrahim (doctor, FMC Abuja) asking for PAT-002391 at FMC Lagos. */
function ibrahimRequest(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    actorRoles: ["doctor"],
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
    recordCount: 1,
    sameHospital: false,
    requestedAt: DAYTIME,
    normalAccessHours: ibrahimSeed.normalAccessHours,
    normalPatientVolume: ibrahimSeed.normalPatientVolume,
    ...overrides,
  };
}

describe("demo invariants", () => {
  test("Ibrahim treatment request for PAT-002391 scores 8 ALLOW", () => {
    const result = scoreAccessRequest(ibrahimRequest());
    expect(result.score).toBe(8);
    expect(result.outcome).toBe("ALLOW");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons).toContain("Treatment purpose");
    expect(result.reasons).toContain("Records are held at another facility");
  });

  test("Ibrahim treatment stays 8 at night (clinical care is round the clock)", () => {
    const result = scoreAccessRequest(ibrahimRequest({ requestedAt: NIGHTTIME }));
    expect(result.score).toBe(8);
    expect(result.outcome).toBe("ALLOW");
    expect(result.factors.afterHours).toBe(true);
    expect(result.reasons).toContain("Outside normal hours; clinical care is round the clock");
  });

  test("500-record harvest scores 94 BLOCK with harvest and volume reasons", () => {
    const result = scoreAccessRequest(ibrahimRequest({ recordCount: 500 }));
    expect(result.score).toBe(HARVEST_SCORE);
    expect(result.score).toBe(94);
    expect(result.outcome).toBe("BLOCK");
    expect(result.reasons.some((reason) => reason.startsWith("Harvest pattern"))).toBe(true);
    expect(result.reasons).toContain("500 records, far above normal volume (20)");
  });

  test.each<[Purpose, number]>([
    ["treatment", DAYTIME],
    ["emergency", NIGHTTIME],
    ["administrative", NIGHTTIME],
    ["referral", DAYTIME],
  ])("harvest is 94 BLOCK for %s at any time", (purpose, requestedAt) => {
    const result = scoreAccessRequest(
      ibrahimRequest({ purpose, requestedAt, recordCount: HARVEST_RECORD_COUNT }),
    );
    expect(result.score).toBe(94);
    expect(result.outcome).toBe("BLOCK");
  });

  test("harvest threshold starts at 500 records", () => {
    const belowHarvest = scoreAccessRequest(ibrahimRequest({ recordCount: 499 }));
    expect(belowHarvest.score).toBeLessThan(HARVEST_SCORE);
    expect(belowHarvest.reasons.some((reason) => reason.startsWith("Harvest"))).toBe(false);
  });
});

describe("thresholds", () => {
  test.each([
    [0, "ALLOW"],
    [VERIFY_THRESHOLD - 1, "ALLOW"],
    [VERIFY_THRESHOLD, "VERIFY"],
    [BLOCK_THRESHOLD - 1, "VERIFY"],
    [BLOCK_THRESHOLD, "BLOCK"],
    [100, "BLOCK"],
  ] as const)("score %i → %s", (score, outcome) => {
    expect(outcomeForScore(score)).toBe(outcome);
  });

  test("administrative request after hours at own facility is VERIFY (40)", () => {
    const result = scoreAccessRequest(
      ibrahimRequest({
        purpose: "administrative",
        sameHospital: true,
        requestedAt: NIGHTTIME,
      }),
    );
    expect(result.score).toBe(40);
    expect(result.outcome).toBe("VERIFY");
    expect(result.reasons).toContain("Outside the requester's normal access hours");
  });

  test("the same administrative request in working hours is ALLOW (25)", () => {
    const result = scoreAccessRequest(
      ibrahimRequest({ purpose: "administrative", sameHospital: true }),
    );
    expect(result.score).toBe(25);
    expect(result.outcome).toBe("ALLOW");
  });
});

describe("factor weights", () => {
  test.each<[UserRole, number]>([
    ["doctor", 8],
    ["nurse", 8],
    ["pharmacist", 8],
    ["laboratory", 8],
    ["hospital_admin", 23],
    ["system_admin", 23],
    ["security_officer", 33],
    ["patient", 88],
  ])("role %s scores %i", (role, expectedScore) => {
    expect(scoreAccessRequest(ibrahimRequest({ actorRoles: [role] })).score).toBe(
      expectedScore,
    );
  });

  test("a patient-role request is BLOCK", () => {
    const result = scoreAccessRequest(ibrahimRequest({ actorRoles: ["patient"] }));
    expect(result.outcome).toBe("BLOCK");
    expect(result.reasons).toContain("Role is not permitted to request clinical records");
  });

  test("mixed roles score by the clinical role", () => {
    const result = scoreAccessRequest(
      ibrahimRequest({ actorRoles: ["security_officer", "doctor"] }),
    );
    expect(result.factors.role).toBe("doctor");
    expect(result.score).toBe(8);
  });

  test.each<[Purpose, number]>([
    ["treatment", 8],
    ["emergency", 13],
    ["follow-up", 13],
    ["referral", 16],
    ["administrative", 28],
  ])("purpose %s scores %i", (purpose, expectedScore) => {
    expect(scoreAccessRequest(ibrahimRequest({ purpose })).score).toBe(expectedScore);
  });

  test("same-facility request drops the cross-facility points", () => {
    const result = scoreAccessRequest(ibrahimRequest({ sameHospital: true }));
    expect(result.score).toBe(5);
    expect(result.reasons).toContain("Records are held at the requester's facility");
  });

  test("volume within baseline adds 5, above baseline pushes to VERIFY", () => {
    expect(scoreAccessRequest(ibrahimRequest({ recordCount: 20 })).score).toBe(13);
    const aboveBaseline = scoreAccessRequest(ibrahimRequest({ recordCount: 21 }));
    expect(aboveBaseline.score).toBe(43);
    expect(aboveBaseline.outcome).toBe("VERIFY");
    expect(aboveBaseline.reasons).toContain("21 records, far above normal volume (20)");
  });

  test("missing baseline defaults to 20", () => {
    const result = scoreAccessRequest(
      ibrahimRequest({ normalPatientVolume: undefined, recordCount: 21 }),
    );
    expect(result.reasons).toContain("21 records, far above normal volume (20)");
  });

  test("uses the worker's own baseline when present", () => {
    const nurseLike = scoreAccessRequest(
      ibrahimRequest({ normalPatientVolume: 35, recordCount: 30 }),
    );
    expect(nurseLike.score).toBe(13);
  });

  test("score is capped at 100 before the harvest rule", () => {
    const result = scoreAccessRequest(
      ibrahimRequest({
        actorRoles: ["patient"],
        purpose: "administrative",
        recordCount: 21,
        requestedAt: NIGHTTIME,
      }),
    );
    expect(result.score).toBe(100);
    expect(result.outcome).toBe("BLOCK");
  });
});

describe("patient consent (INN-45)", () => {
  test("missing consent turns Ibrahim's treatment request into VERIFY 43, with the reason", () => {
    const result = scoreAccessRequest(ibrahimRequest({ consent: "missing" }));
    expect(result.score).toBe(8 + CONSENT_MISSING_POINTS);
    expect(result.outcome).toBe("VERIFY");
    expect(result.reasons).toContain(CONSENT_MISSING_REASON);
    expect(result.factors.consent).toBe("missing");
  });

  test("missing consent is never below the VERIFY threshold", () => {
    for (const purpose of ["treatment", "follow-up", "referral", "administrative"] as const) {
      const result = scoreAccessRequest(ibrahimRequest({ purpose, consent: "missing" }));
      expect(result.score).toBeGreaterThanOrEqual(VERIFY_THRESHOLD);
      expect(result.outcome).not.toBe("ALLOW");
    }
  });

  test("active consent adds a reason but no points; not required adds neither", () => {
    const active = scoreAccessRequest(ibrahimRequest({ consent: "active" }));
    expect(active).toMatchObject({ score: 8, outcome: "ALLOW" });
    expect(active.reasons).toContain(CONSENT_ACTIVE_REASON);
    expect(active.factors.consent).toBe("active");

    const notRequired = scoreAccessRequest(ibrahimRequest());
    expect(notRequired.score).toBe(8);
    expect(notRequired.reasons).not.toContain(CONSENT_ACTIVE_REASON);
    expect(notRequired.reasons).not.toContain(CONSENT_MISSING_REASON);
  });
});

describe("access hours", () => {
  const officeHours = { start: "08:00", end: "18:00" };

  test.each([
    [Date.UTC(2026, 8, 15, 7, 0), false], // 08:00 WAT, start is inclusive
    [Date.UTC(2026, 8, 15, 16, 59), false], // 17:59 WAT
    [Date.UTC(2026, 8, 15, 17, 0), true], // 18:00 WAT, end is exclusive
    [Date.UTC(2026, 8, 15, 6, 59), true], // 07:59 WAT
    [Date.UTC(2026, 8, 15, 23, 30), true], // 00:30 WAT next day
  ])("office hours at %i → outside=%s", (requestedAt, expected) => {
    expect(isOutsideAccessHours(requestedAt, officeHours)).toBe(expected);
  });

  test("overnight window wraps midnight", () => {
    const nightShift = { start: "20:00", end: "06:00" };
    expect(isOutsideAccessHours(Date.UTC(2026, 8, 15, 22, 0), nightShift)).toBe(false); // 23:00 WAT
    expect(isOutsideAccessHours(Date.UTC(2026, 8, 15, 3, 0), nightShift)).toBe(false); // 04:00 WAT
    expect(isOutsideAccessHours(Date.UTC(2026, 8, 15, 11, 0), nightShift)).toBe(true); // 12:00 WAT
  });

  test("missing or malformed hours never add risk", () => {
    expect(isOutsideAccessHours(NIGHTTIME, undefined)).toBe(false);
    expect(isOutsideAccessHours(NIGHTTIME, { start: "8am", end: "6pm" })).toBe(false);
    expect(isOutsideAccessHours(NIGHTTIME, { start: "25:00", end: "18:00" })).toBe(false);
    expect(isOutsideAccessHours(NIGHTTIME, { start: "08:00", end: "08:00" })).toBe(false);
  });

  test("after-hours penalty applies to referral and follow-up but not emergency", () => {
    expect(scoreAccessRequest(ibrahimRequest({ purpose: "referral", requestedAt: NIGHTTIME })).score).toBe(31);
    expect(scoreAccessRequest(ibrahimRequest({ purpose: "follow-up", requestedAt: NIGHTTIME })).score).toBe(28);
    expect(scoreAccessRequest(ibrahimRequest({ purpose: "emergency", requestedAt: NIGHTTIME })).score).toBe(13);
  });
});

describe("output contract", () => {
  test("factors match the accessDecisions.factors shape", () => {
    const result = scoreAccessRequest(ibrahimRequest());
    expect(result.factors).toEqual({
      role: "doctor",
      purpose: "treatment",
      sameHospital: false,
      recordCount: 1,
      consent: "not_required",
      locationMismatch: false,
      afterHours: false,
      recentRequestCount: 0,
    });
  });

  test("every result has at least one non-empty reason", () => {
    const purposes: Purpose[] = ["treatment", "emergency", "referral", "follow-up", "administrative"];
    for (const purpose of purposes) {
      for (const recordCount of [1, 5, 50, 500]) {
        const result = scoreAccessRequest(ibrahimRequest({ purpose, recordCount }));
        expect(result.reasons.length).toBeGreaterThanOrEqual(4);
        expect(result.reasons.every((reason) => reason.trim().length > 0)).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    }
  });

  test("does not mutate its input", () => {
    const input = ibrahimRequest();
    const snapshot = JSON.parse(JSON.stringify(input));
    scoreAccessRequest(input);
    expect(input).toEqual(snapshot);
  });
});

describe("input validation", () => {
  test("rejects an empty recordTypes list", () => {
    expect(() => scoreAccessRequest(ibrahimRequest({ recordTypes: [] }))).toThrow(
      /at least one record type/,
    );
  });

  test.each([0, -1, 1.5, Number.NaN])("rejects recordCount %s", (recordCount) => {
    expect(() => scoreAccessRequest(ibrahimRequest({ recordCount }))).toThrow(
      /recordCount/,
    );
  });

  test("rejects an actor with no roles", () => {
    expect(() => scoreAccessRequest(ibrahimRequest({ actorRoles: [] }))).toThrow(
      /at least one role/,
    );
  });
});

describe("location and historical behaviour (INN-71)", () => {
  const abuja: { code: string; name: string; city: string } = {
    code: "FMC-ABJ",
    name: "FMC Abuja",
    city: "Abuja",
  };

  test("source-facility city is not a mismatch", () => {
    expect(isLocationMismatch("Abuja", abuja)).toBe(false);
    expect(isLocationMismatch("FMC Abuja", abuja)).toBe(false);
    expect(isLocationMismatch(undefined, abuja)).toBe(false);
  });

  test("off-site location adds points and keeps harvest at 94", () => {
    const mismatch = scoreAccessRequest(
      ibrahimRequest({ location: "off-site", sourceFacility: abuja }),
    );
    expect(mismatch.score).toBe(8 + UNUSUAL_LOCATION_POINTS);
    expect(mismatch.factors.locationMismatch).toBe(true);
    expect(mismatch.reasons).toContain(
      "Request location does not match the requester's facility",
    );

    const harvest = scoreAccessRequest(
      ibrahimRequest({
        recordCount: 500,
        location: "off-site",
        sourceFacility: abuja,
      }),
    );
    expect(harvest.score).toBe(HARVEST_SCORE);
    expect(harvest.outcome).toBe("BLOCK");
  });

  test("request volume at the worker baseline adds behaviour points", () => {
    const result = scoreAccessRequest(ibrahimRequest({ recentRequestCount: 20 }));
    expect(result.score).toBe(8 + BEHAVIOUR_DEVIATION_POINTS);
    expect(result.factors.recentRequestCount).toBe(20);
    expect(result.reasons).toContain(
      "20 requests in 24 hours, at or above normal volume (20)",
    );
  });
});

describe("performance", () => {
  test("10,000 decisions finish well under one second", () => {
    const startedAt = performance.now();
    for (let requestIndex = 0; requestIndex < 10_000; requestIndex += 1) {
      scoreAccessRequest(
        ibrahimRequest({
          recordCount: (requestIndex % 600) + 1,
          requestedAt: DAYTIME + requestIndex * 60_000,
          purpose: requestIndex % 2 === 0 ? "treatment" : "administrative",
        }),
      );
    }
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });
});
