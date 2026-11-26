"use client";

import { useEffect, useMemo, useState } from "react";
import { formatar, precoUnitario, resumirEscolhas, type Cardapio, type Item, type LinhaCarrinho } from "@/lib/cardapio";
import { FolhaItem, Fundo } from "./Loja";

/**
 * Ceia de Natal: o cliente monta a ceia (kits, carnes recheadas, assados e porções),
 * escolhe o dia da entrega e paga no cartão. Só entrega, grátis até 9 milhas.
 * Carrinho separado do cardápio do dia (outra data de entrega).
 */
type Linha = LinhaCarrinho & { chave: string };
type Data = { valor: string; rotulo: string };
type Cotacao = { ok: true; milhas: number } | { ok: false; motivo: string } | null;

const CHAVE = "panela-carrinho-natal-v1";
const CHAVE_CLIENTE = "panela-cliente";

const SECOES: { prefixo: string; titulo: string; sub: string; porKg?: boolean; doces?: boolean }[] = [
  { prefixo: "natal-kit-", titulo: "Kits completos", sub: "A base da ceia pronta. Escolha o tamanho pela quantidade de pessoas e some as carnes que quiser." },
  { prefixo: "natal-doce-", titulo: "Doces de Natal", sub: "A ceia não termina sem sobremesa: chocotone, pudim, morango na travessa, mousses e brigadeiros.", doces: true },
  { prefixo: "natal-recheado-", titulo: "Recheados de Natal", sub: "Preço por kg: no + e − você escolhe quantos kg. Nos recheados, escolha o recheio: calabresa, bacon, queijo, cenoura, linguicinha ou o tempero do Chef.", porKg: true },
  { prefixo: "natal-porcao-", titulo: "Porções extras", sub: "Quer mais acompanhamento? Some à sua ceia." },
];

const semPreco = (c: Cardapio, i: Item) => i.preco <= 0 && precoUnitario(c, i, {}) <= 0;
const GRUPO_CARNE_KIT = "natal-carne-kit";
/** Quantos kg de carne foram para dentro dos kits (cada kg sai £2 mais barato que avulso). */
const kgNoKit = (linhas: LinhaCarrinho[]) => linhas.reduce((s, l) => s + (l.selecoes[GRUPO_CARNE_KIT]?.length ?? 0) * l.qtd, 0);
const DESCONTO_KG = 2;
const EMOJI_DOCE: Record<string, string> = {
  "natal-doce-chocotone": "🎂", "natal-doce-morango": "🍓", "natal-doce-pudim": "🍮", "natal-doce-mousse": "🍧",
  "natal-doce-cesta": "🧺", "natal-doce-chocopote": "🍫", "natal-doce-brigadeiros": "🟤", "natal-doce-brigadeiro-40": "🍬", "natal-doce-paodemel": "🍯",
};
const temDoce = (linhas: LinhaCarrinho[]) => linhas.some((l) => l.itemId.startsWith("natal-doce-"));

