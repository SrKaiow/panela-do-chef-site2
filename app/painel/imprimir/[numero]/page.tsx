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
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "Europe/London", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Recibo da cozinha para a impressora (Star SP700 / SP742, papel 76 mm).
 * Feito para impressora matricial: só preto, letras grandes, sem degradê.
 */
export default async function Recibo(props: { params: Promise<{ numero: string }>; searchParams: Promise<{ auto?: string }> }) {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  const { numero } = await props.params;
  const { auto } = await props.searchParams;
  const p = await buscarPorNumero(Number(numero));
  if (!p) notFound();
  const loja = await getAjustes();
  const troco = p.pagamento === "dinheiro" && p.trocoPara ? p.trocoPara - p.total : 0;

  return (
    <div className="recibo">
      <style>{CSS}</style>
      {auto === "1" && <ImprimirAuto />}

      <header className="r-topo">
        <img src="/fotos/logo-ticket.png" alt="Panela do Chef" className="r-logo" />
        <div className="r-loja">COZINHA · DELIVERY</div>
      </header>

      <div className="r-numero">PEDIDO #{p.numero}</div>
      <div className="r-centro">{quando(p.criadoEm)}</div>
      {p.agendadoPara && <div className="r-reserva">RESERVADO PARA<br />{rotuloAgendado(p.agendadoPara).toUpperCase()}</div>}

      {/* Pagamento em destaque */}
      {p.pagamento === "dinheiro" ? (
        <div className="r-pag">
          <div className="r-pag-titulo">PAGAMENTO EM CASH</div>
          <div className="r-pag-linha">COBRAR <b>{gbp(p.total)}</b></div>
          {p.trocoPara ? (
            <>
              <div className="r-pag-linha">CLIENTE PAGA COM <b>{gbp(p.trocoPara)}</b></div>
              <div className="r-troco">LEVAR TROCO<br />{gbp(troco)}</div>
            </>
          ) : (
            <div className="r-troco">SEM TROCO<br /><small>(valor exato)</small></div>
          )}
        </div>
      ) : (
        <div className="r-pag">
          <div className="r-pag-titulo">{p.pago ? "JÁ PAGO NO SITE" : "AGUARDANDO PAGAMENTO"}</div>
          <div className="r-troco">{p.pago ? "NÃO COBRAR" : "CONFERIR ANTES"}<br /><small>{gbp(p.total)} · cartão</small></div>
        </div>
      )}

      <div className="r-sep">ITENS</div>
      <ul className="r-itens">
        {p.itens.map((l, i) => (
          <li key={i}>
            <div className="r-item"><b>{l.qtd}x</b> <b>{l.nome}</b><span>{gbp(l.unitario * l.qtd)}</span></div>
            {l.detalhes.map((d) => <div className="r-det" key={d}>- {d}</div>)}
            {l.obs && <div className="r-obs">OBS: {l.obs}</div>}
          </li>
        ))}
      </ul>

      <div className="r-totais">
        <div><span>Subtotal</span><span>{gbp(p.subtotal)}</span></div>
        <div><span>Entrega</span><span>{p.taxa ? gbp(p.taxa) : "Grátis"}</span></div>
        <div className="r-total"><span>TOTAL</span><span>{gbp(p.total)}</span></div>
      </div>

      <div className="r-sep">CLIENTE</div>
      <div className="r-cliente">
        <b>{p.nome.toUpperCase()}</b><br />
        Tel: <b>{p.telefone}</b><br />
        {p.endereco}<br />
        <b className="r-postcode">{p.postcode}</b>
        {p.distanciaM != null && <> · {(p.distanciaM / 1609.344).toFixed(1)} milhas</>}
      </div>
      {p.observacao && <div className="r-obs-geral">OBSERVAÇÃO:<br />{p.observacao}</div>}

      <footer className="r-rodape">
        {loja.nome} · {telefoneBonito(loja.telefone)}<br />
        Obrigado e bom apetite!
      </footer>
    </div>
  );
}

const CSS = `
@page { size: 76mm auto; margin: 0; }
html, body { background: #fff !important; color: #000 !important; margin: 0; color-scheme: light only; }
:root { color-scheme: light only; --bg: #fff; }
body::before { display: none !important; }
body * { box-shadow: none !important; text-shadow: none !important; }
.recibo { width: 76mm; box-sizing: border-box; margin: 0; padding: 3mm 4mm 8mm; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.25; color: #000; background: #fff; }
.r-topo { text-align: center; }
.r-logo { width: 46mm; height: auto; display: block; margin: 0 auto 1mm; image-rendering: pixelated; }
.r-loja { font-size: 10pt; font-weight: 700; letter-spacing: 1px; }
.r-numero { font-size: 26pt; font-weight: 900; text-align: center; margin: 3mm 0 0; letter-spacing: 0.5px; }
.r-centro { text-align: center; font-size: 11pt; }
.r-reserva { margin: 2mm 0; padding: 1.5mm; border: 2px dashed #000; text-align: center; font-weight: 900; font-size: 12pt; }
.r-pag { margin: 3mm 0; border: 4px solid #000; padding: 2mm; text-align: center; }
.r-pag-titulo { font-size: 17pt; font-weight: 900; letter-spacing: 0.5px; border-bottom: 2px solid #000; padding-bottom: 1.5mm; margin-bottom: 1.5mm; }
.r-pag-linha { font-size: 13pt; }
.r-pag-linha b { font-size: 15pt; }
.r-troco { margin-top: 1.5mm; font-size: 22pt; font-weight: 900; line-height: 1.1; }
.r-troco small { font-size: 11pt; font-weight: 700; }
.r-sep { margin: 3mm 0 1mm; font-weight: 900; font-size: 11pt; border-top: 2px solid #000; border-bottom: 2px solid #000; text-align: center; letter-spacing: 2px; }
.r-itens { list-style: none; margin: 0; padding: 0; }
.r-itens li { padding: 1.2mm 0; border-bottom: 1px dashed #000; }
.r-item { display: flex; gap: 2mm; font-size: 13pt; }
.r-item span { margin-left: auto; white-space: nowrap; }
.r-det { font-size: 11pt; padding-left: 5mm; }
.r-obs { font-size: 11.5pt; font-weight: 900; padding-left: 5mm; }
.r-totais { margin-top: 2mm; font-size: 12pt; }
.r-totais div { display: flex; justify-content: space-between; }
.r-total { font-size: 15pt; font-weight: 900; border-top: 2px solid #000; margin-top: 1mm; padding-top: 1mm; }
.r-cliente { font-size: 12.5pt; }
.r-postcode { font-size: 15pt; }
.r-obs-geral { margin-top: 2mm; border: 2px solid #000; padding: 1.5mm; font-weight: 700; font-size: 12pt; }
.r-rodape { margin-top: 4mm; text-align: center; font-size: 10pt; border-top: 1px dashed #000; padding-top: 2mm; }
@media screen { body { background: #ddd !important; } .recibo { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.3) !important; } }
`;
