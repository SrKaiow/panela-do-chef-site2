import { notFound, redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import { listarContas } from "@/lib/db";
import { getAjustes } from "@/lib/dados";
import { telefoneBonito } from "@/lib/ajustes";
import { DADOS_BANCARIOS, emAberto, numeroFatura } from "@/lib/contas";
import { linkWhatsapp } from "@/lib/whatsapp";
import BotoesFatura from "./BotoesFatura";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fatura · Panela do Chef", robots: { index: false } };

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const dataBR = (d: string) => d.split("-").reverse().join("/");

/** Fatura do cliente a pagar, em A4: vira PDF no celular e vai direto no WhatsApp. */
export default async function Fatura(props: { params: Promise<{ id: string }> }) {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  const { id } = await props.params;
  const c = (await listarContas()).find((x) => x.id === Number(id));
  if (!c) notFound();
  const loja = await getAjustes();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const numero = numeroFatura(c, hoje);
  const itens = emAberto(c);
  const somaItens = itens.reduce((s, l) => s + l.valor, 0);
  const jaPago = Math.max(0, somaItens - c.saldo);
  const primeiroNome = c.nome.trim().split(/\s+/)[0];
  const mensagem = `Oi, ${primeiroNome}! Aqui é da *Panela do Chef*. Segue a sua fatura ${numero}: *total ${gbp(c.saldo)}*. Os dados para transferência estão no PDF. Obrigado pela preferência!`;

  return (
    <main className="fat">
      <style>{CSS}</style>
      <BotoesFatura arquivo={`Fatura ${numero} - ${c.nome}.pdf`} mensagem={mensagem} linkZap={c.telefone ? linkWhatsapp(c.telefone, mensagem) : null} />

      <div className="fat-folha">
        <div className="fat-faixa" />
        <header className="fat-cab">
          <div>
            <img src="/fotos/logo-cartao-cor.png" alt="Panela do Chef" className="fat-logo" />
          </div>
          <div className="fat-titulo">
            <h1>Fatura</h1>
            <span>Invoice</span>
            <dl>
              <dt>Nº</dt><dd>{numero}</dd>
              <dt>Data</dt><dd>{dataBR(hoje)}</dd>
              <dt>Vencimento</dt><dd>À vista</dd>
            </dl>
          </div>
        </header>

        <section className="fat-partes">
          <div>
            <h3>De</h3>
            <strong>PANELA DO CHEF LTD</strong>
            <span>Company No. 16939262</span>
            <span>{loja.entrega.regiao}</span>
            <span>Tel. {telefoneBonito(loja.telefone)}</span>
            <span>paneladochef.co.uk</span>
          </div>
          <div>
            <h3>Para</h3>
            <strong>{c.nome}</strong>
            {c.telefone && <span>Tel. {c.telefone}</span>}
            {c.semanal && <span>Cliente semanal</span>}
          </div>
        </section>

        <table className="fat-tabela">
          <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.id}>
                <td>{dataBR(l.data).slice(0, 5)}</td>
                <td>
                  {l.descricao || "Pedido"}
                  {l.freteRemovido > 0 && <small>Frete de {gbp(l.freteRemovido)} não cobrado (mesmo endereço)</small>}
                </td>
                <td>{gbp(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="fat-totais">
          <div><span>Subtotal</span><span>{gbp(somaItens)}</span></div>
          {jaPago > 0 && <div><span>Já recebido</span><span>−{gbp(jaPago)}</span></div>}
          <div className="fat-total"><span>Total a pagar</span><span>{gbp(c.saldo)}</span></div>
        </section>

        <section className="fat-banco">
          <h3>Dados para transferência</h3>
          <div className="fat-banco-grade">
            <div><span>Beneficiário</span><strong>{DADOS_BANCARIOS.beneficiario}</strong></div>
            <div><span>Conta</span><strong>{DADOS_BANCARIOS.conta}</strong></div>
            <div><span>Sort code</span><strong>{DADOS_BANCARIOS.sortCode}</strong></div>
            <div><span>Referência</span><strong>{numero}</strong></div>
          </div>
          <p>Também aceitamos em dinheiro na próxima entrega.</p>
        </section>

        <footer className="fat-rodape">
          <strong>Obrigado pela preferência!</strong>
          <span>Panela do Chef · @ochefkaio · paneladochef.co.uk</span>
        </footer>
      </div>
    </main>
  );
}

const CSS = `
@page { size: A4; margin: 0; }
html, body { background: #e9e7e1 !important; color: #1c1c1c; color-scheme: light only; }
body::before { display: none !important; }
.fat { padding: 16px 12px 40px; font-family: var(--f-figtree), system-ui, sans-serif; }
.fat-botoes { max-width: 794px; margin: 0 auto 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.fat-botoes button { padding: 12px 16px; border-radius: 12px; border: 0; font-weight: 800; font-size: 15px; cursor: pointer; }
.fat-zap { background: #25d366; color: #0b2e17; flex: 1 1 100%; font-size: 17px !important; padding: 16px !important; }
.fat-sec { background: #fff; color: #1c1c1c; border: 1.5px solid #ccc !important; flex: 1; }
.fat-erro { color: #b4231b; font-weight: 700; margin: 0; }
.fat-dica { font-size: 13px; color: #555; margin: 0; }
.fat-folha { position: relative; width: 794px; zoom: var(--fat-zoom, 1); min-height: 1123px; margin: 0 auto; background: #fff; padding: 46px 52px 40px; box-sizing: border-box; box-shadow: 0 6px 30px rgba(0,0,0,.18); display: flex; flex-direction: column; }
.fat-faixa { position: absolute; left: 0; right: 0; top: 0; height: 10px; background: linear-gradient(90deg, #0b8a45 0 33.3%, #ffd814 33.3% 66.6%, #1e3f9e 66.6%); }
.fat-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.fat-logo { width: 170px; height: auto; display: block; }
.fat-titulo { text-align: right; }
.fat-titulo h1 { margin: 0; font-family: var(--f-anton), Impact, sans-serif; font-weight: 400; font-size: 52px; line-height: 1; text-transform: uppercase; letter-spacing: 2px; color: #0b8a45; }
.fat-titulo > span { display: block; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #888; margin-bottom: 12px; }
.fat-titulo dl { display: grid; grid-template-columns: auto auto; gap: 3px 12px; margin: 0; font-size: 13px; justify-content: end; }
.fat-titulo dt { color: #777; text-align: right; }
.fat-titulo dd { margin: 0; font-weight: 800; text-align: right; }
.fat-partes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 34px 0 26px; }
.fat-partes div { display: grid; gap: 2px; font-size: 14px; align-content: start; }
.fat-partes div + div { background: #fff8d1; border-radius: 12px; padding: 14px 16px; }
.fat-partes strong { font-size: 17px; }
.fat-partes span { color: #444; }
h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #0b8a45; }
.fat-tabela { width: 100%; border-collapse: collapse; font-size: 14px; }
.fat-tabela th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fff; background: #1c1c1c; padding: 10px 12px; }
.fat-tabela th:first-child { border-radius: 8px 0 0 8px; } .fat-tabela th:last-child { border-radius: 0 8px 8px 0; text-align: right; }
.fat-tabela td { padding: 11px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
.fat-tabela td:first-child { white-space: nowrap; color: #666; width: 56px; }
.fat-tabela td:last-child { text-align: right; font-weight: 800; white-space: nowrap; }
.fat-tabela small { display: block; color: #0b6b37; font-size: 12px; margin-top: 2px; }
.fat-totais { margin: 16px 0 0 auto; width: 300px; display: grid; gap: 6px; font-size: 14px; }
.fat-totais div { display: flex; justify-content: space-between; padding: 0 12px; }
.fat-totais .fat-total { margin-top: 6px; padding: 14px 16px; border-radius: 12px; background: #0b8a45; color: #fff; font-size: 20px; font-weight: 900; }
.fat-banco { margin-top: 30px; border: 2px solid #1e3f9e; border-radius: 14px; padding: 16px 18px; }
.fat-banco h3 { color: #1e3f9e; }
.fat-banco-grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.fat-banco-grade div { display: grid; gap: 2px; }
.fat-banco-grade span { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 1px; }
.fat-banco-grade strong { font-size: 15px; }
.fat-banco p { margin: 10px 0 0; font-size: 13px; color: #555; }
.fat-rodape { margin-top: auto; padding-top: 30px; text-align: center; display: grid; gap: 2px; font-size: 13px; color: #666; }
.fat-rodape strong { color: #0b8a45; font-size: 16px; }
@media (max-width: 820px) {
  .fat { padding: 10px 0 30px; }
  .fat-botoes { padding: 0 12px; }
}
@media print {
  html, body { background: #fff !important; }
  .fat { padding: 0; } .fat-botoes { display: none; }
  .fat-folha { box-shadow: none; width: 210mm; min-height: 297mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