export default function Natal({
  cardapio, datas, aberta, raioMilhas, ultimoDia, whatsapp, cartao,
}: {
  cardapio: Cardapio; datas: Data[]; aberta: boolean; raioMilhas: number; ultimoDia: string; whatsapp: string; cartao: boolean;
}) {
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [fechando, setFechando] = useState(false);
  // Veio do "sem sobremesa" no fechamento: depois de escolher o doce, volta para o fechamento.
  const [voltar, setVoltar] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(CHAVE);
      if (s) setCarrinho((JSON.parse(s) as Linha[]).filter((l) => cardapio.itens.some((i) => i.id === l.itemId)));
    } catch { /* carrinho vazio */ }
  }, [cardapio]);
  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(carrinho)); } catch { /* sem armazenamento */ }
  }, [carrinho]);

  const itemPorId = (id: string) => cardapio.itens.find((i) => i.id === id);
  const totalLinha = (l: Linha) => { const it = itemPorId(l.itemId); return it ? precoUnitario(cardapio, it, l.selecoes) * l.qtd : 0; };
  const total = carrinho.reduce((s, l) => s + totalLinha(l), 0);
  const qtdItens = carrinho.reduce((s, l) => s + l.qtd, 0);
  const faltaPreco = carrinho.some((l) => { const it = itemPorId(l.itemId); return it ? precoUnitario(cardapio, it, l.selecoes) <= 0 : false; });

  function adicionar(l: LinhaCarrinho) {
    const chave = JSON.stringify([l.itemId, l.selecoes, l.obs || ""]);
    setCarrinho((c) => {
      const existe = c.find((x) => x.chave === chave);
      if (existe) return c.map((x) => (x.chave === chave ? { ...x, qtd: Math.min(20, x.qtd + l.qtd) } : x));
      return [...c, { ...l, chave }];
    });
    setAberto(null);
    if (voltar) { setVoltar(false); setFechando(true); }
  }

  const dataFim = ultimoDia.split("-").reverse().slice(0, 2).join("/");

  return (
    <div className="natal">
      <header className="natal-hero">
        <span className="natal-hero-foto" aria-hidden="true" />
        <div className="miolo natal-hero-miolo">
          <a href="/" className="natal-voltar">← Cardápio do dia</a>
          <span className="natal-sobre"><span aria-hidden="true">🎅</span> Ceia de Natal · Panela do Chef</span>
          <h1>Monte o seu kit natalino</h1>
          <p>Ceias completas, prontinhas para servir: kits, Chester, peru, pernil, carnes recheadas e porções. Você monta, paga no cartão e a gente entrega no dia.</p>
          <ul className="natal-selos">
            <li>🗓 Encomendas até <strong>{dataFim}</strong></li>
            <li>🚚 Entrega <strong>grátis até {raioMilhas} milhas</strong></li>
            <li>💳 Pagamento <strong>no cartão</strong></li>
          </ul>
          <a href="#natal-kits" className="principal natal-cta"><span>Começar pelos kits</span><span aria-hidden="true">↓</span></a>
        </div>
      </header>

      {!aberta && (
        <p className="miolo natal-aviso">As encomendas da Ceia de Natal fecharam em {dataFim}. Fale com a gente no WhatsApp para ver se ainda dá.</p>
      )}

      <main className="miolo natal-cardapio">
        {SECOES.map((s, n) => {
          const itens = cardapio.itens.filter((i) => i.id.startsWith(s.prefixo));
          if (!itens.length) return null;
          const kits = s.prefixo === "natal-kit-";
          return (
            <section key={s.prefixo} id={n === 0 ? "natal-kits" : s.doces ? "natal-doces" : undefined} className={"natal-secao" + (s.doces ? " natal-doces" : "")}>
              {s.doces && <span className="natal-doces-selo">🍰 Não esqueça a sobremesa</span>}
              <h2>{s.titulo}</h2>
              <p className="dica">{s.sub}</p>
              <div className={kits ? "natal-kits" : "natal-grade"}>
                {itens.map((i) => {
                  const [nome, pessoas] = i.nome.split(" · ");
                  const premium = /premium/i.test(i.nome);
                  return (
                    <button key={i.id} type="button" className={"natal-cartao" + (kits ? " kit" : "") + (premium ? " premium" : "") + (s.doces ? " doce" : "") + (i.destaque ? " mais-pedido" : "")} onClick={() => {
                      if (!aberta) return;
                      if (s.porKg && semPreco(cardapio, i)) { window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Oi! Quero saber o preço do ${i.nome} para a Ceia de Natal.`)}`, "_blank"); return; }
                      setAberto(i);
                    }} disabled={!aberta || !i.disponivel}>
                      {s.doces && <span className="natal-doce-emoji" aria-hidden="true">{EMOJI_DOCE[i.id] ?? "🍰"}</span>}
                      {i.destaque && <span className="natal-mais-pedido">⭐ Mais pedido</span>}
                      <span className="natal-cartao-topo">
                        <strong>{kits ? nome : i.nome}</strong>
                        {kits && pessoas && <span className={"natal-pessoas" + (premium ? " premium" : "")}>{pessoas}</span>}
                      </span>
                      {kits ? (
                        <>
                        <ul className="natal-lista">{i.descricao.split(" · ").map((x) => <li key={x} className={/incluso/i.test(x) ? "brinde" : undefined}>{x}</li>)}</ul>
                        <span className="natal-chamada">🥩 {(i.escolhas ?? []).some((x) => x.grupo === GRUPO_CARNE_KIT && x.min > 0) ? "Escolha a carne do kit:" : "Quer mais carne?"} no kit, cada kg sai <strong>£{DESCONTO_KG} mais barato</strong> que avulso</span>
                        </>
                      ) : (
                        <span className="natal-desc">{i.descricao}</span>
                      )}
                      <span className="natal-cartao-base">
                        <span className={"natal-preco" + (semPreco(cardapio, i) ? " a-definir" : "")}>
                          {semPreco(cardapio, i) ? (s.porKg ? "Sob consulta" : "Preço a definir") : formatar(precoUnitario(cardapio, i, {}))}
                          {s.porKg && !semPreco(cardapio, i) && <small>/kg</small>}
                          {kits && (i.escolhas ?? []).some((x) => x.grupo === GRUPO_CARNE_KIT && x.min > 0) && <small> + carne</small>}
                          {i.precoAntigo ? <s className="natal-antigo">{formatar(Math.round(i.precoAntigo * 100))}</s> : null}
                        </span>
                        <span className="natal-mais" aria-hidden="true">+</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="dica natal-rodape">Tudo é preparado na mesma cozinha, então pode haver traços de alergênicos. Dúvidas? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Fale com a gente no WhatsApp</a>.</p>
      </main>

      {qtdItens > 0 && (
        <div className="natal-barra">
          <button type="button" className="principal" onClick={() => setFechando(true)}>
            <span>🎄 Minha ceia · {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}</span>
            <span>{faltaPreco ? "Ver" : formatar(total)}</span>
          </button>
        </div>
      )}

      {aberto && <FolhaItem cardapio={cardapio} onFechar={() => { setAberto(null); if (voltar) { setVoltar(false); setFechando(true); } }} item={aberto.id.startsWith("natal-kit-") ? { ...aberto, descricao: `🥩 Carne do kit com preço especial: cada kg sai £${DESCONTO_KG} mais barato do que comprar avulso. Quanto mais carne você põe no kit, mais economiza. Toque no + da carne para cada kg.\n\n${aberto.descricao}` } : aberto} onAdicionar={adicionar} />}
      {fechando && (
        <Finalizar
          cardapio={cardapio} carrinho={carrinho} setCarrinho={setCarrinho} total={total} faltaPreco={faltaPreco}
          datas={datas} raioMilhas={raioMilhas} whatsapp={whatsapp} cartao={cartao} aberta={aberta}
          onFechar={() => setFechando(false)}
          doces={cardapio.itens.filter((i) => ["natal-doce-chocotone", "natal-doce-pudim", "natal-doce-morango", "natal-doce-cesta"].includes(i.id))}
          escolherDoce={(i) => { setFechando(false); setVoltar(true); setAberto(i); }}
        />
      )}
    </div>
  );
}

function Finalizar({
  cardapio, carrinho, setCarrinho, total, faltaPreco, datas, raioMilhas, whatsapp, cartao, aberta, onFechar, doces, escolherDoce,
}: {
  doces: Item[]; escolherDoce: (i: Item) => void;
  cardapio: Cardapio; carrinho: Linha[]; setCarrinho: (f: (c: Linha[]) => Linha[]) => void; total: number; faltaPreco: boolean;
  datas: Data[]; raioMilhas: number; whatsapp: string; cartao: boolean; aberta: boolean; onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [postcode, setPostcode] = useState("");
  const [data, setData] = useState(datas[0]?.valor ?? "");
  const [obs, setObs] = useState("");
  const [cotacao, setCotacao] = useState<Cotacao>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CHAVE_CLIENTE) || "{}");
      if (c.nome) setNome(c.nome);
      if (c.telefone) setTelefone(c.telefone);
      if (c.endereco) setEndereco(c.endereco);
      if (c.postcode) setPostcode(c.postcode);
    } catch { /* sem dados salvos */ }
  }, []);

  // Confere a distância assim que o postcode estiver completo.
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  useEffect(() => {
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) { setCotacao(null); return; }
    let vivo = true;
    fetch(`/api/entrega/cotacao?postcode=${pc}&natal=1`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (d.ok === false && !d.milhas) return setCotacao({ ok: false, motivo: d.motivo });
        const milhas = Number(d.milhas);
        setCotacao(milhas <= raioMilhas ? { ok: true, milhas } : { ok: false, motivo: "fora" });
      })
      .catch(() => vivo && setCotacao(null));
    return () => { vivo = false; };
  }, [pc, raioMilhas]);

  const linhas = useMemo(() => carrinho.map((l) => {
    const it = cardapio.itens.find((i) => i.id === l.itemId);
    const unit = it ? precoUnitario(cardapio, it, l.selecoes) : 0;
    const det = it ? (it.escolhas ?? []).map((e) => (l.selecoes[e.grupo]?.length ? resumirEscolhas(l.selecoes[e.grupo]) : "")).filter(Boolean).join(" · ") : "";
    return { l, it, unit, det };
  }), [carrinho, cardapio]);

  const fora = cotacao && !cotacao.ok && cotacao.motivo === "fora";
  const pode = aberta && cartao && !faltaPreco && !!cotacao?.ok && nome.trim() && telefone.trim() && endereco.trim() && data && !enviando && carrinho.length > 0;

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pode) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          natal: true, nome, telefone, endereco, postcode, agendadoPara: data, observacao: obs,
          pagamento: "cartao", retirada: false,
          itens: carrinho.map(({ itemId, qtd, selecoes, obs: o }) => ({ itemId, qtd, selecoes, obs: o })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || "Não foi possível fechar a encomenda.");
      try { localStorage.removeItem(CHAVE); } catch { /* ok */ }
      window.location.href = d.redirecionar;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível fechar a encomenda.");
      setEnviando(false);
    }
  }

  return (
    <Fundo onFechar={onFechar} titulo="Finalizar a ceia">
      <form className="natal-finalizar" onSubmit={pagar}>
        <div className="natal-fin-topo">
          <h2>🎄 Sua Ceia de Natal</h2>
          <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <ul className="linhas">
          {linhas.map(({ l, it, unit, det }) => (
            <li key={l.chave} className="linha">
              <div>
                <span className="nome">{l.itemId.startsWith("natal-recheado-") ? `${l.qtd}kg` : `${l.qtd}×`} {it?.nome ?? l.itemId}</span>
                {det && <span className="dica"> · {det}</span>}
              </div>
              <div className="natal-linha-dir">
                <span>{unit > 0 ? formatar(unit * l.qtd) : "a definir"}</span>
                <button type="button" className="natal-tirar" aria-label={`Tirar ${it?.nome ?? "item"}`} onClick={() => setCarrinho((c) => c.filter((x) => x.chave !== l.chave))}>×</button>
              </div>
            </li>
          ))}
        </ul>

        {!temDoce(carrinho) && doces.length > 0 && (
          <section className="natal-sem-doce" aria-label="Sobremesa">
            <strong>🍰 Sua ceia está sem sobremesa!</strong>
            <span>Feche a noite com um doce do Chef:</span>
            <div className="natal-sem-doce-lista">
              {doces.map((d) => (
                <button key={d.id} type="button" onClick={() => escolherDoce(d)}>
                  <span aria-hidden="true">{EMOJI_DOCE[d.id] ?? "🍰"}</span>
                  <b>{d.nome.split(" · ")[0]}</b>
                  <em>{d.id === "natal-doce-morango" ? "a partir de " : ""}{formatar(Math.round(d.preco * 100))}</em>
                  {d.destaque && <small>Mais pedido</small>}
                </button>
              ))}
            </div>
          </section>
        )}

        <label className="campo">Entrega
          <select value={data} onChange={(e) => setData(e.target.value)} required>
            {datas.map((d) => <option key={d.valor} value={d.valor}>{d.rotulo}</option>)}
          </select>
        </label>
        <label className="campo">Nome<input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></label>
        <label className="campo">Telefone (WhatsApp)<input required type="tel" maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" /></label>
        <label className="campo">Endereço (número e rua)<input required maxLength={160} value={endereco} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" /></label>
        <label className="campo">Postcode<input required maxLength={10} value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} autoComplete="postal-code" placeholder="Ex.: KT17 1JW" /></label>
        {cotacao?.ok && <p className="natal-ok">✅ Entregamos aí ({cotacao.milhas.toFixed(1)} milhas) · <strong>entrega grátis</strong></p>}
        {fora && (
          <p className="erro">
            Infelizmente o seu postcode ultrapassa o nosso raio de entrega da Ceia de Natal ({raioMilhas} milhas).{" "}
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Oi! Quero encomendar a Ceia de Natal, mas meu postcode é ${postcode}.`)}`} target="_blank" rel="noreferrer">Fale com a loja no WhatsApp</a>.
          </p>
        )}
        {cotacao && !cotacao.ok && !fora && <p className="erro">{cotacao.motivo}</p>}
        <label className="campo">Observação <span className="dica">(opcional)</span><textarea maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: tocar a campainha do fundo" /></label>

        {kgNoKit(carrinho) > 0 && <p className="natal-ok">🎉 Você está economizando <strong>£{(kgNoKit(carrinho) * DESCONTO_KG).toFixed(2)}</strong> com {kgNoKit(carrinho)}kg de carne no preço de kit.</p>}
        <div className="totais">
          <div><span>Entrega</span><span>Grátis</span></div>
          <div className="total"><span>Total</span><span>{faltaPreco ? "a definir" : formatar(total)}</span></div>
        </div>
        {faltaPreco && <p className="erro">Ainda estamos fechando os preços da ceia. Volte em breve ou fale com a gente no WhatsApp.</p>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="principal" type="submit" disabled={!pode}>
          <span>{enviando ? "Fechando a encomenda..." : "Pagar com cartão"}</span><span>{faltaPreco ? "" : formatar(total)}</span>
        </button>
        <p className="dica">Pagamento no cartão (Apple Pay / Google Pay) na próxima tela. A encomenda só é confirmada depois do pagamento.</p>
      </form>
    </Fundo>
  );
}
