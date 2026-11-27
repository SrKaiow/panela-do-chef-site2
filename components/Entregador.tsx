"use client";

import { conferirVersao } from "@/lib/versao";
import { useCallback, useEffect, useRef, useState } from "react";

type PedidoRota = {
  numero: number;
  nome: string;
  telefone: string;
  endereco: string;
  postcode: string;
  observacao: string | null;
  status: "confirmado" | "preparando" | "saiu";
  pagamento: "dinheiro" | "cartao";
  pago: boolean;
  total: number;
  trocoPara: number | null;
  naConta?: boolean;
  itens: string[];
  distancia: number | null;
  minutos: number | null;
  avisadoSaiu: boolean;
  avisadoChegando: boolean;
  temCoordenadas: boolean;
  /** A entrega que está sendo feita agora (o cliente vê o carro e recebe o aviso de 1 min). */
  atual: boolean;
  atraso: { minutos: number; motivo: string; em: string } | null;
  waSaiu: string;
  waChegando: string;
  /** Cliente vai pagar por transferência (dados já enviados). */
  transferencia?: boolean;
  /** WhatsApp com o pedido, a conta e o valor para transferência (só pedido em dinheiro ainda não pago). */
  waTransferencia?: string | null;
  mapa: string;
  waze: string;
};

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
/** Distância em milhas (jardas quando está bem perto), como no Waze. */
const km = (m: number) => {
  const milhas = m / 1609.344;
  return milhas < 0.25 ? `${Math.round(m * 1.0936)} yd` : `${milhas.toFixed(1)} mi`;
};

