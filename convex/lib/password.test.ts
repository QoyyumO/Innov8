import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const PASSWORD = "Str0ng-Demo-Passw0rd";

/** Split a real stored hash so tests can corrupt one field at a time. */
async function storedParts(password = PASSWORD) {
  const stored = await hashPassword(password);
  const [, label, iterations, saltHex, hashHex] = stored.split("$");
  return { stored, label, iterations, saltHex, hashHex };
}

describe("hashPassword", () => {
  test("writes the documented format with a 16-byte salt and 32-byte hash", async () => {
    const { label, iterations, saltHex, hashHex } = await storedParts();
    expect(label).toBe("pbkdf2");
    expect(iterations).toBe("100000");
    expect(saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(hashHex).toMatch(/^[0-9a-f]{64}$/);
  });

  test("salts every hash, so the same password stores differently", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);
    expect(first).not.toBe(second);
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
  });
});

describe("verifyPassword", () => {
  test("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  test("rejects a password differing only in the last byte", async () => {
    // The compare must not short-circuit, but it must still be correct at
    // the far end of the digest.
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword(`${PASSWORD} `, stored)).toBe(false);
    expect(await verifyPassword(PASSWORD.slice(0, -1), stored)).toBe(false);
  });

  // INN-66: every malformed stored hash returns false. A throw here would
  // roll back the step-up failure counter and its audit row.
  test("returns false, never throws, for a malformed stored hash", async () => {
    const { stored, saltHex, hashHex } = await storedParts();
    const malformed = [
      "",
      "$",
      "not-a-hash",
      "$pbkdf2$100000$", // too few segments
      `$pbkdf2$100000$${saltHex}$${hashHex}$extra`, // too many
      `$bcrypt$100000$${saltHex}$${hashHex}`, // wrong algorithm
      `pbkdf2$100000$${saltHex}$${hashHex}`, // missing leading $ (4 segments)
      // 5 segments, but a non-empty first one. The old string compare
      // accepted this; it is the only input this change tightens.
      `x$pbkdf2$100000$${saltHex}$${hashHex}`,
      `$pbkdf2$$${saltHex}$${hashHex}`, // empty iterations
      `$pbkdf2$abc$${saltHex}$${hashHex}`, // non-numeric iterations
      `$pbkdf2$0$${saltHex}$${hashHex}`, // zero iterations
      `$pbkdf2$-100000$${saltHex}$${hashHex}`, // negative
      `$pbkdf2$1e9$${saltHex}$${hashHex}`, // exponent notation
      `$pbkdf2$100000abc$${saltHex}$${hashHex}`, // parseInt would accept this
      `$pbkdf2$99999999999$${saltHex}$${hashHex}`, // denial-of-service sized
      `$pbkdf2$100000$$${hashHex}`, // empty salt - used to throw a TypeError
      `$pbkdf2$100000$zz${saltHex.slice(2)}$${hashHex}`, // non-hex salt
      `$pbkdf2$100000$${saltHex.slice(0, -2)}$${hashHex}`, // short salt (also derives differently)
      `$pbkdf2$100000$${saltHex}0$${hashHex}`, // odd-length salt
      `$pbkdf2$100000$${saltHex}$`, // empty hash
      `$pbkdf2$100000$${saltHex}$${hashHex.slice(0, 32)}`, // truncated hash (also fails the length compare)
      `$pbkdf2$100000$${saltHex}$${hashHex}ff`, // over-long hash (same)
      `$pbkdf2$100000$${saltHex}$zz${hashHex.slice(2)}`, // non-hex hash
    ];

    for (const hash of malformed) {
      await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(false);
    }

    // The untouched hash still verifies, so the cases above fail for the
    // reason under test and not because the fixture is broken.
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
  });

  // Load-bearing: reverting to the original `derivedHashHex === hashHex`
  // string compare fails exactly here, because that compare was
  // case-sensitive while a byte compare is not. Do not delete as cosmetic.
  test("a hash re-encoded in upper-case hex still verifies", async () => {
    const { iterations, saltHex, hashHex } = await storedParts();
    const upper = `$pbkdf2$${iterations}$${saltHex.toUpperCase()}$${hashHex.toUpperCase()}`;
    expect(await verifyPassword(PASSWORD, upper)).toBe(true);
  });
});
