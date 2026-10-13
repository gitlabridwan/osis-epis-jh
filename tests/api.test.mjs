import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { initialLedger, today } from "../.sites-runtime/test-build/ledger.mjs";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"));
}
const db = {
  prepare(sql) {
    let values = [];
    return { bind(...v) { values = v; return this; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; }
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  }
};
globalThis.__kasTestEnv = { DB: db };
const ledger = await import("../.sites-runtime/test-build/api.mjs");
const register = await import("../.sites-runtime/test-build/auth-register.mjs");
const login = await import("../.sites-runtime/test-build/auth-login.mjs");
const logout = await import("../.sites-runtime/test-build/auth-logout.mjs");
const session = await import("../.sites-runtime/test-build/auth-session.mjs");
const BASE = "https://kas.example";
const password = "KasOsis-2026!aman";
const request = (path, input, cookie, extra = {}) => new Request(BASE + path, {
  method: input === undefined ? "GET" : "POST", headers: { ...(input === undefined ? {} : { "Content-Type": "application/json", Origin: BASE }), ...(cookie ? { Cookie: cookie } : {}), ...extra },
  ...(input === undefined ? {} : { body: JSON.stringify(input) })
});
const cookieOf = response => response.headers.get("set-cookie")?.split(";")[0];
async function createAccount(email = "bendahara@example.test", name = "Bendahara A") {
  const response = await register.POST(request("/api/auth/register", { name, email, password, confirmPassword: password }));
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  return { cookie: cookieOf(response), ...(await response.json()), response };
}
const read = cookie => ledger.GET(request("/api/ledger", undefined, cookie));
const post = (cookie, revision, action, payload, requestId = crypto.randomUUID(), extra = {}) => ledger.POST(request("/api/ledger", { revision, action, payload, requestId }, cookie, extra));
beforeEach(() => {
  sqlite.exec("DELETE FROM kas_sessions; DELETE FROM kas_users; DELETE FROM kas_ledgers; DELETE FROM kas_auth_limits;");
  globalThis.__kasTestEnv.DB = db;
});

test("Register, login, sesi, dan logout bekerja tanpa akun ChatGPT", async () => {
  assert.equal((await read()).status, 401);
  const account = await createAccount(" BENDAHARA@EXAMPLE.TEST ");
  assert.equal(account.user.email, "bendahara@example.test");
  assert.ok(!("password_hash" in account.user));
  const stored = sqlite.prepare("SELECT password_hash FROM kas_users").get().password_hash;
  assert.match(stored, /^scrypt\$16384\$8\$5\$/); assert.ok(!stored.includes(password));
  const header = account.response.headers.get("set-cookie");
  for (const flag of ["HttpOnly", "SameSite=Lax", "Secure", "Max-Age=604800"]) assert.ok(header.includes(flag));
  const token = account.cookie.split("=")[1];
  assert.notEqual(sqlite.prepare("SELECT token_hash FROM kas_sessions").get().token_hash, token);
  assert.equal((await session.GET(request("/api/auth/session", undefined, account.cookie))).status, 200);
  let response = await logout.POST(request("/api/auth/logout", {}, account.cookie));
  assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await read(account.cookie)).status, 401);
  response = await login.POST(request("/api/auth/login", { email: account.user.email, password }));
  assert.equal(response.status, 200);
  assert.notEqual(cookieOf(response), account.cookie);
  assert.equal((await read(cookieOf(response))).status, 200);
});

test("Validasi register, email ganda, kata sandi salah, dan JSON rusak", async () => {
  const valid = { name: "Pengelola", email: "test@example.test", password, confirmPassword: password };
  for (const input of [{ ...valid, name: " " }, { ...valid, email: "salah" }, { ...valid, password: "pendek" }, { ...valid, confirmPassword: "tidak-sama" }, null, []]) {
    assert.equal((await register.POST(request("/api/auth/register", input))).status, 400);
  }
  await createAccount(valid.email);
  assert.equal((await register.POST(request("/api/auth/register", { ...valid, email: "TEST@EXAMPLE.TEST" }))).status, 409);
  const wrong = await login.POST(request("/api/auth/login", { email: valid.email, password: "kata-sandi-salah" }));
  const unknown = await login.POST(request("/api/auth/login", { email: "unknown@example.test", password: "kata-sandi-salah" }));
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  const broken = new Request(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await login.POST(broken)).status, 400);
});

test("Login menolak token palsu, sesi kedaluwarsa, dan permintaan lintas situs", async () => {
  const a = await createAccount();
  assert.equal((await read("kas_session=" + "f".repeat(64))).status, 401);
  assert.equal((await read("kas_session=rusak")).status, 401);
  assert.equal((await post(a.cookie, 0, "settings", {}, undefined, { Origin: "https://other.example" })).status, 403);
  assert.equal((await logout.POST(request("/api/auth/logout", {}, a.cookie, { Origin: "https://other.example" }))).status, 403);
  assert.equal((await login.POST(request("/api/auth/login", { email: a.user.email, password }, undefined, { "Sec-Fetch-Site": "cross-site" }))).status, 403);
  assert.equal((await register.POST(request("/api/auth/register", { name: "A", email: "other@example.test", password, confirmPassword: password }, undefined, { Origin: "https://other.example" }))).status, 403);
  sqlite.prepare("UPDATE kas_sessions SET expires_at = ?").run(Date.now() - 1);
  assert.equal((await read(a.cookie)).status, 401);
});

