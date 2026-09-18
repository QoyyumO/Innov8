import { describe, expect, test } from "vitest";
import {
  NFR04_P95_TARGET_MS,
  afterHoursAdministrativeRequest,
  evaluationCases,
  measureCase,
  percentileNearestRank,
} from "./lib/decisionEvaluation";
import { scoreAccessRequest } from "./lib/services/riskScoringService";

const WARMUP_ITERATIONS = 50;
const SAMPLE_ITERATIONS = 2_000;

describe("decision engine evaluation (INN-75)", () => {
  test("normal treatment is ALLOW, harvest is BLOCK, missing consent is VERIFY", () => {
    const cases = evaluationCases();
    const byName = Object.fromEntries(
      cases.map((evaluationCase) => [evaluationCase.name, evaluationCase]),
    );
    expect(scoreAccessRequest(byName.normal!.input)).toMatchObject({
      outcome: "ALLOW",
      score: 8,
    });
    expect(scoreAccessRequest(byName.harvest!.input)).toMatchObject({
      outcome: "BLOCK",
      score: 94,
    });
    expect(scoreAccessRequest(byName.verify!.input).outcome).toBe("VERIFY");
  });

  test("after-hours administrative request is VERIFY, not a harvest false positive", () => {
    const result = scoreAccessRequest(afterHoursAdministrativeRequest());
    expect(result.outcome).toBe("VERIFY");
    expect(result.score).toBe(55);
    expect(result.reasons.some((reason) => reason.startsWith("Harvest pattern"))).toBe(
      false,
    );
  });

  test("nearest-rank percentiles use ceil(p/100 * n)", () => {
    expect(percentileNearestRank([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentileNearestRank([1, 2, 3, 4, 5], 95)).toBe(5);
  });

  test("p50 and p95 of every labelled case stay under the 1s NFR-04 target", () => {
    for (const evaluationCase of evaluationCases()) {
      measureCase(evaluationCase, WARMUP_ITERATIONS);
      const { summary } = measureCase(evaluationCase, SAMPLE_ITERATIONS);
      expect(summary.sampleCount).toBe(SAMPLE_ITERATIONS);
      expect(summary.p50Ms).toBeLessThan(NFR04_P95_TARGET_MS);
      expect(summary.p95Ms).toBeLessThan(NFR04_P95_TARGET_MS);
      expect(summary.p50Ms).toBeLessThanOrEqual(summary.p95Ms);
    }
  });
});
