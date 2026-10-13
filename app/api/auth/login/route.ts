import { clientIp, cleanExpired, database, digest, emailInput, newSession, passwordInput, rateLimit, sessionCookie, sessionToken } from "../../../../lib/auth";
import { DUMMY_HASH, verifyPassword } from "../../../../lib/password";
import { LedgerError } from "../../../../lib/ledger";
import { failure, json, readJson } from "../../../../lib/http";
import type { Account } from "../../../../lib/auth-types";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await readJson(request);
    const email = emailInput(input.email), password = passwordInput(input.password);
    const db = database();
    await cleanExpired(db);
    await rateLimit(db, "login-ip:" + clientIp(request), 30, 600);
    await rateLimit(db, "login-email:" + email, 10, 600);
    const row = await db.prepare("SELECT id, name, email, password_hash FROM kas_users WHERE email = ?")
      .bind(email).first<Account & { password_hash: string }>();
    const correct = await verifyPassword(password, row?.password_hash || DUMMY_HASH);
    if (!row || !correct) throw new LedgerError("Email atau kata sandi salah.", 401);
    const user = { id: row.id, name: row.name, email: row.email };
    const session = newSession(user.id, db), oldToken = sessionToken(request.headers);
    await db.batch([
      session.statement,
      ...(oldToken ? [db.prepare("DELETE FROM kas_sessions WHERE token_hash = ?").bind(digest(oldToken))] : []),
    ]);
    return json({ user, message: "Berhasil login." }, 200, { "Set-Cookie": sessionCookie(request, session.token) });
  } catch (error) { return failure(error); }
}
