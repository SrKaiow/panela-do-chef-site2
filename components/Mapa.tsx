"use client";

import { useEffect, useRef } from "react";

type Ponto = { lat: number; lng: number };
type Entregador = Ponto & { direcao?: number | null };

/* Leaflet + OpenStreetMap (grátis, sem chave). Carregado sob demanda só na página do pedido. */
let carregando: Promise<any> | null = null;
function carregarLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      // Conferência de integridade: se o arquivo for adulterado na origem, o navegador não carrega.
      css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      css.crossOrigin = "";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      s.crossOrigin = "";
      s.onload = () => ok((window as any).L);
      s.onerror = falha;
      document.head.appendChild(s);
    });
  }
  return carregando;
}

// Motinha vista de cima, apontando para o norte (gira pela direção).
const MOTO = `
<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
  <circle cx="20" cy="20" r="19" fill="#FFD814" stroke="#070707" stroke-width="2"/>
  <g fill="#070707">
    <rect x="17.5" y="7" width="5" height="7" rx="2.5"/>
    <rect x="17.5" y="26" width="5" height="7" rx="2.5"/>
    <rect x="15" y="12" width="10" height="16" rx="4"/>
    <rect x="11" y="13" width="18" height="2.4" rx="1.2"/>
  </g>
  <circle cx="20" cy="22" r="3.2" fill="#D92B2B"/>
</svg>`;

const pino = (classe: string, conteudo: string) => `<div class="pino ${classe}">${conteudo}</div>`;

export default function Mapa({ entregador, destino, cozinha }: { entregador: Entregador | null; destino: Ponto | null; cozinha?: Ponto | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const moto = useRef<any>(null);
  const marcaDestino = useRef<any>(null);
  const marcaCozinha = useRef<any>(null);
  const linha = useRef<any>(null);
  const ajustou = useRef(false);
  const posAtual = useRef<Ponto | null>(null);
  const animacao = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      mapa.current = L.map(caixa.current, { zoomControl: false, attributionControl: true }).setView([51.34, -0.25], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa.current);
      L.control.zoom({ position: "bottomright" }).addTo(mapa.current);
      atualizar(L);
    }).catch(() => {});
    return () => {
      vivo = false;
      if (animacao.current) cancelAnimationFrame(animacao.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function girar(graus: number | null | undefined) {
    const el = moto.current?.getElement()?.querySelector(".moto-giro") as HTMLElement | null;
    if (el && graus != null) el.style.transform = `rotate(${graus}deg)`;
  }

  // Desliza a moto da posição atual até a nova em ~4 s (o tempo entre uma atualização e outra).
  function deslizar(para: Ponto) {
    const de = posAtual.current ?? para;
    const inicio = performance.now();
    const dur = 4500;
    if (animacao.current) cancelAnimationFrame(animacao.current);
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const p = { lat: de.lat + (para.lat - de.lat) * e, lng: de.lng + (para.lng - de.lng) * e };
      moto.current?.setLatLng([p.lat, p.lng]);
      posAtual.current = p;
      if (linha.current && destino) linha.current.setLatLngs([[p.lat, p.lng], [destino.lat, destino.lng]]);
      if (k < 1) animacao.current = requestAnimationFrame(passo);
    };
    animacao.current = requestAnimationFrame(passo);
  }

  function atualizar(L: any) {
    if (!mapa.current) return;
    if (cozinha && !marcaCozinha.current) {
      marcaCozinha.current = L.marker([cozinha.lat, cozinha.lng], {
        icon: L.divIcon({ className: "", html: pino("cozinha", "Cozinha"), iconSize: [80, 30], iconAnchor: [40, 30] }),
      }).addTo(mapa.current);
    }
    if (destino && !marcaDestino.current) {
      marcaDestino.current = L.marker([destino.lat, destino.lng], {
        icon: L.divIcon({ className: "", html: pino("casa", "Você"), iconSize: [56, 30], iconAnchor: [28, 30] }),
      }).addTo(mapa.current);
    }
    if (entregador) {
      if (!moto.current) {
        moto.current = L.marker([entregador.lat, entregador.lng], {
          icon: L.divIcon({ className: "moto-icone", html: `<div class="moto-giro">${MOTO}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
          zIndexOffset: 1000,
          keyboard: false,
        }).addTo(mapa.current);
        posAtual.current = { lat: entregador.lat, lng: entregador.lng };
        if (destino) {
          linha.current = L.polyline([[entregador.lat, entregador.lng], [destino.lat, destino.lng]], {
            color: "#FFD814", weight: 4, opacity: 0.85, dashArray: "2 10", lineCap: "round",
          }).addTo(mapa.current);
        }
      } else {
        deslizar({ lat: entregador.lat, lng: entregador.lng });
      }
      girar(entregador.direcao);
    }
    const pontos = [entregador, destino, entregador ? null : cozinha].filter(Boolean) as Ponto[];
    if (!ajustou.current && pontos.length >= 2) {
      mapa.current.fitBounds(pontos.map((p) => [p.lat, p.lng]), { padding: [50, 50], maxZoom: 16 });
      ajustou.current = !!entregador;
    } else if (!ajustou.current && pontos.length === 1) {
      mapa.current.setView([pontos[0].lat, pontos[0].lng], 15);
    }
  }

  useEffect(() => {
    const L = (window as any).L;
    if (L) atualizar(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregador?.lat, entregador?.lng, entregador?.direcao, destino?.lat, destino?.lng]);

  return <div ref={caixa} className="mapa" role="img" aria-label="Mapa com a moto do entregador, a cozinha e o seu endereço" />;
}
