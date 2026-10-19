// Confere se o data/cardapio.json está certinho antes de subir.
// Uso: npm run verificar-cardapio
import { readFileSync } from "fs";

let c;
try {
  c = JSON.parse(readFileSync(new URL("../data/cardapio.json", import.meta.url), "utf8"));
} catch (e) {
  console.error("❌ O cardapio.json tem um erro de formato (vírgula ou aspas faltando?):\n  " + e.message);
  process.exit(1);
}

const erros = [];
const cats = new Set(c.categorias.map((x) => x.id));
const ids = new Set();
for (const i of c.itens) {
  if (!i.id) erros.push(`Item sem "id": ${i.nome}`);
  if (ids.has(i.id)) erros.push(`"id" repetido: ${i.id}`);
  ids.add(i.id);
  if (!cats.has(i.categoria)) erros.push(`${i.nome}: categoria "${i.categoria}" não existe em "categorias"`);
  if (typeof i.preco !== "number" || i.preco <= 0) erros.push(`${i.nome}: "preco" precisa ser um número, ex.: 8.5`);
  if (i.precoAntigo != null && typeof i.precoAntigo !== "number") erros.push(`${i.nome}: "precoAntigo" precisa ser número`);
  if (typeof i.disponivel !== "boolean") erros.push(`${i.nome}: "disponivel" precisa ser true ou false`);
  for (const e of i.escolhas ?? []) {
    if (!c.adicionais[e.grupo]) erros.push(`${i.nome}: grupo de adicionais "${e.grupo}" não existe`);
    if (e.min > e.max) erros.push(`${i.nome}: "min" maior que "max" em ${e.grupo}`);
  }
}

if (erros.length) {
  console.error("❌ Encontrei problemas:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`✅ Cardápio ok: ${c.itens.length} itens, ${c.itens.filter((i) => i.disponivel).length} disponíveis, ${c.categorias.length} categorias.`);
