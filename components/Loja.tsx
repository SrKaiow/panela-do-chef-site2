"use client";

import { useCallback, useEffect, useState } from "react";
import { emPence, formatar, precoUnitario, type Cardapio, type Item, type LinhaCarrinho } from "@/lib/cardapio";
import type { AjustesPublicos } from "@/lib/ajustes";
import { estadoLoja, type Estado, type Horario } from "@/lib/horario";
import Hero, { Faixa } from "./Hero";
import QuantoPedir from "./QuantoPedir";
import { IconeCategoria } from "./Icones";

type Linha = LinhaCarrinho & { chave: string };
type Pagamentos = { dinheiro: boolean; cartao: boolean };
type Cotacao = { ok: true; milhas: number; taxa: number; gratisAcima: number | null; gratis: boolean } | { ok: false; motivo: string };

const CHAVE_STORAGE = "panela-carrinho-v1";

function detalhes(item: Item, selecoes: Record<string, string[]>) {
  return (item.escolhas ?? [])
    .map((e) => (selecoes[e.grupo]?.length ? selecoes[e.grupo].join(", ") : ""))
    .filter(Boolean)
    .join(" · ");
}

export default function Loja({
  cardapio, loja, estadoInicial, horariosIniciais, pausado,
}: {
  cardapio: Cardapio;
  loja: AjustesPublicos;
  estadoInicial: Estado;
  horariosIniciais: Horario[];
  pausado: boolean;
}) {
  const pagamentos: Pagamentos = loja.pagamentos;
  const itemPorId = useCallback((id: string) => cardapio.itens.find((i) => i.id === id), [cardapio]);
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [horarios, setHorarios] = useState<Horario[]>(horariosIniciais);

  // A loja fecha sozinha no fim do expediente: confere o relógio a cada 30 s e o servidor a cada minuto.
  useEffect(() => {
    let pausa = pausado;
    const local = setInterval(() => setEstado(estadoLoja(loja.horarios, pausa)), 30000);
    const servidor = setInterval(async () => {
      try {
        const r = await fetch("/api/loja/estado", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        pausa = d.estado.pausado;
        setEstado(d.estado);
        setHorarios(d.horarios);
      } catch {}
    }, 60000);
    return () => { clearInterval(local); clearInterval(servidor); };
  }, [loja.horarios, pausado]);

  // Guarda o carrinho no navegador para não perder se a página recarregar.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || "[]") as Linha[];
      setCarrinho(salvo.filter((l) => itemPorId(l.itemId)?.disponivel));
    } catch {}
  }, [itemPorId]);
  useEffect(() => {
    try { localStorage.setItem(CHAVE_STORAGE, JSON.stringify(carrinho)); } catch {}
  }, [carrinho]);

  const qtdTotal = carrinho.reduce((s, l) => s + l.qtd, 0);
  const subtotal = carrinho.reduce((s, l) => {
    const item = itemPorId(l.itemId);
    return item ? s + precoUnitario(cardapio, item, l.selecoes) * l.qtd : s;
  }, 0);

  function adicionar(l: LinhaCarrinho) {
    const chave = JSON.stringify([l.itemId, l.selecoes, l.obs || ""]);
    setCarrinho((c) => {
      const existe = c.find((x) => x.chave === chave);
      if (existe) return c.map((x) => (x.chave === chave ? { ...x, qtd: Math.min(20, x.qtd + l.qtd) } : x));
      return [...c, { ...l, chave }];
    });
    setAberto(null);
  }

  // Sugestão do Chef: junta tudo no carrinho de uma vez e abre o carrinho.
  function adicionarVarios(linhas: LinhaCarrinho[]) {
    linhas.forEach((l) => adicionar(l));
    setVerCarrinho(true);
  }

  return (
    <>
      {!estado.aberto && <AvisoFechado estado={estado} />}
      <Hero loja={loja} aberto={estado.aberto} />
      <Faixa />
      <QuantoPedir cardapio={cardapio} falaDoChef={loja.falaDoChef} onAdicionar={adicionarVarios} />

      <nav className="abas" aria-label="Categorias" id="cardapio">
        <div className="miolo">
          {cardapio.categorias.map((c) => (
            <a key={c.id} href={"#" + c.id}>{c.nome}</a>
          ))}
        </div>
      </nav>

      <main className="miolo cardapio">
        {!estado.aberto && (
          <p className="aviso-agendar">
            <strong>Cozinha fechada agora.</strong> Monte seu pedido e escolha o horário de entrega
            {estado.proxima ? ` (a partir de ${estado.proxima.quando} às ${estado.proxima.abre})` : ""}: ele fica reservado pra você.
          </p>
        )}
        {cardapio.categorias.map((cat) => {
          const itens = cardapio.itens.filter((i) => i.categoria === cat.id);
          if (!itens.length) return null;
          // Disponíveis primeiro, esgotados no fim da seção.
          itens.sort((a, b) => Number(b.disponivel) - Number(a.disponivel));
          const disponiveis = itens.filter((i) => i.disponivel).length;
          return (
            <section key={cat.id} id={cat.id} className="secao">
              <div className="secao-topo">
                <h2>{cat.nome}</h2>
                <span className="risco" aria-hidden="true" />
                <span className="conta">{disponiveis} {disponiveis === 1 ? "opção" : "opções"}</span>
              </div>
              <div className="lista">
                {itens.map((item) => (
                  <button key={item.id} className="item" disabled={!item.disponivel} onClick={() => setAberto(item)}>
                    <div className="foto">
                      {item.imagem ? <img src={item.imagem} alt="" loading="lazy" /> : <IconeCategoria categoria={item.categoria} />}
                    </div>
                    <div className="info">
                      <h3>{item.nome}</h3>
                      {item.descricao && <p>{item.descricao}</p>}
                      <div className="valores">
                        <span className="preco">{formatar(emPence(item.preco))}</span>
                        {item.precoAntigo && item.precoAntigo > item.preco && (
                          <span className="antigo preco">{formatar(emPence(item.precoAntigo))}</span>
                        )}
                        {!item.disponivel ? (
                          <span className="tag esgotado">Esgotado</span>
                        ) : item.precoAntigo && item.precoAntigo > item.preco ? (
                          <span className="tag promo">Promoção</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="mais" aria-hidden="true">+</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {!verCarrinho && !aberto && (
        <a className={"chef-fab" + (qtdTotal > 0 ? "" : " sem-carrinho")} href="#quanto-pedir" aria-label="Calcular quanto pedir">
          <span className="fala-fab">Quanto pedir?</span>
          <span className="rosto"><img src="/fotos/logo-panela-do-chef.png" alt="" /></span>
        </a>
      )}

      {qtdTotal > 0 && !verCarrinho && !aberto && (
        <div className="barra">
          <button onClick={() => setVerCarrinho(true)}>
            <span><span className="qtd num">{qtdTotal}</span>{estado.aberto ? "Ver carrinho" : "Agendar pedido"}</span>
            <span className="preco">{formatar(subtotal)}</span>
          </button>
        </div>
      )}

      {aberto && <FolhaItem cardapio={cardapio} item={aberto} onFechar={() => setAberto(null)} onAdicionar={adicionar} />}
      {verCarrinho && (
        <FolhaCarrinho
          cardapio={cardapio}
          loja={loja}
          estado={estado}
          horarios={horarios}
          carrinho={carrinho}
          setCarrinho={setCarrinho}
          subtotal={subtotal}
          pagamentos={pagamentos}
          onFechar={() => setVerCarrinho(false)}
        />
      )}
    </>
  );
}

function AvisoFechado({ estado }: { estado: Estado }) {
  return (
    <div className="fechado-faixa" role="status">
      <div className="miolo fechado-miolo">
        <span className="fechado-icone" aria-hidden="true">:C</span>
        <div>
          <strong>Cozinha fechada{estado.proxima ? `, pedir ${estado.proxima.quando}` : ""}</strong>
          <span>
            {estado.proxima
              ? `Voltamos ${estado.proxima.quando} às ${estado.proxima.abre}. Olhe o cardápio e já deixe seu pedido reservado.`
              : "Olhe o cardápio e já deixe seu pedido reservado."}
          </span>
        </div>
        <a className="botao" href="#cardapio">Ver o cardápio</a>
      </div>
    </div>
  );
}

function Fundo({ onFechar, titulo, children }: { onFechar: () => void; titulo: string; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [onFechar]);
  return (
    <div className="fundo" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo}>{children}</div>
    </div>
  );
}

function FolhaItem({ cardapio, item, onFechar, onAdicionar }: { cardapio: Cardapio; item: Item; onFechar: () => void; onAdicionar: (l: LinhaCarrinho) => void }) {
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  const faltando = (item.escolhas ?? []).filter((e) => (selecoes[e.grupo]?.length ?? 0) < e.min);
  const unit = precoUnitario(cardapio, item, selecoes);

  function alternar(grupo: string, nome: string, max: number) {
    setSelecoes((s) => {
      const atual = s[grupo] ?? [];
      if (atual.includes(nome)) return { ...s, [grupo]: atual.filter((n) => n !== nome) };
      if (max === 1) return { ...s, [grupo]: [nome] };
      if (atual.length >= max) return s;
      return { ...s, [grupo]: [...atual, nome] };
    });
  }

  return (
    <Fundo onFechar={onFechar} titulo={item.nome}>
      {item.imagem && <img className="folha-foto" src={item.imagem} alt={item.nome} />}
      <header>
        <div>
          <h2>{item.nome}</h2>
          {item.descricao && <p className="desc">{item.descricao}</p>}
        </div>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>

      {(item.escolhas ?? []).map((e) => {
        const grupo = cardapio.adicionais[e.grupo];
        if (!grupo) return null;
        const escolhidos = selecoes[e.grupo] ?? [];
        const cheio = e.max > 1 && escolhidos.length >= e.max;
        const regra = e.max === 1 ? (e.min ? "Escolha 1" : "Opcional, até 1") : `${escolhidos.length} de ${e.max}${e.min ? `, mínimo ${e.min}` : ""}`;
        return (
          <div className="grupo" key={e.grupo}>
            <div className="grupo-titulo">
              <h3>{grupo.nome}</h3>
              <span className={escolhidos.length >= e.min && e.min > 0 ? "ok" : ""}>{regra}</span>
            </div>
            <div className="opcoes">
              {grupo.opcoes.map((op) => {
                const marcado = escolhidos.includes(op.nome);
                return (
                  <button
                    key={op.nome}
                    type="button"
                    className={"opcao" + (op.esgotado ? " riscado" : "")}
                    aria-pressed={marcado}
                    disabled={op.esgotado || (cheio && !marcado)}
                    onClick={() => alternar(e.grupo, op.nome, e.max)}
                  >
                    {op.nome}
                    {op.preco ? ` +${formatar(emPence(op.preco))}` : ""}
                    {op.esgotado ? " (esgotado)" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <label className="campo" htmlFor="obs-item">
        Alguma observação?
        <input id="obs-item" maxLength={150} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sem cebola, bem passado" />
      </label>

      <div className="rodape-folha">
        <div className="contador">
          <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</button>
          <span className="num" aria-live="polite">{qtd}</span>
          <button type="button" onClick={() => setQtd((q) => Math.min(20, q + 1))} aria-label="Aumentar">+</button>
        </div>
        <button
          className="principal"
          disabled={faltando.length > 0}
          onClick={() => onAdicionar({ itemId: item.id, qtd, selecoes, obs: obs.trim() || undefined })}
        >
          <span>{faltando.length ? `Escolha: ${(cardapio.adicionais[faltando[0].grupo]?.nome ?? "uma opção").toLowerCase()}` : "Adicionar"}</span>
          <span className="preco">{formatar(unit * qtd)}</span>
        </button>
      </div>
    </Fundo>
  );
}

function FolhaCarrinho({
  cardapio, loja, estado, horarios, carrinho, setCarrinho, subtotal, pagamentos, onFechar,
}: {
  cardapio: Cardapio;
  loja: AjustesPublicos;
  estado: Estado;
  horarios: Horario[];
  carrinho: Linha[];
  setCarrinho: React.Dispatch<React.SetStateAction<Linha[]>>;
  subtotal: number;
  pagamentos: Pagamentos;
  onFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<"carrinho" | "dados">("carrinho");
  const [form, setForm] = useState({ nome: "", telefone: "", endereco: "", postcode: "", observacao: "", troco: "" });
  const [pagamento, setPagamento] = useState<"dinheiro" | "cartao">(pagamentos.dinheiro ? "dinheiro" : "cartao");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [quando, setQuando] = useState<string>(estado.aberto ? "" : horarios[0]?.valor ?? "");
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [cotando, setCotando] = useState(false);
  const itemPorId = (id: string) => cardapio.itens.find((i) => i.id === id);

  // Fechou enquanto o cliente montava o pedido: passa a pedir um horário.
  useEffect(() => {
    if (!estado.aberto && !quando && horarios[0]) setQuando(horarios[0].valor);
  }, [estado.aberto, quando, horarios]);

  // Lembra nome/endereço do cliente para o próximo pedido.
  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem("panela-cliente") || "{}"); setForm((f) => ({ ...f, ...d, observacao: "", troco: "" })); } catch {}
  }, []);

  // Taxa de entrega pela distância: calcula quando o postcode está completo.
  const postcodeLimpo = form.postcode.replace(/\s+/g, "").toUpperCase();
  useEffect(() => {
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(postcodeLimpo)) { setCotacao(null); return; }
    let vivo = true;
    setCotando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/entrega/cotacao?postcode=${postcodeLimpo}&subtotal=${subtotal}`);
        const d = await r.json();
        if (vivo) setCotacao(d);
      } catch {
        if (vivo) setCotacao(null);
      } finally {
        if (vivo) setCotando(false);
      }
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [postcodeLimpo, subtotal]);

  const primeiraFaixa = [...loja.faixas].sort((a, b) => a.ateMilhas - b.ateMilhas)[0];
  const taxa = cotacao && cotacao.ok ? cotacao.taxa : null;
  const minimo = emPence(loja.pedidoMinimo);
  const total = subtotal + (taxa ?? 0);
  const foraDaArea = !!cotacao && !cotacao.ok;
  const abaixoMinimo = minimo > 0 && subtotal < minimo;
  const nenhumPagamento = !pagamentos.dinheiro && !pagamentos.cartao;

  const mudar = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function mudarQtd(chave: string, delta: number) {
    setCarrinho((c) => c.map((l) => (l.chave === chave ? { ...l, qtd: l.qtd + delta } : l)).filter((l) => l.qtd > 0));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (pagamento === "dinheiro" && form.troco) {
      const t = parseFloat(form.troco.replace(",", "."));
      if (!(t > 0) || emPence(t) < total) { setErro(`O troco precisa ser para um valor maior que ${formatar(total)}.`); return; }
    }
    setEnviando(true);
    try {
      try { localStorage.setItem("panela-cliente", JSON.stringify({ nome: form.nome, telefone: form.telefone, endereco: form.endereco, postcode: form.postcode })); } catch {}
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          trocoPara: pagamento === "dinheiro" && form.troco ? parseFloat(form.troco.replace(",", ".")) : null,
          pagamento,
          agendadoPara: quando || null,
          itens: carrinho.map(({ itemId, qtd, selecoes, obs }) => ({ itemId, qtd, selecoes, obs })),
        }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || "Não foi possível enviar o pedido.");
      // No cartão, o carrinho só é limpo depois que o pagamento é confirmado.
      if (pagamento === "dinheiro") { try { localStorage.removeItem(CHAVE_STORAGE); } catch {} }
      window.location.href = dados.redirecionar;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o pedido. Tente de novo.");
      setEnviando(false);
    }
  }

  if (carrinho.length === 0) {
    return (
      <Fundo onFechar={onFechar} titulo="Carrinho">
        <header><h2>Seu carrinho está vazio</h2><button className="fechar" onClick={onFechar} aria-label="Fechar">×</button></header>
        <button className="principal" onClick={onFechar}><span>Ver cardápio</span></button>
      </Fundo>
    );
  }

  return (
    <Fundo onFechar={onFechar} titulo="Carrinho">
      <header>
        <h2>{etapa === "carrinho" ? "Seu pedido" : "Entrega e pagamento"}</h2>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>

      {etapa === "carrinho" ? (
        <>
          <div className="linhas">
            {carrinho.map((l) => {
              const item = itemPorId(l.itemId)!;
              return (
                <div className="linha" key={l.chave}>
                  <div>
                    <div className="nome">{item.nome}</div>
                    {detalhes(item, l.selecoes) && <div className="det">{detalhes(item, l.selecoes)}</div>}
                    {l.obs && <div className="det">Obs.: {l.obs}</div>}
                  </div>
                  <div>
                    <div className="preco" style={{ textAlign: "right", fontWeight: 700 }}>{formatar(precoUnitario(cardapio, item, l.selecoes) * l.qtd)}</div>
                    <div className="acoes">
                      <button onClick={() => mudarQtd(l.chave, -1)} aria-label={`Tirar um ${item.nome}`}>−</button>
                      <span className="num">{l.qtd}</span>
                      <button onClick={() => mudarQtd(l.chave, 1)} aria-label={`Mais um ${item.nome}`} disabled={l.qtd >= 20}>+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Totais subtotal={subtotal} taxa={null} total={subtotal} />
          {primeiraFaixa && (
            <p className="dica-entrega">
              Entrega a partir de {formatar(emPence(primeiraFaixa.taxa))}
              {primeiraFaixa.gratisAcima != null ? `, grátis acima de ${formatar(emPence(primeiraFaixa.gratisAcima))} perto da cozinha` : ""}.
              A taxa exata aparece quando você colocar o postcode.
            </p>
          )}
          {abaixoMinimo && <p className="erro">Pedido mínimo para entrega: {formatar(minimo)}.</p>}
          <button className="principal" disabled={abaixoMinimo} onClick={() => setEtapa("dados")}>
            <span>Continuar</span><span className="preco">{formatar(subtotal)}</span>
          </button>
        </>
      ) : (
        <form onSubmit={enviar} style={{ display: "grid", gap: 14 }}>
          <label className="campo" htmlFor="f-nome">Nome
            <input id="f-nome" required maxLength={80} autoComplete="name" value={form.nome} onChange={mudar("nome")} />
          </label>
          <label className="campo" htmlFor="f-tel">WhatsApp / telefone
            <input id="f-tel" required inputMode="tel" maxLength={30} autoComplete="tel" placeholder="07..." value={form.telefone} onChange={mudar("telefone")} />
          </label>
          <label className="campo" htmlFor="f-end">Endereço
            <input id="f-end" required maxLength={160} autoComplete="street-address" placeholder="Número, rua, apartamento" value={form.endereco} onChange={mudar("endereco")} />
          </label>
          <label className="campo" htmlFor="f-pc">Postcode
            <input id="f-pc" required maxLength={10} autoComplete="postal-code" style={{ textTransform: "uppercase" }} value={form.postcode} onChange={mudar("postcode")} aria-describedby="f-pc-info" />
            <span id="f-pc-info" className={"dica" + (foraDaArea ? " erro-texto" : "")} aria-live="polite">
              {cotando ? "Calculando a entrega..." : cotacao ? (cotacao.ok ? (cotacao.gratis ? `${cotacao.milhas} milhas da cozinha: entrega grátis!` : `${cotacao.milhas} milhas da cozinha: entrega ${formatar(cotacao.taxa)}${cotacao.gratisAcima != null ? ` (grátis acima de ${formatar(cotacao.gratisAcima)})` : ""}.`) : cotacao.motivo) : ""}
            </span>
          </label>

          <div className="grupo">
            <div className="grupo-titulo"><h3>Quando você quer receber?</h3></div>
            {!estado.aberto && (
              <p className="dica">A cozinha está fechada agora. Escolha um horário e seu pedido fica reservado.</p>
            )}
            <label className="campo" htmlFor="f-quando">
              <span className="sr-only">Horário de entrega</span>
              <select id="f-quando" className="select" value={quando} onChange={(e) => setQuando(e.target.value)} required={!estado.aberto}>
                {estado.aberto && <option value="">Agora, o quanto antes</option>}
                {horarios.map((h) => <option key={h.valor} value={h.valor}>{h.rotulo}</option>)}
              </select>
            </label>
          </div>
          <label className="campo" htmlFor="f-obs">Observação para a entrega <span className="dica">(opcional)</span>
            <textarea id="f-obs" maxLength={300} placeholder="Ex.: tocar o interfone 3" value={form.observacao} onChange={mudar("observacao")} />
          </label>

          <div className="grupo">
            <div className="grupo-titulo"><h3>Como vai pagar?</h3></div>
            {nenhumPagamento && <p className="erro">Nenhuma forma de pagamento está ativa no momento.</p>}
            <div className="pagamentos" role="radiogroup">
              {pagamentos.dinheiro && (
                <label className="pagamento">
                  <input type="radio" name="pagamento" checked={pagamento === "dinheiro"} onChange={() => setPagamento("dinheiro")} />
                  <strong>Dinheiro na entrega</strong>
                  <span>Você paga em cash para o entregador.</span>
                </label>
              )}
              {pagamentos.cartao && (
                <label className="pagamento">
                  <input type="radio" name="pagamento" checked={pagamento === "cartao"} onChange={() => setPagamento("cartao")} />
                  <strong>Cartão agora</strong>
                  <span>Débito, crédito, Apple Pay ou Google Pay, em página segura.</span>
                </label>
              )}
            </div>
          </div>

          {pagamento === "dinheiro" && pagamentos.dinheiro && (
            <label className="campo" htmlFor="f-troco">Precisa de troco? <span className="dica">Deixe vazio se for pagar o valor exato.</span>
              <input id="f-troco" inputMode="decimal" placeholder={`Troco para quanto? Ex.: ${Math.ceil(total / 1000) * 10}`} value={form.troco} onChange={mudar("troco")} />
            </label>
          )}

          <Totais subtotal={subtotal} taxa={taxa} total={total} />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="principal" type="submit" disabled={enviando || nenhumPagamento || foraDaArea || (!estado.aberto && !quando)}>
            <span>{enviando ? "Enviando..." : pagamento === "cartao" ? "Ir para o pagamento" : quando ? "Reservar pedido" : "Fazer pedido"}</span>
            <span className="preco">{formatar(total)}</span>
          </button>
          <button type="button" className="secundario" onClick={() => setEtapa("carrinho")}>← Voltar ao carrinho</button>
        </form>
      )}
    </Fundo>
  );
}

function Totais({ subtotal, taxa, total }: { subtotal: number; taxa: number | null; total: number }) {
  return (
    <div className="totais preco">
      <div><span>Subtotal</span><span>{formatar(subtotal)}</span></div>
      <div><span>Entrega</span><span>{taxa == null ? "pelo postcode" : taxa ? formatar(taxa) : "Grátis"}</span></div>
      <div className="total"><span>Total</span><span>{formatar(total)}</span></div>
    </div>
  );
}
