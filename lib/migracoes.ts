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

/** Novidades: de £19.99 por £17.90. */
function novidadesPromoV2(c: Cardapio): Cardapio {
  const ids = ["acai-choquito-750", "acai-sensacao-maltine"];
  return { ...c, itens: c.itens.map((i) => (ids.includes(i.id) ? { ...i, preco: 17.9, precoAntigo: 19.99 } : i)) };
}

/** Novidade: Banoffe (copão 750g). */
function banoffeV1(c: Cardapio): Cardapio {
  if (c.itens.some((i) => i.id === "acai-banoffe-750")) return c;
  const base = c.itens.find((i) => i.id === "acai-choquito-750") ?? c.itens.find((i) => i.id === "acai-500");
  const novo = {
    id: "acai-banoffe-750",
    nome: "Banoffe",
    categoria: base?.categoria ?? "acai",
    descricao: "Copão de 750g com base de biscoito e paçoca, doce de leite, chantilly, creme de banoffee, banana em rodelas e paçoca triturada por cima.",
    preco: 17.9,
    precoAntigo: 19.99,
    disponivel: true,
    novidade: true,
    destaque: true,
    selo: "Copão de 750g",
    escolhas: [],
  };
  const pos = c.itens.findIndex((i) => i.id === "acai-sensacao-maltine") + 1;
  const itens = [...c.itens];
  itens.splice(pos > 0 ? pos : 0, 0, novo);
  return { ...c, itens };
}

/** Massa Show: monte sua bowl (£10). */
function massaShowV1(c: Cardapio): Cardapio {
  if (c.itens.some((i) => i.id === "massa-show")) return c;
  const F = "/fotos/cardapio/";
  const op = (nomes: string[]) => nomes.map((nome) => ({ nome }));
  const adicionais = {
    ...c.adicionais,
    "massa-tipo": {
      nome: "1. Escolha sua massa", nomeInterno: "Massa Show - massa",
      opcoes: [
        { nome: "Penne", imagem: F + "massa-penne.jpg" },
        { nome: "Spaghetti", imagem: F + "massa-spaghetti.jpg" },
        { nome: "Fusilli" },
        { nome: "Tagliatelle", imagem: F + "massa-show.jpg" },
      ],
      regras: { obrigatorio: true, varios: false, max: 1, repetir: false },
    },
    "massa-ingredientes": {
      nome: "2. Escolha seus ingredientes", nomeInterno: "Massa Show - ingredientes",
      opcoes: op(["Cebola branca", "Cebola roxa", "Tomate seco", "Pimentão", "Cogumelos", "Milho", "Ervilha", "Azeitonas", "Brócolis", "Tomate", "Presunto", "Bacon", "Calabresa", "Alho-poró"]),
      regras: { obrigatorio: false, varios: true, max: 6, repetir: false },
    },
    "massa-molho": {
      nome: "3. Escolha seu molho", nomeInterno: "Massa Show - molho",
      opcoes: op(["Molho branco", "Molho vermelho"]),
      regras: { obrigatorio: true, varios: false, max: 1, repetir: false },
    },
    "massa-proteina": {
      nome: "4. Adicionais", nomeInterno: "Massa Show - proteínas (+£4)",
      opcoes: ["Frango", "Carne moída", "Camarão"].map((nome) => ({ nome, preco: 4 })),
      regras: { obrigatorio: false, varios: true, max: 3, repetir: false },
    },
    "massa-temperos": {
      nome: "5. Temperos", nomeInterno: "Massa Show - temperos",
      opcoes: op(["Alho", "Sal", "Pimenta-do-reino", "Orégano", "Páprica", "Manjericão", "Salsinha", "Óleo", "Azeite"]),
      regras: { obrigatorio: false, varios: true, max: 9, repetir: false },
    },
    "massa-finalizacao": {
      nome: "6. Finalização", nomeInterno: "Massa Show - finalização",
      opcoes: op(["Queijo parmesão", "Queijo muçarela", "Catupiry", "Cream cheese"]),
      regras: { obrigatorio: false, varios: true, max: 2, repetir: false },
    },
  };
  const categorias = c.categorias.some((x) => x.id === "massas")
    ? c.categorias
    : (() => {
        const i = c.categorias.findIndex((x) => x.id === "acai");
        const lista = [...c.categorias];
        lista.splice(i >= 0 ? i + 1 : 0, 0, { id: "massas", nome: "Massas" });
        return lista;
      })();
  const item = {
    id: "massa-show",
    nome: "Massa Show",
    categoria: "massas",
    descricao: "Monte sua bowl do seu jeito: escolha a massa, os ingredientes, o molho, os temperos e a finalização.",
    preco: 10,
    disponivel: true,
    destaque: true,
    novidade: true,
    video: "/videos/massa-show",
    imagem: F + "massa-show.jpg",
    escolhas: [
      { grupo: "massa-tipo", min: 1, max: 1 },
      { grupo: "massa-ingredientes", min: 0, max: 6 },
      { grupo: "massa-molho", min: 1, max: 1 },
      { grupo: "massa-proteina", min: 0, max: 3 },
      { grupo: "massa-temperos", min: 0, max: 9 },
      { grupo: "massa-finalizacao", min: 0, max: 2 },
    ],
  };
  return { ...c, categorias, adicionais, itens: [...c.itens, item] };
}

