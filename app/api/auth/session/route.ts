import { requireAccount } from "../../../../lib/auth";
import { failure, json } from "../../../../lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return json({ user: await requireAccount(request.headers) }); }
  catch (error) { return failure(error); }
}
