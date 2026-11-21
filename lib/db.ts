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
    "a_caminho_em TEXT",
    "retirada INTEGER NOT NULL DEFAULT 0",
    "imprimir_pedido TEXT",
    "push_chegando INTEGER NOT NULL DEFAULT 0",
    "atraso_min INTEGER NOT NULL DEFAULT 0", "atraso_motivo TEXT", "atraso_em TEXT", "atraso_lat REAL", "atraso_lng REAL",
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
    status TEXT NOT NULL DEFAULT 'pendente',
    foto TEXT
  )`);
  // Avaliações criadas antes da foto do pedido.
  try { await c.execute("ALTER TABLE avaliacoes ADD COLUMN foto TEXT"); } catch {}
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
  // Visitas ao site: um registro por visitante (id anônimo do navegador) por dia.
  await c.execute(`CREATE TABLE IF NOT EXISTS visitas (
    dia TEXT NOT NULL,
    visitante TEXT NOT NULL,
    vezes INTEGER NOT NULL DEFAULT 1,
    primeira TEXT NOT NULL,
    ultima TEXT NOT NULL,
    PRIMARY KEY (dia, visitante)
  )`);
  // Notificação no celular do cliente (Web Push): um aparelho por linha, ligado a um pedido.
  await c.execute(`CREATE TABLE IF NOT EXISTS push_inscricoes (
    endpoint TEXT PRIMARY KEY,
    numero INTEGER NOT NULL,
    criado_em TEXT NOT NULL,
    titulo TEXT,
    corpo TEXT,
    url TEXT
  )`);
  // Clientes a pagar (fiado / semanal): cada cliente tem uma conta com lançamentos.
  await c.execute(`CREATE TABLE IF NOT EXISTS contas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL DEFAULT '',
    obs TEXT NOT NULL DEFAULT '',
    semanal INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    arquivado INTEGER NOT NULL DEFAULT 0
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS contas_lancamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    valor INTEGER NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    pedido INTEGER
  )`);
  try { await c.execute("ALTER TABLE contas_lancamentos ADD COLUMN pedido INTEGER"); } catch {}
  // Cartão fidelidade: quantos brindes o cliente (pelo telefone) já resgatou.
  await c.execute(`CREATE TABLE IF NOT EXISTS fidelidade (
    telefone TEXT PRIMARY KEY,
    resgatados INTEGER NOT NULL DEFAULT 0,
    atualizado_em TEXT NOT NULL
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

export async function exec(sql: string, args: (string | number | null)[] = []) {
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
  /** Quando o entregador tocou "Ir para este cliente" (a entrega que está sendo feita agora). */
  aCaminhoEm: string | null;
  /** Imprevisto avisado pelo entregador (trânsito, acidente...): minutos a mais, motivo e onde foi. */
  atraso: { minutos: number; motivo: string; em: string; lat: number | null; lng: number | null } | null;
  /** Cliente vem buscar na porta (sem entrega e sem taxa). */
  retirada: boolean;
  /** Pedido de impressão feito pelo celular/Telegram: o computador da loja imprime quando vê. */
  imprimirPedido: string | null;
  /** Lançado em "Clientes a pagar" (só no painel/entregador). */
  naConta?: boolean;
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
    aCaminhoEm: (r.a_caminho_em as string) ?? null,
    retirada: Number(r.retirada ?? 0) === 1,
    imprimirPedido: (r.imprimir_pedido as string) ?? null,
    atraso: r.atraso_em
      ? { minutos: Number(r.atraso_min) || 0, motivo: String(r.atraso_motivo ?? "transito"), em: String(r.atraso_em), lat: numOuNull(r.atraso_lat), lng: numOuNull(r.atraso_lng) }
      : null,
  };
}

type NovoPedido = Omit<Pedido, "numero" | "token" | "criadoEm" | "stripeSessao" | "squarePedido" | "linkPagamento" | "statusEm" | "avisadoSaiu" | "avisadoChegando" | "aceitoEm" | "preparoEm" | "saiuEm" | "entregueEm" | "aCaminhoEm" | "atraso" | "imprimirPedido" | "naConta">;