/** Massa Show: pode escolher os 2 molhos, até 10 ingredientes; frango e carne moída +£2, camarão +£4. */
function massaShowV2(c: Cardapio): Cardapio {
  const a = { ...c.adicionais };
  if (a["massa-molho"]) a["massa-molho"] = { ...a["massa-molho"], nome: "3. Escolha seu molho (pode os 2)", regras: { obrigatorio: true, varios: true, max: 2, repetir: false } };
  if (a["massa-proteina"])
    a["massa-proteina"] = { ...a["massa-proteina"], nomeInterno: "Massa Show - proteínas", opcoes: a["massa-proteina"].opcoes.map((o) => ({ ...o, preco: /camar/i.test(o.nome) ? 4 : 2 })) };
  if (a["massa-ingredientes"]) a["massa-ingredientes"] = { ...a["massa-ingredientes"], regras: { obrigatorio: false, varios: true, max: 10, repetir: false } };
  const itens = c.itens.map((i) =>
    i.id === "massa-show"
      ? {
          ...i,
          escolhas: (i.escolhas ?? []).map((e) =>
            e.grupo === "massa-molho" ? { ...e, min: 1, max: 2 } : e.grupo === "massa-ingredientes" ? { ...e, max: 10 } : e,
          ),
        }
      : i,
  );
  return { ...c, adicionais: a, itens };
}

/** Copões de 750g ainda sem ingredientes: aparecem como "Em breve". */
function copoesEmBreveV1(c: Cardapio): Cardapio {
  const ids = ["acai-choquito-750", "acai-sensacao-maltine", "acai-banoffe-750"];
  return { ...c, itens: c.itens.map((i) => (ids.includes(i.id) ? { ...i, disponivel: false, emBreve: true, voltaEm: undefined, destaque: false } : i)) };
}

/** Mousses no açaí: £2 cada, pode repetir até 3. Maracujá com selo "Mais pedido". Sai o mousse antigo dos extras. */
function moussesAcaiV1(c: Cardapio): Cardapio {
  const a = { ...c.adicionais };
  a["mousses-acai"] = {
    nome: "Mousses",
    nomeInterno: "Açaí - mousses (£2 cada)",
    opcoes: [
      { nome: "Mousse de Maracujá", preco: 2, destaque: true },
      { nome: "Mousse de Limão", preco: 2 },
      { nome: "Mousse de Morango", preco: 2 },
      { nome: "Mousse de Uva", preco: 2 },
    ],
    regras: { obrigatorio: false, varios: true, max: 3, repetir: true },
  };
  if (a["extras-acai"]) a["extras-acai"] = { ...a["extras-acai"], opcoes: a["extras-acai"].opcoes.filter((o) => !/^mousse/i.test(o.nome)) };
  const itens = c.itens.map((i) => {
    if (!(i.id === "acai-350" || i.id === "acai-500") || (i.escolhas ?? []).some((e) => e.grupo === "mousses-acai")) return i;
    const esc = [...(i.escolhas ?? [])];
    const pos = esc.findIndex((e) => e.grupo === "toppings-acai");
    esc.splice(pos >= 0 ? pos + 1 : esc.length, 0, { grupo: "mousses-acai", min: 0, max: 3 });
    return { ...i, escolhas: esc };
  });
  return { ...c, adicionais: a, itens };
}

/** Extras pagos do açaí: Tortuguita, Chokito e Jujuba, logo depois do Ouro Branco. */
function extrasDocesV1(c: Cardapio): Cardapio {
  const g = c.adicionais["extras-acai"];
  if (!g) return c;
  const novos: Opcao[] = [
    { nome: "Tortuguita", preco: 2.5 },
    { nome: "Chokito", preco: 2.5 },
    { nome: "Jujuba (gominha)", preco: 1.5 },
  ].filter((n) => !g.opcoes.some((o) => nome(o.nome) === nome(n.nome)));
  const opcoes = [...g.opcoes];
  const pos = opcoes.findIndex((o) => /ouro branco/i.test(o.nome));
  opcoes.splice(pos >= 0 ? pos + 1 : opcoes.length, 0, ...novos);
  return { ...c, adicionais: { ...c.adicionais, "extras-acai": { ...g, opcoes } } };
}

/** Fotos novas do Pastel Frango, Pequi e Gueroba e do Pastel Queijo: tira a foto antiga do painel para valer a nova. */
function fotosPasteisV1(c: Cardapio): Cardapio {
  const ids = new Set(["pastel-frango-pequi", "pastel-queijo"]);
  return { ...c, itens: c.itens.map((i) => (ids.has(i.id) ? { ...i, imagem: undefined } : i)) };
}

const MIGRACOES: [string, (c: Cardapio) => Cardapio][] = [
  ["adicionais-acai-v1", adicionaisAcaiV1],
  ["precos-reais-v1", precosReaisV1],
  ["novidades-v1", novidadesV1],
  ["novidades-promo-v1", novidadesPromoV1],
  ["novidades-promo-v2", novidadesPromoV2],
  ["banoffe-v1", banoffeV1],
  ["massa-show-v1", massaShowV1],
  ["massa-show-v2", massaShowV2],
  ["copoes-em-breve-v1", copoesEmBreveV1],
  ["mousses-acai-v1", moussesAcaiV1],
  ["extras-doces-v1", extrasDocesV1],
  ["fotos-pasteis-v1", fotosPasteisV1],
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
