"use client";

import { useMemo, useState } from "react";
import { formatar, emPence, loja, type LinhaCarrinho } from "@/lib/cardapio";
import { GOSTOS, NIVEIS, sugerir, type Gosto, type NivelFome } from "@/lib/fome";

export default function QuantoPedir({ onAdicionar }: { onAdicionar: (linhas: LinhaCarrinho[]) => void }) {
  const [pessoas, setPessoas] = useState(2);
  const [fome, setFome] = useState<NivelFome>("leao");
  const [gostos, setGostos] = useState<Gosto[]>(["pastel", "batata", "bebida"]);
  const [adicionado, setAdicionado] = useState(false);

  const s = useMemo(() => sugerir(pessoas, fome, gostos), [pessoas, fome, gostos]);
  const nivel = NIVEIS.find((n) => n.id === fome)!;

  function mudar<T>(fn: (v: T) => void) {
    return (v: T) => { fn(v); setAdicionado(false); };
  }
  const alternarGosto = mudar((g: Gosto) => setGostos((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g])));

  return (
    <section id="quanto-pedir" className="fome miolo" aria-labelledby="fome-titulo">
      <div className="fome-caixa">
        <div className="fome-chef">
          <img className="fome-logo" src="/fotos/logo-panela-do-chef.png" alt="Panela do Chef" />
        </div>

        <div style={{ minWidth: 0 }}>
          <h2 id="fome-titulo">Tá com fome? <em>Deixa que o Chef calcula.</em></h2>
          <p className="fome-intro">{loja.falaDoChef}</p>

          <div className="fome-form">
            <div className="fome-linha">
              <span className="rotulo" id="r-pessoas">Quantas pessoas?</span>
              <div className="pessoas">
                <div className="contador" role="group" aria-labelledby="r-pessoas">
                  <button type="button" onClick={() => mudar(setPessoas)(Math.max(1, pessoas - 1))} disabled={pessoas <= 1} aria-label="Menos uma pessoa">−</button>
                  <span className="num" aria-live="polite">{pessoas}</span>
                  <button type="button" onClick={() => mudar(setPessoas)(Math.min(12, pessoas + 1))} disabled={pessoas >= 12} aria-label="Mais uma pessoa">+</button>
                </div>
                <span className="dica">{pessoas === 1 ? "Só você" : `Você e mais ${pessoas - 1}`}</span>
              </div>
            </div>

            <div className="fome-linha">
              <span className="rotulo">Qual o tamanho da fome?</span>
              <div className="niveis">
                {NIVEIS.map((n) => (
                  <button key={n.id} type="button" className="nivel" aria-pressed={fome === n.id} onClick={() => mudar(setFome)(n.id)}>
                    <strong>{n.nome}</strong>
                    <span>{n.fala}</span>
                    <span className="barra-fome" aria-hidden="true"><i style={{ width: `${(n.fator / 2) * 100}%` }} /></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fome-linha">
              <span className="rotulo">O que vocês querem?</span>
              <div className="opcoes">
                {GOSTOS.map((g) => (
                  <button key={g.id} type="button" className="opcao" aria-pressed={gostos.includes(g.id)} onClick={() => alternarGosto(g.id)}>
                    {g.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="fome-fala" aria-live="polite">
              <p className="grande">
                {s.resumo
                  ? `${pessoas === 1 ? "Pra você" : `Pra ${pessoas} pessoas`} com ${nivel.nome.toLowerCase()}: ${s.resumo}.`
                  : "Me conta o que vocês querem comer que eu monto o pedido!"}
              </p>
              {s.linhas.length > 0 && (
                <ul>
                  {s.linhas.map((l) => (
                    <li key={l.item.id}>
                      <span>{l.qtd}× {l.item.nome}</span>
                      <span className="preco">{formatar(emPence(l.item.preco) * l.qtd)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rodape-fala">
                <strong className="preco">Total estimado {formatar(s.total)}</strong>
                <button
                  type="button"
                  className="botao"
                  disabled={!s.linhas.length || !loja.aberto}
                  onClick={() => {
                    onAdicionar(s.linhas.map((l) => ({ itemId: l.item.id, qtd: l.qtd, selecoes: {} })));
                    setAdicionado(true);
                  }}
                >
                  {adicionado ? "No carrinho ✓" : "Colocar tudo no carrinho"}
                </button>
              </div>
            </div>
            <p className="dica-chef">
              <b>Dica do Chef:</b> é uma sugestão. No carrinho você troca sabores e quantidades à vontade.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
