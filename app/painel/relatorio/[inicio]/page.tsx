import { redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import { relatorioSemana, segundaDe } from "@/lib/db";
import BotaoImprimir from "./BotaoImprimir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório semanal · Panela do Chef", robots: { index: false } };

const gbp = (p: number) => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toFixed(2);
const dataBR = (d: string) => d.split("-").reverse().join("/");
const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Relatório da semana em A4, para imprimir ou salvar em PDF (e mandar no grupo). */
export default async function RelatorioImpressao(props: { params: Promise<{ inicio: string }> }) {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  const { inicio } = await props.params;
  const rel = await relatorioSemana(segundaDe(inicio));
  const t = rel.totais;
  const cats = [...new Set(rel.gastos.map((g) => g.categoria))].map((c) => ({ c, v: rel.gastos.filter((g) => g.categoria === c).reduce((s, g) => s + g.valor, 0) }));
  const gerado = new Date().toLocaleString("pt-BR", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" });

  return (
    <main className="rp">
      <style>{CSS}</style>
      <BotaoImprimir />
      <header className="rp-cab">
        <img src="/fotos/logo-cartao-cor.png" alt="Panela do Chef" className="rp-logo" />
        <div>
          <h1>Relatório semanal</h1>
          <p>{dataBR(rel.inicio)} a {dataBR(rel.fim)}</p>
        </div>
      </header>
      <div className="rp-faixa" />

      <section className="rp-kpis">
        <div><span>Entrou</span><strong className="verde">{gbp(t.entrou)}</strong></div>
        <div><span>Gastos</span><strong className="vermelho">{gbp(t.gastos)}</strong></div>
        <div className={"destaque " + (t.resultado >= 0 ? "pos" : "neg")}><span>Resultado</span><strong>{gbp(t.resultado)}</strong></div>
        <div><span>Pedidos</span><strong>{t.pedidos}</strong><small>ticket médio {gbp(t.ticketMedio)}</small></div>
      </section>

      <h2>Entradas por dia</h2>
      <table>
        <thead><tr><th>Dia</th><th>Pedidos</th><th>Cartão</th><th>Dinheiro</th><th>Na conta</th><th>Total</th></tr></thead>
        <tbody>
          {rel.dias.map((d, i) => (
            <tr key={d.data}><td><strong>{NOMES[i]}</strong> {dataBR(d.data).slice(0, 5)}</td><td>{d.pedidos}</td><td>{gbp(d.cartao)}</td><td>{gbp(d.dinheiro)}</td><td>{d.naConta ? gbp(d.naConta) : "—"}</td><td><strong>{gbp(d.total)}</strong></td></tr>
          ))}
        </tbody>
        <tfoot><tr><td>Semana</td><td>{t.pedidos}</td><td>{gbp(t.cartao)}</td><td>{gbp(t.dinheiro)}</td><td>{t.naConta ? gbp(t.naConta) : "—"}</td><td>{gbp(t.vendas)}</td></tr></tfoot>
      </table>
      <p className="rp-nota">
        Entrou = cartão + dinheiro{rel.recebidoContas ? ` + ${gbp(rel.recebidoContas)} recebidos de clientes a pagar` : ""}.
        {t.naConta ? ` "Na conta" (${gbp(t.naConta)}) ainda não foi pago.` : ""} Taxas de entrega incluídas: {gbp(t.taxas)}.
      </p>

      <h2>Gastos</h2>
      {rel.gastos.length === 0 ? <p className="rp-nota">Nenhum gasto lançado nesta semana.</p> : (
        <>
          <table className="rp-gastos">
            <thead><tr><th>Data</th><th>Tipo</th><th>Onde / o quê</th><th>Valor</th></tr></thead>
            <tbody>{rel.gastos.map((g) => <tr key={g.id}><td>{dataBR(g.data).slice(0, 5)}</td><td>{g.categoria}</td><td>{g.descricao || "—"}</td><td className="vermelho">{gbp(g.valor)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>Total de gastos</td><td>{gbp(t.gastos)}</td></tr></tfoot>
          </table>
          <p className="rp-nota">{cats.map((x) => `${x.c}: ${gbp(x.v)}`).join(" · ")}</p>
        </>
      )}

      <section className="rp-final">
        <div><span>Entrou</span><strong>{gbp(t.entrou)}</strong></div>
        <div><span>− Gastos</span><strong>{gbp(t.gastos)}</strong></div>
        <div className={t.resultado >= 0 ? "pos" : "neg"}><span>= Resultado</span><strong>{gbp(t.resultado)}</strong></div>
      </section>
      <footer>Panela do Chef · paneladochef.co.uk · gerado em {gerado}</footer>
    </main>
  );
}

const CSS = `
@page { size: A4; margin: 14mm; }
body { background: #fff !important; color: #1c1c1c; }
.rp { max-width: 820px; margin: 0 auto; padding: 24px 18px 40px; font-family: var(--f-figtree), system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rp-botao { display: block; margin: 0 0 18px auto; padding: 12px 18px; border: 0; border-radius: 12px; background: #ffd814; color: #111; font-weight: 800; font-size: 15px; cursor: pointer; }
.rp-cab { display: flex; align-items: center; gap: 18px; }
.rp-logo { width: 150px; height: auto; }
.rp-cab h1 { margin: 0; font-family: var(--f-anton), Impact, sans-serif; font-weight: 400; font-size: 40px; text-transform: uppercase; letter-spacing: 1px; color: #0b8a45; }
.rp-cab p { margin: 2px 0 0; font-size: 18px; font-weight: 700; color: #444; }
.rp-faixa { height: 8px; margin: 14px 0 20px; border-radius: 4px; background: linear-gradient(90deg, #0b8a45 0 33%, #ffd814 33% 66%, #1e3f9e 66%); }
.rp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
.rp-kpis div { border: 1.5px solid #e3e3e3; border-radius: 12px; padding: 12px; display: grid; gap: 2px; }
.rp-kpis span { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #666; }
.rp-kpis strong { font-size: 24px; }
.rp-kpis small { font-size: 11px; color: #666; }
.rp-kpis .destaque { border: 0; color: #fff; }
.rp-kpis .destaque span { color: rgba(255,255,255,.85); }
.rp-kpis .destaque.pos { background: #0b8a45; }
.rp-kpis .destaque.neg { background: #b4231b; }
.verde { color: #0b8a45; } .vermelho { color: #b4231b; }
h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin: 18px 0 8px; color: #0b8a45; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #555; background: #fff8d1; padding: 7px 8px; }
td { padding: 7px 8px; border-bottom: 1px solid #eee; }
th:not(:first-child), td:not(:first-child) { text-align: right; }
tfoot td { font-weight: 800; border-top: 2px solid #1c1c1c; border-bottom: 0; }
.rp-gastos th:not(:last-child), .rp-gastos td:not(:last-child) { text-align: left; }
.rp-nota { font-size: 12px; color: #555; margin: 6px 0 0; }
.rp-final { margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid #1c1c1c; border-radius: 12px; overflow: hidden; }
.rp-final div { padding: 12px 14px; display: grid; gap: 2px; }
.rp-final div + div { border-left: 1px solid #ddd; }
.rp-final span { font-size: 12px; font-weight: 700; color: #555; }
.rp-final strong { font-size: 22px; }
.rp-final .pos { background: #e9f7ef; color: #0b6b37; } .rp-final .neg { background: #fdecea; color: #b4231b; }
footer { margin-top: 22px; font-size: 11px; color: #888; text-align: center; }
@media (max-width: 640px) { .rp-kpis { grid-template-columns: 1fr 1fr; } .rp-cab h1 { font-size: 30px; } .rp-logo { width: 110px; } }
@media print { .rp-botao { display: none; } .rp { padding: 0; } }
`;
