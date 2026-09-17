# INN-66: Harden verifyPassword — constant-time compare and malformed-hash handling — Implementation Plan

**Git branch:** `INN-66-harden-verify-password`

## Context

Found in the 2026-09-17 full-codebase review. `convex/lib/password.ts` had three sharp edges:

1. `derivedHashHex === hashHex` — a short-circuiting string comparison of a credential.
2. `saltHex.match(/.{1,2}/g)!` — a non-null assertion. A stored hash with an empty salt segment makes `match` return `null`, so `verifyPassword` threw a `TypeError` instead of returning `false`.
3. `parseInt(parts[2], 10)` — unvalidated. `parseInt("abc")` is `NaN` and `parseInt("100000abc")` is `100000`; either reaches `deriveBits`, as a silent failure or as a denial-of-service-sized iteration count.

The stored format is fixed by `hashPassword`, so 2 and 3 need a corrupt or hand-edited row. The throw is still the one that matters most: `verifyPassword` is the step-up primitive as well as the login one, and in `completeStepUp` **a throw rolls back the transaction** — the failure counter and its `StepUpFailed` audit row go with it. The module's own doc comment explains why wrong passwords must return rather than throw; a malformed hash was quietly outside that rule and would bypass the lockout accounting.

The timing leak is the weakest of the three in practice — the comparison is over a PBKDF2 output with a per-user salt, so there is no useful oracle — but a non-constant-time credential comparison is the first thing a security reviewer greps for, and this is a healthcare access-control demo.

---

## Scope

- [x] Compare derived bytes without short-circuiting
- [x] Return `false` for every stored hash that does not parse — never throw
- [x] Validate the iteration count is a positive integer in an expected range
- [x] Tests for empty salt, non-numeric iterations, and a truncated hash
- [x] No change to the stored format, so no migration and no re-hashing

---

## Implementation

`convex/lib/password.ts` is restructured around one parse step and one compare step.

### Parsing

`parseStoredHash(stored)` returns `null` for anything that is not `$pbkdf2$<iterations>$<saltHex>$<hashHex>` with a 16-byte salt and a 32-byte hash. It checks the leading empty segment and the label, then:

- `parseIterations` tests `/^\d+$/` **before** parsing, because `parseInt` accepts `"100000abc"` and yields `NaN` for `"abc"`. The result must be a safe integer within `MIN_STORED_ITERATIONS` (1,000) and `MAX_STORED_ITERATIONS` (1,000,000). `hashPassword` only ever writes 100,000, so anything outside that window is a corrupt row: too low is a weakened hash, too high is a denial of service.
- `hexToBytes` takes the expected byte count and returns `null` unless the text is exactly that many hex digits, so the non-null assertion is gone and a truncated hash is rejected. The length is checked *before* decoding: that is the module's only allocation, and leaving it unbounded would be the last remaining way `verifyPassword` could throw.

Hex is matched case-insensitively, so the accepted set widens slightly: a hash re-encoded in upper case now verifies where the old string compare rejected it. The stored format itself is unchanged — `hashPassword` still emits exactly what it always did. In the other direction the parser tightens, requiring the leading segment to be empty, which the old code never checked.

### Comparing

`equalsInConstantTime` accumulates `|=` over `left[index] ^ right[index]` across the whole digest and compares once at the end. It returns early only on a length mismatch, which is not secret — the stored format fixes it.

### Shared derivation

`hashPassword` and `verifyPassword` both go through `deriveBytes`, and hex encoding is one `bytesToHex`, so the two paths cannot drift on algorithm, digest or output size.

---

## Testing

`convex/lib/password.test.ts` is a plain unit suite — no Convex harness needed — and `convex/stepUp.test.ts` covers the caller.

The caller test is the important one: it patches Ibrahim's `hashedPassword` to a hash with an empty salt and asserts that `completeVerification` returns `failed` **and** that `stepUpFailures` and the `StepUpFailed` audit row survived the mutation. That is the regression this ticket exists to prevent, and a unit test on `verifyPassword` alone cannot express it.

The malformed-hash case walks 22 corruptions of a real stored hash and asserts each `resolves.toBe(false)`, then re-verifies the untouched hash so a broken fixture cannot make the suite pass vacuously. It covers empty salt, non-hex salt, short and odd-length salt, empty / truncated / over-long / non-hex digest, empty / non-numeric / zero / negative / exponent / trailing-garbage / oversized iterations, wrong algorithm, missing leading `$`, and wrong segment counts.

Deliberate-break results:

| Reverted edge | Caught? |
| --- | --- |
| Non-null assertion on the salt | Yes — in the unit suite **and** in the step-up caller test |
| Unvalidated `parseInt` iterations | Yes |
| Original hex **string** compare | Yes — by the upper-case-hex test |
| Short-circuiting **byte** compare | **No** |

Only the last one survives, and that is expected: a functional test cannot observe short-circuiting, and a wall-clock assertion over a 32-byte compare would be CI flake rather than assurance. The property is held by the compare being one small, named function that nothing else in the file bypasses.

Note the third row: reverting to the original `derivedHashHex === hashHex` **is** caught, because that compare was case-sensitive and a byte compare is not. The upper-case-hex test is therefore load-bearing, not cosmetic, and is commented as such.

---

## Open questions

- [x] Re-hash stored passwords? No — the format is unchanged and every hash `hashPassword` ever wrote parses and verifies as before.
- [x] Should a malformed hash be distinguishable from a wrong password by the caller? No. Both are "these credentials do not authenticate", and `completeStepUp` must count both against the lockout. It is distinguishable to an *operator* though: `verifyPassword` logs a breadcrumb (no hash material) when a stored hash does not parse, because otherwise a corrupt credential row locks a user out permanently and silently.
- [x] Root `README.md` "What works today"? No change needed — INN-66 alters nothing user-visible, and the step 1 row already describes login accurately.
