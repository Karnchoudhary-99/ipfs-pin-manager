// CID validation for IPFS content identifiers.
//
// Supported, without any IPFS dependency:
//   - CIDv0: base58btc multihash, always starts with "Qm" and is 46 chars.
//   - CIDv1: multibase-encoded, currently base32-lower ("bafy…"/"bafk…"/"bafkr…")
//     and base58btc ("z…") forms.
// Validation is deliberately structural (alphabet + length + prefix), not a
// full multihash decode: a string that passes here is well-formed, and the
// registry stores it verbatim. Unknown codecs are not rejected — a CID's
// codec lives inside the multihash bytes, which a string check cannot see.

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE32_LOWER_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function isBase58(str) {
  return [...str].every((ch) => BASE58_ALPHABET.includes(ch));
}

function isBase32Lower(str) {
  return [...str].every((ch) => BASE32_LOWER_ALPHABET.includes(ch));
}

/** Parse a CID string. Returns { version, encoding } or null if malformed. */
export function parseCid(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  // CIDv0: Qm + 44 base58 chars (sha2-256 multihash, 46 chars total).
  if (value.startsWith("Qm") && value.length === 46 && isBase58(value)) {
    return { version: 0, encoding: "base58btc" };
  }
  // CIDv1 base32-lower: "b" multibase prefix + base32 payload.
  if (value.startsWith("b") && value.length >= 10 && isBase32Lower(value.slice(1))) {
    return { version: 1, encoding: "base32" };
  }
  // CIDv1 base58btc: "z" multibase prefix + base58 payload.
  if (value.startsWith("z") && value.length >= 10 && isBase58(value.slice(1))) {
    return { version: 1, encoding: "base58btc" };
  }
  return null;
}

export function isValidCid(value) {
  return parseCid(value) !== null;
}

/** Validate or throw a TypeError naming the offending value. */
export function assertValidCid(value) {
  const parsed = parseCid(value);
  if (!parsed) throw new TypeError(`invalid CID: ${JSON.stringify(value)}`);
  return parsed;
}
