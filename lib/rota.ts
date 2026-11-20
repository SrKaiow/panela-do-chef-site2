import { distanciaMetros, minutosAte } from "./entrega";

/**
 * Tempo e distância de carro pelas ruas (OSRM, mapa do OpenStreetMap), em vez da linha reta.
 * A linha reta errava muito: 2.1 km em reta eram 3.3 milhas de rua (Waze 8 min, site dizia 4).
 * Guarda o resultado por ~90 s para não pedir de novo a cada atualização. Se o serviço falhar, usa a conta antiga.
 */
type Rota = { minutos: number; metros: number; pelaRua: boolean };
const cache = new Map<string, { em: number; r: Rota }>();
const SERVIDORES = ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];

/** Estimativa rápida sem chamar o serviço de mapas (linha reta + margem de ruas). */
export function rotaEstimada(de: { lat: number; lng: number }, para: { lat: number; lng: number }, velKmh?: number): Rota {
  const reta = distanciaMetros(de, para);
  return { minutos: Math.max(1, Math.round(minutosAte(reta, velKmh) * 1.4 + 1)), metros: Math.round(reta * 1.5), pelaRua: false };
}

export async function rotaCarro(de: { lat: number; lng: number }, para: { lat: number; lng: number }, velKmh?: number): Promise<Rota> {
  const chave = `${de.lat.toFixed(3)},${de.lng.toFixed(3)}>${para.lat.toFixed(4)},${para.lng.toFixed(4)}`;
  const c = cache.get(chave);
  if (c && Date.now() - c.em < 90_000) return c.r;
  for (const base of SERVIDORES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`${base}/route/v1/driving/${de.lng},${de.lat};${para.lng},${para.lat}?overview=false`, { signal: ctrl.signal, headers: { "User-Agent": "paneladochef.co.uk" } });
      clearTimeout(t);
      if (!r.ok) continue;
      const d = (await r.json()) as { code?: string; routes?: { duration: number; distance: number }[] };
      const rota = d.code === "Ok" ? d.routes?.[0] : undefined;
      if (!rota) continue;
      // +1 min para estacionar e chegar na porta.
      const res: Rota = { minutos: Math.round(rota.duration / 60 + 1), metros: Math.round(rota.distance), pelaRua: true };
      if (cache.size > 500) cache.clear();
      cache.set(chave, { em: Date.now(), r: res });
      return res;
    } catch {
      /* tenta o próximo servidor */
    }
  }
  return rotaEstimada(de, para, velKmh);
}
