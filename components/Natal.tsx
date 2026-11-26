"use client";

import { useEffect, useMemo, useState } from "react";
import { formatar, precoUnitario, resumirEscolhas, type Cardapio, type Item, type LinhaCarrinho } from "@/lib/cardapio";
import { FolhaItem, Fundo } from "./Loja";
import { DESCONTO_KG_NO_KIT as DESCONTO_KG } from "@/lib/natal";

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
  { prefixo: "natal-kit-", titulo: "Kits completos", sub: "A ceia completa, já com as carnes. Escolha pelo número de pessoas e, se quiser, adicione mais carne." },
  { prefixo: "natal-doce-", titulo: "Doces de Natal", sub: "A ceia não termina sem sobremesa: chocotone, pudim, morango na travessa, mousses e brigadeiros.", doces: true },
  { prefixo: "natal-recheado-", titulo: "Recheados de Natal", sub: "Preço por kg: no + e − você escolhe quantos kg. Nos recheados, escolha o recheio: calabresa, bacon, queijo, cenoura, linguicinha ou o tempero do Chef.", porKg: true },
  { prefixo: "natal-porcao-", titulo: "Porções extras", sub: "Quer mais acompanhamento? Some à sua ceia." },
];

const semPreco = (c: Cardapio, i: Item) => i.preco <= 0 && precoUnitario(c, i, {}) <= 0;
const GRUPO_CARNE_KIT = "natal-carne-kit";
/** Quantos kg de carne foram para dentro dos kits (cada kg sai £2 mais barato que avulso). */
const kgNoKit = (linhas: LinhaCarrinho[]) => linhas.reduce((s, l) => s + (l.selecoes[GRUPO_CARNE_KIT]?.length ?? 0) * l.qtd, 0);
/** Maior número de pessoas do kit ("até 7/9 pessoas" -> 9). */
const maxPessoas = (nome: string) => { const ns = (nome.split(" · ")[1] ?? "").match(/\d+/g); return ns ? Number(ns[ns.length - 1]) : 0; };
const EMOJI_DOCE: Record<string, string> = {
  "natal-doce-chocotone": "🎂", "natal-doce-morango": "🍓", "natal-doce-pudim": "🍮", "natal-doce-mousse": "🍧",
  "natal-doce-cesta": "🧺", "natal-doce-chocopote": "🍫", "natal-doce-brigadeiros": "🟤", "natal-doce-brigadeiro-40": "🍬", "natal-doce-paodemel": "🍯",
};
/** Contagem regressiva até o fim das encomendas (atualiza a cada segundo; null quando acabou). */
function useContagem(fim: string) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (agora == null) return null;
  const ms = Date.parse(fim) - agora;
  if (ms <= 0) return null;
  const seg = Math.floor(ms / 1000);
  return { d: Math.floor(seg / 86400), h: Math.floor((seg % 86400) / 3600), m: Math.floor((seg % 3600) / 60), s: seg % 60 };
}

/** [anterior, melhor, seguinte, ...resto] pela ordem original dos kits. */
function ordemPodio(itens: Item[], melhorId: string) {
  const i = itens.findIndex((x) => x.id === melhorId);
  if (i < 1 || i >= itens.length - 1) return itens;
  const podio = [itens[i - 1], itens[i], itens[i + 1]];
  return [...podio, ...itens.filter((x) => !podio.includes(x))];
}

const temDoce = (linhas: LinhaCarrinho[]) => linhas.some((l) => l.itemId.startsWith("natal-doce-"));

