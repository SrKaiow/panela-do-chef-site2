"use client";

import { useEffect, useRef, useState } from "react";
import { emPence, formatar, type Item } from "@/lib/cardapio";

/**
 * Novidades da casa: cada uma sozinha, grande, no topo do cardápio.
 * À esquerda, a torre de camadas monta em espiral (cada camada entra girando) e fica ondulando;
 * à direita, o copo pronto. Repete sem parar enquanto está na tela.
 */

const L = "/fotos/lancamentos/";
type Camada = { src: string; top: number; alt: number };
type Config = { tom: string; copo: string; proporcaoPilha: number; proporcaoCopo: number; camadas: Camada[] };

const MONTAGENS: Record<string, Config> = {
  "acai-sensacao-maltine": {
    tom: "rosa",
    copo: L + "s-copo.webp",
    proporcaoPilha: 0.2979,
    proporcaoCopo: 0.5244,
    camadas: [
      { src: L + "s-camada-00.webp", top: 0.0, alt: 13.62 },
      { src: L + "s-camada-01.webp", top: 12.34, alt: 14.36 },
      { src: L + "s-camada-02.webp", top: 25.43, alt: 7.66 },
      { src: L + "s-camada-03.webp", top: 31.81, alt: 8.72 },
      { src: L + "s-camada-04.webp", top: 39.26, alt: 7.13 },
      { src: L + "s-camada-05.webp", top: 45.11, alt: 8.72 },
      { src: L + "s-camada-06.webp", top: 52.55, alt: 10.85 },
      { src: L + "s-camada-07.webp", top: 62.13, alt: 7.66 },
      { src: L + "s-camada-08.webp", top: 68.51, alt: 9.26 },
      { src: L + "s-camada-09.webp", top: 76.49, alt: 8.19 },
      { src: L + "s-camada-10.webp", top: 83.4, alt: 16.6 },
    ],
  },
  "acai-choquito-750": {
    tom: "roxo",
    copo: L + "c-copo.webp",
    proporcaoPilha: 0.2857,
    proporcaoCopo: 0.5178,
    camadas: [
      { src: L + "c-camada-00.webp", top: 0.0, alt: 13.54 },
      { src: L + "c-camada-01.webp", top: 12.28, alt: 12.17 },
      { src: L + "c-camada-02.webp", top: 23.17, alt: 8.15 },
      { src: L + "c-camada-03.webp", top: 30.05, alt: 8.15 },
      { src: L + "c-camada-04.webp", top: 36.93, alt: 9.21 },
      { src: L + "c-camada-05.webp", top: 44.87, alt: 9.21 },
      { src: L + "c-camada-06.webp", top: 52.8, alt: 9.74 },
      { src: L + "c-camada-07.webp", top: 61.27, alt: 7.62 },
      { src: L + "c-camada-08.webp", top: 67.62, alt: 7.62 },
      { src: L + "c-camada-09.webp", top: 73.97, alt: 10.26 },
      { src: L + "c-camada-10.webp", top: 82.96, alt: 17.04 },
    ],
  },
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

const CICLO = 11000; // monta (~4 s) + ondula com o copo ao lado + desmonta
function Vitrine({ item, abrir }: { item: Item; abrir: (i: Item) => void }) {
  const raiz = useRef<HTMLElement>(null);
  const visivel = useRef(false);
  const [rodada, setRodada] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const cfg = MONTAGENS[item.id];

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        visivel.current = e.isIntersecting;
        if (e.isIntersecting) setRodada((r) => (r === 0 ? 1 : r));
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!rodada || !cfg) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let espera: ReturnType<typeof setInterval> | undefined;
    const t1 = setTimeout(() => setSaindo(true), CICLO - 700);
    const t2 = setTimeout(() => {
      setSaindo(false);
      if (visivel.current) setRodada((r) => r + 1);
      else espera = setInterval(() => { if (visivel.current) { clearInterval(espera); setRodada((r) => r + 1); } }, 500);
    }, CICLO);
    return () => { clearTimeout(t1); clearTimeout(t2); if (espera) clearInterval(espera); };
  }, [rodada, cfg]);

  const n = cfg?.camadas.length ?? 0;
  return (
    <section ref={raiz} className={"vitrine tom-" + (cfg?.tom ?? "roxo")} aria-labelledby={"nov-" + item.id}>
      <div className={"vitrine-palco" + (rodada ? " montando" : "") + (saindo ? " saindo" : "")} key={rodada}>
        <span className="vitrine-luz" aria-hidden="true" />
        {cfg ? (
          <div className="palco-duplo" aria-hidden="true">
            <div className="torre" style={{ aspectRatio: String(cfg.proporcaoPilha) }}>
              {/* de baixo para cima: a base entra primeiro e a tampa por último (fica por cima) */}
              {[...cfg.camadas].reverse().map((c, i) => (
                <img
                  key={c.src}
                  src={c.src}
                  alt=""
                  className={"camada" + (i === 0 ? " base" : "")}
                  style={{ top: c.top + "%", height: c.alt + "%", ["--i" as string]: i, ["--lado" as string]: i % 2 ? 1 : -1, ["--n" as string]: n }}
                />
              ))}
            </div>
            <img src={cfg.copo} alt="" className="copo-pronto" style={{ aspectRatio: String(cfg.proporcaoCopo) }} />
          </div>
        ) : (
          item.imagem && <img src={item.imagem} alt="" className="vitrine-foto" />
        )}
        {item.selo && (
          <span className="vitrine-selo">
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
          <span className="vitrine-precos">
            {item.precoAntigo && item.precoAntigo > item.preco && <s className="vitrine-de">De {formatar(emPence(item.precoAntigo))}</s>}
            <span className="vitrine-preco">
              {item.precoAntigo && item.precoAntigo > item.preco && <small>por apenas </small>}
              {formatar(emPence(item.preco))}
            </span>
          </span>
          <button type="button" className="vitrine-btn" onClick={() => abrir(item)}>
            Quero o meu
          </button>
        </div>
      </div>
    </section>
  );
}
