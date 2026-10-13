import { database, digest, sessionCookie, sessionToken } from "../../../../lib/auth";
import { failure, json, readJson } from "../../../../lib/http";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await readJson(request);
    const token = sessionToken(request.headers);
    if (token) await database().prepare("DELETE FROM kas_sessions WHERE token_hash = ?").bind(digest(token)).run();
    return json({ message: "Anda sudah keluar." }, 200, { "Set-Cookie": sessionCookie(request, null) });
  } catch (error) { return failure(error); }
}
