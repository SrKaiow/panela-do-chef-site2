"use client";

import { useEffect, useRef, useState } from "react";
import Avaliar from "./Avaliar";

export type Depoimento = { nome: string; local: string | null; nota: number; texto: string; foto?: string; verificado?: boolean; data?: string };

const Estrelas = ({ n }: { n: number }) => (
  <span className="estrelas" aria-label={`${n} de 5 estrelas`}>
    {"★★★★★".slice(0, n)}
    <span className="apagada">{"★★★★★".slice(n)}</span>
  </span>
);

export default function Avaliacoes({ lista, clientes }: { lista: Depoimento[]; clientes?: string }) {
  const [aberto, setAberto] = useState(false);
  const trilho = useRef<HTMLDivElement>(null);
  const media = lista.length ? lista.reduce((s, d) => s + d.nota, 0) / lista.length : 5;

  function rolar(dir: 1 | -1) {
    const t = trilho.current;
    if (!t) return;
    t.scrollBy({ left: dir * Math.min(t.clientWidth * 0.9, 640), behavior: "smooth" });
  }

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto]);

  return (
    <section className="depo" aria-labelledby="depo-titulo">
      <div className="miolo depo-topo">
        <div>
          <p className="olho">Avaliações de clientes</p>
          <h2 id="depo-titulo" className="titulo-secao">Quem prova, <em>volta</em></h2>
        </div>
        <div className="selos-prova">
        {clientes && (
          <div className="nota-media">
            <strong className="num">{clientes}</strong>
            <div><span className="rotulo-forte">clientes</span><span>satisfeitos</span></div>
          </div>
        )}
        <div className="nota-media">
          <strong className="num">{media.toFixed(1).replace(".", ",")}</strong>
          <div>
            <Estrelas n={Math.round(media)} />
            <span>{lista.length} avaliações</span>
          </div>
        </div>
        </div>
      </div>

      <div className="depo-trilho" ref={trilho} tabIndex={0} aria-label="Avaliações, role para o lado para ver mais">
        {lista.map((d, i) => (
          <blockquote key={i} className="depo-cartao">
            <Estrelas n={d.nota} />
            <p>{d.texto}</p>
            <footer>
              {d.foto ? <img className="avatar" src={d.foto} alt="" loading="lazy" /> : <span className="avatar" aria-hidden="true">{d.nome.trim().charAt(0).toUpperCase()}</span>}
              <cite>
                {d.nome}{d.local ? ` · ${d.local}` : ""}
                {d.verificado && <span className="verificado">Pedido verificado</span>}
              </cite>
            </footer>
          </blockquote>
        ))}
      </div>

      <div className="miolo depo-acoes">
        <div className="setas">
          <button type="button" className="seta" onClick={() => rolar(-1)} aria-label="Avaliações anteriores">←</button>
          <button type="button" className="seta" onClick={() => rolar(1)} aria-label="Mais avaliações">→</button>
        </div>
        <button type="button" className="botao" onClick={() => setAberto(true)}>Deixar minha avaliação ★</button>
      </div>

      {aberto && (
        <div className="fundo" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="folha" role="dialog" aria-modal="true" aria-label="Deixar avaliação">
            <header>
              <div>
                <h2>Sua avaliação</h2>
                <p className="desc">Conta pra gente como foi. A sua avaliação aparece aqui depois que o Chef aprovar.</p>
              </div>
              <button className="fechar" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
            </header>
            <Avaliar onFechar={() => setAberto(false)} />
          </div>
        </div>
      )}
    </section>
  );
}
