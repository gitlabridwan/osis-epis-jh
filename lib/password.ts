import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

// OWASP's scrypt configuration with a 16 MiB working set fits Workers memory.
const COST = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 64, COST, (error, result) => {
      if (error) reject(error); else resolve(result);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt}$${hash.toString("hex")}`;
}

// Perform the same expensive operation for an email that is not registered.
export const DUMMY_HASH = `scrypt$16384$8$5$${"0".repeat(32)}$${"0".repeat(128)}`;
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" ||
      parts[2] !== "8" || parts[3] !== "5" || !/^[a-f0-9]{32}$/.test(parts[4]) ||
      !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const derived = await derive(password, parts[4]);
  return timingSafeEqual(derived, Buffer.from(parts[5], "hex"));
}
