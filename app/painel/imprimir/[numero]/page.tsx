import { notFound, redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import { buscarPorNumero } from "@/lib/db";
import { getAjustes } from "@/lib/dados";
import { telefoneBonito } from "@/lib/ajustes";
import { rotuloAgendado } from "@/lib/horario";
import ImprimirAuto from "./ImprimirAuto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recibo da cozinha", robots: { index: false } };

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "numeric" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const valor = (p: number) => (p / 100).toFixed(2);

/**
 * Recibo da cozinha no estilo das lanchonetes (McDonald's / Burger King): letra de máquina,
 * tudo em maiúsculas, linhas tracejadas e negrito só no que importa. Feito para a Star SP742
 * (matricial, rolo de 63 mm de área útil) gastando pouca fita.
 */
export default async function Recibo(props: { params: Promise<{ numero: string }>; searchParams: Promise<{ auto?: string }> }) {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  const { numero } = await props.params;
  const { auto } = await props.searchParams;
  const p = await buscarPorNumero(Number(numero));
  if (!p) notFound();
  const loja = await getAjustes();
  const troco = p.pagamento === "dinheiro" && p.trocoPara ? p.trocoPara - p.total : 0;

  const linhaDupla = <div className="r-linha r-dupla" />;
  const linha = <div className="r-linha" />;

  return (
    <div className="recibo">
      <style>{CSS}</style>
      <ImprimirAuto auto={auto === "1"} />

      <div className="r-c r-marca">PANELA DO CHEF</div>
      <div className="r-c">{loja.entrega.regiao.toUpperCase()}</div>
      <div className="r-c">TEL {telefoneBonito(loja.telefone)}</div>
      {linhaDupla}

      <div className="r-lr"><span>DELIVERY</span><span>PEDIDO</span></div>
      <div className="r-lr r-num"><span className="r-data">{dia(p.criadoEm)}<br />{hora(p.criadoEm)}</span><b>#{p.numero}</b></div>
      {p.agendadoPara && (<>{linha}<div className="r-c r-b">*** AGENDADO: {rotuloAgendado(p.agendadoPara).toUpperCase()} ***</div></>)}
      {linhaDupla}

      <ul className="r-itens">
        {p.itens.map((l, i) => (
          <li key={i}>
            <div className="r-item"><span className="r-q">{l.qtd}</span><span className="r-n">{l.nome.toUpperCase()}</span><span className="r-v">{valor(l.unitario * l.qtd)}</span></div>
            {l.detalhes.map((d) => <div className="r-det" key={d}>+ {d.toUpperCase()}</div>)}
            {l.obs && <div className="r-det r-b">** {l.obs.toUpperCase()}</div>}
          </li>
        ))}
      </ul>
      {linha}

      <div className="r-lr"><span>SUBTOTAL</span><span>{valor(p.subtotal)}</span></div>
      <div className="r-lr"><span>ENTREGA</span><span>{p.taxa ? valor(p.taxa) : "GRATIS"}</span></div>
      <div className="r-lr r-b r-tot"><span>TOTAL</span><span>{gbp(p.total)}</span></div>
      {linhaDupla}

      {p.pagamento === "dinheiro" ? (
        <>
          <div className="r-lr"><span>PAGAMENTO</span><span>CASH</span></div>
          <div className="r-lr r-b r-troco"><span>TROCO</span><span>{troco > 0 ? gbp(troco) : "SEM TROCO"}</span></div>
        </>
      ) : (
        <div className="r-lr"><span>PAGAMENTO</span><span>{p.pago ? "PAGO NO SITE" : "AGUARDANDO"}</span></div>
      )}
      {linhaDupla}

      <div className="r-b">{p.nome.toUpperCase()}</div>
      <div>TEL {p.telefone}</div>
      <div>{p.endereco.toUpperCase()}</div>
      <div className="r-b">{p.postcode.toUpperCase()}{p.distanciaM != null && p.distanciaM >= 160 ? <span className="r-normal"> ({(p.distanciaM / 1609.344).toFixed(1)} MI)</span> : null}</div>
      {p.observacao && (<>{linha}<div>OBS: {p.observacao.toUpperCase()}</div></>)}
      {linhaDupla}

      <div className="r-c">OBRIGADO E BOM APETITE!</div>
      <div className="r-c">@OCHEFKAIO</div>
    </div>
  );
}

const CSS = `
html, body { background: #fff !important; color: #000 !important; margin: 0; color-scheme: light only; }
:root { color-scheme: light only; --bg: #fff; }
body::before { display: none !important; }
body * { box-shadow: none !important; text-shadow: none !important; }
/* Letra de máquina, como nas lanchonetes. Margem maior na esquerda: a SP742 corta um pouco desse lado. */
.recibo { width: 100%; max-width: 63mm; box-sizing: border-box; margin: 0; padding: 1mm 2mm 4mm 5mm;
  font-family: "Courier New", Courier, "Lucida Console", monospace; font-size: 9.5pt; line-height: 1.3; font-weight: 400; color: #000; background: #fff; }
.r-c { text-align: center; }
.r-b { font-weight: 700; }
.r-normal { font-weight: 400; }
.r-marca { font-size: 12pt; font-weight: 700; letter-spacing: 1px; }
.r-linha { border-top: 1px dashed #000; margin: 1.2mm 0; }
.r-dupla { border-top: 3px double #000; }
.r-lr { display: flex; justify-content: space-between; gap: 2mm; }
.r-num { align-items: flex-end; }
.r-num b { font-size: 20pt; line-height: 1; font-weight: 700; }
.r-data { font-size: 9pt; }
.r-itens { list-style: none; margin: 0; padding: 0; }
.r-itens li { padding: 0.6mm 0; break-inside: avoid; }
.r-item { display: flex; gap: 1.5mm; }
.r-q { min-width: 4mm; font-weight: 700; }
.r-n { flex: 1; }
.r-v { white-space: nowrap; }
.r-det { padding-left: 5.5mm; font-size: 9pt; }
.r-tot { font-size: 11pt; }
.r-troco { font-size: 12pt; }
@media screen { body { background: #ddd !important; } .recibo { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.3) !important; } }
`;
