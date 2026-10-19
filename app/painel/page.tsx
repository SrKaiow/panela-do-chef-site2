import { redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import Painel from "@/components/Painel";
import "./painel.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos | Painel Panela do Chef", robots: { index: false } };

export default function PaginaPainel() {
  if (!logado("painel")) redirect("/painel/entrar");
  return <Painel />;
}
