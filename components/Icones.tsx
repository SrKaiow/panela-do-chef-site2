/** Ícones das categorias (aparecem quando o item não tem foto). */
export function IconeCategoria({ categoria }: { categoria: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (categoria) {
    case "pasteis":
    case "pasteis-doces":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M6 40 A26 22 0 0 1 58 40 Z" {...p} />
          {[12, 20, 28, 36, 44, 52].map((x) => <circle key={x} cx={x} cy="37" r="1.6" fill="currentColor" stroke="none" />)}
          {categoria === "pasteis-doces" && <path d="M22 26 q4 -4 8 0 q4 4 8 0" {...p} />}
          {categoria === "pasteis" && <path d="M30 14 q-3 -5 0 -8 M38 16 q-3 -5 0 -8" {...p} />}
        </svg>
      );
    case "batatas":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <ellipse cx="32" cy="40" rx="24" ry="13" {...p} />
          <path d="M14 34 q6 -12 18 -10 q12 -2 18 10" {...p} />
          <path d="M22 30 l3 3 M32 27 l0 4 M41 30 l-3 3" {...p} />
        </svg>
      );
    case "acai":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M16 24 h32 l-4 32 h-24 z" {...p} />
          <path d="M14 24 q4 -10 12 -6 q6 -8 12 0 q8 -4 12 6" {...p} />
          <circle cx="26" cy="12" r="3" {...p} />
          <path d="M20 38 h24" {...p} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect x="20" y="12" width="24" height="44" rx="6" {...p} />
          <path d="M20 22 h24 M20 46 h24 M28 8 h8" {...p} />
        </svg>
      );
  }
}
