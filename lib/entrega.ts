import { loja } from "./cardapio";

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Velocidade média de entrega na cidade (km/h). Ajuste em data/loja.json > entrega.velocidadeMediaKmh */
const velocidade = () => (loja.entrega as { velocidadeMediaKmh?: number }).velocidadeMediaKmh ?? 25;

/** Minutos estimados até a porta, considerando ruas não retas (fator 1.35). */
export function minutosAte(distancia: number) {
  const metrosPorMin = (velocidade() * 1000) / 60;
  return Math.max(0, Math.round(((distancia * 1.35) / metrosPorMin) * 10) / 10);
}

/** Distância a partir da qual mandamos o aviso "está chegando" (padrão: ~1 minuto). */
export const metrosAviso = () => (loja.entrega as { avisoChegandoMetros?: number }).avisoChegandoMetros ?? 450;

/** Postcode do Reino Unido -> coordenadas, pelo serviço gratuito postcodes.io. */
export async function coordenadasDoPostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`https://api.postcodes.io/postcodes/${pc}`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    const { latitude, longitude } = d.result ?? {};
    return typeof latitude === "number" && typeof longitude === "number" ? { lat: latitude, lng: longitude } : null;
  } catch {
    return null;
  }
}
