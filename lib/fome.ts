import { cardapio, emPence, type Item } from "./cardapio";

export type NivelFome = "lanche" | "normal" | "leao" | "sem-fundo";
export type Gosto = "pastel" | "batata" | "doce" | "bebida";

/** Quantas "porções de salgado" cada pessoa come. 1 porção = 1 pastel gigante ou 1 batata top. Ajuste à vontade. */
export const NIVEIS: { id: NivelFome; nome: string; fala: string; fator: number }[] = [
  { id: "lanche", nome: "Só um lanchinho", fala: "Beliscar sem pesar", fator: 0.5 },
  { id: "normal", nome: "Fome normal", fala: "Aquela refeição completa", fator: 1 },
  { id: "leao", nome: "Fome de leão", fala: "Não comi nada o dia todo", fator: 1.5 },
  { id: "sem-fundo", nome: "Saco sem fundo", fala: "Quero sair rolando", fator: 2 },
];

export const GOSTOS: { id: Gosto; nome: string }[] = [
  { id: "pastel", nome: "Pastel salgado" },
  { id: "batata", nome: "Batata recheada" },
  { id: "doce", nome: "Sobremesa" },
  { id: "bebida", nome: "Bebida" },
];

export type Sugestao = { linhas: { item: Item; qtd: number }[]; total: number; resumo: string };

// Só sugere itens disponíveis e que não exigem escolher adicionais.
const pronto = (i: Item) => i.disponivel && !(i.escolhas ?? []).some((e) => e.min > 0);

function distribuir(categoria: string, qtd: number, preferir?: (i: Item) => boolean) {
  let opcoes = cardapio.itens.filter((i) => i.categoria === categoria && pronto(i));
  if (preferir) opcoes = [...opcoes.filter(preferir), ...opcoes.filter((i) => !preferir(i))];
  const mapa = new Map<Item, number>();
  if (!opcoes.length) return mapa;
  // Varia os sabores: um de cada, girando.
  for (let k = 0; k < qtd; k++) {
    const it = opcoes[k % Math.min(opcoes.length, Math.max(2, Math.ceil(qtd / 2)))];
    mapa.set(it, (mapa.get(it) ?? 0) + 1);
  }
  return mapa;
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function sugerir(pessoas: number, fome: NivelFome, gostos: Gosto[]): Sugestao {
  const fator = NIVEIS.find((n) => n.id === fome)!.fator;
  const porcoes = Math.max(1, Math.ceil(pessoas * fator));
  const querPastel = gostos.includes("pastel");
  const querBatata = gostos.includes("batata");
  const soDoce = !querPastel && !querBatata;

  let nBatata = 0;
  let nPastel = 0;
  if (querPastel && querBatata) {
    nBatata = porcoes >= 2 ? Math.max(1, Math.floor(porcoes / 3)) : 0;
    nPastel = porcoes - nBatata;
  } else if (querBatata) nBatata = porcoes;
  else if (querPastel) nPastel = porcoes;

  // Sem salgado, a sobremesa vira a refeição: usa a fome inteira.
  const nDoce = gostos.includes("doce") ? (soDoce ? porcoes : Math.max(1, Math.ceil(pessoas * (fator >= 1.5 ? 1 : 0.5)))) : 0;
  const nBebida = gostos.includes("bebida") ? pessoas : 0;

  const linhas: Sugestao["linhas"] = [];
  const juntar = (m: Map<Item, number>) => m.forEach((qtd, item) => linhas.push({ item, qtd }));
  // Começa pelos campeões de recheio (X-Tudo e os de carne) quando a fome é grande.
  juntar(distribuir("pasteis", nPastel, fator >= 1.5 ? (i) => /x-tudo|carne/i.test(i.id) : undefined));
  juntar(distribuir("batatas", nBatata));
  juntar(distribuir("pasteis-doces", nDoce));
  juntar(distribuir("bebidas", nBebida, (i) => /guarana|caldo/i.test(i.id)));

  const total = linhas.reduce((s, l) => s + emPence(l.item.preco) * l.qtd, 0);
  const partes = [
    nPastel && plural(nPastel, "pastel gigante", "pastéis gigantes"),
    nBatata && plural(nBatata, "batata top", "batatas top"),
    nDoce && plural(nDoce, "pastel doce", "pastéis doces"),
    nBebida && plural(nBebida, "bebida", "bebidas"),
  ].filter(Boolean) as string[];
  const resumo = partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0] ?? "";
  return { linhas, total, resumo };
}
