"use client";

import { useMemo, useRef, useState } from "react";
import { gerarId, type Cardapio, type Escolha, type Item } from "@/lib/cardapio";
import { ALERGENICOS } from "@/lib/alergenicos";
import { reduzirFoto } from "@/lib/reduzirFoto";
import type { Salvar } from "./Admin";

type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;

export async function enviarFoto(arquivo: File): Promise<string> {
  const blob = await reduzirFoto(arquivo);
  const form = new FormData();
  form.append("foto", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
  const r = await fetch("/api/painel/fotos", { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || "Não consegui enviar a foto.");
  return d.url as string;
}

const libra = (n: number) => "£" + n.toFixed(2);

export default function Itens({ cardapio, salvar, aberto, ir, avisar }: { cardapio: Cardapio; salvar: Salvar<Cardapio>; aberto: string | null; ir: (s: string, sub?: string) => void; avisar: Aviso }) {
  if (aberto) {
    const item = aberto === "novo" ? null : cardapio.itens.find((i) => i.id === aberto) ?? null;
    if (aberto !== "novo" && !item) return <p className="sq-sub">Item não encontrado. <button className="sq-link" onClick={() => ir("itens")}>Voltar</button></p>;
    return <EditorItem key={aberto} cardapio={cardapio} item={item} salvar={salvar} voltar={() => ir("itens")} avisar={avisar} />;
  }
  return <Biblioteca cardapio={cardapio} salvar={salvar} ir={ir} />;
}

function Biblioteca({ cardapio, salvar, ir }: { cardapio: Cardapio; salvar: Salvar<Cardapio>; ir: (s: string, sub?: string) => void }) {
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("todas");
  const [filtro, setFiltro] = useState<"todos" | "disponiveis" | "esgotados" | "sem-foto">("todos");
  const nomeCat = useMemo(() => Object.fromEntries(cardapio.categorias.map((c) => [c.id, c.nome])), [cardapio]);

  const lista = cardapio.itens.filter((i) => {
    if (cat !== "todas" && i.categoria !== cat) return false;
    if (filtro === "disponiveis" && !i.disponivel) return false;
    if (filtro === "esgotados" && i.disponivel) return false;
    if (filtro === "sem-foto" && i.imagem) return false;
    const b = busca.trim().toLowerCase();
    return !b || i.nome.toLowerCase().includes(b) || i.descricao?.toLowerCase().includes(b);
  });

  function alternar(item: Item) {
    salvar({ ...cardapio, itens: cardapio.itens.map((i) => (i.id === item.id ? { ...i, disponivel: !i.disponivel } : i)) });
  }

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Biblioteca de itens</h1>
          <p className="sq-sub">{cardapio.itens.length} itens · o que você muda aqui aparece no site na hora.</p>
        </div>
        <button className="sq-btn sq-btn-primario" onClick={() => ir("itens", "novo")}>Criar item</button>
      </div>

      <div className="sq-filtros">
        <label className="sq-busca">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar itens" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Categoria</span>
          <select className="sq-select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="todas">Todas as categorias</option>
            {cardapio.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Situação</span>
          <select className="sq-select" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todos">Todos</option>
            <option value="disponiveis">Disponíveis</option>
            <option value="esgotados">Esgotados</option>
            <option value="sem-foto">Sem foto</option>
          </select>
        </label>
      </div>

      <div className="sq-tabela-caixa">
        <table className="sq-tabela">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="so-largo">Categoria</th>
              <th scope="col">Disponibilidade</th>
              <th scope="col" className="direita">Preço</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id}>
                <td>
                  <a className="sq-item" href={`#itens/${encodeURIComponent(i.id)}`}>
                    {i.imagem ? <img src={i.imagem} alt="" loading="lazy" /> : <span className="sq-sem-foto" aria-hidden="true">{i.nome.slice(0, 2)}</span>}
                    <span>
                      <strong>{i.nome}</strong>
                      {!i.imagem && <span className="sq-sub sq-alerta">Sem foto</span>}
                      {i.alergenicos == null && <span className="sq-sub sq-alerta">Sem alergênicos</span>}
                    </span>
                  </a>
                </td>
                <td className="so-largo sq-sub">{nomeCat[i.categoria] ?? "—"}</td>
                <td>
                  <button className={"sq-pilula " + (i.disponivel ? "ok" : "off")} onClick={() => alternar(i)} title="Clique para mudar">
                    {i.disponivel ? "Disponível" : "Esgotado"}
                  </button>
                </td>
                <td className="direita num">
                  {i.precoAntigo ? <s className="sq-sub">{libra(i.precoAntigo)}</s> : null} {libra(i.preco)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="sq-vazio">Nenhum item encontrado.</p>}
      </div>
    </div>
  );
}

function EditorItem({ cardapio, item, salvar, voltar, avisar }: { cardapio: Cardapio; item: Item | null; salvar: Salvar<Cardapio>; voltar: () => void; avisar: Aviso }) {
  const novo = !item;
  const [f, setF] = useState<Item>(
    item ?? { id: "", nome: "", categoria: cardapio.categorias[0]?.id ?? "", descricao: "", preco: 0, disponivel: true, escolhas: [] },
  );
  const [preco, setPreco] = useState(item ? item.preco.toFixed(2) : "");
  const [precoAntigo, setPrecoAntigo] = useState(item?.precoAntigo ? item.precoAntigo.toFixed(2) : "");
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [apagar, setApagar] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const mudar = <K extends keyof Item>(k: K, v: Item[K]) => setF((x) => ({ ...x, [k]: v }));

  async function escolherFoto(arquivo?: File | null) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) { avisar({ tipo: "erro", texto: "Escolha um arquivo de imagem." }); return; }
    setEnviando(true);
    try {
      const url = await enviarFoto(arquivo);
      mudar("imagem", url);
    } catch (e: any) {
      avisar({ tipo: "erro", texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  const escolhas = f.escolhas ?? [];
  function alternarGrupo(grupo: string) {
    const tem = escolhas.find((e) => e.grupo === grupo);
    const g = cardapio.adicionais[grupo];
    // Usa as regras padrão do conjunto (definidas em Modificadores).
    const min = g?.regras?.obrigatorio ? 1 : 0;
    const max = g?.regras ? (g.regras.varios ? g.regras.max : 1) : Math.max(1, g?.opcoes.length ?? 1);
    mudar("escolhas", tem ? escolhas.filter((e) => e.grupo !== grupo) : [...escolhas, { grupo, min, max }]);
  }
  function mudarEscolha(grupo: string, campo: keyof Omit<Escolha, "grupo">, valor: number) {
    mudar("escolhas", escolhas.map((e) => (e.grupo === grupo ? { ...e, [campo]: valor } : e)));
  }

  async function gravar(ev: React.FormEvent) {
    ev.preventDefault();
    const p = parseFloat(preco.replace(",", "."));
    const pa = precoAntigo.trim() ? parseFloat(precoAntigo.replace(",", ".")) : undefined;
    if (!f.nome.trim()) return avisar({ tipo: "erro", texto: "Dê um nome para o item." });
    if (!(p > 0)) return avisar({ tipo: "erro", texto: "Coloque o preço (ex.: 12.50)." });
    if (pa != null && !(pa > p)) return avisar({ tipo: "erro", texto: "O preço antigo precisa ser maior que o preço atual." });
    let id = f.id;
    if (novo) {
      id = gerarId(f.nome);
      let n = 2;
      while (cardapio.itens.some((i) => i.id === id)) id = `${gerarId(f.nome)}-${n++}`;
    }
    const final: Item = { ...f, id, nome: f.nome.trim(), descricao: f.descricao.trim(), preco: Math.round(p * 100) / 100, precoAntigo: pa != null ? Math.round(pa * 100) / 100 : undefined };
    if (!final.imagem) delete final.imagem;
    if (!final.escolhas?.length) delete final.escolhas;
    setSalvando(true);
    const itens = novo ? [...cardapio.itens, final] : cardapio.itens.map((i) => (i.id === item!.id ? final : i));
    const ok = await salvar({ ...cardapio, itens });
    setSalvando(false);
    if (ok) voltar();
  }

  async function remover() {
    if (!item) return;
    const ok = await salvar({ ...cardapio, itens: cardapio.itens.filter((i) => i.id !== item.id) });
    if (ok) voltar();
  }

  return (
    <form className="sq-pagina sq-editor" onSubmit={gravar}>
      <div className="sq-cabeca sq-cabeca-fixa">
        <button type="button" className="sq-btn" onClick={voltar} aria-label="Voltar para a biblioteca">✕</button>
        <h1>{novo ? "Criar item" : "Editar item"}</h1>
        <button className="sq-btn sq-btn-primario" disabled={salvando || enviando}>{salvando ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="sq-editor-grade">
        <div className="sq-editor-col">
          <section className="sq-cartao">
            <h2>Detalhes</h2>
            <label className="sq-campo">Nome
              <input required value={f.nome} onChange={(e) => mudar("nome", e.target.value)} maxLength={80} />
            </label>
            <div className="sq-linha2">
              <label className="sq-campo">Preço (£)
                <input required inputMode="decimal" placeholder="0.00" value={preco} onChange={(e) => setPreco(e.target.value)} />
              </label>
              <label className="sq-campo">Preço antigo (opcional)
                <input inputMode="decimal" placeholder="Mostra riscado" value={precoAntigo} onChange={(e) => setPrecoAntigo(e.target.value)} />
              </label>
            </div>
            <label className="sq-campo">Descrição
              <textarea rows={4} value={f.descricao} onChange={(e) => mudar("descricao", e.target.value)} maxLength={500} placeholder="O que vem, tamanho, para quantas pessoas..." />
            </label>
            <label className="sq-campo">Categoria
              <select className="sq-select" value={f.categoria} onChange={(e) => mudar("categoria", e.target.value)}>
                {cardapio.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </section>

          <section className="sq-cartao">
            <h2>Modificadores</h2>
            <p className="sq-sub">Escolha os grupos de opções que o cliente vê ao pedir este item.</p>
            <div className="sq-mods">
              {Object.entries(cardapio.adicionais).map(([id, g]) => {
                const e = escolhas.find((x) => x.grupo === id);
                return (
                  <div key={id} className={"sq-mod" + (e ? " ligado" : "")}>
                    <label className="sq-check">
                      <input type="checkbox" checked={!!e} onChange={() => alternarGrupo(id)} />
                      <span>
                        <strong>{g.nomeInterno || g.nome}</strong>
                        <span className="sq-sub">{g.opcoes.length} opções{g.opcoes.some((o) => o.preco) ? " · algumas pagas" : ""}</span>
                      </span>
                    </label>
                    {e && (
                      <div className="sq-minmax">
                        <label>Mín. <input type="number" min={0} max={e.max} value={e.min} onChange={(ev) => mudarEscolha(id, "min", Math.max(0, +ev.target.value))} /></label>
                        <label>Máx. <input type="number" min={1} max={g.opcoes.length} value={e.max} onChange={(ev) => mudarEscolha(id, "max", Math.max(1, +ev.target.value))} /></label>
                        <span className="sq-sub">{e.min > 0 ? "Obrigatório" : "Opcional"}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(cardapio.adicionais).length === 0 && <p className="sq-sub">Nenhum grupo criado ainda. Crie em Modificadores.</p>}
            </div>
          </section>
        </div>

        <div className="sq-editor-col">
          <section className="sq-cartao">
            <h2>Foto</h2>
            <div
              className={"sq-foto" + (arrastando ? " arrastando" : "") + (f.imagem ? " tem" : "")}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); escolherFoto(e.dataTransfer.files?.[0]); }}
            >
              {f.imagem ? <img src={f.imagem} alt={`Foto de ${f.nome || "item"}`} /> : (
                <div className="sq-foto-vazia">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
                  <span>Arraste a foto aqui</span>
                </div>
              )}
              {enviando && <div className="sq-foto-carregando">Enviando foto...</div>}
            </div>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="sq-foto-acoes">
              <button type="button" className="sq-btn" onClick={() => input.current?.click()} disabled={enviando}>{f.imagem ? "Trocar foto" : "Escolher foto"}</button>
              {f.imagem && <button type="button" className="sq-btn" onClick={() => mudar("imagem", undefined)}>Remover</button>}
            </div>
            <p className="sq-sub">Pode mandar direto do celular. A foto é ajustada sozinha para carregar rápido no site.</p>
          </section>

          <section className="sq-cartao">
            <h2>Alergênicos</h2>
            <p className="sq-sub">Marque o que o item contém, incluindo os toppings e opções. A lei exige mostrar isso antes da compra.</p>
            <div className="sq-alergenicos">
              {ALERGENICOS.map((a) => {
                const marcado = (f.alergenicos ?? []).includes(a.id);
                return (
                  <label key={a.id} className={"sq-alerg" + (marcado ? " ligado" : "")}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => mudar("alergenicos", marcado ? (f.alergenicos ?? []).filter((x) => x !== a.id) : [...(f.alergenicos ?? []), a.id])}
                    />
                    {a.nome}
                  </label>
                );
              })}
            </div>
            <label className="sq-check">
              <input type="checkbox" checked={f.alergenicos != null && f.alergenicos.length === 0} onChange={(e) => mudar("alergenicos", e.target.checked ? [] : undefined)} />
              <span><strong>Não contém nenhum dos 14</strong><span className="sq-sub">Deixe tudo desmarcado e esta caixa vazia se ainda não conferiu: o site mostra "pergunte antes de pedir".</span></span>
            </label>
          </section>

          <section className="sq-cartao">
            <h2>Disponibilidade</h2>
            <label className="sq-interruptor">
              <input type="checkbox" checked={f.disponivel} onChange={(e) => mudar("disponivel", e.target.checked)} />
              <span className="trilho" aria-hidden="true" />
              <span>{f.disponivel ? "Disponível no site" : "Esgotado (aparece, mas não dá para pedir)"}</span>
            </label>
          </section>

          {!novo && (
            <section className="sq-cartao">
              <h2>Apagar item</h2>
              {!apagar ? (
                <button type="button" className="sq-btn sq-btn-perigo" onClick={() => setApagar(true)}>Apagar este item</button>
              ) : (
                <div className="sq-foto-acoes">
                  <button type="button" className="sq-btn sq-btn-perigo cheio" onClick={remover}>Sim, apagar do cardápio</button>
                  <button type="button" className="sq-btn" onClick={() => setApagar(false)}>Cancelar</button>
                </div>
              )}
              <p className="sq-sub">Se for só por hoje, prefira marcar como esgotado.</p>
            </section>
          )}
        </div>
      </div>
    </form>
  );
}
