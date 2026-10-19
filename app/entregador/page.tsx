import { redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import Entregador from "@/components/Entregador";
import "../painel/painel.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entregas | Panela do Chef", robots: { index: false } };

export default function PaginaEntregador() {
  if (!logado("entregador")) redirect("/entregador/entrar");
  return <Entregador />;
}
