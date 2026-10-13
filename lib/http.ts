import { LedgerError } from "./ledger";

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const result = new Headers(headers);
  result.set("Cache-Control", "private, no-store");
  result.set("Vary", "Cookie");
  result.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { status, headers: result });
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    throw new LedgerError("Permintaan dari situs lain ditolak.", 403);
  }
}

export async function readJson(request: Request, maxBytes = 8192): Promise<Record<string, unknown>> {
  checkOrigin(request);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new LedgerError("Format permintaan harus JSON.", 415);
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new LedgerError("Data permintaan terlalu besar.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new LedgerError("Data permintaan wajib diisi.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new LedgerError("Data permintaan terlalu besar.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let input: unknown;
  try { input = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new LedgerError("Data JSON tidak valid."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LedgerError("Data permintaan tidak valid.");
  }
  return input as Record<string, unknown>;
}

export function failure(error: unknown) {
  if (error instanceof LedgerError) return json({ error: error.message }, error.status);
  // Do not log request bodies, passwords, session tokens, or database queries.
  console.error("Kas API failed:", error instanceof Error ? error.name : "unknown");
  return json({ error: "Layanan belum tersedia. Periksa koneksi dan migrasi database, lalu coba lagi." }, 503);
}
