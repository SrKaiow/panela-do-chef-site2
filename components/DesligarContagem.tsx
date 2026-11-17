"use client";

import { useEffect, useState } from "react";

/** Botão da política de privacidade: liga/desliga a contagem de visitas neste navegador. */
export default function DesligarContagem() {
  const [desligado, setDesligado] = useState(false);
  useEffect(() => { try { setDesligado(localStorage.getItem("panela-sem-contagem") === "1"); } catch {} }, []);
  function alternar() {
    try {
      if (desligado) localStorage.removeItem("panela-sem-contagem");
      else { localStorage.setItem("panela-sem-contagem", "1"); localStorage.removeItem("panela-visitante"); }
      setDesligado(!desligado);
    } catch {}
  }
  return (
    <button type="button" className="btn-contagem" onClick={alternar}>
      {desligado ? "Contagem desligada neste aparelho · ligar de novo" : "Não contar minhas visitas"}
    </button>
  );
}
