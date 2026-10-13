import { database, requireAccount } from "../../../lib/auth";
import { applyAction, initialLedger, LedgerError } from "../../../lib/ledger";
import type { Ledger } from "../../../lib/ledger";
import { failure, json, readJson } from "../../../lib/http";
export const dynamic = "force-dynamic";

type StoredLedger = { id: string; owner_user_id: string; payload: string; revision: number; updated_at: string };
async function current(request: Request) {
  const user = await requireAccount(request.headers), db = database();
  // Ownership comes exclusively from the verified session, never the request body.
  const ledgerId = "account:" + user.id;
  const load = () => db.prepare("SELECT * FROM kas_ledgers WHERE id = ? AND owner_user_id = ?")
    .bind(ledgerId, user.id).first<StoredLedger>();
  let row = await load();
  if (!row) {
    const state = initialLedger();
    state.settings.treasurer = user.name;
    await db.prepare("INSERT OR IGNORE INTO kas_ledgers (id, owner_user_id, payload, revision, updated_at) VALUES (?, ?, ?, 0, ?)")
      .bind(ledgerId, user.id, JSON.stringify(state), new Date().toISOString()).run();
    row = await load();
  }
  if (!row) throw new LedgerError("Buku kas belum dapat dibuka.", 503);
  return { row, db, user, state: JSON.parse(row.payload) as Ledger };
}

export async function GET(request: Request) {
  try {
    const { state, row } = await current(request);
    return json({ state, revision: row.revision, updatedAt: row.updated_at });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const input = await readJson(request, 2_000_000);
    if (typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{10,100}$/.test(input.requestId) ||
        !Number.isSafeInteger(input.revision) || (input.revision as number) < 0 || typeof input.action !== "string" ||
        !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new LedgerError("Identitas atau isi penyimpanan tidak valid.");
    }
    const { state, row, db, user } = await current(request);
    if (state.appliedRequests.includes(input.requestId)) {
      return json({ state, revision: row.revision, updatedAt: row.updated_at, message: "Perubahan sudah tersimpan." });
    }
    if (row.revision !== input.revision) {
      return json({ error: "Data berubah di perangkat lain. Data terbaru sudah dimuat. Periksa isian, lalu simpan kembali.", state, revision: row.revision, updatedAt: row.updated_at }, 409);
    }
    const result = applyAction(state, input.action, input.payload, input.requestId, user.name);
    const updatedAt = new Date().toISOString();
    const write = await db.prepare("UPDATE kas_ledgers SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_user_id = ? AND revision = ?")
      .bind(JSON.stringify(result.state), updatedAt, row.id, user.id, row.revision).run();
    if (write.meta.changes !== 1) throw new LedgerError("Data berubah saat disimpan. Muat ulang, lalu coba kembali.", 409);
    return json({ state: result.state, revision: row.revision + 1, updatedAt, message: result.message });
  } catch (error) { return failure(error); }
}
