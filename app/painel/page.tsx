import { redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import Admin from "@/components/painel/Admin";
import "./painel.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel | Panela do Chef", robots: { index: false } };

export default async function PaginaPainel() {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  return <Admin />;
}
