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

const MIGRACOES: [string, (c: Cardapio) => Cardapio][] = [["adicionais-acai-v1", adicionaisAcaiV1]];

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
