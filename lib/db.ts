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
    "agendado_para TEXT", "distancia_m INTEGER", "aceito_em TEXT", "preparo_em TEXT", "saiu_em TEXT", "entregue_em TEXT",
    "avisado_loja INTEGER NOT NULL DEFAULT 0",
    "square_pedido TEXT", "link_pagamento TEXT",
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
  await c.execute(`CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS fotos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    dados BLOB NOT NULL,
    criado_em TEXT NOT NULL
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS entregador_local (
    id INTEGER PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    precisao REAL,
    atualizado_em TEXT NOT NULL
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS limites (
    chave TEXT NOT NULL,
    janela INTEGER NOT NULL,
    n INTEGER NOT NULL,
    expira INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chave, janela)
  )`);
}

function db() {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:pedidos.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || process.env.DATABASE_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
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
  /** Id do pedido na Square, quando o pagamento online é pela Square. */
  squarePedido: string | null;
  /** Link da página de pagamento (para tentar de novo). */
  linkPagamento: string | null;
  lat: number | null;
  lng: number | null;
  avisadoSaiu: boolean;
  avisadoChegando: boolean;
  agendadoPara: string | null;
  distanciaM: number | null;
  aceitoEm: string | null;
  preparoEm: string | null;
  saiuEm: string | null;
  entregueEm: string | null;
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
    squarePedido: (r.square_pedido as string) ?? null,
    linkPagamento: (r.link_pagamento as string) ?? null,
    lat: numOuNull(r.lat),
    lng: numOuNull(r.lng),
    avisadoSaiu: Number(r.avisado_saiu) === 1,
    avisadoChegando: Number(r.avisado_chegando) === 1,
    agendadoPara: (r.agendado_para as string) ?? null,
    distanciaM: numOuNull(r.distancia_m),
    aceitoEm: (r.aceito_em as string) ?? null,
    preparoEm: (r.preparo_em as string) ?? null,
    saiuEm: (r.saiu_em as string) ?? null,
    entregueEm: (r.entregue_em as string) ?? null,
  };
}

type NovoPedido = Omit<Pedido, "numero" | "token" | "criadoEm" | "stripeSessao" | "squarePedido" | "linkPagamento" | "statusEm" | "avisadoSaiu" | "avisadoChegando" | "aceitoEm" | "preparoEm" | "saiuEm" | "entregueEm">;

