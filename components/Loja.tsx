"use client";

import { useCallback, useEffect, useState } from "react";
import { emPence, formatar, precoUnitario, resumirEscolhas, type Cardapio, type Item, type LinhaCarrinho } from "@/lib/cardapio";
import type { AjustesPublicos } from "@/lib/ajustes";
import { nomeAlergenico } from "@/lib/alergenicos";
import { estadoLoja, type Estado, type Horario } from "@/lib/horario";
import Hero, { Faixa } from "./Hero";
import QuantoPedir from "./QuantoPedir";
import { IconeCategoria } from "./Icones";
import Novidades from "./Novidades";

type Linha = LinhaCarrinho & { chave: string };
type Pagamentos = { dinheiro: boolean; cartao: boolean };
type Cotacao = { ok: true; milhas: number; taxa: number; gratisAcima: number | null; gratis: boolean } | { ok: false; motivo: string };

const CHAVE_STORAGE = "panela-carrinho-v1";
const CHAVE_ULTIMO = "panela-ultimo-pedido";
const CHAVE_CLIENTE = "panela-cliente";

function detalhes(item: Item, selecoes: Record<string, string[]>) {
  return (item.escolhas ?? [])
    .map((e) => (selecoes[e.grupo]?.length ? resumirEscolhas(selecoes[e.grupo]) : ""))
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

      {/* Âncora fora da barra fixa: rolar até a barra (que fica grudada no topo) não movia a página. */}
      <div id="cardapio" className="ancora-cardapio" aria-hidden="true" />
      <nav className="abas" aria-label="Categorias">
        <div className="miolo">
          {cardapio.categorias.map((c) => (
            <a key={c.id} href={"#" + c.id}>{c.nome}</a>
          ))}
        </div>
      </nav>

      <main className="miolo cardapio">
        <PedirDeNovo cardapio={cardapio} carrinhoVazio={carrinho.length === 0} onAdicionar={adicionarVarios} />
        <Novidades itens={cardapio.itens} abrir={setAberto} />
        {!estado.aberto && (
          <p className="aviso-agendar">
            <strong>Cozinha fechada agora.</strong> Entregas voltam
            {estado.proxima ? ` ${estado.proxima.quando} às ${estado.proxima.abre}` : " quando a cozinha abrir"}. Quer garantir o seu? Reserve um horário e venha <strong>coletar na porta</strong>.
          </p>
        )}
        <p className="aviso-alergia">
          <strong>Tem alguma alergia?</strong> Toque no item para ver os alergênicos. Na dúvida, fale com a gente no WhatsApp antes de pedir.
          Tudo é preparado na mesma cozinha, então pode haver traços.
        </p>
        <MaisPedidos itens={cardapio.itens.filter((i) => !i.novidade)} abrir={setAberto} />
        {cardapio.categorias.map((cat) => {
          const itens = cardapio.itens.filter((i) => i.categoria === cat.id);
          if (!itens.length) return null;
          // Disponíveis primeiro, esgotados no fim da seção.
          // Disponíveis primeiro; dentro deles, do mais caro para o mais barato.
          itens.sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || b.preco - a.preco || a.nome.localeCompare(b.nome));
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
                      {item.video ? (
                        <video autoPlay muted loop playsInline preload="metadata" poster={item.video + "-capa.jpg"} aria-hidden="true">
                          <source src={item.video + ".webm"} type="video/webm" />
                          <source src={item.video + ".mp4"} type="video/mp4" />
                        </video>
                      ) : item.imagem ? <img src={item.imagem} alt="" loading="lazy" /> : <IconeCategoria categoria={item.categoria} />}
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
                          <span className={"tag " + (item.emBreve ? "em-breve" : "esgotado")}>{item.emBreve ? "Em breve" : item.voltaEm ? "Esgotado · volta amanhã" : "Esgotado"}</span>
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
              ? `Voltamos ${estado.proxima.quando} às ${estado.proxima.abre}. Se quiser, já reserve seu pedido para coletar na porta.`
              : "Se quiser, já reserve seu pedido para coletar na porta."}
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
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);
  useEffect(() => {
    // Trava a página de trás de verdade (position: fixed). Só overflow: hidden não basta no iPhone:
    // ao abrir o teclado a página rola por baixo e o cursor dos campos fica fora do lugar.
    const y = window.scrollY;
    const b = document.body.style;
    const antes = { overflow: b.overflow, position: b.position, top: b.top, width: b.width };
    Object.assign(b, { overflow: "hidden", position: "fixed", top: `-${y}px`, width: "100%" });
    return () => {
      Object.assign(b, antes);
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    };
  }, []);
  return (
    <div className="fundo" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo}>{children}</div>
    </div>
  );
}

