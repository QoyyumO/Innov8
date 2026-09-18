export function assertNonEmptyString(fieldName: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`${fieldName} must not be empty`);
  }
  return trimmed;
}

export function assertDecisionReasons(reasons: string[]): string[] {
  const trimmedReasons: string[] = [];
  for (const reason of reasons) {
    const trimmed = reason.trim();
    if (trimmed !== "") {
      trimmedReasons.push(trimmed);
    }
  }
  if (trimmedReasons.length === 0) {
    throw new Error("access decision requires at least one reason");
  }
  return trimmedReasons;
}

export function assertRiskScore(riskScore: number): number {
  if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
    throw new Error("riskScore must be between 0 and 100");
  }
  return riskScore;
}
