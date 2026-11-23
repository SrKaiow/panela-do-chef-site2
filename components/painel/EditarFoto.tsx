"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Esconde dados pessoais numa foto de avaliação (endereço na nota, telefone...).
 * Arraste o dedo/mouse sobre a parte a esconder: "Borrar" quadricula (fica ilegível) e "Tarja" cobre com uma cor.
 * Ao salvar, a foto nova substitui a original, e a original é apagada do banco.
 */
type Marca = { x: number; y: number; w: number; h: number; tipo: "borrar" | "tarja"; cor: string };
const CORES = [
  { nome: "Kraft", cor: "#b9936a" },
  { nome: "Branco", cor: "#f4f1ea" },
  { nome: "Preto", cor: "#1c1c1c" },
];

export default function EditarFoto({ src, fechar, salvar }: { src: string; fechar: () => void; salvar: (b: Blob) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [atual, setAtual] = useState<Marca | null>(null);
  const [tipo, setTipo] = useState<Marca["tipo"] | "mover">("borrar");
  // Zoom: a foto aumenta dentro da área e dá para andar por ela com "Mover" (ou rolando no computador).
  const [zoom, setZoom] = useState(1);
  const [base, setBase] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [cor, setCor] = useState(CORES[0].cor);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "salvando" | "erro">("carregando");
  const inicio = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      img.current = i;
      const c = canvas.current!;
      const escala = Math.min(1, 1600 / Math.max(i.naturalWidth, i.naturalHeight));
      c.width = Math.round(i.naturalWidth * escala);
      c.height = Math.round(i.naturalHeight * escala);
      medir();
      setEstado("pronto");
    };
    i.onerror = () => setEstado("erro");
    i.src = src;
  }, [src]);

  // Largura da foto em 100%: cabe inteira na área.
  function medir() {
    const a = area.current, c = canvas.current;
    if (!a || !c || !c.width) return;
    // Altura de referência pela tela (a área pode estar espremida enquanto a foto carrega).
    const w = a.clientWidth - 16, h = Math.max(240, window.innerHeight * 0.55);
    setBase(Math.max(100, Math.min(w, h * (c.width / c.height))));
  }
  useEffect(() => {
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /** Muda o zoom mantendo o mesmo ponto no meio da tela. */
  function mudarZoom(novo: number) {
    const a = area.current;
    const z = Math.min(6, Math.max(1, Math.round(novo * 4) / 4));
    if (!a || z === zoom) return;
    const cx = (a.scrollLeft + a.clientWidth / 2) / zoom, cy = (a.scrollTop + a.clientHeight / 2) / zoom;
    setZoom(z);
    requestAnimationFrame(() => {
      a.scrollLeft = cx * z - a.clientWidth / 2;
      a.scrollTop = cy * z - a.clientHeight / 2;
    });
  }

  // Redesenha a foto com todas as marcas.
  useEffect(() => {
    const c = canvas.current, i = img.current;
    if (!c || !i) return;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(i, 0, 0, c.width, c.height);
    for (const m of [...marcas, ...(atual ? [atual] : [])]) {
      const r = normalizar(m);
      if (r.w < 2 || r.h < 2) continue;
      if (m.tipo === "tarja") {
        ctx.fillStyle = m.cor;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(10, r.w / 6, r.h / 6));
        ctx.fill();
      } else {
        // Quadriculado grosso: reduz a área para poucos pontos e amplia sem suavizar. Texto fica impossível de ler.
        const bloco = Math.max(10, Math.round(Math.max(r.w, r.h) / 10));
        const pw = Math.max(1, Math.round(r.w / bloco)), ph = Math.max(1, Math.round(r.h / bloco));
        const tmp = document.createElement("canvas");
        tmp.width = pw;
        tmp.height = ph;
        tmp.getContext("2d")!.drawImage(c, r.x, r.y, r.w, r.h, 0, 0, pw, ph);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, pw, ph, r.x, r.y, r.w, r.h);
        ctx.imageSmoothingEnabled = true;
      }
    }
  }, [marcas, atual, estado]);

  function ponto(e: React.PointerEvent) {
    const c = canvas.current!;
    const b = c.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * c.width, y: ((e.clientY - b.top) / b.height) * c.height };
  }
  function normalizar(m: Marca) {
    return { x: Math.round(Math.min(m.x, m.x + m.w)), y: Math.round(Math.min(m.y, m.y + m.h)), w: Math.round(Math.abs(m.w)), h: Math.round(Math.abs(m.h)) };
  }

  async function concluir() {
    setEstado("salvando");
    try {
      const blob = await new Promise<Blob | null>((ok) => canvas.current!.toBlob(ok, "image/jpeg", 0.88));
      if (!blob) throw new Error("sem imagem");
      await salvar(blob);
    } catch {
      setEstado("pronto");
      alert("Não consegui salvar a foto. Tente de novo.");
    }
  }

  return (
    <div className="ef-fundo" role="dialog" aria-modal="true" aria-label="Esconder dados da foto">
      <div className="ef-caixa">
        <header className="ef-topo">
          <strong>Esconder dados da foto</strong>
          <button className="ef-x" onClick={fechar} aria-label="Fechar">×</button>
        </header>
        <p className="ef-dica">Arraste o dedo por cima do endereço, nome ou telefone.</p>
        <div className="ef-ferramentas">
          <button className={"ef-tool" + (tipo === "borrar" ? " on" : "")} onClick={() => setTipo("borrar")}>▦ Borrar</button>
          <button className={"ef-tool" + (tipo === "tarja" ? " on" : "")} onClick={() => setTipo("tarja")}>▬ Tarja</button>
          {tipo === "tarja" && CORES.map((c) => (
            <button key={c.cor} className={"ef-cor" + (cor === c.cor ? " on" : "")} style={{ background: c.cor }} onClick={() => setCor(c.cor)} aria-label={`Tarja ${c.nome}`} title={c.nome} />
          ))}
          <button className={"ef-tool" + (tipo === "mover" ? " on" : "")} onClick={() => setTipo("mover")}>✋ Mover</button>
          <button className="ef-tool" disabled={!marcas.length} onClick={() => setMarcas((m) => m.slice(0, -1))}>↶ Desfazer</button>
        </div>
        <div className="ef-zoom">
          <button className="ef-tool" disabled={zoom <= 1} onClick={() => mudarZoom(zoom - 0.5)} aria-label="Diminuir zoom">−</button>
          <input type="range" min={1} max={6} step={0.25} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Zoom" />
          <button className="ef-tool" disabled={zoom >= 6} onClick={() => mudarZoom(zoom + 0.5)} aria-label="Aumentar zoom">+</button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        {zoom > 1 && <p className="ef-dica">Zoom ligado: use <b>✋ Mover</b> para andar pela foto, depois volte para Borrar ou Tarja.</p>}
        <div
          className="ef-area"
          ref={area}
          style={{ placeItems: zoom > 1 ? "start" : "center" }}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); mudarZoom(zoom * (e.deltaY < 0 ? 1.15 : 0.87)); } }}
        >
          {estado === "carregando" && <p>Carregando a foto...</p>}
          {estado === "erro" && <p>Não consegui abrir a foto.</p>}
          <canvas
            ref={canvas}
            className="ef-canvas"
            style={{
              display: estado === "carregando" || estado === "erro" ? "none" : "block",
              width: base ? base * zoom : undefined,
              cursor: tipo === "mover" ? "grab" : "crosshair",
            }}
            onPointerDown={(e) => {
              if (estado !== "pronto") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              if (tipo === "mover") {
                const a = area.current!;
                arrasto.current = { x: e.clientX, y: e.clientY, sl: a.scrollLeft, st: a.scrollTop };
                return;
              }
              const p = ponto(e);
              inicio.current = p;
              setAtual({ x: p.x, y: p.y, w: 0, h: 0, tipo: tipo as Marca["tipo"], cor });
            }}
            onPointerMove={(e) => {
              if (arrasto.current) {
                const a = area.current!;
                a.scrollLeft = arrasto.current.sl - (e.clientX - arrasto.current.x);
                a.scrollTop = arrasto.current.st - (e.clientY - arrasto.current.y);
                return;
              }
              if (!inicio.current || tipo === "mover") return;
              const p = ponto(e);
              setAtual({ x: inicio.current.x, y: inicio.current.y, w: p.x - inicio.current.x, h: p.y - inicio.current.y, tipo: tipo as Marca["tipo"], cor });
            }}
            onPointerUp={() => {
              arrasto.current = null;
              if (atual) {
                const r = normalizar(atual);
                if (r.w > 6 && r.h > 6) setMarcas((m) => [...m, { ...atual, ...r }]);
              }
              inicio.current = null;
              setAtual(null);
            }}
            onPointerCancel={() => { inicio.current = null; arrasto.current = null; setAtual(null); }}
          />
        </div>
        <footer className="ef-rodape">
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn principal-p" disabled={!marcas.length || estado !== "pronto"} onClick={concluir}>
            {estado === "salvando" ? "Salvando..." : "Salvar foto"}
          </button>
        </footer>
      </div>
    </div>
  );
}
