import { redirect } from "next/navigation";
import { logado, senhaDefinida } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Painel Panela do Chef", robots: { index: false } };

export default function Entrar({ searchParams }: { searchParams: { erro?: string } }) {
  if (logado("painel")) redirect("/painel");
  const semSenha = !senhaDefinida("painel");
  return (
    <main className="miolo" style={{ maxWidth: 420, paddingBlock: "12vh 40px", display: "grid", gap: 18 }}>
      <h1 className="marca" style={{ color: "var(--ouro)", fontSize: "2.2rem" }}>
        Painel<small style={{ color: "var(--texto-2)" }}>Panela do Chef</small>
      </h1>
      {semSenha && <p className="erro">Defina ADMIN_PASSWORD nas variáveis de ambiente para usar o painel.</p>}
      <form method="post" action="/api/entrar" style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="area" value="painel" />
        <label className="campo" htmlFor="senha">Senha
          <input id="senha" name="senha" type="password" required autoFocus autoComplete="current-password" />
        </label>
        {searchParams.erro && <p className="erro" role="alert">Senha incorreta. Tente de novo.</p>}
        <button className="principal" type="submit" disabled={semSenha}><span>Entrar</span><span>→</span></button>
      </form>
    </main>
  );
}
