import { clientIp, cleanExpired, database, emailInput, newSession, passwordInput, rateLimit, sessionCookie, sessionToken, digest } from "../../../../lib/auth";
import { hashPassword } from "../../../../lib/password";
import { LedgerError } from "../../../../lib/ledger";
import { failure, json, readJson } from "../../../../lib/http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await readJson(request);
    const email = emailInput(input.email), password = passwordInput(input.password, true);
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
      throw new LedgerError("Nama wajib diisi dan maksimal 80 karakter.");
    }
    if (input.confirmPassword !== password) throw new LedgerError("Konfirmasi kata sandi tidak sama.");
    const db = database();
    await cleanExpired(db);
    await rateLimit(db, "register:" + clientIp(request), 8, 3600);
    const duplicate = () => db.prepare("SELECT id FROM kas_users WHERE email = ?").bind(email).first();
    if (await duplicate()) throw new LedgerError("Email sudah terdaftar. Silakan login.", 409);
    const user = { id: crypto.randomUUID(), name: input.name.trim(), email };
    const passwordHash = await hashPassword(password), session = newSession(user.id, db);
    const oldToken = sessionToken(request.headers);
    try {
      // Account creation and its initial session succeed or fail together.
      await db.batch([
        db.prepare("INSERT INTO kas_users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(user.id, user.name, email, passwordHash, new Date().toISOString()),
        session.statement,
        ...(oldToken ? [db.prepare("DELETE FROM kas_sessions WHERE token_hash = ?").bind(digest(oldToken))] : []),
      ]);
    } catch (error) {
      if (await duplicate()) throw new LedgerError("Email sudah terdaftar. Silakan login.", 409);
      throw error;
    }
    return json({ user, message: "Akun berhasil dibuat. Anda sudah login." }, 201, { "Set-Cookie": sessionCookie(request, session.token) });
  } catch (error) { return failure(error); }
}
