"use client";

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
  itens: string[];
  distancia: number | null;
  minutos: number | null;
  avisadoSaiu: boolean;
  avisadoChegando: boolean;
  temCoordenadas: boolean;
  waSaiu: string;
  waChegando: string;
  mapa: string;
};

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

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

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/entregador/pedidos", { cache: "no-store" });
      if (r.status === 401) { window.location.href = "/entregador/entrar"; return; }
      const d = await r.json();
      setPedidos(d.pedidos);
      setAutomatico(d.automatico);
      setMetrosAviso(d.metrosAviso);
    } catch {
      setErro("Sem internet. Tentando de novo...");
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 8000);
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [carregar]);

  async function enviarPosicao(pos: GeolocationPosition) {
    const t = Date.now();
    if (t - ultimoPost.current < 4000) return; // no máximo a cada 4 segundos
    ultimoPost.current = t;
    try {
      const r = await fetch("/api/entregador/localizacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }),
      });
      if (r.ok) { setUltimoEnvio(Date.now()); setErro(""); carregar(); }
    } catch {
      setErro("Não consegui enviar a localização. Confira a internet.");
    }
  }

  async function ligarGps() {
    if (!("geolocation" in navigator)) { setGps("erro"); setErro("Este celular não libera a localização pelo navegador."); return; }
    setGps("ligando");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => { setGps("ligado"); enviarPosicao(pos); },
      (e) => {
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

  function desligarGps() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    setGps("desligado");
  }
  useEffect(() => () => desligarGps(), []);

  async function acao(numero: number, dados: Record<string, unknown>) {
    const r = await fetch(`/api/entregador/pedidos/${numero}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    if (!r.ok) setErro("Não consegui salvar. Confira a internet.");
    carregar();
  }

  const prontos = pedidos.filter((p) => p.status !== "saiu");
  const emRota = pedidos.filter((p) => p.status === "saiu").sort((a, b) => (a.distancia ?? 1e9) - (b.distancia ?? 1e9));
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
                ? `Os clientes em rota veem você no mapa${segundos != null ? ` · enviado há ${segundos}s` : ""}. Deixe esta tela aberta.`
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

        {emRota.length > 0 && <h2 className="secao-titulo">Em rota ({emRota.length})</h2>}
        {emRota.map((p) => {
          const pertinho = p.distancia != null && p.distancia <= metrosAviso;
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

              <div className={"pag " + p.pagamento}>
                {p.pagamento === "dinheiro" ? (
                  <>
                    <strong>COBRAR {gbp(p.total)} EM DINHEIRO</strong>
                    <span>{p.trocoPara ? `Levar troco de ${gbp(p.trocoPara - p.total)} (cliente paga com ${gbp(p.trocoPara)})` : "Sem troco"}</span>
                  </>
                ) : (
                  <strong>JÁ PAGO NO CARTÃO</strong>
                )}
              </div>

              {pertinho && !p.avisadoChegando && !automatico && (
                <a className="btn aviso-1min" href={p.waChegando} target="_blank" rel="noreferrer" onClick={() => acao(p.numero, { avisoManual: "chegando" })}>
                  Faltando ~1 min: avisar no WhatsApp
                </a>
              )}
              {p.avisadoChegando && <div className="ok-aviso">Cliente avisado que você está chegando ✓</div>}

              <footer>
                <a className="btn" href={p.mapa} target="_blank" rel="noreferrer">Abrir rota no Maps</a>
                {!automatico && !p.avisadoSaiu && (
                  <a className="btn" href={p.waSaiu} target="_blank" rel="noreferrer" onClick={() => acao(p.numero, { avisoManual: "saiu" })}>Mandar link do rastreio</a>
                )}
                <button className="btn principal-p" onClick={() => acao(p.numero, { status: "entregue", ...(p.pagamento === "dinheiro" ? { dinheiroRecebido: true } : {}) })}>
                  {p.pagamento === "dinheiro" ? "Entregue e recebido" : "Entregue"}
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
