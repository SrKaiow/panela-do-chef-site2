"use client";

import { useEffect, useState } from "react";
import { cardapio, loja, emPence, formatar, precoUnitario, type Item, type LinhaCarrinho } from "@/lib/cardapio";
import Hero, { Faixa } from "./Hero";
import QuantoPedir from "./QuantoPedir";
import { IconeCategoria } from "./Icones";

type Linha = LinhaCarrinho & { chave: string };
type Pagamentos = { dinheiro: boolean; cartao: boolean };

const CHAVE_STORAGE = "panela-carrinho-v1";
const itemPorId = (id: string) => cardapio.itens.find((i) => i.id === id);

function detalhes(item: Item, selecoes: Record<string, string[]>) {
  return (item.escolhas ?? [])
    .map((e) => (selecoes[e.grupo]?.length ? selecoes[e.grupo].join(", ") : ""))
    .filter(Boolean)
    .join(" · ");
}

export default function Loja({ pagamentos }: { pagamentos: Pagamentos }) {
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [aberto, setAberto] = useState<Item | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);

  // Guarda o carrinho no navegador para não perder se a página recarregar.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || "[]") as Linha[];
      setCarrinho(salvo.filter((l) => itemPorId(l.itemId)?.disponivel));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CHAVE_STORAGE, JSON.stringify(carrinho)); } catch {}
  }, [carrinho]);

  const qtdTotal = carrinho.reduce((s, l) => s + l.qtd, 0);
  const subtotal = carrinho.reduce((s, l) => {
    const item = itemPorId(l.itemId);
    return item ? s + precoUnitario(item, l.selecoes) * l.qtd : s;
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
      <Hero dinheiro={pagamentos.dinheiro} cartao={pagamentos.cartao} />
      <Faixa />
      <QuantoPedir onAdicionar={adicionarVarios} />

      <nav className="abas" aria-label="Categorias" id="cardapio">
        <div className="miolo">
          {cardapio.categorias.map((c) => (
            <a key={c.id} href={"#" + c.id}>{c.nome}</a>
          ))}
        </div>
      </nav>

      <main className="miolo cardapio">
        {!loja.aberto && <p className="aviso-fechado">{loja.mensagemFechado}</p>}
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
                  <button key={item.id} className="item" disabled={!item.disponivel || !loja.aberto} onClick={() => setAberto(item)}>
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
            <span><span className="qtd num">{qtdTotal}</span>Ver carrinho</span>
            <span className="preco">{formatar(subtotal)}</span>
          </button>
        </div>
      )}

      {aberto && <FolhaItem item={aberto} onFechar={() => setAberto(null)} onAdicionar={adicionar} />}
      {verCarrinho && (
        <FolhaCarrinho
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

function FolhaItem({ item, onFechar, onAdicionar }: { item: Item; onFechar: () => void; onAdicionar: (l: LinhaCarrinho) => void }) {
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  const faltando = (item.escolhas ?? []).filter((e) => (selecoes[e.grupo]?.length ?? 0) < e.min);
  const unit = precoUnitario(item, selecoes);

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
      <header>
        <div>
          <h2>{item.nome}</h2>
          {item.descricao && <p className="desc">{item.descricao}</p>}
        </div>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>

      {(item.escolhas ?? []).map((e) => {
        const grupo = cardapio.adicionais[e.grupo];
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
          <span>{faltando.length ? `Escolha: ${cardapio.adicionais[faltando[0].grupo].nome.toLowerCase()}` : "Adicionar"}</span>
          <span className="preco">{formatar(unit * qtd)}</span>
        </button>
      </div>
    </Fundo>
  );
}

function FolhaCarrinho({
  carrinho, setCarrinho, subtotal, pagamentos, onFechar,
}: {
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

  // Lembra nome/endereço do cliente para o próximo pedido.
  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem("panela-cliente") || "{}"); setForm((f) => ({ ...f, ...d, observacao: "", troco: "" })); } catch {}
  }, []);

  const taxa = emPence(loja.entrega.taxa);
  const minimo = emPence(loja.entrega.pedidoMinimo);
  const total = subtotal + taxa;
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
                    <div className="preco" style={{ textAlign: "right", fontWeight: 700 }}>{formatar(precoUnitario(item, l.selecoes) * l.qtd)}</div>
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
          <Totais subtotal={subtotal} taxa={taxa} total={total} />
          {abaixoMinimo && <p className="erro">Pedido mínimo para entrega: {formatar(minimo)}.</p>}
          <button className="principal" disabled={abaixoMinimo} onClick={() => setEtapa("dados")}>
            <span>Continuar</span><span className="preco">{formatar(total)}</span>
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
            <input id="f-pc" required maxLength={10} autoComplete="postal-code" style={{ textTransform: "uppercase" }} value={form.postcode} onChange={mudar("postcode")} />
          </label>
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
          <button className="principal" type="submit" disabled={enviando || nenhumPagamento}>
            <span>{enviando ? "Enviando..." : pagamento === "cartao" ? "Ir para o pagamento" : "Fazer pedido"}</span>
            <span className="preco">{formatar(total)}</span>
          </button>
          <button type="button" className="secundario" onClick={() => setEtapa("carrinho")}>← Voltar ao carrinho</button>
        </form>
      )}
    </Fundo>
  );
}

function Totais({ subtotal, taxa, total }: { subtotal: number; taxa: number; total: number }) {
  return (
    <div className="totais preco">
      <div><span>Subtotal</span><span>{formatar(subtotal)}</span></div>
      <div><span>Entrega</span><span>{taxa ? formatar(taxa) : "Grátis"}</span></div>
      <div className="total"><span>Total</span><span>{formatar(total)}</span></div>
    </div>
  );
}
