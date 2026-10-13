import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthForm from "../../components/auth-form";
import { getAccount } from "../../lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Login | Kas OSIS EPIS-JH" };
export default async function Login() {
  if (await getAccount(new Headers(await headers()))) redirect("/");
  return <AuthForm mode="login"/>;
}