export async function criarPedido(p: NovoPedido) {
  const token = randomBytes(12).toString("base64url");
  const agora = new Date().toISOString();
  const r = await exec(
    `INSERT INTO pedidos (token, criado_em, nome, telefone, endereco, postcode, observacao, itens, subtotal, taxa, total, pagamento, troco_para, pago, status, status_em, lat, lng, agendado_para, distancia_m)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
    [token, agora, p.nome, p.telefone, p.endereco, p.postcode, p.observacao, JSON.stringify(p.itens),
      p.subtotal, p.taxa, p.total, p.pagamento, p.trocoPara, p.pago ? 1 : 0, p.status, agora, p.lat, p.lng, p.agendadoPara, p.distanciaM],
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

const COLUNA_DO_STATUS: Partial<Record<Status, string>> = {
  confirmado: "aceito_em",
  preparando: "preparo_em",
  saiu: "saiu_em",
  entregue: "entregue_em",
};

export async function mudarStatus(numero: number, status: Status) {
  const agora = new Date().toISOString();
  const col = COLUNA_DO_STATUS[status];
  await exec(
    `UPDATE pedidos SET status = ?, status_em = ?${col ? `, ${col} = COALESCE(${col}, ?)` : ""} WHERE numero = ?`,
    col ? [status, agora, agora, numero] : [status, agora, numero],
  );
}

/**
 * Quantos pedidos estão na frente deste na cozinha: os que chegaram antes e ainda não saíram.
 * Pedidos agendados para mais tarde só entram na fila quando chega a hora deles.
 */
export async function pedidosNaFrente(p: Pedido) {
  const agora = new Date().toISOString();
  const r = await exec(
    `SELECT COUNT(*) AS n FROM pedidos
     WHERE status IN ('novo','confirmado','preparando')
       AND numero <> ?
       AND COALESCE(agendado_para, criado_em) < ?
       AND COALESCE(agendado_para, criado_em) <= ?`,
    [p.numero, p.agendadoPara ?? p.criadoEm, agora],
  );
  return Number(r.rows[0]?.n ?? 0);
}

/* ------------------------------ Configurações ------------------------------ */

export async function lerConfig<T>(chave: string): Promise<T | null> {
  const r = await exec("SELECT valor FROM config WHERE chave = ?", [chave]);
  return r.rows[0] ? (JSON.parse(String(r.rows[0].valor)) as T) : null;
}

export async function salvarConfig(chave: string, valor: unknown) {
  await exec(
    `INSERT INTO config (chave, valor, atualizado_em) VALUES (?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    [chave, JSON.stringify(valor), new Date().toISOString()],
  );
}

/* ---------------------------------- Fotos ---------------------------------- */

export async function salvarFoto(tipo: string, dados: Uint8Array) {
  const id = randomBytes(9).toString("base64url");
  const { c, pronto } = db();
  await pronto;
  await c.execute({ sql: "INSERT INTO fotos (id, tipo, dados, criado_em) VALUES (?, ?, ?, ?)", args: [id, tipo, dados, new Date().toISOString()] });
  return id;
}

export async function lerFoto(id: string) {
  const r = await exec("SELECT tipo, dados FROM fotos WHERE id = ?", [id]);
  const x = r.rows[0];
  if (!x) return null;
  const d = x.dados as unknown;
  const bytes = d instanceof ArrayBuffer ? new Uint8Array(d) : (d as Uint8Array);
  return { tipo: String(x.tipo), dados: bytes };
}

export async function apagarFoto(id: string) {
  await exec("DELETE FROM fotos WHERE id = ?", [id]);
}

export async function marcarPago(numero: number, pago: boolean) {
  await exec("UPDATE pedidos SET pago = ? WHERE numero = ?", [pago ? 1 : 0, numero]);
}

export async function marcarAviso(numero: number, qual: "saiu" | "chegando") {
  await exec(`UPDATE pedidos SET ${qual === "saiu" ? "avisado_saiu" : "avisado_chegando"} = 1 WHERE numero = ?`, [numero]);
}

export async function salvarPagamentoSquare(numero: number, orderId: string, link: string) {
  await exec("UPDATE pedidos SET square_pedido = ?, link_pagamento = ? WHERE numero = ?", [orderId, link, numero]);
}

export async function buscarPorPedidoSquare(orderId: string) {
  const r = await exec("SELECT * FROM pedidos WHERE square_pedido = ?", [orderId]);
  return r.rows[0] ? linhaParaPedido(r.rows[0] as Record<string, unknown>) : null;
}

export async function salvarSessaoStripe(numero: number, sessao: string) {
  await exec("UPDATE pedidos SET stripe_sessao = ? WHERE numero = ?", [sessao, numero]);
}

/** Chamado quando o Stripe confirma: marca pago e libera o pedido para a cozinha. */
/** Marca que a loja já foi avisada deste pedido. Devolve true só na primeira vez (evita aviso duplicado). */
export async function marcarAvisoLoja(numero: number) {
  const r = await exec("UPDATE pedidos SET avisado_loja = 1 WHERE numero = ? AND avisado_loja = 0", [numero]);
  return r.rowsAffected > 0;
}

export async function confirmarPagamentoCartao(numero: number) {
  await exec(
    "UPDATE pedidos SET pago = 1, status = CASE WHEN status = 'aguardando_pagamento' THEN 'novo' ELSE status END, status_em = CASE WHEN status = 'aguardando_pagamento' THEN ? ELSE status_em END WHERE numero = ?",
    [new Date().toISOString(), numero],
  );
}

/* ------------------------- Limite de tentativas ------------------------- */

/**
 * Conta tentativas por chave (ex.: "login:1.2.3.4") numa janela de tempo, guardado no banco,
 * então vale para todos os servidores ao mesmo tempo. Devolve true se ainda está dentro do limite.
 */
export async function dentroDoLimite(chave: string, max: number, janelaSeg: number) {
  const agora = Math.floor(Date.now() / 1000);
  const janela = Math.floor(agora / janelaSeg);
  const r = await exec(
    "INSERT INTO limites (chave, janela, n, expira) VALUES (?, ?, 1, ?) ON CONFLICT(chave, janela) DO UPDATE SET n = n + 1 RETURNING n",
    [chave.slice(0, 120), janela, (janela + 1) * janelaSeg],
  );
  if (Math.random() < 0.02) {
    // Limpeza de vez em quando: contagens que já venceram.
    await exec("DELETE FROM limites WHERE expira < ?", [agora]).catch(() => {});
  }
  return Number(r.rows[0]?.n ?? 1) <= max;
}

/** Apaga as contagens de uma chave (ex.: depois de entrar com a senha certa). */
export async function zerarLimite(chave: string) {
  await exec("DELETE FROM limites WHERE chave = ?", [chave.slice(0, 120)]);
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
