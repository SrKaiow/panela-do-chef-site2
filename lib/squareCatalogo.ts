/**
 * Lê os modificadores (adicionais) cadastrados na Square: listas, opções, preço, esgotado e foto.
 * Usado pelo painel para importar tudo de uma vez.
 */

type Obj = {
  type: string;
  id: string;
  is_deleted?: boolean;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  modifier_list_data?: { name?: string; modifiers?: Obj[]; selection_type?: string; image_ids?: string[] };
  modifier_data?: {
    name?: string;
    price_money?: { amount?: number };
    image_id?: string;
    modifier_list_id?: string;
    ordinal?: number;
    location_overrides?: { location_id?: string; sold_out?: boolean }[];
    sold_out?: boolean;
  };
  image_data?: { url?: string };
};

export type OpcaoSquare = { nome: string; preco: number; esgotado: boolean; imagemId: string | null };
export type ListaSquare = { id: string; nome: string; varios: boolean; opcoes: OpcaoSquare[] };

const base = () =>
  process.env.SQUARE_API_URL || (process.env.SQUARE_AMBIENTE === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");

async function listar(tipos: string): Promise<Obj[]> {
  const todos: Obj[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const u = new URL(base() + "/v2/catalog/list");
    u.searchParams.set("types", tipos);
    if (cursor) u.searchParams.set("cursor", cursor);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, Accept: "application/json" } });
    const d = (await r.json().catch(() => ({}))) as { objects?: Obj[]; cursor?: string };
    if (!r.ok) throw new Error("A Square não respondeu (" + r.status + ").");
    todos.push(...(d.objects ?? []));
    if (!d.cursor) break;
    cursor = d.cursor;
  }
  return todos;
}

export async function adicionaisDaSquare(): Promise<ListaSquare[]> {
  const loja = process.env.SQUARE_LOCATION_ID;
  const objs = await listar("MODIFIER_LIST,MODIFIER");
  const soltos = objs.filter((o) => o.type === "MODIFIER");
  return objs
    .filter((o) => o.type === "MODIFIER_LIST" && !o.is_deleted)
    .map((l) => {
      const mods = (l.modifier_list_data?.modifiers?.length ? l.modifier_list_data.modifiers : soltos.filter((m) => m.modifier_data?.modifier_list_id === l.id))
        .filter((m) => !m.is_deleted)
        .sort((a, b) => (a.modifier_data?.ordinal ?? 0) - (b.modifier_data?.ordinal ?? 0));
      return {
        id: l.id,
        nome: l.modifier_list_data?.name?.trim() || "Adicionais",
        varios: l.modifier_list_data?.selection_type !== "SINGLE",
        opcoes: mods.map((m) => {
          const d = m.modifier_data ?? {};
          const naLoja = d.location_overrides?.find((x) => x.location_id === loja);
          return {
            nome: (d.name ?? "").trim(),
            preco: (d.price_money?.amount ?? 0) / 100,
            esgotado: !!(naLoja?.sold_out ?? d.sold_out),
            imagemId: d.image_id ?? null,
          };
        }).filter((o) => o.nome),
      };
    })
    .filter((l) => l.opcoes.length);
}

/** Baixa a foto de uma opção (o endereço vem da própria Square, não do navegador). */
export async function fotoDaSquare(id: string): Promise<{ bytes: ArrayBuffer; tipo: string } | null> {
  const r = await fetch(base() + "/v2/catalog/object/" + encodeURIComponent(id), {
    headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, Accept: "application/json" },
  });
  const d = (await r.json().catch(() => ({}))) as { object?: Obj };
  const url = d.object?.type === "IMAGE" ? d.object.image_data?.url : undefined;
  // Só https (fora dos testes locais, que usam SQUARE_API_URL).
  if (!url || !(/^https:\/\//.test(url) || (process.env.SQUARE_API_URL && /^http:\/\/localhost/.test(url)))) return null;
  const f = await fetch(url);
  if (!f.ok) return null;
  const tipo = f.headers.get("content-type") || "image/jpeg";
  if (!tipo.startsWith("image/")) return null;
  const bytes = await f.arrayBuffer();
  if (bytes.byteLength > 15 * 1024 * 1024) return null;
  return { bytes, tipo };
}
