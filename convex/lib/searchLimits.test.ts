import { describe, expect, test } from "vitest";
import {
  NAME_PREFIX_MIN_LENGTH,
  isPatientPublicIdQuery,
  isSearchableQuery,
  normalizeSearchQuery,
} from "./searchLimits";

/**
 * isSearchableQuery decides whether an append-only audit row is written
 * (INN-56), so it is pinned directly rather than only through the mutation.
 * True must mean "findPatientsByQuery reaches an index for this input".
 */
describe("isSearchableQuery", () => {
  test("rejects input that never reaches an index", () => {
    for (const query of ["", " ", "   ", "\t\n", "c", "ch", " ch "]) {
      expect(isSearchableQuery(query)).toBe(false);
    }
  });

  test("accepts a public ID, whatever its case or padding", () => {
    for (const query of [
      "PAT-002391",
      "pat-002391",
      "  PAT-002391  ",
      "PAT-0",
      "PAT-999999",
    ]) {
      expect(isSearchableQuery(query)).toBe(true);
    }
  });

  test("a public-ID match is never shorter than the name minimum", () => {
    // So the two branches cannot interact: nothing matching the pattern can
    // be rejected by the name-length rule.
    expect("pat-0".length).toBeGreaterThanOrEqual(NAME_PREFIX_MIN_LENGTH);
  });

  test("'pat-' without digits is not a public ID and falls to the name rule", () => {
    expect(isPatientPublicIdQuery("pat-")).toBe(false);
    expect(isSearchableQuery("pat-")).toBe(true); // 4 characters
  });

  test("the length rule measures the normalised string, not the raw one", () => {
    // "a  b" collapses to "a b" - exactly at the boundary the refactor turns on.
    expect(normalizeSearchQuery("a  b")).toBe("a b");
    expect(normalizeSearchQuery("a  b").length).toBe(NAME_PREFIX_MIN_LENGTH);
    expect(isSearchableQuery("a  b")).toBe(true);
  });

  test("accepts names at and above the minimum", () => {
    expect(isSearchableQuery("chi")).toBe(true);
    expect(isSearchableQuery("chioma")).toBe(true);
    expect(isSearchableQuery("  Chioma Okonkwo  ")).toBe(true);
  });
});

describe("normalizeSearchQuery", () => {
  test("trims, collapses inner whitespace, and lowercases", () => {
    expect(normalizeSearchQuery("  Chioma   Okonkwo  ")).toBe("chioma okonkwo");
  });

  test("is idempotent, so re-deriving the verdict is safe", () => {
    const once = normalizeSearchQuery("  Chioma   Okonkwo  ");
    expect(normalizeSearchQuery(once)).toBe(once);
  });
});
