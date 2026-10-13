import { env } from "cloudflare:workers";
import { createHash, randomBytes } from "node:crypto";
import type { Account } from "./auth-types";
import { LedgerError } from "./ledger";

export const SESSION_COOKIE = "kas_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function database(): D1Database {
  if (!env.DB) throw new LedgerError("Database belum tersedia. Periksa konfigurasi D1.", 503);
  return env.DB;
}

export function sessionToken(headers: Headers): string | null {
  const cookie = headers.get("cookie") || "";
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function getAccount(headers: Headers): Promise<Account | null> {
  const token = sessionToken(headers);
  if (!token) return null;
  return database().prepare(`SELECT u.id, u.name, u.email FROM kas_sessions s
    JOIN kas_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(digest(token), Date.now()).first<Account>();
}

export async function requireAccount(headers: Headers): Promise<Account> {
  const user = await getAccount(headers);
  if (!user) throw new LedgerError("Silakan login untuk membuka buku kas.", 401);
  return user;
}

export function newSession(userId: string, db: D1Database) {
  const token = randomBytes(32).toString("hex");
  const statement = db.prepare("INSERT INTO kas_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(digest(token), userId, Date.now() + SESSION_SECONDS * 1000, new Date().toISOString());
  return { token, statement };
}

export function sessionCookie(request: Request, token: string | null) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure}`;
}

export function emailInput(value: unknown) {
  if (typeof value !== "string") throw new LedgerError("Email wajib diisi.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new LedgerError("Masukkan alamat email yang valid.");
  }
  return email;
}

export function passwordInput(value: unknown, register = false) {
  if (typeof value !== "string" || value.length < (register ? 12 : 1) || value.length > 128) {
    throw new LedgerError(register ? "Kata sandi harus berisi 12–128 karakter." : "Email atau kata sandi salah.", register ? 400 : 401);
  }
  // Passwords are used exactly as supplied; spaces and Unicode are preserved.
  return value;
}

export async function rateLimit(db: D1Database, key: string, limit: number, seconds: number) {
  const now = Date.now();
  const row = await db.prepare(`INSERT INTO kas_auth_limits (key, attempts, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    RETURNING attempts, reset_at`).bind(digest(key), now + seconds * 1000, now, now)
    .first<{ attempts: number; reset_at: number }>();
  if (!row || row.attempts > limit) throw new LedgerError("Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.", 429);
}

export function clientIp(request: Request) {
  // CF-Connecting-IP is supplied by Cloudflare; arbitrary forwarded headers are ignored.
  return request.headers.get("cf-connecting-ip") || "local";
}

export async function cleanExpired(db: D1Database) {
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM kas_sessions WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM kas_auth_limits WHERE reset_at <= ?").bind(now),
  ]);
}
