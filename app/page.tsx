import KasApp from "../components/kas-app";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccount } from "../lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getAccount(new Headers(await headers()));
  if (!user) redirect("/login");
  return <KasApp user={user} />;
}
