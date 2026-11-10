"use client";

import { useEffect, useRef, useState } from "react";

/** Vídeo vertical da Panela: toca sozinho, sem som, em loop. O botão liga o som. */
export default function VideoCinema() {
  const ref = useRef<HTMLVideoElement>(null);
  const [som, setSom] = useState(false);

  // Só toca quando aparece na tela (economiza bateria e dados no celular).
  useEffect(() => {
    const v = ref.current;
    if (!v || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  function alternarSom() {
    const v = ref.current;
    if (!v) return;
    v.muted = som;
    if (!som) { v.currentTime = 0; v.play().catch(() => {}); }
    setSom(!som);
  }

  return (
    <figure className="midia cinema">
      <video
        ref={ref}
        poster="/fotos/panela-cinematic-capa.jpg"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-label="Vídeo da Panela do Chef: açaí, batidinhas, copos e o Chef Kaio na cozinha"
      >
        <source src="/videos/panela-cinematic.webm" type="video/webm" />
        <source src="/videos/panela-cinematic.mp4" type="video/mp4" />
      </video>
      <button type="button" className="cinema-som" onClick={alternarSom} aria-pressed={som}>
        {som ? "🔊 Som ligado" : "🔇 Ligar o som"}
      </button>
    </figure>
  );
}
