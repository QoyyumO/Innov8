/**
 * Password hashing and verification (PBKDF2-SHA256).
 *
 * Stored format: `$pbkdf2$<iterations>$<saltHex>$<hashHex>`.
 *
 * `verifyPassword` must NEVER throw (INN-66). It is the step-up primitive as
 * well as the login one, and in `completeStepUp` a throw rolls back the
 * failure counter and its `StepUpFailed` audit row - so a corrupt stored hash
 * would silently bypass the lockout accounting. Every malformed hash returns
 * `false` instead.
 */

const PBKDF2_LABEL = "pbkdf2";
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = "SHA-256";
const DERIVED_BITS = 256;
const DERIVED_BYTES = DERIVED_BITS / 8;
const SALT_BYTES = 16;

/**
 * Accepted iteration window for a stored hash. `hashPassword` only ever
 * writes `PBKDF2_ITERATIONS`, so anything outside this is a corrupt or
 * hand-edited row: too low is a weakened hash, too high is a denial of
 * service (the ceiling is ~10x the cost of a normal verification), and
 * `NaN` would reach `deriveBits` as a silent failure.
 */
const MIN_STORED_ITERATIONS = 1000;
const MAX_STORED_ITERATIONS = 1000000;

const HEX_PATTERN = /^[0-9a-f]+$/i;
const DIGITS_PATTERN = /^\d+$/;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Decoded bytes, or null unless the text is exactly `expectedBytes` worth of
 * hex digits. The length is checked before decoding so a malformed hash can
 * never make this allocate: it is the only allocation in the module, and an
 * unbounded one would be the last way verifyPassword could still throw.
 */
function hexToBytes(
  hex: string,
  expectedBytes: number,
): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== expectedBytes * 2 || !HEX_PATTERN.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Compare without short-circuiting on the first differing byte. Length is not
 * secret here - the stored format fixes it - so an early return on a length
 * mismatch is fine; the contents are what must not leak through timing.
 *
 * Deliberately not called "constant time": there is no data-dependent branch
 * in the loop, but bounds checks, tier-up and GC are the engine's business,
 * not this function's, so JavaScript cannot promise the real property. The
 * operands are PBKDF2 outputs over a per-user salt, so there is no oracle to
 * climb anyway - this is defence in depth and reviewability.
 */
function equalsWithoutShortCircuit(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

type StoredHash = {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  expected: Uint8Array<ArrayBuffer>;
};

function parseIterations(value: string): number | null {
  // parseInt would accept "100000abc" and return NaN for "abc", so the shape
  // is checked before the parse rather than after it.
  if (!DIGITS_PATTERN.test(value)) {
    return null;
  }
  const iterations = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(iterations)) {
    return null;
  }
  if (iterations < MIN_STORED_ITERATIONS || iterations > MAX_STORED_ITERATIONS) {
    return null;
  }
  return iterations;
}

/** null for any stored hash that does not parse - never a throw. */
function parseStoredHash(stored: string): StoredHash | null {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "" || parts[1] !== PBKDF2_LABEL) {
    return null;
  }

  const iterations = parseIterations(parts[2]);
  if (iterations === null) {
    return null;
  }

  const salt = hexToBytes(parts[3], SALT_BYTES);
  if (salt === null) {
    return null;
  }

  const expected = hexToBytes(parts[4], DERIVED_BYTES);
  if (expected === null) {
    return null;
  }

  return { iterations, salt, expected };
}

async function deriveBytes(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: PBKDF2_DIGEST },
    key,
    DERIVED_BITS,
  );
  return new Uint8Array(derived);
}

export async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBytes(password, salt, PBKDF2_ITERATIONS);
  return `$${PBKDF2_LABEL}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // No account has an empty password, and this keeps the no-throw guarantee
  // from resting on the runtime accepting a zero-length key material.
  if (password === "") {
    return false;
  }
  const stored = parseStoredHash(hash);
  if (stored === null) {
    // A stored hash that does not parse means a corrupt credential row, not a
    // wrong password: that user can no longer log in and nothing else would
    // say so. Breadcrumb only - never the hash, and never anything the client
    // sees, which would make this an oracle.
    console.error("verifyPassword: stored password hash does not parse");
    return false;
  }
  const derived = await deriveBytes(password, stored.salt, stored.iterations);
  return equalsWithoutShortCircuit(derived, stored.expected);
}
