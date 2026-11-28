/** Links de avaliação dos almoços (marmitas vendidas pelo WhatsApp, fora do site). */

/** "costela-no-bafo" -> "Costela no bafo". Só letras, números e hífen. */
export function pratoDoLink(slug: string): string | null {
  const s = decodeURIComponent(slug || "").toLowerCase().trim();
  if (!/^[a-z0-9à-ú]+(-[a-z0-9à-ú]+){0,6}$/.test(s) || s.length > 40) return null;
  const t = s.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Regiões que aparecem para o cliente escolher (as mais comuns das entregas). */
export const REGIOES = [
  "Epsom", "Ewell", "Stoneleigh", "Chessington", "Sutton", "Cheam", "Worcester Park", "Banstead",
  "Ashtead", "Leatherhead", "Tolworth", "Surbiton", "Kingston", "Morden", "Wallington", "Carshalton",
];
