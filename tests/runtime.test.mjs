import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { build } = require(require.resolve("esbuild", { paths: [require.resolve("vite")] }));
const { Miniflare } = require(require.resolve("miniflare", { paths: [require.resolve("wrangler")] }));

test("Cloudflare Workers/D1: register, login, CRUD dan logout dengan runtime asli", { timeout: 45000 }, async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = await build({ stdin: { contents: `
    import * as register from './app/api/auth/register/route.ts';
    import * as login from './app/api/auth/login/route.ts';
    import * as logout from './app/api/auth/logout/route.ts';
    import * as ledger from './app/api/ledger/route.ts';
    const routes = { '/api/auth/register': register, '/api/auth/login': login, '/api/auth/logout': logout, '/api/ledger': ledger };
    export default { async fetch(request) { const route=routes[new URL(request.url).pathname]; return route?.[request.method] ? route[request.method](request) : new Response('Not found', {status:404}); } };
  `, resolveDir: root, sourcefile: "runtime-test-worker.ts" }, bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", external: ["cloudflare:workers", "node:*"], logLevel: "silent" });
  const mf = new Miniflare({ modules: true, script: output.outputFiles[0].text, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "kas-runtime-test" } });
  try {
    const db = await mf.getD1Database("DB");
    for (const name of (await readdir(new URL("../drizzle/", import.meta.url))).filter(name => name.endsWith(".sql")).sort()) {
      const sql = await readFile(new URL("../drizzle/" + name, import.meta.url), "utf8");
      const statements = sql.replace(/-->[^\n]*/g, "").split(";").map(s => s.trim()).filter(Boolean);
      await db.batch(statements.map(sql => db.prepare(sql)));
    }
    const base = "https://kas.example", password = "KasOsis-2026!aman";
    const send = (path, body, cookie) => mf.dispatchFetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: base }), ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await send("/api/ledger")).status, 401);
    let response = await send("/api/auth/register", { name: "Bendahara", email: "runtime@example.test", password, confirmPassword: password });
    assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    const initialCookie = response.headers.get("set-cookie").split(";")[0];
    response = await send("/api/auth/logout", {}, initialCookie); assert.equal(response.status, 200);
    assert.equal((await send("/api/ledger", undefined, initialCookie)).status, 401);
    response = await send("/api/auth/login", { email: "runtime@example.test", password });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const cookie = response.headers.get("set-cookie").split(";")[0];
    let data = await (await send("/api/ledger", undefined, cookie)).json();
    assert.equal(data.state.members.length, 12);
    const save = async (action, payload) => {
      const result = await send("/api/ledger", { action, payload, revision: data.revision, requestId: crypto.randomUUID() }, cookie);
      assert.equal(result.status, 200, JSON.stringify(await result.clone().json())); data = await result.json();
    };
    await save("saveTransaction", { kind: "income", amount: 10000, date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date()), title: "Donasi", category: "Donasi", method: "Tunai" });
    const transaction = data.state.transactions[0];
    await save("saveTransaction", { ...transaction, amount: 15000, correctionReason: "Koreksi bukti" });
    assert.equal(data.state.transactions.length, 1); assert.equal(data.state.transactions[0].amount, 15000);
    await save("deleteTransaction", { id: transaction.id, reason: "Transaksi ganda" });
    assert.ok(data.state.transactions[0].voidedAt);
    await save("saveBill", { memberId: "m-raffa", period: "2026-11", amount: 10000 });
    await save("saveBill", { ...data.state.bills[0], amount: 5000, correctionReason: "Koreksi tarif" });
    assert.equal(data.state.bills.length, 1); assert.equal(data.state.bills[0].amount, 5000);
    response = await send("/api/auth/logout", {}, cookie); assert.equal(response.status, 200);
    assert.equal((await send("/api/ledger", undefined, cookie)).status, 401);
  } finally { await mf.dispose(); }
});
