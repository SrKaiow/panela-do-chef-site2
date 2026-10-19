import { redirect } from "next/navigation";
import { logado, senhaDefinida } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entregador | Panela do Chef", robots: { index: false } };

export default function EntrarEntregador({ searchParams }: { searchParams: { erro?: string } }) {
  if (logado("entregador")) redirect("/entregador");
  const semSenha = !senhaDefinida("entregador");
  return (
    <main className="miolo" style={{ maxWidth: 420, paddingBlock: "12vh 40px", display: "grid", gap: 18 }}>
      <h1 className="marca" style={{ color: "var(--ouro)", fontSize: "2.2rem" }}>
        Entregas<small style={{ color: "var(--texto-2)" }}>Panela do Chef</small>
      </h1>
      {semSenha && <p className="erro">Defina DRIVER_PASSWORD nas variáveis de ambiente para usar a tela do entregador.</p>}
      <form method="post" action="/api/entrar" style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="area" value="entregador" />
        <label className="campo" htmlFor="senha">Senha do entregador
          <input id="senha" name="senha" type="password" required autoFocus autoComplete="current-password" />
        </label>
        {searchParams.erro && <p className="erro" role="alert">Senha incorreta. Tente de novo.</p>}
        <button className="principal" type="submit" disabled={semSenha}><span>Entrar</span><span>→</span></button>
      </form>
    </main>
  );
}
