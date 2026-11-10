import type { Faixa } from "./ajustes";

/** Distância em metros entre dois pontos (fórmula de Haversine, linha reta). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const METROS_POR_MILHA = 1609.344;

/** Minutos estimados até a porta, considerando ruas não retas (fator 1.35). */
export function minutosAte(distancia: number, velocidadeKmh = 25) {
  const metrosPorMin = (velocidadeKmh * 1000) / 60;
  return Math.max(0, Math.round(((distancia * 1.35) / metrosPorMin) * 10) / 10);
}

/** Direção (0 = norte, 90 = leste) de a para b, em graus. Usada para virar a motinha no mapa. */
export function direcaoGraus(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export type Cotacao =
  | { ok: true; milhas: number; taxa: number; gratisAcima: number | null; gratis: boolean }
  | { ok: false; milhas: number; motivo: string };

/** Taxa de entrega pela distância em linha reta, igual à regra da Square (faixas em milhas). Valores em pence. */
export function cotarEntrega(distanciaM: number, subtotal: number, faixas: Faixa[], raioMilhas: number): Cotacao {
  const milhas = Math.round((distanciaM / METROS_POR_MILHA) * 10) / 10;
  if (milhas > raioMilhas) return { ok: false, milhas, motivo: `Ainda não entregamos tão longe (${milhas} milhas). Entregamos até ${raioMilhas} milhas da cozinha.` };
  const ordenadas = [...faixas].sort((a, b) => a.ateMilhas - b.ateMilhas);
  const faixa = ordenadas.find((f) => distanciaM / METROS_POR_MILHA <= f.ateMilhas) ?? ordenadas[ordenadas.length - 1];
  if (!faixa) return { ok: true, milhas, taxa: 0, gratisAcima: null, gratis: true };
  const gratisAcima = faixa.gratisAcima != null ? Math.round(faixa.gratisAcima * 100) : null;
  const gratis = gratisAcima != null && subtotal >= gratisAcima;
  return { ok: true, milhas, taxa: gratis ? 0 : Math.round(faixa.taxa * 100), gratisAcima, gratis };
}

/** Postcode do Reino Unido -> coordenadas, pelo serviço gratuito postcodes.io. */
export async function coordenadasDoPostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`${process.env.POSTCODES_API_URL || "https://api.postcodes.io"}/postcodes/${pc}`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    const { latitude, longitude } = d.result ?? {};
    return typeof latitude === "number" && typeof longitude === "number" ? { lat: latitude, lng: longitude } : null;
  } catch {
    return null;
  }
}