test("Buku kas terpisah antar akun dan buku kas lama tidak diberikan ke pendaftar", async () => {
  const legacy = initialLedger(); legacy.settings.orgName = "Buku kas lama pemilik";
  sqlite.prepare("INSERT INTO kas_ledgers VALUES (?, ?, ?, ?, ?)").run("main", "old-chatgpt-owner", JSON.stringify(legacy), 9, new Date().toISOString());
  const a = await createAccount(), b = await createAccount("second@example.test", "Pengelola B");
  let response = await read(a.cookie), data = await response.json();
  assert.equal(data.state.settings.treasurer, a.user.name); assert.equal(data.revision, 0);
  response = await post(a.cookie, 0, "saveTransaction", { kind: "dues", memberId: "m-qai", amount: 10000, date: today(), title: "Kas A", method: "Tunai" });
  const saved = await response.json(); assert.equal(response.status, 200);
  data = await (await read(b.cookie)).json(); assert.equal(data.state.transactions.length, 0);
  assert.equal((await post(b.cookie, 0, "saveTransaction", { ...saved.state.transactions[0], correctionReason: "Menebak ID akun A" })).status, 404);
  assert.equal((await post(b.cookie, 0, "deleteTransaction", { id: saved.state.transactions[0].id, reason: "Menebak ID akun A" })).status, 400);
  assert.equal(saved.state.audit.at(-1).actor, a.user.name);
  assert.equal(sqlite.prepare("SELECT revision FROM kas_ledgers WHERE id = 'main'").get().revision, 9);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM kas_ledgers").get().n, 3);
  assert.equal((await (await read(a.cookie)).json()).state.transactions.length, 1);
});

test("Revisi atomik, idempotensi, dan proteksi saldo tetap berlaku pada CRUD", async () => {
  const { cookie } = await createAccount(); let data = await (await read(cookie)).json();
  let response = await post(cookie, 0, "settings", { ...data.state.settings, openingCashConfirmed: true });
  assert.equal(response.status, 200);
  const payment = { kind: "dues", memberId: "m-qai", amount: 10000, date: today(), title: "Pembayaran kas", method: "Tunai" };
  const concurrent = await Promise.all([post(cookie, 1, "saveTransaction", payment), post(cookie, 1, "saveTransaction", payment)]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  data = await (await read(cookie)).json(); assert.equal(data.state.transactions.length, 1); assert.equal(data.revision, 2);
  const requestId = crypto.randomUUID(); response = await post(cookie, 2, "saveTransaction", payment, requestId); assert.equal(response.status, 200);
  response = await post(cookie, 2, "saveTransaction", payment, requestId); data = await response.json(); assert.equal(data.state.transactions.length, 2); assert.equal(data.revision, 3);
  response = await post(cookie, 1, "settings", data.state.settings); assert.equal(response.status, 409); assert.equal((await response.json()).revision, 3);
  assert.equal((await post(cookie, 3, "saveTransaction", { ...payment, amount: -1 })).status, 400);
  assert.equal((await post(cookie, 3, "saveTransaction", { kind: "expense", amount: 25000, date: today(), title: "Peralatan", category: "Perlengkapan", method: "Tunai" })).status, 400);
  const edit = { ...data.state.transactions[0], amount: 15000, correctionReason: "Koreksi bukti" };
  response = await post(cookie, 3, "saveTransaction", edit); assert.equal(response.status, 200); data = await response.json();
  assert.equal(data.state.transactions.length, 2); assert.equal(data.revision, 4);
  response = await post(cookie, 4, "deleteTransaction", { id: edit.id, reason: "Transaksi ganda" }); assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("Pembatasan percobaan login memakai penghitung database", async () => {
  const a = await createAccount();
  for (let i = 0; i < 10; i++) assert.equal((await login.POST(request("/api/auth/login", { email: a.user.email, password: "kata-sandi-salah" }))).status, 401);
  assert.equal((await login.POST(request("/api/auth/login", { email: a.user.email, password }))).status, 429);
  sqlite.prepare("UPDATE kas_auth_limits SET reset_at = ?").run(Date.now() - 1);
  assert.equal((await login.POST(request("/api/auth/login", { email: a.user.email, password }))).status, 200);
});

test("Format, ukuran input, dan database yang tidak tersedia ditangani", async () => {
  const badType = new Request(BASE + "/api/auth/login", { method: "POST", body: "{}" });
  assert.equal((await login.POST(badType)).status, 415);
  assert.equal((await register.POST(request("/api/auth/register", { filler: "x".repeat(9000) }))).status, 413);
  const malformed = await ledger.POST(request("/api/ledger", { revision: 0, requestId: crypto.randomUUID(), action: "settings", payload: null }));
  assert.equal(malformed.status, 400);
  globalThis.__kasTestEnv.DB = undefined;
  const response = await login.POST(request("/api/auth/login", { email: "a@example.test", password }));
  assert.equal(response.status, 503);
});