/** fetch com prazo: no 4G/5G uma requisição pode ficar presa ao trocar de antena; melhor desistir e tentar de novo. */
async function buscar(url: string, init: RequestInit = {}, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

const MOTIVOS = [
  { id: "transito", nome: "Muito trânsito", icone: "🚦" },
  { id: "acidente", nome: "Acidente", icone: "💥" },
  { id: "obras", nome: "Obras / desvio", icone: "🚧" },
];

export default function Entregador() {
  const [pedidos, setPedidos] = useState<PedidoRota[]>([]);
  const [automatico, setAutomatico] = useState(false);
  const [metrosAviso, setMetrosAviso] = useState(450);
  const [gps, setGps] = useState<"desligado" | "ligando" | "ligado" | "erro">("desligado");
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const watchId = useRef<number | null>(null);
  const ultimoPost = useRef(0);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const carregando = useRef(false);
  const ultimaCarga = useRef(0);
  const falhasLista = useRef(0);
  const falhasGps = useRef(0);

  const carregar = useCallback(async (forcar = false) => {
    // Uma de cada vez, e no máximo a cada 3 s (o GPS também chama isto).
    if (carregando.current || (!forcar && Date.now() - ultimaCarga.current < 3000)) return;
    carregando.current = true;
    ultimaCarga.current = Date.now();
    try {
      const r = await buscar("/api/entregador/pedidos");
      if (r.status === 401) { window.location.href = "/entregador/entrar"; return; }
      conferirVersao(r);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setPedidos(d.pedidos);
      setAutomatico(d.automatico);
      setMetrosAviso(d.metrosAviso);
      falhasLista.current = 0;
      setErro((e) => (e.startsWith("Sem internet") || e.startsWith("Conexão") ? "" : e));
    } catch {
      // Uma falha só (troca de antena, túnel) não é motivo para alarme: avisa a partir da segunda seguida.
      falhasLista.current++;
      if (falhasLista.current >= 2) setErro("Conexão fraca: tentando de novo... (a tela continua funcionando)");
    } finally {
      carregando.current = false;
    }
  }, []);

  // Chegou perto de um cliente que ainda não foi avisado: vibra e apita para lembrar de tocar no botão do WhatsApp.
  const lembrados = useRef(new Set<number>());
  useEffect(() => {
    if (automatico) return;
    for (const p of pedidos) {
      if ((!p.atual && pedidos.some((x) => x.atual)) || p.avisadoChegando || p.distancia == null || p.distancia > metrosAviso || lembrados.current.has(p.numero)) continue;
      lembrados.current.add(p.numero);
      try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch {}
      try {
        const ctx = new AudioContext();
        [0, 0.25, 0.5].forEach((d) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 1046; g.gain.setValueAtTime(0.4, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.18); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2); });
      } catch {}
    }
  }, [pedidos, metrosAviso, automatico]);

  useEffect(() => {
    carregar(true);
    const t = setInterval(() => carregar(), 8000);
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [carregar]);

  // Envio da posição: só um por vez, sempre a mais nova. Se falhar, tenta de novo sozinho.
  const ultimaPos = useRef<{ lat: number; lng: number; precisao: number } | null>(null);
  const enviando = useRef(false);
  async function enviarPosicao(pos?: GeolocationPosition) {
    if (pos) ultimaPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy };
    const t = Date.now();
    if (!ultimaPos.current || enviando.current || t - ultimoPost.current < 4000) return; // no máximo a cada 4 segundos
    ultimoPost.current = t;
    enviando.current = true;
    try {
      const r = await buscar("/api/entregador/localizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ultimaPos.current),
      }, 8000);
      if (r.status === 401) { window.location.href = "/entregador/entrar"; return; }
      if (!r.ok) throw new Error(String(r.status));
      falhasGps.current = 0;
      setUltimoEnvio(Date.now());
      setErro((e) => (e.startsWith("Sem internet") || e.startsWith("Conexão") || e.startsWith("Não consegui enviar") ? "" : e));
      carregar();
    } catch {
      falhasGps.current++;
      ultimoPost.current = 0; // tenta de novo no próximo ciclo, sem esperar
      if (falhasGps.current >= 3) setErro("Conexão fraca: a localização vai assim que o sinal voltar.");
    } finally {
      enviando.current = false;
    }
  }

  // Reenvia a última posição a cada 5 s mesmo parado (no semáforo o GPS do iPhone não manda nada novo)
  // e logo que a internet volta. Assim o cliente nunca fica com o carro "parado" no mapa por falha de sinal.
  useEffect(() => {
    const t = setInterval(() => { if (watchId.current != null) enviarPosicao(); }, 5000);
    const voltouNet = () => { ultimoPost.current = 0; enviarPosicao(); carregar(true); };
    window.addEventListener("online", voltouNet);
    return () => { clearInterval(t); window.removeEventListener("online", voltouNet); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lembra que o GPS foi ligado: ao voltar para a página (ou se o celular recarregar a aba), religa sozinho.
  const lembrar = (v: boolean) => { try { localStorage.setItem("panela-gps", v ? "1" : "0"); } catch {} };
  useEffect(() => {
    let querLigado = false;
    try { querLigado = localStorage.getItem("panela-gps") === "1"; } catch {}
    if (querLigado) ligarGps();
    const voltou = () => {
      if (document.visibilityState !== "visible") return;
      let quer = false;
      try { quer = localStorage.getItem("panela-gps") === "1"; } catch {}
      if (!quer) return;
      // O navegador solta a tela e às vezes o GPS quando a aba some: pede de novo.
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      ultimoPost.current = 0;
      ligarGps();
    };
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("pageshow", voltou);
    return () => { document.removeEventListener("visibilitychange", voltou); window.removeEventListener("pageshow", voltou); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ligarGps() {
    lembrar(true);
    if (!("geolocation" in navigator)) { setGps("erro"); setErro("Este celular não libera a localização pelo navegador."); return; }
    setGps("ligando");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => { setGps("ligado"); enviarPosicao(pos); },
      (e) => {
        // Demora do GPS (túnel, prédio) com posição já conhecida: segue mandando a última, sem alarme.
        if (e.code !== 1 && ultimaPos.current) return;
        setGps("erro");
        setErro(e.code === 1 ? "Localização bloqueada. Libere a localização para este site nas configurações do navegador." : "Não consegui pegar o GPS. Tente ir para um lugar aberto.");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    // Mantém a tela ligada para o GPS não parar (o celular pode desligar o GPS do navegador com a tela apagada).
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl) wakeLock.current = await wl.request("screen");
    } catch {}
  }

  function pararGps() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    setGps("desligado");
  }
  function desligarGps() { lembrar(false); pararGps(); }
  useEffect(() => () => pararGps(), []);

  const [motivo, setMotivo] = useState("transito");
  /** Ação do entregador: tenta 2 vezes (sinal fraco) antes de mostrar erro. */
  async function mandar(url: string, method: string, dados: object, falha: string) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await buscar(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }, 10000);
        if (r.ok) { carregar(true); return true; }
        if (r.status < 500) break;
      } catch { /* tenta de novo */ }
    }
    setErro(falha);
    carregar(true);
    return false;
  }
  async function avisarAtraso(minutos: number) {
    await mandar("/api/entregador/imprevisto", "POST", { minutos, motivo }, "Não consegui avisar. Confira a internet e toque de novo.");
  }
  async function limparAtraso() {
    await mandar("/api/entregador/imprevisto", "POST", { limpar: true }, "Não consegui salvar. Toque de novo.");
  }

  async function acao(numero: number, dados: Record<string, unknown>) {
    await mandar(`/api/entregador/pedidos/${numero}`, "PATCH", dados, "Não consegui salvar. Confira a internet e toque de novo.");
  }

  const prontos = pedidos.filter((p) => p.status !== "saiu");
  const emRota = pedidos.filter((p) => p.status === "saiu").sort((a, b) => Number(b.atual) - Number(a.atual) || (a.distancia ?? 1e9) - (b.distancia ?? 1e9));
  const segundos = ultimoEnvio ? Math.round((agora - ultimoEnvio) / 1000) : null;

  return (
    <div className="painel">
      <header className="painel-topo">
        <div className="painel-miolo painel-linha">
          <strong className="painel-marca">Entregas</strong>
          <form method="post" action="/api/sair"><input type="hidden" name="area" value="entregador" /><button className="btn">Sair</button></form>
        </div>
      </header>

      <main className="painel-miolo" style={{ display: "grid", gap: 16, paddingBlock: 18 }}>
        <section className={"gps gps-" + gps}>
          <div>
            <strong>
              {gps === "ligado" ? "Localização ligada" : gps === "ligando" ? "Ligando o GPS..." : gps === "erro" ? "GPS com problema" : "Localização desligada"}
            </strong>
            <span>
              {gps === "ligado"
                ? `Os clientes em rota veem você no mapa${segundos != null ? ` · enviado há ${segundos}s` : ""}. Toque em "Abrir rota no Waze", depois volte para esta tela e deixe ela aberta: o Waze continua falando o caminho.`
                : "Ligue antes de sair. Os clientes acompanham você no mapa e recebem o aviso de 1 minuto."}
            </span>
          </div>
          {gps === "ligado" || gps === "ligando" ? (
            <button className="btn" onClick={desligarGps}>Desligar</button>
          ) : (
            <button className="btn principal-p" onClick={ligarGps}>Ligar localização</button>
          )}
        </section>

        {erro && <p className="erro" role="alert">{erro}</p>}

        {emRota.length > 0 && <h2 className="secao-titulo">No carro ({emRota.length})</h2>}
        {emRota.length > 0 && (
          <section className="imprevisto">
            <strong>Imprevisto no caminho?</strong>
            <span className="sub">Avisa todos os clientes com pedido no carro e marca no mapa deles onde você está.</span>
            <div className="imprevisto-motivos" role="group" aria-label="Motivo">
              {MOTIVOS.map((m) => (
                <button key={m.id} type="button" className={"btn" + (motivo === m.id ? " ativo" : "")} aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)}>
                  {m.icone} {m.nome}
                </button>
              ))}
            </div>
            <div className="imprevisto-min">
              {[5, 10, 15].map((n) => (
                <button key={n} type="button" className="btn principal-p" onClick={() => avisarAtraso(n)}>+{n} min</button>
              ))}
            </div>
            {emRota[0].atraso && (
              <div className="ok-aviso">
                Clientes avisados: +{emRota[0].atraso.minutos} min · {MOTIVOS.find((m) => m.id === emRota[0].atraso!.motivo)?.nome ?? "Imprevisto"}{" "}
                <button type="button" className="btn" onClick={limparAtraso}>Já normalizou</button>
              </div>
            )}
          </section>
        )}
        {emRota.length > 1 && !emRota.some((p) => p.atual) && (
          <p className="sub">Toque em <strong>Ir para este cliente</strong> na entrega que você vai fazer agora. Só esse cliente vê o carro no mapa; os outros esperam a vez.</p>
        )}
        {emRota.map((p) => {
          const pertinho = p.atual && p.distancia != null && p.distancia <= metrosAviso;
          return (
            <article key={p.numero} className={"pedido st-saiu" + (pertinho ? " pertinho" : "")}>
              <header>
                <div>
                  <h2>#{p.numero} · {p.nome}</h2>
                  <span className="sub">{p.endereco}, <strong>{p.postcode}</strong></span>
                </div>
                {p.distancia != null && (
                  <span className="dist num">{km(p.distancia)}<small>{p.minutos != null ? `~${Math.max(1, Math.round(p.minutos))} min` : ""}</small></span>
                )}
              </header>
              {p.observacao && <div className="obs">{p.observacao}</div>}
              {!p.temCoordenadas && <div className="sub">Postcode sem localização: o aviso automático de 1 minuto não funciona neste pedido.</div>}

              <div className={"pag " + (p.naConta ? "cartao" : p.pagamento)}>
                {p.naConta ? (
                  <strong>NA CONTA · NÃO COBRAR</strong>
                ) : p.pagamento === "dinheiro" && p.transferencia ? (
                  <>
                    <strong>TRANSFERÊNCIA · {gbp(p.total)}</strong>
                    <span>Dados da conta enviados no WhatsApp · confira no banco</span>
                  </>
                ) : p.pagamento === "dinheiro" ? (
                  <>
                    <strong>COBRAR {gbp(p.total)} EM DINHEIRO</strong>
                    <span>{p.trocoPara ? `Levar troco de ${gbp(p.trocoPara - p.total)} (cliente paga com ${gbp(p.trocoPara)})` : "Sem troco"}</span>
                  </>
                ) : (
                  <strong>JÁ PAGO NO CARTÃO</strong>
                )}
              </div>

              {p.waTransferencia && (
                <a className={"btn transf-btn" + (p.transferencia ? " enviado" : "")} href={p.waTransferencia} target="_blank" rel="noreferrer" onClick={() => acao(p.numero, { transferencia: true })}>
                  {p.transferencia ? "🏦 Mandar os dados da conta de novo" : "🏦 Vai pagar por transferência · mandar conta no WhatsApp"}
                </a>
              )}

              {pertinho && !p.avisadoChegando && !automatico && (
                <a className="btn aviso-1min" href={p.waChegando} target="_blank" rel="noreferrer" onClick={() => acao(p.numero, { avisoManual: "chegando" })}>
                  📲 Chegando! Toque para avisar no WhatsApp
                </a>
              )}
              {p.avisadoChegando && <div className="ok-aviso">Cliente avisado que você está chegando ✓</div>}

              {p.atual ? <div className="ok-aviso">🚗 Indo para este cliente agora · ele vê você no mapa</div> : <div className="sub">Esperando a vez · o cliente ainda não vê o carro</div>}

              <footer>
                {p.atual ? (
                  <a className="btn principal-p" href={p.waze} target="_blank" rel="noreferrer">Abrir rota no Waze</a>
                ) : (
                  <a className="btn principal-p" href={p.waze} target="_blank" rel="noreferrer" onClick={() => { if (gps === "desligado") ligarGps(); acao(p.numero, { iniciar: true }); }}>
                    Ir para este cliente
                  </a>
                )}
                <a className="btn" href={p.mapa} target="_blank" rel="noreferrer">Google Maps</a>
                {!automatico && !p.avisadoSaiu && (
                  <a className="btn" href={p.waSaiu} target="_blank" rel="noreferrer" onClick={() => acao(p.numero, { avisoManual: "saiu" })}>Mandar link do rastreio</a>
                )}
                <button className="btn principal-p" onClick={() => acao(p.numero, { status: "entregue", ...(p.pagamento === "dinheiro" && !p.transferencia ? { dinheiroRecebido: true } : {}) })}>
                  {p.pagamento === "dinheiro" && !p.transferencia ? "Entregue e recebido" : "Entregue"}
                </button>
              </footer>
            </article>
          );
        })}

        <h2 className="secao-titulo">Para sair ({prontos.length})</h2>
        {prontos.length === 0 && <p className="vazio">Nenhum pedido esperando. Os pedidos confirmados na cozinha aparecem aqui sozinhos.</p>}
        {prontos.map((p) => (
          <article key={p.numero} className={`pedido st-${p.status}`}>
            <header>
              <div>
                <h2>#{p.numero} · {p.nome}</h2>
                <span className="sub">{p.endereco}, <strong>{p.postcode}</strong></span>
              </div>
              <span className={`selo st-${p.status}`}>{p.status === "preparando" ? "Preparando" : "Confirmado"}</span>
            </header>
            <ul className="itens">{p.itens.map((i) => <li key={i}>{i}</li>)}</ul>
            <footer>
              <button className="btn principal-p" onClick={() => { if (gps === "desligado") ligarGps(); acao(p.numero, { status: "saiu" }); }}>
                Peguei, saindo para entrega
              </button>
            </footer>
          </article>
        ))}
      </main>
    </div>
  );
}
