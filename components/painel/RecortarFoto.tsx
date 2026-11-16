"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Enquadrar a foto antes de enviar: o quadrado mostra exatamente como o item aparece no site.
 * Arraste com o dedo (ou mouse) para mover, use o controle (ou pinça com dois dedos) para aproximar.
 * Gera uma foto quadrada de 1200 x 1200.
 */
const LADO = 1200;

export default function RecortarFoto({ fonte, cancelar, pronto }: { fonte: string; cancelar: () => void; pronto: (b: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // deslocamento em fração do quadro
  const [gerando, setGerando] = useState(false);
  const quadro = useRef<HTMLDivElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = fonte;
  }, [fonte]);

  // Tamanho da foto dentro do quadro (1 = quadro inteiro): com zoom 1 o lado menor ocupa o quadro todo.
  const base = img ? { w: Math.max(1, img.naturalWidth / img.naturalHeight), h: Math.max(1, img.naturalHeight / img.naturalWidth) } : { w: 1, h: 1 };
  const tam = { w: base.w * zoom, h: base.h * zoom };
  const limitar = (p: { x: number; y: number }, t = tam) => ({
    x: Math.min(0, Math.max(1 - t.w, p.x)),
    y: Math.min(0, Math.max(1 - t.h, p.y)),
  });

  // Começa centralizada.
  useEffect(() => {
    if (img) setPos(limitar({ x: (1 - base.w) / 2, y: (1 - base.h) / 2 }, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  function mudarZoom(z: number) {
    const novo = Math.min(4, Math.max(1, z));
    const t = { w: base.w * novo, h: base.h * novo };
    // Mantém o centro do quadro no mesmo ponto da foto.
    const cx = (0.5 - pos.x) / tam.w, cy = (0.5 - pos.y) / tam.h;
    setZoom(novo);
    setPos(limitar({ x: 0.5 - cx * t.w, y: 0.5 - cy * t.h }, t));
  }

  function baixo(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      pinca.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function mover(e: React.PointerEvent) {
    const antes = toques.current.get(e.pointerId);
    if (!antes || !quadro.current) return;
    const lado = quadro.current.clientWidth;
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2 && pinca.current) {
      const [a, b] = [...toques.current.values()];
      mudarZoom(pinca.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinca.current.dist));
      return;
    }
    setPos((p) => limitar({ x: p.x + (e.clientX - antes.x) / lado, y: p.y + (e.clientY - antes.y) / lado }));
  }
  function cima(e: React.PointerEvent) {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) pinca.current = null;
  }

  async function confirmar() {
    if (!img) return;
    setGerando(true);
    const c = document.createElement("canvas");
    c.width = LADO;
    c.height = LADO;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, pos.x * LADO, pos.y * LADO, tam.w * LADO, tam.h * LADO);
    const gerar = (tipo: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
    let b = await gerar("image/webp", 0.85);
    if (!b || b.type !== "image/webp") b = await gerar("image/jpeg", 0.87);
    setGerando(false);
    if (b) pronto(b);
  }

  return (
    <div className="sq-recorte-veu" role="dialog" aria-modal="true" aria-label="Enquadrar a foto">
      <div className="sq-recorte">
        <h2>Enquadrar a foto</h2>
        <p className="sq-sub">Arraste para posicionar e aproxime com dois dedos ou com o controle. O quadrado é como a foto aparece no site.</p>
        <div
          ref={quadro}
          className="sq-recorte-quadro"
          onPointerDown={baixo}
          onPointerMove={mover}
          onPointerUp={cima}
          onPointerCancel={cima}
          onWheel={(e) => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}
        >
          {img ? (
            <img
              src={fonte}
              alt=""
              draggable={false}
              style={{ left: pos.x * 100 + "%", top: pos.y * 100 + "%", width: tam.w * 100 + "%", height: tam.h * 100 + "%" }}
            />
          ) : (
            <span className="sq-sub">Abrindo a foto...</span>
          )}
          <span className="sq-recorte-grade" aria-hidden="true" />
        </div>
        <label className="sq-recorte-zoom">
          <span aria-hidden="true">−</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Aproximar" />
          <span aria-hidden="true">+</span>
        </label>
        <div className="sq-recorte-acoes">
          <button type="button" className="sq-btn" onClick={cancelar}>Cancelar</button>
          <button type="button" className="sq-btn sq-btn-primario" onClick={confirmar} disabled={!img || gerando}>
            {gerando ? "Preparando..." : "Usar esta foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
