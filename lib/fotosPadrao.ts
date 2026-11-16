import type { Cardapio } from "./cardapio";

/**
 * Fotos dos produtos que vêm junto com o site (public/fotos/cardapio/<id>.jpg).
 * Item sem foto no painel usa a daqui; ao trocar a foto no painel, vale a do painel.
 */
const COM_FOTO = new Set<string>(["acai-350","acai-500","acai-choquito-750","acai-sensacao-maltine","batata-4-queijos","batata-calabacon","batidinha-acai","caldo-de-cana","coca-zero","fanta-laranja","j2o-apple-mango","j2o-apple-raspberry","j2o-orange-passion","pastel-4-queijos","pastel-banana-queijo","pastel-brigadeiro","pastel-carne-gueroba","pastel-carne-queijo","pastel-carne","pastel-doce-de-leite","pastel-frango-catupiry","pastel-frango","pastel-ninho-morango","pastel-nutella-morango","pastel-pizza","pastel-x-tudo"]);

/** Destaques ("Mais pedidos") até alguém marcar ou desmarcar algum no painel. */
const DESTAQUES_INICIAIS = ["acai-500", "acai-350", "pastel-x-tudo", "batata-calabacon", "pastel-carne-queijo", "pastel-nutella-morango", "batidinha-acai"];

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Fotos dos adicionais (public/fotos/adicionais/<nome>.jpg), achadas pelo nome da opção. */
const ADICIONAIS = new Set<string>(["abacaxi","banana","bis","biscoff","calda-de-abacaxi","calda-de-morango","cereja-em-calda","creme-de-ninho","creme-de-oreo","creme-de-pistache","doce-de-leite","fini","geleia-de-banana","gotas-de-chocolate-ao-leite","gotas-de-chocolate-branco","granola","kitkat","kiwi","leite-condensado","m-m","manga","marshmallow","mel","mix-de-castanhas","morango","mousse-de-maracuja","ninho","nutella","oreo","ouro-branco","ovomaltine","pacoca","pasta-de-amendoim","pessego","uva-passas","uva"]);
const APELIDOS: Record<string, string> = {
  "leite-em-po": "ninho", "leite-ninho": "ninho", "ninho": "ninho",
  "m-m-s": "m-m", "m-ms": "m-m", "mms": "m-m", "kit-kat": "kitkat",
  "uva-passa": "uva-passas", "uvas-passas": "uva-passas", "castanhas": "mix-de-castanhas", "morangos": "morango", "uvas": "uva", "uva-verde": "uva", "pessegos": "pessego", "creme-pistachio": "creme-de-pistache", "pistache": "creme-de-pistache", "calda-abacaxi": "calda-de-abacaxi", "geleia-banana": "geleia-de-banana",
};
function fotoAdicional(nome: string) {
  const n = normal(nome);
  const k = APELIDOS[n] ?? (ADICIONAIS.has(n) ? n : ADICIONAIS.has(n.replace(/s$/, "")) ? n.replace(/s$/, "") : null);
  return k && ADICIONAIS.has(k) ? `/fotos/adicionais/${k}.jpg` : undefined;
}

/** Fotos trocadas depois de publicadas: o "?v=" faz o navegador baixar de novo. */
const VERSAO: Record<string, number> = { "acai-choquito-750": 3, "acai-sensacao-maltine": 3 };
const comVersao = (url: string | undefined) => {
  const m = url?.match(/^\/fotos\/cardapio\/([a-z0-9-]+)\.jpg$/);
  return m && VERSAO[m[1]] ? `${url}?v=${VERSAO[m[1]]}` : url;
};

export function aplicarFotosPadrao(c: Cardapio): Cardapio {
  const semEscolha = !c.itens.some((i) => typeof i.destaque === "boolean");
  const adicionais = Object.fromEntries(
    Object.entries(c.adicionais).map(([id, g]) => [id, { ...g, opcoes: g.opcoes.map((o) => (o.imagem ? o : { ...o, imagem: fotoAdicional(o.nome) })) }]),
  );
  return {
    ...c,
    adicionais,
    itens: c.itens.map((i) => {
      const id = COM_FOTO.has(i.id) ? i.id : COM_FOTO.has(normal(i.nome)) ? normal(i.nome) : null;
      return {
        ...i,
        imagem: comVersao(i.imagem || (id ? `/fotos/cardapio/${id}.jpg` : undefined)),
        destaque: semEscolha ? DESTAQUES_INICIAIS.includes(i.id) || undefined : i.destaque,
      };
    }),
  };
}
