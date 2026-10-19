"use client";

import { useEffect, useRef } from "react";

type Ponto = { lat: number; lng: number };

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
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => ok((window as any).L);
      s.onerror = falha;
      document.head.appendChild(s);
    });
  }
  return carregando;
}

const iconeHtml = (classe: string, conteudo: string) => `<div class="pino ${classe}">${conteudo}</div>`;

export default function Mapa({ entregador, destino }: { entregador: Ponto | null; destino: Ponto | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const marcaEntregador = useRef<any>(null);
  const marcaDestino = useRef<any>(null);
  const ajustou = useRef(false);

  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      mapa.current = L.map(caixa.current, { zoomControl: false, attributionControl: true }).setView([51.33, -0.27], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(mapa.current);
      L.control.zoom({ position: "bottomright" }).addTo(mapa.current);
      atualizar(L);
    }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualizar(L: any) {
    if (!mapa.current) return;
    if (destino) {
      if (!marcaDestino.current) {
        marcaDestino.current = L.marker([destino.lat, destino.lng], {
          icon: L.divIcon({ className: "", html: iconeHtml("casa", "Você"), iconSize: [56, 30], iconAnchor: [28, 30] }),
        }).addTo(mapa.current);
      }
    }
    if (entregador) {
      if (!marcaEntregador.current) {
        marcaEntregador.current = L.marker([entregador.lat, entregador.lng], {
          icon: L.divIcon({ className: "", html: iconeHtml("moto", "Entregador"), iconSize: [92, 30], iconAnchor: [46, 30] }),
          zIndexOffset: 1000,
        }).addTo(mapa.current);
      } else {
        marcaEntregador.current.setLatLng([entregador.lat, entregador.lng]);
      }
    }
    const pontos = [entregador, destino].filter(Boolean) as Ponto[];
    if (pontos.length === 2 && !ajustou.current) {
      mapa.current.fitBounds(pontos.map((p) => [p.lat, p.lng]), { padding: [50, 50], maxZoom: 16 });
      ajustou.current = true;
    } else if (pontos.length === 1 && !ajustou.current) {
      mapa.current.setView([pontos[0].lat, pontos[0].lng], 15);
    }
  }

  useEffect(() => {
    const L = (window as any).L;
    if (L) atualizar(L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregador?.lat, entregador?.lng, destino?.lat, destino?.lng]);

  return <div ref={caixa} className="mapa" role="img" aria-label="Mapa com a posição do entregador e do seu endereço" />;
}
