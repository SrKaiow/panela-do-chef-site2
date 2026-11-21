import { exec, lerConfig, salvarConfig } from "./db";

/**
 * Notificação no celular do cliente mesmo com a página fechada ou a tela bloqueada (Web Push).
 * Funciona no Android (Chrome) e no iPhone quando o site foi adicionado à tela de início.
 * As chaves VAPID são criadas na primeira vez e guardadas no banco.
 * O push vai sem conteúdo; o service worker (public/sw.js) busca a mensagem em /api/push/mensagem.
 */
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Chaves = { publica: string; privadaJwk: JsonWebKey };

async function chaves(): Promise<Chaves> {
  const salvo = await lerConfig<Chaves>("vapid").catch(() => null);
  if (salvo?.publica && salvo.privadaJwk) return salvo;
  const par = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publica = b64url(await crypto.subtle.exportKey("raw", par.publicKey));
  const privadaJwk = await crypto.subtle.exportKey("jwk", par.privateKey);
  const c = { publica, privadaJwk };
  await salvarConfig("vapid", c);
  return c;
}

export async function chavePublicaPush() {
  return (await chaves()).publica;
}

async function jwtVapid(endpoint: string) {
  const c = await chaves();
  const aud = new URL(endpoint).origin;
  const cab = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contato@paneladochef.co.uk" })));
  const chave = await crypto.subtle.importKey("jwk", c.privadaJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, new TextEncoder().encode(`${cab}.${corpo}`));
  return { jwt: `${cab}.${corpo}.${b64url(ass)}`, publica: c.publica };
}

/** Guarda a inscrição do navegador do cliente para este pedido. */
export async function inscreverPush(numero: number, endpoint: string) {
  await exec(
    "INSERT INTO push_inscricoes (endpoint, numero, criado_em) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET numero = excluded.numero, criado_em = excluded.criado_em",
    [endpoint, numero, new Date().toISOString()],
  );
}

/** Mensagem que o service worker mostra (a última mandada para aquele aparelho). */
export async function mensagemPush(endpoint: string) {
  const r = await exec("SELECT titulo, corpo, url FROM push_inscricoes WHERE endpoint = ?", [endpoint]);
  const x = r.rows[0];
  return x?.titulo ? { titulo: String(x.titulo), corpo: String(x.corpo ?? ""), url: String(x.url ?? "/") } : null;
}

/** Manda a notificação para todos os aparelhos inscritos neste pedido. */
export async function enviarPushPedido(numero: number, titulo: string, corpo: string, url: string) {
  const r = await exec("SELECT endpoint FROM push_inscricoes WHERE numero = ?", [numero]);
  for (const row of r.rows) {
    const endpoint = String(row.endpoint);
    try {
      await exec("UPDATE push_inscricoes SET titulo = ?, corpo = ?, url = ? WHERE endpoint = ?", [titulo, corpo, url, endpoint]);
      const { jwt, publica } = await jwtVapid(endpoint);
      const resp = await fetch(endpoint, { method: "POST", headers: { TTL: "600", Urgency: "high", Authorization: `vapid t=${jwt}, k=${publica}`, "Content-Length": "0" } });
      if (resp.status === 404 || resp.status === 410) await exec("DELETE FROM push_inscricoes WHERE endpoint = ?", [endpoint]);
      else if (!resp.ok) console.error("[push]", resp.status, (await resp.text()).slice(0, 200));
    } catch (e) {
      console.error("[push]", e);
    }
  }
}
