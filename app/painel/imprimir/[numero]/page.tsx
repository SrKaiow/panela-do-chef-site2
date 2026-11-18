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
export default async function Recibo(props: { params: Promise<{ numero: string }>; searchParams: Promise<{ auto?: string; cor?: string }> }) {
  if (!(await logado("painel"))) redirect("/painel/entrar");
  const { numero } = await props.params;
  const { auto, cor } = await props.searchParams;
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

      <div className="r-lr"><span>{p.retirada ? "COLETA" : "DELIVERY"}</span><span>PEDIDO</span></div>
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
      <div className="r-lr"><span>{p.retirada ? "COLETA" : "ENTREGA"}</span><span>{p.taxa ? valor(p.taxa) : "GRATIS"}</span></div>
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
      {p.retirada ? (
        <div className="r-coleta">COLETA NA PORTA</div>
      ) : (<>
      <div>{p.endereco.toUpperCase()}</div>
      <div className="r-b">{p.postcode.toUpperCase()}{p.distanciaM != null && p.distanciaM >= 160 ? <span className="r-normal"> ({(p.distanciaM / 1609.344).toFixed(1)} MI)</span> : null}</div>
      </>)}
      {p.observacao && (<>{linha}<div>OBS: {p.observacao.toUpperCase()}</div></>)}
      {linhaDupla}

      <div className="r-c">OBRIGADO E BOM APETITE!</div>
      <div className="r-c">@OCHEFKAIO</div>

      {/* ---------- cartão de agradecimento para o cliente ---------- */}
      <div className="r-corte"><span>✂ destaque e coloque na sacola</span></div>
      <section className={"r-obrigado" + (cor === "1" ? " cor" : "")}>
        {/* Logo de verdade (panela, chama e bandeira). Na matricial vai só o contorno, para gastar pouca fita. */}
        <img className="r-ob-logo pb" src="/fotos/logo-cartao.png" alt="Panela do Chef" />
        <img className="r-ob-logo cl" src="/fotos/logo-cartao-cor.png" alt="Panela do Chef" />
        <div className="r-ob-sub"><Losango /> SABORES DO BRASIL EM LONDRES <Losango /></div>
        <Emblema />
        <div className="r-ob-titulo">OBRIGADO</div>
        <div className="r-ob-pelo">pelo seu pedido,</div>
        {nomeCliente && <div className="r-ob-nome">{nomeCliente}!</div>}
        <p className="r-ob-texto">Foi um prazer cozinhar pra você. Cada pedido é feito na hora, com o tempero de casa.</p>
        {cartao && cartao.ganhou && cartao.carimbos > 0 && (
          <div className="r-ob-fid">
            <div className="r-ob-fid-tit"><Losango /> SEU CARTÃO FIDELIDADE <Losango /></div>
            <div className="r-ob-carimbos">
              {Array.from({ length: cartao.meta }, (_, i) => <span key={i} className={i < cartao.carimbos ? "x" : ""}>{i < cartao.carimbos ? "✔" : i + 1}</span>)}
            </div>
            <div className="r-ob-fid-txt">{cartao.carimbos >= cartao.meta ? "Cartão completo! Seu brinde está te esperando." : `Mais ${cartao.meta - cartao.carimbos} pedido${cartao.meta - cartao.carimbos > 1 ? "s" : ""} pelo site e você ganha um brinde.`}</div>
          </div>
        )}
        <Emblema />
        <div className="r-ob-assina">Chef Kaio</div>
        <div className="r-ob-cargo">FUNDADOR &amp; CHEF</div>
        <div className="r-ob-site">paneladochef.co.uk</div>
        <div className="r-ob-insta">@ochefkaio</div>
      </section>
    </div>
  );
}

/** Losango da bandeira (contorno na matricial; verde e amarelo na versão colorida). */
function Losango() {
  return (
    <svg className="r-los" viewBox="0 0 12 8" aria-hidden="true">
      <polygon points="6,0.6 11.4,4 6,7.4 0.6,4" />
    </svg>
  );
}

