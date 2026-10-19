import { createClient, type Client } from "@libsql/client";
import { randomBytes } from "crypto";
import type { LinhaPedido } from "./cardapio";

let client: Client | null = null;
let pronto: Promise<void> | null = null;

async function preparar(c: Client) {
  await c.execute(`CREATE TABLE IF NOT EXISTS pedidos (
    numero INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    criado_em TEXT NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT NOT NULL,
    postcode TEXT NOT NULL,
    observacao TEXT,
    itens TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    taxa INTEGER NOT NULL,
    total INTEGER NOT NULL,
    pagamento TEXT NOT NULL,
    troco_para INTEGER,
    pago INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'novo',
    stripe_sessao TEXT
  )`);
  // Colunas novas (rastreio). ALTER falha se já existir; ignoramos.
  for (const col of [
    "lat REAL", "lng REAL", "status_em TEXT",
    "avisado_saiu INTEGER NOT NULL DEFAULT 0", "avisado_chegando INTEGER NOT NULL DEFAULT 0",
  ]) {
    try { await c.execute(`ALTER TABLE pedidos ADD COLUMN ${col}`); } catch {}
  }
  await c.execute(`CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criado_em TEXT NOT NULL,
    nome TEXT NOT NULL,
    local TEXT,
    nota INTEGER NOT NULL,
    texto TEXT NOT NULL,
    pedido_numero INTEGER,
    status TEXT NOT NULL DEFAULT 'pendente'
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS entregador_local (
    id INTEGER PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    precisao REAL,
    atualizado_em TEXT NOT NULL
  )`);
}

function db() {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL || "file:pedidos.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  if (!pronto) pronto = preparar(client);
  return { c: client, pronto };
}

async function exec(sql: string, args: (string | number | null)[] = []) {
  const { c, pronto } = db();
  await pronto;
  return c.execute({ sql, args });
}

/* ------------------------------ Pedidos ------------------------------ */

export const STATUS = ["aguardando_pagamento", "novo", "confirmado", "preparando", "saiu", "entregue", "cancelado"] as const;
export type Status = (typeof STATUS)[number];

export type Pedido = {
  numero: number;
  token: string;
  criadoEm: string;
  nome: string;
  telefone: string;
  endereco: string;
  postcode: string;
  observacao: string | null;
  itens: LinhaPedido[];
  subtotal: number;
  taxa: number;
  total: number;
  pagamento: "dinheiro" | "cartao";
  trocoPara: number | null;
  pago: boolean;
  status: Status;
  statusEm: string | null;
  stripeSessao: string | null;
  lat: number | null;
  lng: number | null;
  avisadoSaiu: boolean;
  avisadoChegando: boolean;
};

const numOuNull = (v: unknown) => (v == null ? null : Number(v));

function linhaParaPedido(r: Record<string, unknown>): Pedido {
  return {
    numero: Number(r.numero),
    token: String(r.token),
    criadoEm: String(r.criado_em),
    nome: String(r.nome),
    telefone: String(r.telefone),
    endereco: String(r.endereco),
    postcode: String(r.postcode),
    observacao: (r.observacao as string) ?? null,
    itens: JSON.parse(String(r.itens)),
    subtotal: Number(r.subtotal),
    taxa: Number(r.taxa),
    total: Number(r.total),
    pagamento: r.pagamento as Pedido["pagamento"],
    trocoPara: numOuNull(r.troco_para),
    pago: Number(r.pago) === 1,
    status: r.status as Status,
    statusEm: (r.status_em as string) ?? null,
    stripeSessao: (r.stripe_sessao as string) ?? null,
    lat: numOuNull(r.lat),
    lng: numOuNull(r.lng),
    avisadoSaiu: Number(r.avisado_saiu) === 1,
    avisadoChegando: Number(r.avisado_chegando) === 1,
  };
}

type NovoPedido = Omit<Pedido, "numero" | "token" | "criadoEm" | "stripeSessao" | "statusEm" | "avisadoSaiu" | "avisadoChegando">;

