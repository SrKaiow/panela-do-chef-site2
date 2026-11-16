"use client";

import { useEffect, useRef, useState } from "react";
import { emPence, formatar, type Item } from "@/lib/cardapio";

/**
 * Novidades da casa: cada uma aparece sozinha, grande, no topo do cardápio.
 * Quando entra na tela, o copo é montado camada por camada (só CSS; quem prefere menos movimento vê o copo pronto).
 */

const L = "/fotos/lancamentos/";

/** Montagem camada por camada (posições tiradas da foto original, de cima para baixo em %). */
const CAMADAS: Record<string, { final: string; tom: string; camadas?: { src: string; top: number; alt: number }[] }> = {
  "acai-sensacao-maltine": {
    final: L + "sensacao-inteiro.webp?v=2",
    tom: "rosa",
    camadas: [
      { src: L + "sensacao-s1.webp", top: 77.35, alt: 22.65 },
      { src: L + "sensacao-s2.webp", top: 57.35, alt: 20 },
      { src: L + "sensacao-s3.webp", top: 47.65, alt: 9.71 },
      { src: L + "sensacao-s4.webp", top: 20, alt: 27.65 },
      { src: L + "sensacao-s5.webp", top: 0, alt: 20 },
    ],
  },
  "acai-choquito-750": { final: L + "choquito-inteiro.webp?v=2", tom: "roxo" },
};

export default function Novidades({ itens, abrir }: { itens: Item[]; abrir: (i: Item) => void }) {
  const novidades = itens.filter((i) => i.novidade && i.disponivel);
  if (!novidades.length) return null;
  return (
    <div className="novidades">
      {novidades.map((item) => (
        <Vitrine key={item.id} item={item} abrir={abrir} />
      ))}
    </div>
  );
}

function Vitrine({ item, abrir }: { item: Item; abrir: (i: Item) => void }) {
  const palco = useRef<HTMLDivElement>(null);
  const [rodada, setRodada] = useState(0);
  const cfg = CAMADAS[item.id];

  // Começa a montar quando o cartão aparece na tela.
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRodada((r) => (r === 0 ? 1 : r));
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className={"vitrine tom-" + (cfg?.tom ?? "ouro")} aria-labelledby={"nov-" + item.id}>
      <div ref={palco} className={"vitrine-palco" + (rodada ? " montando" : "")} key={rodada}>
        <span className="vitrine-luz" aria-hidden="true" />
        <span className="vitrine-chao" aria-hidden="true" />
        {cfg?.camadas ? (
          <div className="montagem montagem-pilha" aria-hidden="true">
            <div className="pilha">
              {cfg.camadas.map((c, n) => (
                <img key={c.src} src={c.src} alt="" className="camada" style={{ top: c.top + "%", height: c.alt + "%", ["--n" as string]: n }} />
              ))}
            </div>
            <img src={cfg.final} alt="" className="pronto" />
          </div>
        ) : cfg ? (
          <div className="montagem montagem-copo" aria-hidden="true">
            <img src={cfg.final} alt="" className="copo-recheio" />
            <img src={cfg.final} alt="" className="copo-topo" />
          </div>
        ) : (
          item.imagem && <img src={item.imagem} alt="" className="vitrine-foto" />
        )}
        {item.selo && (
          <span className="vitrine-selo">
            <span aria-hidden="true">👑</span>
            {item.selo.replace(/(\d+\s?g)$/i, "")}
            <strong>{(item.selo.match(/\d+\s?g$/i) ?? [""])[0]}</strong>
          </span>
        )}
      </div>

      <div className="vitrine-texto">
        <span className="vitrine-tag">Novidade na casa</span>
        <h2 id={"nov-" + item.id}>{item.nome}</h2>
        {item.descricao && <p>{item.descricao}</p>}
        <div className="vitrine-acoes">
          <span className="vitrine-preco">{formatar(emPence(item.preco))}</span>
          <button type="button" className="vitrine-btn" onClick={() => abrir(item)}>
            Quero o meu
          </button>
        </div>
        {cfg && (
          <button type="button" className="vitrine-repetir" onClick={() => setRodada((r) => r + 1)}>
            ↻ Ver a montagem de novo
          </button>
        )}
      </div>
    </section>
  );
}
