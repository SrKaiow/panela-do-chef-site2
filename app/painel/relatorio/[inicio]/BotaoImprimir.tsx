"use client";

export default function BotaoImprimir() {
  return (
    <button type="button" className="rp-botao" onClick={() => window.print()}>
      🖨 Imprimir / Salvar em PDF
    </button>
  );
}
