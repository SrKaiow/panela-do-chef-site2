import type { Cardapio, Opcao } from "./cardapio";
import { lerConfig, salvarConfig } from "./db";

/**
 * Ajustes únicos no cardápio salvo (rodam uma vez só; ficam anotados em config "migracoes").
 * Não mexem no que não é deles: disponibilidade, preços dos itens e fotos já escolhidas ficam como estão.
 */

const nome = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Toppings do açaí iguais aos da Square (grátis) + "Special extras" pagos. */
function adicionaisAcaiV1(c: Cardapio): Cardapio {
  const gratis: Opcao[] = [
    "Leite Condensado", "Doce de Leite", "Nutella", "Pasta de Amendoim", "Mix de Castanhas", "Paçoca", "Marshmallow", "Mel",
    ["KitKat", true], ["Bis", false, 0.5], "Oreo", ["M&M's", true], "Fini", "Uva-passas", "Biscoff", "Granola", "Leite Ninho",
    "Ovomaltine", "Kiwi", "Morango", "Banana", "Uva", "Manga", ["Pêssego", true], ["Abacaxi", true],
  ].map((x) => {
    const [n, esg, preco] = Array.isArray(x) ? x : [x];
    return { nome: n as string, ...(preco ? { preco: preco as number } : {}), ...(esg ? { esgotado: true } : {}) };
  });
  const extras: Opcao[] = (
    [
      ["Ouro Branco", 2.5], ["Gotas de Chocolate ao Leite", 1.5], ["Gotas de Chocolate Branco", 1.5], ["Cereja em Calda", 1.5],
      ["Mousse de Maracujá", 1.5, true], ["Calda de Morango", 1], ["Calda de Abacaxi", 1], ["Creme de Ninho", 1, true],
      ["Creme de Pistache", 1.5], ["Creme de Oreo", 1, true], ["Geleia de Banana", 1.5, true],
    ] as [string, number, boolean?][]
  ).map(([n, preco, esg]) => ({ nome: n, preco, ...(esg ? { esgotado: true } : {}) }));

  const antes = c.adicionais["toppings-acai"];
  // Mantém a foto que já tinha sido escolhida para a mesma opção.
  const fotoAntes = new Map((antes?.opcoes ?? []).filter((o) => o.imagem).map((o) => [nome(o.nome), o.imagem!]));
  const comFoto = (o: Opcao) => (fotoAntes.has(nome(o.nome)) ? { ...o, imagem: fotoAntes.get(nome(o.nome)) } : o);

  const adicionais = {
    ...c.adicionais,
    "toppings-acai": {
      ...(antes ?? {}),
      nome: antes?.nome ?? "Escolha os toppings",
      nomeInterno: antes?.nomeInterno ?? "Açaí - toppings (grátis)",
      opcoes: gratis.map(comFoto),
      regras: antes?.regras ?? { obrigatorio: false, varios: true, max: 5, repetir: false },
    },
    "extras-acai": c.adicionais["extras-acai"] ?? {
      nome: "Special extras",
      nomeInterno: "Açaí - extras pagos",
      opcoes: extras,
      regras: { obrigatorio: false, varios: true, max: 6, repetir: false },
    },
  };
  const itens = c.itens.map((i) =>
    (i.id === "acai-350" || i.id === "acai-500") && !(i.escolhas ?? []).some((e) => e.grupo === "extras-acai")
      ? { ...i, escolhas: [...(i.escolhas ?? []), { grupo: "extras-acai", min: 0, max: 6 }] }
      : i,
  );
  return { ...c, adicionais, itens };
}

