"use client";

import { useState } from "react";
import { gerarId, type Cardapio, type GrupoAdicional, type Opcao, type RegrasGrupo } from "@/lib/cardapio";
import { enviarFoto } from "./Itens";
import type { Salvar } from "./Admin";

/* ---------------- Modificadores (grupos de opções), no estilo da Square ---------------- */

const regrasPadrao = (g?: GrupoAdicional | null): RegrasGrupo =>
  g?.regras ?? { obrigatorio: false, varios: (g?.opcoes.length ?? 2) > 1, max: Math.max(1, Math.min(5, g?.opcoes.length ?? 1)), repetir: false };

export function Modificadores({ cardapio, salvar }: { cardapio: Cardapio; salvar: Salvar<Cardapio> }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const usos = (id: string) => cardapio.itens.filter((i) => i.escolhas?.some((e) => e.grupo === id)).length;

  if (editando) {
    const grupo = editando === "novo" ? null : cardapio.adicionais[editando];
    return <EditorGrupo key={editando} id={editando === "novo" ? null : editando} grupo={grupo ?? null} cardapio={cardapio} salvar={salvar} voltar={() => setEditando(null)} />;
  }

  const lista = Object.entries(cardapio.adicionais).filter(([, g]) => {
    const b = busca.trim().toLowerCase();
    return !b || g.nome.toLowerCase().includes(b) || g.nomeInterno?.toLowerCase().includes(b) || g.opcoes.some((o) => o.nome.toLowerCase().includes(b));
  });

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Modificadores</h1>
          <p className="sq-sub">Opções que o cliente escolhe no item: toppings, sabores, adicionais pagos, bebida do combo.</p>
        </div>
        <button className="sq-btn sq-btn-primario" onClick={() => setEditando("novo")}>Criar modificador</button>
      </div>
      <div className="sq-filtros">
        <label className="sq-busca">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar modificador ou opção" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
      <div className="sq-tabela-caixa">
        <table className="sq-tabela">
          <thead><tr><th scope="col">Nome</th><th scope="col">Opções</th><th scope="col" className="so-largo">Usado em</th></tr></thead>
          <tbody>
            {lista.map(([id, g]) => {
              const esgotados = g.opcoes.filter((o) => o.esgotado).length;
              const pagos = g.opcoes.filter((o) => o.preco).length;
              return (
                <tr key={id}>
                  <td>
                    <button className="sq-link forte" onClick={() => setEditando(id)}>{g.nomeInterno || g.nome}</button>
                    {g.nomeInterno && <span className="sq-sub" style={{ display: "block" }}>Cliente vê: {g.nome}</span>}
                  </td>
                  <td className="sq-sub">
                    {g.opcoes.slice(0, 5).map((o) => o.nome).join(", ")}{g.opcoes.length > 5 ? ` +${g.opcoes.length - 5}` : ""}
                    {pagos > 0 && <span style={{ display: "block" }}>{pagos} {pagos === 1 ? "opção paga" : "opções pagas"}</span>}
                    {esgotados > 0 && <span className="sq-alerta" style={{ display: "block" }}>{esgotados} {esgotados === 1 ? "esgotada" : "esgotadas"}</span>}
                  </td>
                  <td className="so-largo sq-sub">{usos(id)} {usos(id) === 1 ? "item" : "itens"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="sq-vazio">Nenhum modificador encontrado.</p>}
      </div>
    </div>
  );
}

type Linha = Opcao & { precoTxt: string; chave: string };
let seq = 0;
const novaChave = () => `l${Date.now()}-${seq++}`;

function EditorGrupo({ id, grupo, cardapio, salvar, voltar }: { id: string | null; grupo: GrupoAdicional | null; cardapio: Cardapio; salvar: Salvar<Cardapio>; voltar: () => void }) {
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [nomeInterno, setNomeInterno] = useState(grupo?.nomeInterno ?? "");
  const [linhas, setLinhas] = useState<Linha[]>(
    (grupo?.opcoes ?? []).map((o) => ({ ...o, precoTxt: o.preco ? o.preco.toFixed(2) : "", chave: novaChave() })),
  );
  const [nova, setNova] = useState("");
  const [regras, setRegras] = useState<RegrasGrupo>(regrasPadrao(grupo));
  const [itensUsando, setItensUsando] = useState<Set<string>>(
    () => new Set(id ? cardapio.itens.filter((i) => i.escolhas?.some((e) => e.grupo === id)).map((i) => i.id) : []),
  );
  const [aplicarRegras, setAplicarRegras] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [apagar, setApagar] = useState(false);
  const [erro, setErro] = useState("");
  const [buscaItem, setBuscaItem] = useState("");

  const mudar = (i: number, campo: keyof Linha, v: unknown) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const mover = (de: number, para: number) =>
    setLinhas((ls) => {
      if (para < 0 || para >= ls.length || de === para) return ls;
      const n = [...ls];
      const [x] = n.splice(de, 1);
      n.splice(para, 0, x);
      return n;
    });

  function adicionarNova() {
    const n = nova.trim();
    if (!n) return;
    setLinhas((ls) => [...ls, { nome: n, precoTxt: "", chave: novaChave() }]);
    setNova("");
  }

  async function foto(i: number, arquivo?: File | null) {
    if (!arquivo) return;
    setEnviando(linhas[i].chave);
    try {
      mudar(i, "imagem", await enviarFoto(arquivo));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(null);
    }
  }

  async function gravar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro("");
    const opcoes: Opcao[] = [];
    const vistos = new Set<string>();
    for (const l of linhas) {
      const n = l.nome.trim();
      if (!n) continue;
      if (vistos.has(n.toLowerCase())) return setErro(`A opção "${n}" está repetida.`);
      vistos.add(n.toLowerCase());
      const p = parseFloat(l.precoTxt.replace(",", "."));
      if (l.precoTxt.trim() && !(p >= 0)) return setErro(`Preço inválido em "${n}". Use, por exemplo, 0.50.`);
      const op: Opcao = { nome: n };
      if (p > 0) op.preco = Math.round(p * 100) / 100;
      if (l.esgotado) op.esgotado = true;
      if (l.imagem) op.imagem = l.imagem;
      if (l.padrao) op.padrao = true;
      opcoes.push(op);
    }
    if (!nome.trim()) return setErro("Dê um nome que o cliente vai ver (ex.: Escolha os toppings).");
    if (!opcoes.length) return setErro("Coloque pelo menos uma opção.");

    const max = regras.varios ? Math.max(1, regras.repetir ? regras.max : Math.min(regras.max, opcoes.length)) : 1;
    const r: RegrasGrupo = { ...regras, max, repetir: regras.varios && regras.repetir };
    const min = r.obrigatorio ? 1 : 0;

    let chave = id;
    if (!chave) {
      chave = gerarId(nomeInterno || nome);
      let k = 2;
      while (cardapio.adicionais[chave]) chave = `${gerarId(nomeInterno || nome)}-${k++}`;
    }
    const itens = cardapio.itens.map((it) => {
      const tem = it.escolhas?.some((e) => e.grupo === chave);
      const quer = itensUsando.has(it.id);
      if (quer && !tem) return { ...it, escolhas: [...(it.escolhas ?? []), { grupo: chave!, min, max }] };
      if (!quer && tem) return { ...it, escolhas: it.escolhas!.filter((e) => e.grupo !== chave) };
      if (quer && tem && aplicarRegras) return { ...it, escolhas: it.escolhas!.map((e) => (e.grupo === chave ? { ...e, min, max } : e)) };
      return it;
    });
    const g: GrupoAdicional = { nome: nome.trim(), opcoes, regras: r };
    if (nomeInterno.trim()) g.nomeInterno = nomeInterno.trim();
    const ok = await salvar({ ...cardapio, adicionais: { ...cardapio.adicionais, [chave]: g }, itens });
    if (ok) voltar();
  }

  async function remover() {
    if (!id) return;
    const adicionais = { ...cardapio.adicionais };
    delete adicionais[id];
    const itens = cardapio.itens.map((i) => ({ ...i, escolhas: i.escolhas?.filter((e) => e.grupo !== id) }));
    const ok = await salvar({ ...cardapio, adicionais, itens });
    if (ok) voltar();
  }

  const opcoesValidas = linhas.filter((l) => l.nome.trim()).length;
  const itensFiltrados = cardapio.itens.filter((i) => !buscaItem.trim() || i.nome.toLowerCase().includes(buscaItem.trim().toLowerCase()));

  return (
    <form className="sq-pagina" onSubmit={gravar}>
      <div className="sq-cabeca sq-cabeca-fixa">
        <button type="button" className="sq-btn" onClick={voltar} aria-label="Voltar">✕</button>
        <h1>{id ? "Editar conjunto de modificadores" : "Criar conjunto de modificadores"}</h1>
        <button className="sq-btn sq-btn-primario" disabled={!!enviando}>Salvar</button>
      </div>
      {erro && <p className="sq-erro" role="alert">{erro}</p>}

      <section className="sq-cartao">
        <div className="sq-linha2">
          <label className="sq-campo">Nome (só para você)
            <input value={nomeInterno} onChange={(e) => setNomeInterno(e.target.value)} placeholder="Ex.: Açaí - toppings" />
          </label>
          <label className="sq-campo">Nome que o cliente vê
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Acompanhamentos disponíveis" />
          </label>
        </div>
      </section>

      <section className="sq-cartao">
        <h2>Lista de opções</h2>
        <p className="sq-sub">Coloque um valor em "Preço" para cobrar a mais por uma opção especial (ex.: Bis +£0.50). Deixe vazio se for grátis.</p>
        <div className="sq-mod-tabela" role="table" aria-label="Opções do modificador">
          <div className="sq-mod-linha sq-mod-cab" role="row">
            <span /><span>Foto</span><span>Nome</span><span>Preço</span><span>Disponível</span><span title="Já vem marcada">Pré-selecionar</span><span />
          </div>
          {linhas.map((l, i) => (
            <div
              key={l.chave}
              role="row"
              className={"sq-mod-linha" + (arrastando === i ? " arrastando" : "")}
              draggable
              onDragStart={() => setArrastando(i)}
              onDragOver={(e) => { e.preventDefault(); if (arrastando != null && arrastando !== i) { mover(arrastando, i); setArrastando(i); } }}
              onDragEnd={() => setArrastando(null)}
            >
              <span className="sq-alca" aria-hidden="true" title="Arraste para mudar a ordem">⋮⋮</span>
              <label className="sq-mod-foto" title={l.imagem ? "Trocar foto" : "Adicionar foto"}>
                {enviando === l.chave ? <span className="sq-sub">...</span> : l.imagem ? <img src={l.imagem} alt="" /> : <span aria-hidden="true">＋</span>}
                <input type="file" accept="image/*" hidden onChange={(e) => { foto(i, e.target.files?.[0]); e.target.value = ""; }} />
                <span className="sr-only">Foto de {l.nome}</span>
              </label>
              <input aria-label="Nome da opção" value={l.nome} onChange={(e) => mudar(i, "nome", e.target.value)} />
              <span className="sq-preco-campo">
                <span aria-hidden="true">£</span>
                <input aria-label={`Preço extra de ${l.nome}`} inputMode="decimal" placeholder="0.00" value={l.precoTxt} onChange={(e) => mudar(i, "precoTxt", e.target.value)} />
              </span>
              <label className="sq-interruptor sq-estoque">
                <input type="checkbox" checked={!l.esgotado} onChange={(e) => mudar(i, "esgotado", !e.target.checked)} />
                <span className="trilho" aria-hidden="true" />
                <span className={l.esgotado ? "sq-alerta" : ""}>{l.esgotado ? "Esgotado" : "Disponível"}</span>
              </label>
              <input type="checkbox" className="sq-pre" aria-label={`Pré-selecionar ${l.nome}`} checked={!!l.padrao} onChange={(e) => mudar(i, "padrao", e.target.checked)} />
              <span className="sq-opcao-acoes">
                <button type="button" className="sq-icone" onClick={() => mover(i, i - 1)} aria-label="Subir" disabled={i === 0}>↑</button>
                <button type="button" className="sq-icone" onClick={() => mover(i, i + 1)} aria-label="Descer" disabled={i === linhas.length - 1}>↓</button>
                <button type="button" className="sq-icone" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remover ${l.nome}`}>✕</button>
              </span>
            </div>
          ))}
          <div className="sq-mod-linha sq-mod-nova" role="row">
            <span /><span className="sq-mod-foto vazia" aria-hidden="true">＋</span>
            <input
              aria-label="Nova opção"
              placeholder="Nova opção (Enter para adicionar)"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarNova(); } }}
            />
            <button type="button" className="sq-btn" onClick={adicionarNova}>Adicionar</button>
          </div>
        </div>
      </section>

      <section className="sq-cartao">
        <h2>Regras de seleção</h2>
        <p className="sq-sub">São o padrão do conjunto. Valem para os itens marcados abaixo.</p>
        <label className="sq-interruptor sq-regra">
          <span>Exigir uma seleção<span className="sq-sub">O cliente precisa escolher pelo menos uma opção.</span></span>
          <input type="checkbox" checked={regras.obrigatorio} onChange={(e) => setRegras({ ...regras, obrigatorio: e.target.checked })} />
          <span className="trilho" aria-hidden="true" />
        </label>
        <label className="sq-interruptor sq-regra">
          <span>Permitir mais de uma opção<span className="sq-sub">Desligado = o cliente escolhe só uma.</span></span>
          <input type="checkbox" checked={regras.varios} onChange={(e) => setRegras({ ...regras, varios: e.target.checked })} />
          <span className="trilho" aria-hidden="true" />
        </label>
        {regras.varios && (
          <>
            <label className="sq-interruptor sq-regra">
              <span>Permitir repetir a mesma opção<span className="sq-sub">Ex.: 2× Nutella. O cliente vê botões de + e −.</span></span>
              <input type="checkbox" checked={regras.repetir} onChange={(e) => setRegras({ ...regras, repetir: e.target.checked })} />
              <span className="trilho" aria-hidden="true" />
            </label>
            <label className="sq-regra-max">
              <span>Máximo de seleções</span>
              <select className="sq-select" value={regras.max} onChange={(e) => setRegras({ ...regras, max: +e.target.value })}>
                {Array.from({ length: Math.max(regras.repetir ? 20 : opcoesValidas, 1) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        )}
      </section>

      <section className="sq-cartao">
        <h2>Aplicar aos itens</h2>
        <p className="sq-sub">{itensUsando.size} {itensUsando.size === 1 ? "item usa" : "itens usam"} este conjunto.</p>
        <label className="sq-busca">
          <span className="sr-only">Buscar item</span>
          <input type="search" placeholder="Buscar item" value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} />
        </label>
        <div className="sq-aplicar">
          {itensFiltrados.map((it) => (
            <label key={it.id} className="sq-check">
              <input
                type="checkbox"
                checked={itensUsando.has(it.id)}
                onChange={(e) => setItensUsando((s) => { const n = new Set(s); if (e.target.checked) n.add(it.id); else n.delete(it.id); return n; })}
              />
              <span>{it.nome}</span>
            </label>
          ))}
        </div>
        {id && (
          <label className="sq-check">
            <input type="checkbox" checked={aplicarRegras} onChange={(e) => setAplicarRegras(e.target.checked)} />
            <span>Atualizar as regras nos itens que já usam este conjunto<span className="sq-sub">Desmarque se algum item tem mínimo e máximo próprios.</span></span>
          </label>
        )}
      </section>

      {id && (
        <section className="sq-cartao">
          <h2>Apagar conjunto</h2>
          {!apagar ? <button type="button" className="sq-btn sq-btn-perigo" onClick={() => setApagar(true)}>Apagar este conjunto</button> : (
            <div className="sq-foto-acoes">
              <button type="button" className="sq-btn sq-btn-perigo cheio" onClick={remover}>Sim, apagar e tirar dos itens</button>
              <button type="button" className="sq-btn" onClick={() => setApagar(false)}>Cancelar</button>
            </div>
          )}
        </section>
      )}
    </form>
  );
}

/* ---------------- Categorias ---------------- */

export function Categorias({ cardapio, salvar }: { cardapio: Cardapio; salvar: Salvar<Cardapio> }) {
  const [nova, setNova] = useState("");
  const [nomes, setNomes] = useState<Record<string, string>>(() => Object.fromEntries(cardapio.categorias.map((c) => [c.id, c.nome])));
  const qtd = (id: string) => cardapio.itens.filter((i) => i.categoria === id).length;

  function mover(i: number, d: number) {
    const c = [...cardapio.categorias];
    const j = i + d;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    salvar({ ...cardapio, categorias: c });
  }
  function renomear(id: string) {
    const nome = nomes[id]?.trim();
    const atual = cardapio.categorias.find((c) => c.id === id);
    if (!nome || nome === atual?.nome) return;
    salvar({ ...cardapio, categorias: cardapio.categorias.map((c) => (c.id === id ? { ...c, nome } : c)) });
  }
  function adicionar(ev: React.FormEvent) {
    ev.preventDefault();
    const nome = nova.trim();
    if (!nome) return;
    let id = gerarId(nome);
    let n = 2;
    while (cardapio.categorias.some((c) => c.id === id)) id = `${gerarId(nome)}-${n++}`;
    setNomes((x) => ({ ...x, [id]: nome }));
    salvar({ ...cardapio, categorias: [...cardapio.categorias, { id, nome }] });
    setNova("");
  }
  function remover(id: string) {
    if (qtd(id)) return;
    salvar({ ...cardapio, categorias: cardapio.categorias.filter((c) => c.id !== id) });
  }

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Categorias</h1>
          <p className="sq-sub">A ordem daqui é a ordem das abas do cardápio no site.</p>
        </div>
      </div>
      <form className="sq-cartao sq-nova" onSubmit={adicionar}>
        <label className="sq-campo" style={{ flex: 1 }}>Nova categoria
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Ex.: Combos" />
        </label>
        <button className="sq-btn sq-btn-primario">Adicionar</button>
      </form>
      <div className="sq-tabela-caixa">
        <table className="sq-tabela">
          <thead><tr><th scope="col">Nome</th><th scope="col">Itens</th><th scope="col" className="direita">Ordem</th></tr></thead>
          <tbody>
            {cardapio.categorias.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <input className="sq-inline" aria-label={`Nome da categoria ${c.nome}`} value={nomes[c.id] ?? c.nome}
                    onChange={(e) => setNomes((x) => ({ ...x, [c.id]: e.target.value }))}
                    onBlur={() => renomear(c.id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                </td>
                <td className="sq-sub">{qtd(c.id)}</td>
                <td className="direita">
                  <span className="sq-opcao-acoes">
                    <button className="sq-icone" onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>↑</button>
                    <button className="sq-icone" onClick={() => mover(i, 1)} aria-label="Descer" disabled={i === cardapio.categorias.length - 1}>↓</button>
                    <button className="sq-icone" onClick={() => remover(c.id)} aria-label="Apagar" disabled={qtd(c.id) > 0} title={qtd(c.id) ? "Mova os itens antes de apagar" : "Apagar"}>✕</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