export async function criarPedido(p: NovoPedido) {
  const token = randomBytes(12).toString("base64url");
  const agora = new Date().toISOString();
  const r = await exec(
    `INSERT INTO pedidos (token, criado_em, nome, telefone, endereco, postcode, observacao, itens, subtotal, taxa, total, pagamento, troco_para, pago, status, status_em, lat, lng, agendado_para, distancia_m, retirada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING numero`,
    [token, agora, p.nome, p.telefone, p.endereco, p.postcode, p.observacao, JSON.stringify(p.itens),
      p.subtotal, p.taxa, p.total, p.pagamento, p.trocoPara, p.pago ? 1 : 0, p.status, agora, p.lat, p.lng, p.agendadoPara, p.distanciaM, p.retirada ? 1 : 0],
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

/** O entregador vai para este cliente agora: só ele vê o carro no mapa e recebe o aviso de 1 minuto. */
export async function iniciarEntrega(numero: number) {
  await exec(`UPDATE pedidos SET a_caminho_em = NULL WHERE status = 'saiu' AND numero != ?`, [numero]);
  await exec(`UPDATE pedidos SET a_caminho_em = ? WHERE numero = ? AND status = 'saiu'`, [new Date().toISOString(), numero]);
}

/**
 * Qual entrega está sendo feita agora: a que o entregador iniciou;
 * se só tem um pedido no carro, é ele (não precisa tocar em nada).
 */
export async function entregaAtual(): Promise<number | null> {
  const noCarro = await listarPorStatus(["saiu"]);
  const iniciada = noCarro.filter((p) => p.aCaminhoEm).sort((a, b) => b.aCaminhoEm!.localeCompare(a.aCaminhoEm!))[0];
  if (iniciada) return iniciada.numero;
  return noCarro.length === 1 ? noCarro[0].numero : null;
}

/** Imprevisto no caminho: soma minutos em todos os pedidos que estão no carro (todos vão atrasar). */
export async function registrarAtraso(minutos: number, motivo: string, onde: { lat: number; lng: number } | null) {
  await exec(
    `UPDATE pedidos SET atraso_min = MIN(60, atraso_min + ?), atraso_motivo = ?, atraso_em = ?, atraso_lat = ?, atraso_lng = ? WHERE status = 'saiu'`,
    [minutos, motivo, new Date().toISOString(), onde?.lat ?? null, onde?.lng ?? null],
  );
}

export async function limparAtraso() {
  await exec(`UPDATE pedidos SET atraso_min = 0, atraso_motivo = NULL, atraso_em = NULL, atraso_lat = NULL, atraso_lng = NULL WHERE status = 'saiu'`);
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

/** Marca como pago. Devolve true só para quem marcou (evita avisar/imprimir duas vezes). */
export async function confirmarPagamentoCartao(numero: number) {
  const r = await exec(
    "UPDATE pedidos SET pago = 1, status = CASE WHEN status = 'aguardando_pagamento' THEN 'novo' ELSE status END, status_em = CASE WHEN status = 'aguardando_pagamento' THEN ? ELSE status_em END WHERE numero = ? AND pago = 0",
    [new Date().toISOString(), numero],
  );
  return r.rowsAffected > 0;
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
  /** Foto de como o pedido chegou (enviada pelo cliente). */
  foto: string | null;
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
    foto: (r.foto as string) ?? null,
  };
}

export async function criarAvaliacao(a: { nome: string; local: string | null; nota: number; texto: string; pedidoNumero: number | null; foto?: string | null }) {
  await exec("INSERT INTO avaliacoes (criado_em, nome, local, nota, texto, pedido_numero, status, foto) VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?)",
    [new Date().toISOString(), a.nome, a.local, a.nota, a.texto, a.pedidoNumero, a.foto ?? null]);
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

/* ------------------------- Visitas e clientes ------------------------- */

const diaLondres = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const diasAtras = (n: number) => diaLondres(new Date(Date.now() - n * 86400_000));

export async function registrarVisita(visitante: string) {
  const agora = new Date().toISOString();
  await exec(
    `INSERT INTO visitas (dia, visitante, vezes, primeira, ultima) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(dia, visitante) DO UPDATE SET vezes = vezes + 1, ultima = excluded.ultima`,
    [diaLondres(), visitante, agora, agora],
  );
  if (Math.random() < 0.01) await exec("DELETE FROM visitas WHERE dia < ?", [diasAtras(400)]).catch(() => {});
}

export type EstatisticasVisitas = {
  dias: number;
  acessos: number;
  visitantes: number;
  voltaram: number;
  novos: number;
  pedidos: number;
  porDia: { dia: string; acessos: number; visitantes: number; pedidos: number }[];
};

/** Resumo dos últimos `dias` dias (contando hoje). */
export async function estatisticasVisitas(dias: number): Promise<EstatisticasVisitas> {
  const desde = diasAtras(dias - 1);
  const [tot, volta, novos, porDia, peds] = await Promise.all([
    exec("SELECT COALESCE(SUM(vezes),0) AS acessos, COUNT(DISTINCT visitante) AS visitantes FROM visitas WHERE dia >= ?", [desde]),
    // Voltaram: vieram em mais de um dia no período, ou abriram o site mais de uma vez no mesmo dia (com intervalo).
    exec(
      `SELECT COUNT(*) AS n FROM (SELECT visitante FROM visitas WHERE dia >= ? GROUP BY visitante HAVING COUNT(*) > 1 OR SUM(vezes) > 1)`,
      [desde],
    ),
    // Novos: a primeira visita de todas caiu dentro do período.
    exec("SELECT COUNT(*) AS n FROM (SELECT MIN(dia) AS m FROM visitas GROUP BY visitante) WHERE m >= ?", [desde]),
    exec("SELECT dia, SUM(vezes) AS acessos, COUNT(*) AS visitantes FROM visitas WHERE dia >= ? GROUP BY dia ORDER BY dia", [desde]),
    exec(
      `SELECT substr(criado_em, 1, 10) AS dia, COUNT(*) AS n FROM pedidos
       WHERE criado_em >= ? AND status NOT IN ('cancelado', 'aguardando_pagamento') GROUP BY dia`,
      [desde],
    ),
  ]);
  const pedPorDia = new Map(peds.rows.map((r) => [String(r.dia), Number(r.n)]));
  const visPorDia = new Map(porDia.rows.map((r) => [String(r.dia), r]));
  const lista: EstatisticasVisitas["porDia"] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = diasAtras(i);
    const v = visPorDia.get(d);
    lista.push({ dia: d, acessos: Number(v?.acessos ?? 0), visitantes: Number(v?.visitantes ?? 0), pedidos: pedPorDia.get(d) ?? 0 });
  }
  return {
    dias,
    acessos: Number(tot.rows[0]?.acessos ?? 0),
    visitantes: Number(tot.rows[0]?.visitantes ?? 0),
    voltaram: Number(volta.rows[0]?.n ?? 0),
    novos: Number(novos.rows[0]?.n ?? 0),
    pedidos: lista.reduce((s, d) => s + d.pedidos, 0),
    porDia: lista,
  };
}

/** Telefone só com números, no formato do Reino Unido (07...). */
export function telefoneChave(tel: string) {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("0044")) n = n.slice(4);
  if (n.startsWith("44") && n.length >= 12) n = n.slice(2);
  if (n.length === 10 && n.startsWith("7")) n = "0" + n;
  return n;
}

export type Cliente = {
  telefone: string;
  nome: string;
  postcode: string;
  pedidos: number;
  pedidosSemana: number;
  pedidosMes: number;
  gasto: number;
  primeiro: string;
  ultimo: string;
  resgatados: number;
  /** Pedidos que valem carimbo (subtotal a partir do mínimo). */
  carimbos: number;
};

/** Clientes a partir dos pedidos (não conta cancelados nem cartão não pago). */
export async function listarClientes(minimoPence = 0): Promise<Cliente[]> {
  const [r, f] = await Promise.all([
    exec(
      `SELECT telefone, nome, postcode, total, subtotal, criado_em FROM pedidos
       WHERE status NOT IN ('cancelado', 'aguardando_pagamento') ORDER BY criado_em DESC LIMIT 20000`,
    ),
    exec("SELECT telefone, resgatados FROM fidelidade"),
  ]);
  const resg = new Map(f.rows.map((x) => [String(x.telefone), Number(x.resgatados)]));
  const semana = Date.now() - 7 * 86400_000;
  const mes = Date.now() - 30 * 86400_000;
  const mapa = new Map<string, Cliente>();
  for (const x of r.rows) {
    const tel = telefoneChave(String(x.telefone));
    if (!tel) continue;
    const quando = String(x.criado_em);
    const t = new Date(quando).getTime();
    let c = mapa.get(tel);
    if (!c) {
      // Pedidos vêm do mais novo para o mais antigo: o primeiro visto tem o nome e o postcode mais recentes.
      c = { telefone: tel, nome: String(x.nome), postcode: String(x.postcode), pedidos: 0, pedidosSemana: 0, pedidosMes: 0, gasto: 0, primeiro: quando, ultimo: quando, resgatados: resg.get(tel) ?? 0, carimbos: 0 };
      mapa.set(tel, c);
    }
    c.pedidos++;
    if (Number(x.subtotal) >= minimoPence) c.carimbos++;
    c.gasto += Number(x.total);
    if (t >= semana) c.pedidosSemana++;
    if (t >= mes) c.pedidosMes++;
    c.primeiro = quando;
  }
  return [...mapa.values()];
}

export async function registrarResgate(telefone: string, delta: 1 | -1) {
  await exec(
    `INSERT INTO fidelidade (telefone, resgatados, atualizado_em) VALUES (?, MAX(0, ?), ?)
     ON CONFLICT(telefone) DO UPDATE SET resgatados = MAX(0, resgatados + ?), atualizado_em = excluded.atualizado_em`,
    [telefoneChave(telefone), delta, new Date().toISOString(), delta],
  );
}

/** Cartão fidelidade de um pedido: quantos carimbos o cliente tem contando até este pedido. */
export async function carimbosDoPedido(p: Pedido, meta: number, minimoPence = 0) {
  const tel = telefoneChave(p.telefone);
  const fim = tel.slice(-9);
  if (fim.length < 9) return null;
  const [r, f] = await Promise.all([
    exec(
      `SELECT telefone FROM pedidos WHERE criado_em <= ? AND subtotal >= ? AND status NOT IN ('cancelado', 'aguardando_pagamento')
       AND replace(replace(replace(telefone, ' ', ''), '-', ''), '+', '') LIKE ?`,
      [p.criadoEm, minimoPence, "%" + fim],
    ),
    exec("SELECT resgatados FROM fidelidade WHERE telefone = ?", [tel]),
  ]);
  const pedidos = r.rows.filter((x) => telefoneChave(String(x.telefone)) === tel).length;
  const resgatados = Number(f.rows[0]?.resgatados ?? 0);
  return { carimbos: Math.max(0, pedidos - resgatados * meta), meta, ganhou: p.subtotal >= minimoPence };
}

/* ------------------------- Clientes a pagar (fiado / semanal) ------------------------- */

export type Lancamento = { id: number; tipo: "compra" | "pagamento"; valor: number; descricao: string; data: string };
export type Conta = { id: number; nome: string; telefone: string; obs: string; semanal: boolean; criadoEm: string; saldo: number; ultimo: string | null; lancamentos: Lancamento[] };

/** Contas com saldo (compras - pagamentos, em pence) e os lançamentos, mais recentes primeiro. */
export async function listarContas(): Promise<Conta[]> {
  const contas = await exec("SELECT * FROM contas WHERE arquivado = 0 ORDER BY nome COLLATE NOCASE");
  const lanc = await exec("SELECT * FROM contas_lancamentos ORDER BY data DESC, id DESC");
  const porConta = new Map<number, Lancamento[]>();
  for (const r of lanc.rows) {
    const id = Number(r.conta_id);
    const l: Lancamento = { id: Number(r.id), tipo: r.tipo === "pagamento" ? "pagamento" : "compra", valor: Number(r.valor), descricao: String(r.descricao ?? ""), data: String(r.data) };
    porConta.set(id, [...(porConta.get(id) ?? []), l]);
  }
  return contas.rows.map((r) => {
    const id = Number(r.id);
    const ls = porConta.get(id) ?? [];
    const saldo = ls.reduce((s, l) => s + (l.tipo === "compra" ? l.valor : -l.valor), 0);
    return { id, nome: String(r.nome), telefone: String(r.telefone ?? ""), obs: String(r.obs ?? ""), semanal: Number(r.semanal) === 1, criadoEm: String(r.criado_em), saldo, ultimo: ls[0]?.data ?? null, lancamentos: ls };
  });
}

export async function salvarConta(c: { id?: number; nome: string; telefone: string; obs: string; semanal: boolean }) {
  if (c.id) {
    await exec("UPDATE contas SET nome = ?, telefone = ?, obs = ?, semanal = ? WHERE id = ?", [c.nome, c.telefone, c.obs, c.semanal ? 1 : 0, c.id]);
    return c.id;
  }
  const r = await exec("INSERT INTO contas (nome, telefone, obs, semanal, criado_em) VALUES (?, ?, ?, ?, ?) RETURNING id", [c.nome, c.telefone, c.obs, c.semanal ? 1 : 0, new Date().toISOString()]);
  return Number(r.rows[0].id);
}

export async function arquivarConta(id: number) {
  await exec("UPDATE contas SET arquivado = 1 WHERE id = ?", [id]);
}

export async function lancarConta(l: { contaId: number; tipo: "compra" | "pagamento"; valor: number; descricao: string; data: string }) {
  await exec("INSERT INTO contas_lancamentos (conta_id, tipo, valor, descricao, data, criado_em) VALUES (?, ?, ?, ?, ?, ?)", [l.contaId, l.tipo, l.valor, l.descricao, l.data, new Date().toISOString()]);
}

export async function apagarLancamento(id: number) {
  await exec("DELETE FROM contas_lancamentos WHERE id = ?", [id]);
}

/** Números dos pedidos do site que já foram lançados em alguma conta. */
export async function pedidosNaConta(): Promise<Set<number>> {
  const r = await exec("SELECT DISTINCT pedido FROM contas_lancamentos WHERE pedido IS NOT NULL");
  return new Set(r.rows.map((x) => Number(x.pedido)));
}

/**
 * Joga um pedido do site na conta do cliente (acha pelo telefone; se não existir, cria).
 * Não lança o mesmo pedido duas vezes.
 */
export async function pedidoParaConta(numero: number) {
  const p = await buscarPorNumero(numero);
  if (!p) throw new Error("Pedido não encontrado.");
  if ((await pedidosNaConta()).has(numero)) return { jaEstava: true, nome: p.nome };
  const chave = telefoneChave(p.telefone);
  const contas = await exec("SELECT id, telefone FROM contas WHERE arquivado = 0");
  let id = Number(contas.rows.find((r) => chave && telefoneChave(String(r.telefone ?? "")) === chave)?.id ?? 0);
  if (!id) id = await salvarConta({ nome: p.nome, telefone: p.telefone, obs: "", semanal: false });
  const itens = p.itens.map((l) => `${l.qtd}x ${l.nome}`).join(", ");
  const data = new Date(p.criadoEm).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  await exec("INSERT INTO contas_lancamentos (conta_id, tipo, valor, descricao, data, criado_em, pedido) VALUES (?, 'compra', ?, ?, ?, ?, ?)", [id, p.total, `Pedido #${numero}: ${itens}`.slice(0, 160), data, new Date().toISOString(), numero]);
  return { jaEstava: false, nome: p.nome };
}

/** Pede para o computador da loja imprimir este pedido (botão no celular ou no Telegram). */
export async function pedirImpressao(numero: number) {
  await exec("UPDATE pedidos SET imprimir_pedido = ? WHERE numero = ?", [new Date().toISOString(), numero]);
}

/** Marca que o push de "chegando" já foi mandado (uma vez por pedido). Devolve true só na primeira vez. */
export async function marcarPushChegando(numero: number) {
  const r = await exec("UPDATE pedidos SET push_chegando = 1 WHERE numero = ? AND push_chegando = 0", [numero]);
  return r.rowsAffected > 0;
}
