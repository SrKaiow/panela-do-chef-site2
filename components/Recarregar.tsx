"use client";

import { useEffect, useState } from "react";

/** Recarrega a página algumas vezes enquanto o pagamento é confirmado. */
export default function Recarregar({ segundos, vezes }: { segundos: number; vezes: number }) {
  const [desistiu, setDesistiu] = useState(false);
  useEffect(() => {
    let n = 0;
    try { n = Number(sessionStorage.getItem("panela-confirmando" + location.pathname) || 0); } catch {}
    if (n >= vezes) { setDesistiu(true); return; }
    const t = setTimeout(() => {
      try { sessionStorage.setItem("panela-confirmando" + location.pathname, String(n + 1)); } catch {}
      window.location.reload();
    }, segundos * 1000);
    return () => clearTimeout(t);
  }, [segundos, vezes]);

  return (
    <div className="manchete" role="status" aria-live="polite">
      <div>
        <h2>{desistiu ? "Ainda não recebemos a confirmação" : "Confirmando o pagamento"}</h2>
        <p>
          {desistiu
            ? "Se o valor saiu da sua conta, fale com a gente no WhatsApp com o número do pedido que a gente confere na hora."
            : "Leva só alguns segundos. Não feche esta página."}
        </p>
      </div>
    </div>
  );
}