export async function criarPedido(p: NovoPedido) {
  const token = randomBytes(12).toString("base64url");
  const agora = new Date().toISOString();
  const r = await exec(
    `INSERT INTO pedidos (token, criado_em, nome, telefone, endereco, postcode, observacao, itens, subtotal, taxa, total, pagamento, troco_para, pago, status, status_em, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
    [token, agora, p.nome, p.telefone, p.endereco, p.postcode, p.observacao, JSON.stringify(p.itens),
      p.subtotal, p.taxa, p.total, p.pagamento, p.trocoPara, p.pago ? 1 : 0, p.status, agora, p.lat, p.lng],
  );
  return { numero: Number(r.rows[0].numero), token };
}

export async function buscarPorToken(token: string) {
  const r = await exec("SELECT * FROM pedidos WHERE token = ?", [token]);
  return r.rows[0] ? linhaParaPedido(r.rows[0] as Record<string, unknown>) : null;
}

export async function buscarPorNumero(numero: number) {
  const r = await exec("SELECT * FROM pedidos WHERE numero = ?", [numero]);
  return r.rows[0] ? linhaParaPedido(r.rows[0] as Record<string, unknown>) : null;
}

export async function listarPedidos(limite = 200) {
  const r = await exec("SELECT * FROM pedidos ORDER BY numero DESC LIMIT ?", [limite]);
  return r.rows.map((x) => linhaParaPedido(x as Record<string, unknown>));
}

export async function listarPorStatus(status: Status[]) {
  const r = await exec(`SELECT * FROM pedidos WHERE status IN (${status.map(() => "?").join(",")}) ORDER BY numero ASC`, status);
  return r.rows.map((x) => linhaParaPedido(x as Record<string, unknown>));
}

export async function mudarStatus(numero: number, status: Status) {
  await exec("UPDATE pedidos SET status = ?, status_em = ? WHERE numero = ?", [status, new Date().toISOString(), numero]);
}

export async function marcarPago(numero: number, pago: boolean) {
  await exec("UPDATE pedidos SET pago = ? WHERE numero = ?", [pago ? 1 : 0, numero]);
}

export async function marcarAviso(numero: number, qual: "saiu" | "chegando") {
  await exec(`UPDATE pedidos SET ${qual === "saiu" ? "avisado_saiu" : "avisado_chegando"} = 1 WHERE numero = ?`, [numero]);
}

export async function salvarSessaoStripe(numero: number, sessao: string) {
  await exec("UPDATE pedidos SET stripe_sessao = ? WHERE numero = ?", [sessao, numero]);
}

/** Chamado quando o Stripe confirma: marca pago e libera o pedido para a cozinha. */
export async function confirmarPagamentoCartao(numero: number) {
  await exec(
    "UPDATE pedidos SET pago = 1, status = CASE WHEN status = 'aguardando_pagamento' THEN 'novo' ELSE status END, status_em = CASE WHEN status = 'aguardando_pagamento' THEN ? ELSE status_em END WHERE numero = ?",
    [new Date().toISOString(), numero],
  );
}

/* ------------------------- Localização do entregador ------------------------- */

export type Local = { lat: number; lng: number; precisao: number | null; atualizadoEm: string };

export async function salvarLocal(lat: number, lng: number, precisao: number | null) {
  await exec(
    `INSERT INTO entregador_local (id, lat, lng, precisao, atualizado_em) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, precisao = excluded.precisao, atualizado_em = excluded.atualizado_em`,
    [lat, lng, precisao, new Date().toISOString()],
  );
}

export async function lerLocal(): Promise<Local | null> {
  const r = await exec("SELECT * FROM entregador_local WHERE id = 1");
  const x = r.rows[0];
  return x ? { lat: Number(x.lat), lng: Number(x.lng), precisao: numOuNull(x.precisao), atualizadoEm: String(x.atualizado_em) } : null;
}

/* ------------------------------ Avaliações ------------------------------ */

export type Avaliacao = {
  id: number;
  criadoEm: string;
  nome: string;
  local: string | null;
  nota: number;
  texto: string;
  pedidoNumero: number | null;
  status: "pendente" | "aprovada" | "oculta";
};

function linhaParaAvaliacao(r: Record<string, unknown>): Avaliacao {
  return {
    id: Number(r.id),
    criadoEm: String(r.criado_em),
    nome: String(r.nome),
    local: (r.local as string) ?? null,
    nota: Number(r.nota),
    texto: String(r.texto),
    pedidoNumero: numOuNull(r.pedido_numero),
    status: r.status as Avaliacao["status"],
  };
}

export async function criarAvaliacao(a: { nome: string; local: string | null; nota: number; texto: string; pedidoNumero: number | null }) {
  await exec("INSERT INTO avaliacoes (criado_em, nome, local, nota, texto, pedido_numero, status) VALUES (?, ?, ?, ?, ?, ?, 'pendente')",
    [new Date().toISOString(), a.nome, a.local, a.nota, a.texto, a.pedidoNumero]);
}

export async function listarAvaliacoes(somenteAprovadas: boolean) {
  const r = await exec(
    somenteAprovadas ? "SELECT * FROM avaliacoes WHERE status = 'aprovada' ORDER BY id DESC LIMIT 60" : "SELECT * FROM avaliacoes ORDER BY id DESC LIMIT 300",
  );
  return r.rows.map((x) => linhaParaAvaliacao(x as Record<string, unknown>));
}

export async function mudarStatusAvaliacao(id: number, status: Avaliacao["status"]) {
  await exec("UPDATE avaliacoes SET status = ? WHERE id = ?", [status, id]);
}

export async function pedidoJaAvaliado(numero: number) {
  const r = await exec("SELECT 1 FROM avaliacoes WHERE pedido_numero = ? LIMIT 1", [numero]);
  return r.rows.length > 0;
}