/** Preços reais passados pelo Kaio em 16/11/2026 (tira o "preço antigo" de promoção desses itens). */
function precosReaisV1(c: Cardapio): Cardapio {
  const precos: Record<string, number> = {
    "caldo-de-cana": 3, "j2o-orange-passion": 1.5, "j2o-apple-raspberry": 1.5, "j2o-apple-mango": 1.5,
    "fanta-laranja": 1.5, "coca-zero": 1.5, "batidinha-acai": 12,
    "pastel-banana-queijo": 7.5, "pastel-coco": 7, "pastel-nutella-morango": 8, "pastel-brigadeiro": 9,
    "pastel-doce-de-leite": 8, "pastel-ninho-morango": 8, "pastel-calabresa-queijo": 8, "pastel-queijo": 7,
    "pastel-presunto-queijo": 8, "pastel-pizza": 8, "pastel-carne-queijo": 8, "pastel-4-queijos": 7, "pastel-carne": 9,
    "pastel-frango": 8, "pastel-frango-catupiry": 9, "pastel-x-tudo": 13, "pastel-carne-gueroba": 10, "pastel-frango-pequi": 10,
    "batata-4-queijos": 8, "batata-strogonoff": 9, "batata-casadinho": 9, "batata-doritos": 8, "batata-calabacon": 9,
  };
  let itens = c.itens.map((i) => {
    if (!(i.id in precos)) return i;
    const { precoAntigo: _, ...resto } = i;
    return {
      ...resto,
      preco: precos[i.id],
      ...(i.id === "pastel-doce-de-leite" ? { nome: "Pastel Doce de Leite com Canela e Açúcar" } : {}),
    };
  });
  // Fanta Uva e Fanta Limão, iguais à Fanta Laranja.
  const base = itens.find((i) => i.id === "fanta-laranja");
  if (base) {
    const pos = itens.indexOf(base) + 1;
    const novas = [
      { id: "fanta-uva", nome: "Fanta Uva (lata 330ml)" },
      { id: "fanta-limao", nome: "Fanta Limão (lata 330ml)" },
    ]
      .filter((n) => !itens.some((i) => i.id === n.id))
      .map((n) => ({ ...base, ...n, imagem: undefined, destaque: undefined, preco: 1.5, disponivel: true }));
    itens = [...itens.slice(0, pos), ...novas, ...itens.slice(pos)];
  }
  // Strogonoff: frango no preço, camarão +£2.
  const g = c.adicionais["proteina-strogonoff"];
  const adicionais = g
    ? { ...c.adicionais, "proteina-strogonoff": { ...g, opcoes: g.opcoes.map((o) => (/camar/i.test(o.nome) ? { ...o, preco: 2 } : { ...o, preco: undefined })) } }
    : c.adicionais;
  return { ...c, itens, adicionais };
}

/** Novidades da casa: Açaí de Choquito com Bis de Oreo (copão 750g) e Sensação Maltine. */
function novidadesV1(c: Cardapio): Cardapio {
  const base = c.itens.find((i) => i.id === "acai-500");
  const novos = [
    {
      id: "acai-choquito-750",
      nome: "Açaí de Choquito com Bis de Oreo",
      descricao: "Copão de 750g com creme de Oreo, Leite Ninho e leite condensado, finalizado com Choquito, Bis de Oreo e biscoito Oreo.",
      preco: 17.49,
      selo: "Copão de 750g",
    },
    {
      id: "acai-sensacao-maltine",
      nome: "Sensação Maltine",
      descricao: "Uma explosão de cremosidade: camadas de açaí, mousse de morango, creme de chocolate maltine, Ovomaltine, morango e leite condensado. Com tampa em domo.",
      preco: 17.49,
    },
  ]
    .filter((n) => !c.itens.some((i) => i.id === n.id))
    .map((n) => ({ categoria: base?.categoria ?? "acai", disponivel: true, novidade: true, destaque: true, escolhas: [], ...n }));
  return { ...c, itens: [...novos, ...c.itens] };
}

/** Novidades em promoção: de £17.49 por £15.99. */
function novidadesPromoV1(c: Cardapio): Cardapio {
  const ids = ["acai-choquito-750", "acai-sensacao-maltine"];
  return { ...c, itens: c.itens.map((i) => (ids.includes(i.id) ? { ...i, preco: 15.99, precoAntigo: 17.49 } : i)) };
}

const MIGRACOES: [string, (c: Cardapio) => Cardapio][] = [
  ["adicionais-acai-v1", adicionaisAcaiV1],
  ["precos-reais-v1", precosReaisV1],
  ["novidades-v1", novidadesV1],
  ["novidades-promo-v1", novidadesPromoV1],
];

/** Aplica as migrações que ainda não rodaram e salva. Se algo falhar, devolve o cardápio como estava. */
let tudoFeito = false;
export async function migrarCardapio(c: Cardapio, salvo: boolean): Promise<Cardapio> {
  if (tudoFeito) return c;
  try {
    const feitas = (await lerConfig<string[]>("migracoes")) ?? [];
    const faltam = MIGRACOES.filter(([id]) => !feitas.includes(id));
    if (!faltam.length) { tudoFeito = true; return c; }
    let novo = c;
    for (const [, f] of faltam) novo = f(novo);
    // Cardápio ainda não salvo (padrão do site): só devolve ajustado; a migração roda de verdade quando ele for salvo.
    if (!salvo) return novo;
    await salvarConfig("cardapio", novo);
    await salvarConfig("migracoes", [...feitas, ...faltam.map(([id]) => id)]);
    tudoFeito = true;
    return novo;
  } catch (e) {
    console.error("[migracoes]", e);
    return c;
  }
}