function FolhaItem({ cardapio, item, onFechar, onAdicionar }: { cardapio: Cardapio; item: Item; onFechar: () => void; onAdicionar: (l: LinhaCarrinho) => void }) {
  // Opções marcadas como "pré-selecionar" no painel já vêm escolhidas.
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>(() => {
    const ini: Record<string, string[]> = {};
    for (const e of item.escolhas ?? []) {
      const padrao = (cardapio.adicionais[e.grupo]?.opcoes ?? []).filter((o) => o.padrao && !o.esgotado).map((o) => o.nome);
      if (padrao.length) ini[e.grupo] = padrao.slice(0, e.max);
    }
    return ini;
  });
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  const faltando = (item.escolhas ?? []).filter((e) => (selecoes[e.grupo]?.length ?? 0) < e.min);
  const unit = precoUnitario(cardapio, item, selecoes);

  // Grupos com "repetir": mais uma / menos uma da mesma opção.
  function somar(grupo: string, nome: string, max: number, delta: 1 | -1) {
    setSelecoes((s) => {
      const atual = s[grupo] ?? [];
      if (delta === 1) return atual.length >= max ? s : { ...s, [grupo]: [...atual, nome] };
      const i = atual.lastIndexOf(nome);
      return i < 0 ? s : { ...s, [grupo]: [...atual.slice(0, i), ...atual.slice(i + 1)] };
    });
  }

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
      {item.video ? (
        <video className="folha-foto folha-video" autoPlay muted loop playsInline poster={item.video + "-capa.jpg"} aria-label={item.nome}>
          <source src={item.video + ".webm"} type="video/webm" />
          <source src={item.video + ".mp4"} type="video/mp4" />
        </video>
      ) : (
        item.imagem && <img className="folha-foto" src={item.imagem} alt={item.nome} />
      )}
      <header>
        <div>
          <h2>{item.nome}</h2>
          {item.descricao && <p className="desc">{item.descricao}</p>}
        </div>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>
      <p className={"alergenicos" + (item.alergenicos?.length ? " contem" : "")}>
        <strong>Alergênicos:</strong>{" "}
        {item.alergenicos == null
          ? "ainda não informados. Tem alergia? Fale com a gente no WhatsApp antes de pedir."
          : item.alergenicos.length
            ? `contém ${item.alergenicos.map(nomeAlergenico).join(", ").toLowerCase()}.`
            : "não contém nenhum dos 14 alergênicos principais."}
        <span> Tudo é preparado na mesma cozinha, então pode haver traços.</span>
      </p>

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
            {grupo.regras?.repetir && e.max > 1 ? (
              <div className="opcoes-rep">
                {grupo.opcoes.map((op) => {
                  const n = escolhidos.filter((x) => x === op.nome).length;
                  return (
                    <div key={op.nome} className={"opcao-rep" + (n ? " ligada" : "") + (op.esgotado ? " riscado" : "") + (op.destaque && !op.esgotado ? " destaque" : "")}>
                      {op.imagem && <img className="opcao-foto" src={op.imagem} alt="" loading="lazy" />}
                      <span className="opcao-nome">
                        {op.destaque && !op.esgotado && <span className="opcao-selo">Mais pedido</span>}
                        {op.nome}
                        {op.preco ? <em className="extra">+{formatar(emPence(op.preco))}</em> : null}
                        {op.esgotado ? <em> esgotado</em> : null}
                      </span>
                      <span className="opcao-qtd">
                        {n > 0 && <button type="button" onClick={() => somar(e.grupo, op.nome, e.max, -1)} aria-label={`Tirar um ${op.nome}`}>−</button>}
                        {n > 0 && <span className="num">{n}</span>}
                        <button type="button" disabled={op.esgotado || cheio} onClick={() => somar(e.grupo, op.nome, e.max, 1)} aria-label={`Adicionar ${op.nome}`}>+</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={"opcoes" + (grupo.opcoes.some((o) => o.imagem) ? " grade" : "")}>
                {[...grupo.opcoes].sort((x, y) => Number(!!x.esgotado) - Number(!!y.esgotado)).map((op) => {
                  const marcado = escolhidos.includes(op.nome);
                  if (grupo.opcoes.some((o) => o.imagem))
                    return (
                      <button
                        key={op.nome}
                        type="button"
                        className={"opcao-card" + (op.esgotado ? " riscado" : "")}
                        aria-pressed={marcado}
                        disabled={op.esgotado || (cheio && !marcado)}
                        onClick={() => alternar(e.grupo, op.nome, e.max)}
                      >
                        <span className="oc-foto">
                          {op.imagem ? <img src={op.imagem} alt="" loading="lazy" /> : <span aria-hidden="true">{op.nome.charAt(0)}</span>}
                          {marcado && <span className="oc-check" aria-hidden="true">✓</span>}
                          {op.esgotado && <span className="oc-esgotado">Esgotado</span>}
                        </span>
                        <span className="oc-nome">{op.nome}</span>
                        <span className="oc-preco">{op.preco ? `+${formatar(emPence(op.preco))}` : "Grátis"}</span>
                      </button>
                    );
                  return (
                    <button
                      key={op.nome}
                      type="button"
                      className={"opcao" + (op.esgotado ? " riscado" : "") + (op.imagem ? " com-foto" : "")}
                      aria-pressed={marcado}
                      disabled={op.esgotado || (cheio && !marcado)}
                      onClick={() => alternar(e.grupo, op.nome, e.max)}
                    >
                      {op.imagem && <img className="opcao-foto" src={op.imagem} alt="" loading="lazy" />}
                      {op.nome}
                      {op.preco ? <em className="extra">+{formatar(emPence(op.preco))}</em> : null}
                      {op.esgotado ? " (esgotado)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {item.categoria !== "bebidas" && (
        <label className="campo" htmlFor="obs-item">
          Alguma observação?
          <input id="obs-item" maxLength={150} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sem cebola, bem passado" />
        </label>
      )}

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
  const [form, setForm] = useState({ nome: "", telefone: "", endereco: "", postcode: "", observacao: "", troco: "", site: "" });
  const [pagamento, setPagamento] = useState<"dinheiro" | "cartao">(pagamentos.cartao ? "cartao" : "dinheiro");
  /** Dinheiro: o cliente sempre diz se vai pagar exato ou se precisa de troco. */
  const [troco, setTroco] = useState<"exato" | "sim" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [quando, setQuando] = useState<string>(estado.aberto ? "" : horarios[0]?.valor ?? "");
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [cotando, setCotando] = useState(false);
  /** Entrega em casa ou o cliente vem buscar na porta (sem taxa). */
  const [modo, setModo] = useState<"entrega" | "coleta">("entrega");
  const coleta = modo === "coleta";
  /** Coleta: localização do celular conferida (precisa estar dentro do raio). */
  const [local, setLocal] = useState<{ lat: number; lng: number; milhas: number } | null>(null);
  const [localErro, setLocalErro] = useState("");
  const [localizando, setLocalizando] = useState(false);
  function pegarLocal() {
    setLocalErro("");
    if (!("geolocation" in navigator)) { setLocalErro("Este celular não deixou pegar a localização. Escolha Entrega."); return; }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          const r = await fetch(`/api/entrega/perto?lat=${lat}&lng=${lng}`, { cache: "no-store" });
          const d = await r.json();
          if (d.ok) setLocal({ lat, lng, milhas: d.milhas });
          else { setLocal(null); setLocalErro(d.motivo || "Não foi possível conferir a localização."); }
        } catch {
          setLocalErro("Não foi possível conferir a localização. Tente de novo.");
        } finally {
          setLocalizando(false);
        }
      },
      (e) => {
        setLocalizando(false);
        setLocalErro(e.code === 1
          ? "Você não deixou usar a localização. Para coletar, ative a localização (Ajustes > Safari/Chrome > Localização) e tente de novo, ou escolha Entrega."
          : "Não conseguimos achar sua localização. Tente de novo em um lugar aberto.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  const itemPorId = (id: string) => cardapio.itens.find((i) => i.id === id);

  // Fechou enquanto o cliente montava o pedido: passa a pedir um horário.
  useEffect(() => {
    if (!estado.aberto && !quando && horarios[0]) setQuando(horarios[0].valor);
  }, [estado.aberto, quando, horarios]);

  // Lembra nome/endereço do cliente para o próximo pedido (se ele deixou salvar).
  const [salvarDados, setSalvarDados] = useState(true);
  const [jaSalvo, setJaSalvo] = useState(false);
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(CHAVE_CLIENTE) || "null");
      if (d && d.nome) { const { modo: m, ...resto } = d; setForm((f) => ({ ...f, ...resto, observacao: "", troco: "" })); if (m === "coleta") setModo("coleta"); setJaSalvo(true); }
    } catch {}
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
  const taxa = coleta ? 0 : cotacao && cotacao.ok ? cotacao.taxa : null;
  const minimo = emPence(loja.pedidoMinimo);
  const total = subtotal + (taxa ?? 0);
  const foraDaArea = !coleta && !!cotacao && !cotacao.ok;
  const abaixoMinimo = !coleta && minimo > 0 && subtotal < minimo;
  const nenhumPagamento = !pagamentos.dinheiro && !pagamentos.cartao;

  const mudar = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function mudarQtd(chave: string, delta: number) {
    setCarrinho((c) => c.map((l) => (l.chave === chave ? { ...l, qtd: l.qtd + delta } : l)).filter((l) => l.qtd > 0));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (pagamento === "dinheiro") {
      if (!troco) { setErro("Diga se vai pagar o valor exato ou se precisa de troco."); return; }
      if (troco === "sim") {
        const t = parseFloat(form.troco.replace(",", "."));
        if (!(t > 0) || emPence(t) <= total) { setErro(`Diga com quanto vai pagar: um valor maior que ${formatar(total)}.`); return; }
      }
    }
    setEnviando(true);
    try {
      try {
        if (salvarDados) {
          localStorage.setItem(CHAVE_CLIENTE, JSON.stringify({ nome: form.nome, telefone: form.telefone, endereco: form.endereco, postcode: form.postcode, modo }));
          const linhas = carrinho.map(({ itemId, qtd, selecoes, obs }) => ({ itemId, qtd, selecoes, obs }));
          localStorage.setItem(CHAVE_ULTIMO, JSON.stringify({ em: new Date().toISOString(), linhas }));
        } else {
          localStorage.removeItem(CHAVE_CLIENTE);
          localStorage.removeItem(CHAVE_ULTIMO);
        }
      } catch {}
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          trocoPara: pagamento === "dinheiro" && troco === "sim" && form.troco ? parseFloat(form.troco.replace(",", ".")) : null,
          pagamento,
          retirada: coleta,
          local: coleta && local ? { lat: local.lat, lng: local.lng } : undefined,
          agendadoPara: coleta ? quando || null : null,
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
          {/* campo-isca contra robôs: escondido de pessoas */}
          <input className="isca" tabIndex={-1} autoComplete="off" aria-hidden="true" name="site" value={form.site} onChange={mudar("site")} />
          <div className="modo-entrega" role="radiogroup" aria-label="Entrega ou coleta">
            <button type="button" role="radio" aria-checked={!coleta} className={!coleta ? "ligado" : ""} onClick={() => setModo("entrega")}>
              Entrega<small>levamos até você</small>
            </button>
            <button type="button" role="radio" aria-checked={coleta} className={coleta ? "ligado" : ""} onClick={() => setModo("coleta")}>
              Coletar<small>na porta · sem taxa</small>
            </button>
          </div>
          <label className="campo" htmlFor="f-nome">Nome
            <input id="f-nome" required maxLength={80} autoComplete="name" value={form.nome} onChange={mudar("nome")} />
          </label>
          <label className="campo" htmlFor="f-tel">WhatsApp / telefone
            <input id="f-tel" required inputMode="tel" maxLength={30} autoComplete="tel" placeholder="07..." value={form.telefone} onChange={mudar("telefone")} />
          </label>
          {coleta ? (
            <div className="coleta-confirma">
              <p className="dica">Você vem buscar na porta da <strong>Panela do Chef · Epsom, KT17 1JW</strong>. Para pedir para coletar, confirme que está por perto (até {loja.raioMilhas} milhas).</p>
              {local ? (
                <p className="coleta-ok">✓ Você está a {local.milhas} milhas daqui. Pode pedir!</p>
              ) : (
                <button type="button" className="principal" onClick={pegarLocal} disabled={localizando}>
                  <span>{localizando ? "Procurando sua localização..." : "📍 Confirmar minha localização"}</span>
                </button>
              )}
              {localErro && <p className="erro" role="alert">{localErro}</p>}
            </div>
          ) : (<>
          <label className="campo" htmlFor="f-end">Endereço
            <input id="f-end" required maxLength={160} autoComplete="street-address" placeholder="Número, rua, apartamento" value={form.endereco} onChange={mudar("endereco")} />
          </label>
          <label className="campo" htmlFor="f-pc">Postcode
            <input id="f-pc" required maxLength={10} autoComplete="postal-code" style={{ textTransform: "uppercase" }} value={form.postcode} onChange={mudar("postcode")} aria-describedby="f-pc-info" />
            <span id="f-pc-info" className={"dica" + (foraDaArea ? " erro-texto" : "")} aria-live="polite">
              {cotando ? "Calculando a entrega..." : cotacao ? (cotacao.ok ? (cotacao.gratis ? `${cotacao.milhas} milhas da cozinha: entrega grátis!` : `${cotacao.milhas} milhas da cozinha: entrega ${formatar(cotacao.taxa)}${cotacao.gratisAcima != null ? ` (grátis acima de ${formatar(cotacao.gratisAcima)})` : ""}.`) : cotacao.motivo) : ""}
            </span>
          </label>
          </>)}

          {!coleta && (estado.aberto ? (
            <p className="dica">Entrega agora, o quanto antes. Quer deixar reservado para mais tarde? Escolha <strong>Coletar</strong>.</p>
          ) : (
            <p className="erro" role="alert">A cozinha está fechada agora, então não dá para pedir entrega{estado.proxima ? ` (voltamos ${estado.proxima.quando} às ${estado.proxima.abre})` : ""}. Para deixar o pedido reservado, escolha <strong>Coletar</strong> e venha buscar na porta.</p>
          ))}
          {coleta && <div className="grupo">
            <div className="grupo-titulo"><h3>Quando você vem buscar?</h3></div>
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
          </div>}
          <label className="campo" htmlFor="f-obs">Observação <span className="dica">({coleta ? "alergia ou recado" : "entrega ou alergia"}, opcional)</span>
            <textarea id="f-obs" maxLength={300} placeholder="Ex.: tocar o interfone 3 · tenho alergia a amendoim" value={form.observacao} onChange={mudar("observacao")} />
          </label>

          <div className="grupo">
            <div className="grupo-titulo"><h3>Como vai pagar?</h3></div>
            {nenhumPagamento && <p className="erro">Nenhuma forma de pagamento está ativa no momento.</p>}
            <div className="pagamentos" role="radiogroup">
              {pagamentos.cartao && (
                <label className="pagamento pagamento-online">
                  <input type="radio" name="pagamento" checked={pagamento === "cartao"} onChange={() => setPagamento("cartao")} />
                  <strong>Apple Pay, Google Pay ou cartão</strong>
                  <span>Pague agora, em página segura da {loja.provedorCartao === "square" ? "Square" : "Stripe"}. Seu pedido vai direto para a cozinha.</span>
                  <span className="selos" aria-label="Aceitamos Apple Pay, Google Pay, Visa, Mastercard e American Express">
                    <i className="selo-pg preto">Apple Pay</i>
                    <i className="selo-pg branco">G Pay</i>
                    <i className="selo-pg visa">VISA</i>
                    <i className="selo-pg master"><b /><b /></i>
                    <i className="selo-pg amex">AMEX</i>
                  </span>
                </label>
              )}
              {pagamentos.dinheiro && (
                <label className="pagamento">
                  <input type="radio" name="pagamento" checked={pagamento === "dinheiro"} onChange={() => setPagamento("dinheiro")} />
                  <strong>{coleta ? "Dinheiro na coleta" : "Dinheiro na entrega"}</strong>
                  <span>{coleta ? "Você paga em cash quando vier buscar." : "Você paga em cash para o entregador."}</span>
                </label>
              )}
            </div>
          </div>

          {pagamento === "dinheiro" && pagamentos.dinheiro && (
            <div className="grupo">
              <div className="grupo-titulo"><h3>Precisa de troco?</h3></div>
              <div className="pagamentos troco-opcoes" role="radiogroup" aria-label="Precisa de troco?">
                <label className="pagamento">
                  <input type="radio" name="troco" checked={troco === "exato"} onChange={() => { setTroco("exato"); setForm((f) => ({ ...f, troco: "" })); }} />
                  <strong>Não, vou pagar o valor exato</strong>
                  <span>{taxa == null ? "O total aparece depois do postcode." : `Tenho ${formatar(total)} certinho.`}</span>
                </label>
                <label className="pagamento">
                  <input type="radio" name="troco" checked={troco === "sim"} onChange={() => setTroco("sim")} />
                  <strong>Sim, preciso de troco</strong>
                  <span>{coleta ? "Separamos o troco certo para você." : "O entregador já leva o troco certo."}</span>
                </label>
              </div>
              {troco === "sim" && (
                <div className="troco-valor">
                  <span className="dica">Com quanto você vai pagar?</span>
                  <div className="troco-notas">
                    {notasSugeridas(total).map((n) => (
                      <button type="button" key={n} className={"nota" + (form.troco === String(n) ? " ativa" : "")} onClick={() => setForm((f) => ({ ...f, troco: String(n) }))}>£{n}</button>
                    ))}
                  </div>
                  <label className="campo" htmlFor="f-troco">
                    <span className="sr-only">Outro valor</span>
                    <input id="f-troco" inputMode="decimal" placeholder="Outro valor, ex.: 90" value={form.troco} onChange={mudar("troco")} />
                  </label>
                  {(() => {
                    const t = parseFloat(form.troco.replace(",", "."));
                    if (!(t > 0) || taxa == null) return null;
                    const v = emPence(t);
                    return v > total
                      ? <p className="troco-calc">Você paga {formatar(v)} e recebe <strong>{formatar(v - total)}</strong> de troco.</p>
                      : <p className="troco-calc erro-texto">Precisa ser mais que {formatar(total)}.</p>;
                  })()}
                </div>
              )}
            </div>
          )}

          <Totais subtotal={subtotal} taxa={taxa} total={total} coleta={coleta} />
          <label className="salvar-dados">
            <input type="checkbox" checked={salvarDados} onChange={(e) => setSalvarDados(e.target.checked)} />
            <span>
              <strong>{jaSalvo ? "Manter meus dados salvos" : "Salvar meus dados para a próxima vez"}</strong>
              <small>Fica só neste celular: da próxima vez seu endereço já vem preenchido e dá para repetir este pedido com um toque.</small>
            </span>
          </label>
          <p className="dica">Usamos seus dados só para preparar e entregar o pedido. <a href="/privacidade" target="_blank">Política de privacidade</a>.</p>
          {foraDaArea && cotacao && !cotacao.ok && <p className="erro fora-area" role="alert">{cotacao.motivo}</p>}
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="principal" type="submit" disabled={enviando || nenhumPagamento || foraDaArea || (coleta && !local) || (!coleta && !estado.aberto) || (coleta && !estado.aberto && !quando) || (pagamento === "dinheiro" && !troco)}>
            <span>{enviando ? "Enviando..." : pagamento === "cartao" ? "Ir para o pagamento" : coleta && quando ? "Reservar pedido" : "Fazer pedido"}</span>
            <span className="preco">{formatar(total)}</span>
          </button>
          <button type="button" className="secundario" onClick={() => setEtapa("carrinho")}>← Voltar ao carrinho</button>
        </form>
      )}
    </Fundo>
  );
}

/** Notas prováveis acima do total: £88.50 -> £90, £100. */
function notasSugeridas(totalPence: number) {
  const t = totalPence / 100;
  const v = new Set<number>();
  for (const passo of [5, 10, 20, 50]) {
    const n = Math.ceil(t / passo) * passo;
    v.add(n === t ? n + passo : n);
  }
  return [...v].filter((n) => n > t).sort((a, b) => a - b).slice(0, 4);
}

function Totais({ subtotal, taxa, total, coleta }: { subtotal: number; taxa: number | null; total: number; coleta?: boolean }) {
  return (
    <div className="totais preco">
      <div><span>Subtotal</span><span>{formatar(subtotal)}</span></div>
      {coleta ? <div><span>Coleta na porta</span><span>Grátis</span></div> : <div><span>Entrega</span><span>{taxa == null ? "pelo postcode" : taxa ? formatar(taxa) : "Grátis"}</span></div>}
      <div className="total"><span>Total</span><span>{formatar(total)}</span></div>
    </div>
  );
}

/** Faixa "Mais pedidos": os itens marcados como destaque no painel, com foto grande. */
function MaisPedidos({ itens, abrir }: { itens: Item[]; abrir: (i: Item) => void }) {
  const destaques = itens.filter((i) => i.destaque).sort((a, b) => Number(b.disponivel) - Number(a.disponivel));
  if (!destaques.length) return null;
  return (
    <section className="secao mais-pedidos" aria-labelledby="mais-pedidos-titulo">
      <div className="secao-topo">
        <h2 id="mais-pedidos-titulo">Mais pedidos</h2>
        <span className="risco" aria-hidden="true" />
      </div>
      <div className="mp-trilho">
        {destaques.map((item) => (
          <button key={item.id} className="mp-card" disabled={!item.disponivel} onClick={() => abrir(item)}>
            <div className="mp-foto">
              {item.imagem ? <img src={item.imagem} alt="" loading="lazy" /> : <IconeCategoria categoria={item.categoria} />}
              {!item.disponivel && <span className={"tag " + (item.emBreve ? "em-breve" : "esgotado")}>{item.emBreve ? "Em breve" : item.voltaEm ? "Volta amanhã" : "Esgotado"}</span>}
            </div>
            <strong>{item.nome}</strong>
            <span className="preco">{formatar(emPence(item.preco))}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** "Pedir de novo": o último pedido feito neste aparelho, pronto para ir ao carrinho com um toque. */
function PedirDeNovo({ cardapio, carrinhoVazio, onAdicionar }: { cardapio: Cardapio; carrinhoVazio: boolean; onAdicionar: (l: LinhaCarrinho[]) => void }) {
  const [salvo, setSalvo] = useState<{ nome: string; linhas: LinhaCarrinho[]; faltou: number } | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem(CHAVE_ULTIMO) || "null") as { linhas: LinhaCarrinho[] } | null;
      if (!u?.linhas?.length) return;
      const cli = JSON.parse(localStorage.getItem(CHAVE_CLIENTE) || "{}");
      // Só o que ainda existe e está disponível hoje (com as mesmas opções).
      const validas = u.linhas.filter((l) => {
        const item = cardapio.itens.find((i) => i.id === l.itemId);
        if (!item?.disponivel) return false;
        return Object.entries(l.selecoes ?? {}).every(([g, nomes]) =>
          nomes.every((n) => cardapio.adicionais[g]?.opcoes.some((o) => o.nome === n && !o.esgotado)),
        );
      });
      if (validas.length) setSalvo({ nome: String(cli.nome || "").trim().split(/\s+/)[0] || "", linhas: validas, faltou: u.linhas.length - validas.length });
    } catch {}
  }, [cardapio]);

  if (!salvo || fechado || !carrinhoVazio) return null;
  const total = salvo.linhas.reduce((s, l) => {
    const item = cardapio.itens.find((i) => i.id === l.itemId)!;
    return s + precoUnitario(cardapio, item, l.selecoes) * l.qtd;
  }, 0);
  const resumo = salvo.linhas.map((l) => `${l.qtd}x ${cardapio.itens.find((i) => i.id === l.itemId)!.nome}`).join(", ");
  const nome = salvo.nome ? salvo.nome.charAt(0).toUpperCase() + salvo.nome.slice(1).toLowerCase() : "";

  return (
    <section className="de-novo" aria-labelledby="de-novo-titulo">
      <button className="de-novo-fechar" onClick={() => setFechado(true)} aria-label="Fechar">×</button>
      <span className="de-novo-tag">{nome ? `Que bom te ver de novo, ${nome}!` : "Bem-vindo de volta!"}</span>
      <h2 id="de-novo-titulo">Pedir de novo?</h2>
      <p>{resumo}{salvo.faltou > 0 && <small> · {salvo.faltou === 1 ? "1 item do último pedido não está disponível hoje" : `${salvo.faltou} itens do último pedido não estão disponíveis hoje`}</small>}</p>
      <button className="principal" onClick={() => onAdicionar(salvo.linhas)}>
        <span>Colocar no carrinho</span>
        <span className="preco">{formatar(total)}</span>
      </button>
    </section>
  );
}