/** Divisor com o emblema da bandeira do Brasil: retângulo, losango, círculo e a faixa. */
function Emblema() {
  return (
    <svg className="r-emb" viewBox="0 0 200 22" aria-hidden="true">
      <line className="fio" x1="4" y1="11" x2="76" y2="11" />
      <line className="fio" x1="124" y1="11" x2="196" y2="11" />
      <circle className="ponto" cx="70" cy="11" r="1.6" /><circle className="ponto" cx="130" cy="11" r="1.6" />
      <rect className="ret" x="84" y="2" width="32" height="18" rx="1.5" />
      <polygon className="los" points="100,4.2 113.5,11 100,17.8 86.5,11" />
      <circle className="glo" cx="100" cy="11" r="4.6" />
      <path className="fx" d="M95.6 10.2 Q100 8.4 104.5 11.6" />
    </svg>
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
.r-coleta { margin: 1.5mm 0; padding: 1.5mm 0; border: 1.5px solid #000; text-align: center; font-weight: 700; font-size: 13pt; letter-spacing: 1px; }
/* Cartão de agradecimento: identidade da marca (logo, bandeira, fontes do site) só em contorno, para gastar pouca fita.
   Com ?cor=1 sai colorido (para impressora colorida comum). */
.r-corte { margin: 6mm 0 3mm; border-top: 1px dashed #000; text-align: center; }
.r-corte span { position: relative; top: -0.75em; background: #fff; padding: 0 2mm; font-size: 7.5pt; }
.r-obrigado { position: relative; text-align: center; padding: 3mm 2.5mm 3mm; border: 1px solid #000; border-radius: 3mm; outline: 1px solid #000; outline-offset: -1.6mm; }
.r-ob-logo { display: block; width: 46mm; height: auto; margin: 1mm auto 0; }
.r-ob-logo.cl { display: none; }
.r-los { width: 2.6mm; height: 1.8mm; vertical-align: 0.1mm; fill: none; stroke: #000; stroke-width: 1.1; }
.r-ob-sub { font-size: 5.6pt; letter-spacing: 0.6px; margin-top: 1.5mm; white-space: nowrap; }
.r-emb { display: block; width: 48mm; height: 5.3mm; margin: 2.2mm auto; fill: none; stroke: #000; stroke-width: 1.3; }
.r-emb .ponto { fill: #000; stroke: none; }
.r-ob-titulo { font-family: var(--f-anton), Impact, "Arial Narrow", sans-serif; font-size: 30pt; line-height: 1.05; letter-spacing: 1.5px;
  color: transparent; -webkit-text-stroke: 0.9px #000; }
.r-ob-pelo { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 12pt; margin-top: .5mm; }
.r-ob-nome { font-family: var(--f-yellowtail), "Brush Script MT", "Segoe Script", cursive; font-size: 30pt; line-height: 1.1; margin: 0.5mm 0 1mm; }
.r-ob-texto { font-family: Georgia, "Times New Roman", serif; font-size: 8.8pt; line-height: 1.35; margin: 0 1mm; }
.r-ob-fid { margin: 3mm 0.5mm 0; padding: 2mm 1mm; border: 1px dashed #000; border-radius: 3mm; }
.r-ob-fid-tit { font-size: 6.6pt; font-weight: 700; letter-spacing: 0.4px; white-space: nowrap; }
.r-ob-carimbos { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2mm; margin: 1.5mm 0; }
.r-ob-carimbos span { width: 7mm; height: 7mm; border-radius: 50%; border: 1px dashed #000; display: grid; place-items: center; font-size: 7pt; }
.r-ob-carimbos span.x { border: 1.5px solid #000; font-size: 10pt; font-weight: 700; }
.r-ob-fid-txt { font-size: 7.8pt; }
.r-ob-assina { font-family: var(--f-yellowtail), "Brush Script MT", "Segoe Script", cursive; font-size: 24pt; line-height: 1; }
.r-ob-cargo { font-size: 6.3pt; letter-spacing: 1.5px; margin-top: 1mm; }
.r-ob-site { font-size: 8pt; margin-top: 2mm; font-weight: 700; }
.r-ob-insta { font-size: 7.5pt; }
/* Versão colorida */
.cor, .cor * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cor { border-color: #0b8a45; outline-color: #f2c200; }
.cor .r-ob-logo.pb { display: none; } .cor .r-ob-logo.cl { display: block; }
.cor .r-los { fill: #ffd814; stroke: #0b8a45; }
.cor .r-emb .fio { stroke: #0b8a45; } .cor .r-emb .ponto { fill: #f6980c; }
.cor .r-emb .ret { fill: #0b8a45; stroke: #0b8a45; } .cor .r-emb .los { fill: #ffd814; stroke: #ffd814; }
.cor .r-emb .glo { fill: #1e3f9e; stroke: #1e3f9e; } .cor .r-emb .fx { stroke: #fff; }
.cor .r-ob-titulo { color: #0b8a45; -webkit-text-stroke: 0; }
.cor .r-ob-nome, .cor .r-ob-assina { color: #f6980c; }
.cor .r-ob-sub, .cor .r-ob-cargo, .cor .r-ob-site { color: #0b8a45; }
.cor .r-ob-fid { border-color: #0b8a45; background: #fffbe0; }
.cor .r-ob-carimbos span.x { border-color: #0b8a45; color: #0b8a45; }
@media screen { body { background: #ddd !important; } .recibo { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.3) !important; } }
`;