export default function Natal({
  cardapio, datas, aberta, raioMilhas, ultimoDia, encerraEm, whatsapp, cartao,
}: {
  cardapio: Cardapio; datas: Data[]; aberta: boolean; raioMilhas: number; ultimoDia: string; encerraEm: string; whatsapp: string; cartao: boolean;
}) {
  // Quiz "pra quantas pessoas?": marca o kit ideal e o botão flutuante passa a chamar para ele.
  const [indicado, setIndicado] = useState<string | null>(null);
  const restante = useContagem(encerraEm);
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

  // Gatilhos dos kits: preço por pessoa, o kit que mais compensa e um exemplo real do "preço de kit".
  const kitsLista = cardapio.itens.filter((i) => i.id.startsWith("natal-kit-") && i.disponivel);
  const porPessoa = (i: Item) => { const n = maxPessoas(i.nome); return n ? Math.round(precoUnitario(cardapio, i, {}) / n) : 0; };
  const melhorKit = kitsLista.filter((i) => porPessoa(i) > 0).sort((a, b) => porPessoa(a) - porPessoa(b))[0];
  const anteriorDoMelhor = melhorKit
    ? kitsLista.filter((i) => porPessoa(i) > 0 && precoUnitario(cardapio, i, {}) < precoUnitario(cardapio, melhorKit, {})).sort((a, b) => precoUnitario(cardapio, b, {}) - precoUnitario(cardapio, a, {}))[0]
    : undefined;
  const economia = (i: Item) => (i.precoAntigo ? Math.round(i.precoAntigo * 100) - precoUnitario(cardapio, i, {}) : 0);
  const kitIndicado = indicado ? kitsLista.find((k) => k.id === indicado) : undefined;
  function indicar(id: string) {
    setIndicado(id);
    setTimeout(() => document.getElementById("kit-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
  // Pessoas -> kit (pelo maior número de pessoas de cada kit; o Premium é o último botão).
  const OPCOES_PESSOAS = [
    { rotulo: "Até 4", n: 4 },
    { rotulo: "5 a 9", n: 9 },
    { rotulo: "10 a 15", n: 15 },
  ];
  const kitPara = (n: number) => kitsLista.filter((k) => maxPessoas(k.nome) >= n).sort((a, b) => maxPessoas(a.nome) - maxPessoas(b.nome))[0];
  const kitPremium = kitsLista.find((k) => /premium/i.test(k.nome));

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
            <li>🗓 Encomendas até <strong>{dataFim} às 22h</strong></li>
            <li>🚚 Entrega <strong>grátis até {raioMilhas} milhas</strong></li>
            <li>💳 Pagamento <strong>no cartão</strong></li>
          </ul>
          {aberta && restante && (
            <div className="natal-contagem" role="timer" aria-label="Tempo até fechar as encomendas">
              <span className="natal-contagem-titulo">As encomendas fecham em</span>
              <span className="natal-contagem-caixas">
                <span><b className="num">{restante.d}</b>dias</span>
                <span><b className="num">{String(restante.h).padStart(2, "0")}</b>horas</span>
                <span><b className="num">{String(restante.m).padStart(2, "0")}</b>min</span>
                <span><b className="num">{String(restante.s).padStart(2, "0")}</b>seg</span>
              </span>
            </div>
          )}
          <a href="#natal-quiz" className="principal natal-cta"><span>Montar minha ceia agora</span><span aria-hidden="true">↓</span></a>
        </div>
      </header>

      {aberta && (
        <nav className="natal-atalhos" aria-label="Ir para">
          <a href="#natal-kits">Kits</a>
          <a href="#natal-doces">Doces</a>
          <a href="#natal-carnes">Carnes</a>
          <a href="#natal-porcoes">Porções</a>
        </nav>
      )}

      {!aberta && (
        <p className="miolo natal-aviso">As encomendas da Ceia de Natal fecharam em {dataFim}. Fale com a gente no WhatsApp para ver se ainda dá.</p>
      )}

      <main className="miolo natal-cardapio">
        {aberta && kitsLista.length > 0 && (
          <section id="natal-quiz" className="natal-quiz">
            <span className="natal-quiz-pergunta">Pra quantas pessoas é a sua ceia?</span>
            <span className="natal-quiz-sub">Toque e a gente mostra o kit ideal pra você.</span>
            <div className="natal-quiz-opcoes">
              {OPCOES_PESSOAS.map((o) => {
                const k = kitPara(o.n);
                if (!k) return null;
                return (
                  <button key={o.rotulo} type="button" aria-pressed={indicado === k.id} onClick={() => indicar(k.id)}>
                    <b>{o.rotulo}</b><small>pessoas</small>
                  </button>
                );
              })}
              {kitPremium && (
                <button type="button" className="premium" aria-pressed={indicado === kitPremium.id} onClick={() => indicar(kitPremium.id)}>
                  <b>Quero o melhor</b><small>Premium</small>
                </button>
              )}
            </div>
            {kitIndicado && (
              <p className="natal-quiz-resposta">
                <span>O ideal pra você é o <strong>{kitIndicado.nome.split(" · ")[0]}</strong>: {formatar(precoUnitario(cardapio, kitIndicado, {}))}
                {economia(kitIndicado) > 0 && <> · você economiza <strong>{formatar(economia(kitIndicado))}</strong></>}</span>
                <button type="button" onClick={() => setAberto(kitIndicado)}>Quero esse!</button>
              </p>
            )}
          </section>
        )}
        {SECOES.map((s, n) => {
          const brutos = cardapio.itens.filter((i) => i.id.startsWith(s.prefixo));
          // Kits em pódio: o de melhor custo-benefício no meio, o anterior à esquerda, o seguinte à direita; o resto embaixo.
          const itens = s.prefixo === "natal-kit-" && melhorKit ? ordemPodio(brutos, melhorKit.id) : brutos;
          const podio = s.prefixo === "natal-kit-" && melhorKit && itens.length >= 3;
          if (!itens.length) return null;
          const kits = s.prefixo === "natal-kit-";
          return (
            <section key={s.prefixo} id={n === 0 ? "natal-kits" : s.doces ? "natal-doces" : s.porKg ? "natal-carnes" : s.prefixo === "natal-porcao-" ? "natal-porcoes" : undefined} className={"natal-secao" + (s.doces ? " natal-doces" : "")}>
              {s.doces && <span className="natal-doces-selo">🍰 Não esqueça a sobremesa</span>}
              <h2>{s.titulo}</h2>
              <p className="dica">{s.sub}</p>
              {s.doces && (
                <a className="natal-credito" href="https://www.instagram.com/dlauradocesartesanais/" target="_blank" rel="noopener noreferrer">
                  <span aria-hidden="true">♥</span> Doces artesanais por <b>@dlauradocesartesanais</b>
                </a>
              )}
              <div className={kits ? "natal-kits" + (podio ? " podio" : "") : "natal-grade"}>
                {itens.map((i, pos) => {
                  const [nome, pessoas] = i.nome.split(" · ");
                  const premium = /premium/i.test(i.nome);
                  return (
                    <button key={i.id} id={kits ? "kit-" + i.id : undefined} type="button" className={"natal-cartao" + (kits ? " kit" : "") + (kits && melhorKit?.id === i.id ? " melhor" : "") + (kits && indicado === i.id ? " indicado" : "") + (podio && pos === 1 ? " centro" : "") + (podio && pos > 2 ? " baixo" : "") + (premium ? " premium" : "") + (s.doces ? " doce" : "") + (i.destaque ? " mais-pedido" : "")} onClick={() => {
                      if (!aberta) return;
                      if (s.porKg && semPreco(cardapio, i)) { window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Oi! Quero saber o preço do ${i.nome} para a Ceia de Natal.`)}`, "_blank"); return; }
                      setAberto(i);
                    }} disabled={!aberta || !i.disponivel}>
                      {s.doces && (i.imagem
                        ? <img className="natal-doce-foto" src={i.imagem} alt={i.nome} loading="lazy" />
                        : <span className="natal-doce-emoji" aria-hidden="true">{EMOJI_DOCE[i.id] ?? "🍰"}</span>)}
                      {i.destaque && <span className="natal-mais-pedido">⭐ Mais pedido</span>}
                      {kits && indicado === i.id ? <span className="natal-melhor indicado">Ideal pra você</span>
                        : kits && melhorKit?.id === i.id && <span className="natal-melhor">Melhor custo-benefício</span>}
                      {kits && economia(i) > 0 && <span className="natal-economia">Economize {formatar(economia(i))}</span>}
                      <span className="natal-cartao-topo">
                        <strong>{kits ? nome : i.nome}</strong>
                        {kits && pessoas && <span className={"natal-pessoas" + (premium ? " premium" : "")}>{pessoas}</span>}
                      </span>
                      {kits ? (
                        <>
                        <ul className="natal-lista">{i.descricao.split(" · ").map((x) => <li key={x} className={/incluso/i.test(x) ? "brinde" : undefined}>{x}</li>)}</ul>
                        </>
                      ) : (
                        <span className="natal-desc">{i.descricao}</span>
                      )}
                      {kits && melhorKit?.id === i.id && anteriorDoMelhor && (
                        <span className="natal-pessoa top">
                          <em>Só {formatar(precoUnitario(cardapio, i, {}) - precoUnitario(cardapio, anteriorDoMelhor, {}))} a mais que o {anteriorDoMelhor.nome.split(" · ")[0]} e serve muito mais gente</em>
                        </span>
                      )}
                      <span className="natal-cartao-base">
                        <span className={"natal-preco" + (semPreco(cardapio, i) ? " a-definir" : "")}>
                          {kits && i.precoAntigo ? <small className="natal-por">por apenas</small> : null}
                          {semPreco(cardapio, i) ? (s.porKg ? "Sob consulta" : "Preço a definir") : formatar(precoUnitario(cardapio, i, {}))}
                          {s.porKg && !semPreco(cardapio, i) && <small>/kg</small>}
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

      {aberta && !aberto && !fechando && (
        <div className="natal-barra">
          {qtdItens > 0 ? (
            <button type="button" className="principal natal-chamar" onClick={() => setFechando(true)}>
              <span className="natal-chamar-textos">
                <span>Finalizar minha ceia · {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}</span>
                {restante && <small>fecha em {restante.d}d {restante.h}h {restante.m}min</small>}
              </span>
              <span>{faltaPreco ? "Ver" : formatar(total)}</span>
            </button>
          ) : (
            <button type="button" className="principal natal-chamar" onClick={() => {
              if (kitIndicado) setAberto(kitIndicado);
              else document.getElementById("natal-quiz")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
              <span className="natal-chamar-textos">
                <span>{kitIndicado ? `Quero o ${kitIndicado.nome.split(" · ")[0]}!` : "Garanta a sua ceia de Natal"}</span>
                {restante && <small>encomendas fecham em {restante.d}d {restante.h}h {restante.m}min</small>}
              </span>
              <span>{kitIndicado ? formatar(precoUnitario(cardapio, kitIndicado, {})) : "Começar →"}</span>
            </button>
          )}
        </div>
      )}

      {aberto && <FolhaItem cardapio={cardapio} onFechar={() => { setAberto(null); if (voltar) { setVoltar(false); setFechando(true); } }} item={aberto.id.startsWith("natal-kit-") ? { ...aberto, descricao: `${aberto.precoAntigo ? `🔥 De ${formatar(Math.round(aberto.precoAntigo * 100))} por apenas ${formatar(precoUnitario(cardapio, aberto, {}))}!\n` : ""}O kit já vem completo, com carne. Quer mais? Toque no + da carne para cada kg extra.\n\n${aberto.descricao}` } : aberto} onAdicionar={adicionar} />}
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
  // Quanto o cliente economiza: promoção dos kits (de/por) + carne extra no preço de kit.
  const economiaTotal = carrinho.reduce((soma, l) => {
    const it = cardapio.itens.find((i) => i.id === l.itemId);
    return soma + (it?.precoAntigo ? (Math.round(it.precoAntigo * 100) - Math.round(it.preco * 100)) * l.qtd : 0);
  }, 0) + kgNoKit(carrinho) * DESCONTO_KG * 100;
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
            <span>Feche a noite com um doce artesanal da @dlauradocesartesanais:</span>
            <div className="natal-sem-doce-lista">
              {doces.map((d) => (
                <button key={d.id} type="button" onClick={() => escolherDoce(d)}>
                  {d.imagem ? <img src={d.imagem} alt="" loading="lazy" /> : <span aria-hidden="true">{EMOJI_DOCE[d.id] ?? "🍰"}</span>}
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

        {economiaTotal > 0 && <p className="natal-ok">🎉 Você está economizando <strong>{formatar(economiaTotal)}</strong> nesta ceia!</p>}
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
