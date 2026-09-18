import { HARVEST_RECORD_COUNT } from "./riskConstants";
import {
  scoreAccessRequest,
  type RiskInput,
  type RiskBreakdown,
} from "./services/riskScoringService";

const ALL_RECORD_TYPES = [
  "medical_summary",
  "allergies",
  "medications",
  "diagnoses",
] as const;

/** 10:00 West Africa Time. */
const DAYTIME = Date.UTC(2026, 8, 15, 9, 0);
/** 22:00 West Africa Time. */
const NIGHTTIME = Date.UTC(2026, 8, 15, 21, 0);

const IBRAHIM_HOURS = { start: "08:00", end: "18:00" };

export type EvaluationCaseName = "normal" | "harvest" | "verify";

export type EvaluationCase = {
  name: EvaluationCaseName;
  input: RiskInput;
};

/** NFR-04: 95% of normal engine decisions inside this many milliseconds. */
export const NFR04_P95_TARGET_MS = 1000;

export function evaluationCases(): EvaluationCase[] {
  const ibrahimBase: RiskInput = {
    actorRoles: ["doctor"],
    purpose: "treatment",
    recordTypes: [...ALL_RECORD_TYPES],
    recordCount: 1,
    sameHospital: false,
    requestedAt: DAYTIME,
    normalAccessHours: IBRAHIM_HOURS,
    normalPatientVolume: 20,
  };
  return [
    { name: "normal", input: ibrahimBase },
    {
      name: "harvest",
      input: { ...ibrahimBase, recordCount: HARVEST_RECORD_COUNT },
    },
    {
      name: "verify",
      input: { ...ibrahimBase, consent: "missing" },
    },
  ];
}

export function afterHoursAdministrativeRequest(): RiskInput {
  return {
    actorRoles: ["hospital_admin"],
    purpose: "administrative",
    recordTypes: [...ALL_RECORD_TYPES],
    recordCount: 1,
    sameHospital: true,
    requestedAt: NIGHTTIME,
    normalAccessHours: IBRAHIM_HOURS,
    normalPatientVolume: 8,
  };
}

export function percentileNearestRank(
  sortedAscending: number[],
  percentile: number,
): number {
  if (sortedAscending.length === 0) {
    throw new Error("percentile requires at least one sample");
  }
  const rank = Math.ceil((percentile / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length, Math.max(1, rank)) - 1;
  return sortedAscending[index] ?? 0;
}

export type LatencySummary = {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

export function summariseLatencies(samplesMs: number[]): LatencySummary {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  return {
    sampleCount: sorted.length,
    p50Ms: percentileNearestRank(sorted, 50),
    p95Ms: percentileNearestRank(sorted, 95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

/** Times one `scoreAccessRequest` call in milliseconds (engine only, no network). */
export function timeScoreAccessRequest(input: RiskInput): {
  durationMs: number;
  result: RiskBreakdown;
} {
  const startedAt = performance.now();
  const result = scoreAccessRequest(input);
  return { durationMs: performance.now() - startedAt, result };
}

export function measureCase(
  evaluationCase: EvaluationCase,
  iterations: number,
): { summary: LatencySummary; lastResult: RiskBreakdown } {
  const samplesMs: number[] = [];
  let lastResult: RiskBreakdown | undefined;
  for (let index = 0; index < iterations; index += 1) {
    const timed = timeScoreAccessRequest(evaluationCase.input);
    samplesMs.push(timed.durationMs);
    lastResult = timed.result;
  }
  if (lastResult === undefined) {
    throw new Error("measureCase requires at least one iteration");
  }
  return { summary: summariseLatencies(samplesMs), lastResult };
}
