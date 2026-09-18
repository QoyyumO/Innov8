import { describe, expect, test } from "vitest";
import {
  NFR04_P95_TARGET_MS,
  afterHoursAdministrativeRequest,
  evaluationCases,
  measureCase,
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
    expect(scoreAccessRequest(byName.normal!.input).outcome).toBe("ALLOW");
    expect(scoreAccessRequest(byName.harvest!.input).outcome).toBe("BLOCK");
    expect(scoreAccessRequest(byName.verify!.input).outcome).toBe("VERIFY");
  });

  test("after-hours administrative request is extra scrutiny, not a harvest false positive", () => {
    const result = scoreAccessRequest(afterHoursAdministrativeRequest());
    expect(result.outcome).not.toBe("BLOCK");
    expect(result.reasons.some((reason) => reason.startsWith("Harvest pattern"))).toBe(
      false,
    );
  });

  test("p95 of normal scoreAccessRequest stays under the 1s NFR-04 target", () => {
    const normalCase = evaluationCases().find(
      (evaluationCase) => evaluationCase.name === "normal",
    );
    if (normalCase === undefined) {
      throw new Error("expected a normal evaluation case");
    }
    measureCase(normalCase, WARMUP_ITERATIONS);
    const { summary } = measureCase(normalCase, SAMPLE_ITERATIONS);
    expect(summary.p95Ms).toBeLessThan(NFR04_P95_TARGET_MS);
  });
});
