"use client";

import { useState } from "react";
import { gerarId, type Cardapio, type GrupoAdicional, type Opcao } from "@/lib/cardapio";
import type { Salvar } from "./Admin";

/* ---------------- Modificadores (grupos de opções) ---------------- */

export function Modificadores({ cardapio, salvar }: { cardapio: Cardapio; salvar: Salvar<Cardapio> }) {
  const [editando, setEditando] = useState<string | null>(null);
  const usos = (id: string) => cardapio.itens.filter((i) => i.escolhas?.some((e) => e.grupo === id)).length;

  if (editando) {
    const grupo = editando === "novo" ? null : cardapio.adicionais[editando];
    return <EditorGrupo key={editando} id={editando === "novo" ? null : editando} grupo={grupo ?? null} cardapio={cardapio} salvar={salvar} voltar={() => setEditando(null)} />;
  }

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Modificadores</h1>
          <p className="sq-sub">Grupos de opções, como toppings, sabores ou bebida do combo.</p>
        </div>
        <button className="sq-btn sq-btn-primario" onClick={() => setEditando("novo")}>Criar modificador</button>
      </div>
      <div className="sq-tabela-caixa">
        <table className="sq-tabela">
          <thead><tr><th scope="col">Nome</th><th scope="col">Opções</th><th scope="col" className="so-largo">Usado em</th></tr></thead>
          <tbody>
            {Object.entries(cardapio.adicionais).map(([id, g]) => (
              <tr key={id}>
                <td><button className="sq-link forte" onClick={() => setEditando(id)}>{g.nome}</button></td>
                <td className="sq-sub">{g.opcoes.slice(0, 4).map((o) => o.nome).join(", ")}{g.opcoes.length > 4 ? ` +${g.opcoes.length - 4}` : ""}</td>
                <td className="so-largo sq-sub">{usos(id)} {usos(id) === 1 ? "item" : "itens"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorGrupo({ id, grupo, cardapio, salvar, voltar }: { id: string | null; grupo: GrupoAdicional | null; cardapio: Cardapio; salvar: Salvar<Cardapio>; voltar: () => void }) {
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [opcoes, setOpcoes] = useState<(Opcao & { precoTxt: string })[]>(
    (grupo?.opcoes ?? [{ nome: "" }]).map((o) => ({ ...o, precoTxt: o.preco ? o.preco.toFixed(2) : "" })),
  );
  const [apagar, setApagar] = useState(false);
  const usado = id ? cardapio.itens.filter((i) => i.escolhas?.some((e) => e.grupo === id)) : [];

  const mudar = (i: number, campo: "nome" | "precoTxt" | "esgotado", v: string | boolean) =>
    setOpcoes((os) => os.map((o, j) => (j === i ? { ...o, [campo]: v } : o)));
  const mover = (i: number, d: number) =>
    setOpcoes((os) => { const n = [...os]; const j = i + d; if (j < 0 || j >= n.length) return os; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function gravar(ev: React.FormEvent) {
    ev.preventDefault();
    const limpas: Opcao[] = opcoes
      .filter((o) => o.nome.trim())
      .map((o) => {
        const p = parseFloat(o.precoTxt.replace(",", "."));
        const op: Opcao = { nome: o.nome.trim() };
        if (p > 0) op.preco = Math.round(p * 100) / 100;
        if (o.esgotado) op.esgotado = true;
        return op;
      });
    if (!nome.trim() || !limpas.length) return;
    let chave = id;
    if (!chave) {
      chave = gerarId(nome);
      let n = 2;
      while (cardapio.adicionais[chave]) chave = `${gerarId(nome)}-${n++}`;
    }
    const ok = await salvar({ ...cardapio, adicionais: { ...cardapio.adicionais, [chave]: { nome: nome.trim(), opcoes: limpas } } });
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

  return (
    <form className="sq-pagina" onSubmit={gravar}>
      <div className="sq-cabeca sq-cabeca-fixa">
        <button type="button" className="sq-btn" onClick={voltar} aria-label="Voltar">✕</button>
        <h1>{id ? "Editar modificador" : "Criar modificador"}</h1>
        <button className="sq-btn sq-btn-primario">Salvar</button>
      </div>
      <section className="sq-cartao">
        <label className="sq-campo">Nome do grupo (o cliente vê)
          <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Escolha os toppings" />
        </label>
      </section>
      <section className="sq-cartao">
        <h2>Opções</h2>
        <div className="sq-opcoes">
          <div className="sq-opcao sq-opcao-cab" aria-hidden="true"><span>Nome</span><span>Preço extra</span><span>Esgotado</span><span /></div>
          {opcoes.map((o, i) => (
            <div className="sq-opcao" key={i}>
              <input aria-label={`Opção ${i + 1}`} value={o.nome} onChange={(e) => mudar(i, "nome", e.target.value)} placeholder="Nome da opção" />
              <input aria-label="Preço extra" inputMode="decimal" value={o.precoTxt} onChange={(e) => mudar(i, "precoTxt", e.target.value)} placeholder="£0.00" />
              <input aria-label="Esgotado" type="checkbox" checked={!!o.esgotado} onChange={(e) => mudar(i, "esgotado", e.target.checked)} />
              <span className="sq-opcao-acoes">
                <button type="button" className="sq-icone" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
                <button type="button" className="sq-icone" onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
                <button type="button" className="sq-icone" onClick={() => setOpcoes((os) => os.filter((_, j) => j !== i))} aria-label="Remover opção">✕</button>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="sq-btn" onClick={() => setOpcoes((os) => [...os, { nome: "", precoTxt: "" }])}>+ Adicionar opção</button>
      </section>
      {id && (
        <section className="sq-cartao">
          <h2>Apagar grupo</h2>
          <p className="sq-sub">{usado.length ? `Usado em: ${usado.map((i) => i.nome).join(", ")}. Ao apagar, ele sai desses itens.` : "Não está em nenhum item."}</p>
          {!apagar ? <button type="button" className="sq-btn sq-btn-perigo" onClick={() => setApagar(true)}>Apagar este grupo</button> : (
            <div className="sq-foto-acoes">
              <button type="button" className="sq-btn sq-btn-perigo cheio" onClick={remover}>Sim, apagar</button>
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
