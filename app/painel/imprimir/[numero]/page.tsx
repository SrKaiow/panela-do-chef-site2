import { notFound, redirect } from "next/navigation";
import { logado } from "@/lib/auth";
import { buscarPorNumero, carimbosDoPedido } from "@/lib/db";
import { lerFidelidade } from "@/lib/fidelidade";
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
  // Cartão de agradecimento: vai junto com o pedido (destaca pelo tracejado e coloca na sacola).
  const primeiro = (p.nome.trim().split(/\s+/)[0] || "").toLowerCase();
  const nomeCliente = primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
  const cartao = await lerFidelidade().then((f) => carimbosDoPedido(p, f.meta, Math.round(f.minimo * 100))).catch(() => null);

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

      {/* ---------- cartão de agradecimento para o cliente ---------- */}
      <div className="r-corte"><span>✂ destaque e coloque na sacola</span></div>
      <section className="r-obrigado">
        <div className="r-ob-marca">PANELA DO CHEF</div>
        <div className="r-ob-sub">SABORES DO BRASIL EM LONDRES</div>
        <div className="r-ob-linha" />
        <div className="r-ob-titulo">Obrigado</div>
        <div className="r-ob-pelo">pelo seu pedido,</div>
        {nomeCliente && <div className="r-ob-nome">{nomeCliente}!</div>}
        <p className="r-ob-texto">Foi um prazer cozinhar pra você. Cada pedido é feito na hora, com o tempero de casa.</p>
        {cartao && cartao.ganhou && cartao.carimbos > 0 && (
          <div className="r-ob-fid">
            <div className="r-ob-fid-tit">SEU CARTÃO FIDELIDADE</div>
            <div className="r-ob-carimbos">
              {Array.from({ length: cartao.meta }, (_, i) => <span key={i} className={i < cartao.carimbos ? "x" : ""}>{i < cartao.carimbos ? "✔" : i + 1}</span>)}
            </div>
            <div className="r-ob-fid-txt">{cartao.carimbos >= cartao.meta ? "Cartão completo! Seu brinde está te esperando." : `Mais ${cartao.meta - cartao.carimbos} pedido${cartao.meta - cartao.carimbos > 1 ? "s" : ""} pelo site e você ganha um brinde.`}</div>
          </div>
        )}
        <div className="r-ob-linha" />
        <div className="r-ob-assina">Chef Kaio</div>
        <div className="r-ob-cargo">FUNDADOR &amp; CHEF</div>
        <div className="r-ob-site">paneladochef.co.uk</div>
      </section>
    </div>
  );
}

const CSS = `
html, body { background: #fff !important; color: #000 !important; margin: 0; color-scheme: light only; }
:root { color-scheme: light only; --bg: #fff; }
body::before { display: none !important; }
body * { box-shadow: none !important; text-shadow: none !important; }
/* Letra de máquina, como nas lanchonetes. Lucida Console tem o traço mais grosso que a Courier: na matricial não falha.
   Margens dos dois lados para não cortar na SP742. */
.recibo { width: 100%; max-width: 63mm; box-sizing: border-box; margin: 0; padding: 1mm 4mm 4mm 6mm;
  font-family: "Lucida Console", Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.3; font-weight: 400; color: #000; background: #fff; }
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
/* Cartão de agradecimento: letras grandes e finas (pouca fita), sem foto. */
.r-corte { margin: 6mm 0 3mm; border-top: 1px dashed #000; text-align: center; }
.r-corte span { position: relative; top: -0.75em; background: #fff; padding: 0 2mm; font-size: 7.5pt; }
.r-obrigado { text-align: center; padding: 1mm 1mm 2mm; }
.r-ob-marca { font-family: Georgia, "Times New Roman", serif; font-size: 13pt; letter-spacing: 3px; }
.r-ob-sub { font-size: 6.5pt; letter-spacing: 1.5px; margin-top: .5mm; }
.r-ob-linha { width: 14mm; margin: 2.5mm auto; border-top: 1px solid #000; }
.r-ob-titulo { font-family: Georgia, "Times New Roman", serif; font-size: 26pt; line-height: 1; }
.r-ob-pelo { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 13pt; margin-top: 1mm; }
.r-ob-nome { font-family: "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive; font-size: 24pt; margin: 2mm 0 1mm; }
.r-ob-texto { font-family: Georgia, "Times New Roman", serif; font-size: 9pt; line-height: 1.35; margin: 1mm 2mm 0; }
.r-ob-fid { margin: 3mm 0 0; padding: 2mm 1mm; border: 1px solid #000; border-radius: 3mm; }
.r-ob-fid-tit { font-size: 7.5pt; font-weight: 700; letter-spacing: 1px; }
.r-ob-carimbos { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2mm; margin: 1.5mm 0; }
.r-ob-carimbos span { width: 7.5mm; height: 7.5mm; border-radius: 50%; border: 1px dashed #000; display: grid; place-items: center; font-size: 7pt; }
.r-ob-carimbos span.x { border: 1.5px solid #000; font-size: 10pt; font-weight: 700; }
.r-ob-fid-txt { font-size: 8pt; }
.r-ob-assina { font-family: "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive; font-size: 20pt; line-height: 1; }
.r-ob-cargo { font-size: 6.5pt; letter-spacing: 1.5px; margin-top: 1mm; }
.r-ob-site { font-size: 8pt; margin-top: 2mm; font-weight: 700; }
@media screen { body { background: #ddd !important; } .recibo { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.3) !important; } }
`;
