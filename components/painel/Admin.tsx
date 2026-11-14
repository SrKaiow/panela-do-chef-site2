"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cardapio } from "@/lib/cardapio";
import type { Ajustes } from "@/lib/ajustes";
import Painel from "../Painel";
import Inicio from "./Inicio";
import Itens from "./Itens";
import { Categorias, Modificadores } from "./Grupos";
import HorariosEntrega from "./HorariosEntrega";
import { estadoLoja } from "@/lib/horario";

export type Salvar<T> = (novo: T) => Promise<boolean>;

const MENU = [
  { id: "inicio", nome: "Início", icone: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { id: "pedidos", nome: "Pedidos", icone: "M6 2h12l2 4v15a1 1 0 01-1 1H5a1 1 0 01-1-1V6zm-2 4h16M9 11h6M9 15h6" },
  { titulo: "Itens e cardápio" },
  { id: "itens", nome: "Biblioteca de itens", icone: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { id: "modificadores", nome: "Modificadores", icone: "M4 6h16M4 12h10M4 18h6M18 15v6M15 18h6" },
  { id: "categorias", nome: "Categorias", icone: "M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4" },
  { titulo: "Loja" },
  { id: "horarios", nome: "Horários e entrega", icone: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "avaliacoes", nome: "Avaliações", icone: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
] as const;

type Secao = "inicio" | "pedidos" | "itens" | "modificadores" | "categorias" | "horarios" | "avaliacoes";

function lerHash(): { secao: Secao; sub: string | null } {
  const [s, sub] = (typeof window === "undefined" ? "" : window.location.hash.slice(1)).split("/");
  const valida = MENU.some((m) => "id" in m && m.id === s);
  return { secao: (valida ? s : "inicio") as Secao, sub: sub ? decodeURIComponent(sub) : null };
}

export default function Admin() {
  const [rota, setRota] = useState<{ secao: Secao; sub: string | null }>({ secao: "inicio", sub: null });
  const [menuAberto, setMenuAberto] = useState(false);
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [novos, setNovos] = useState(0);
  const [avPendentes, setAvPendentes] = useState(0);
  const [somPronto, setSomPronto] = useState(true);

  useEffect(() => {
    const mudar = () => { setRota(lerHash()); setMenuAberto(false); window.scrollTo({ top: 0 }); };
    mudar();
    window.addEventListener("hashchange", mudar);
    return () => window.removeEventListener("hashchange", mudar);
  }, []);

  useEffect(() => {
    (async () => {
      const [c, a] = await Promise.all([fetch("/api/painel/cardapio", { cache: "no-store" }), fetch("/api/painel/ajustes", { cache: "no-store" })]);
      if (c.status === 401 || a.status === 401) { window.location.href = "/painel/entrar"; return; }
      setCardapio(await c.json());
      setAjustes(await a.json());
    })().catch(() => setAviso({ tipo: "erro", texto: "Não consegui carregar o cardápio. Recarregue a página." }));
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tipo === "ok" ? 2600 : 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const salvarCardapio: Salvar<Cardapio> = useCallback(async (novo) => {
    const antes = cardapio;
    setCardapio(novo);
    try {
      const r = await fetch("/api/painel/cardapio", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(novo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui salvar.");
      setAviso({ tipo: "ok", texto: "Salvo. Já está no site." });
      return true;
    } catch (e: any) {
      setCardapio(antes);
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    }
  }, [cardapio]);

  const salvarAjustes: Salvar<Ajustes> = useCallback(async (novo) => {
    try {
      const r = await fetch("/api/painel/ajustes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(novo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui salvar.");
      setAjustes(d);
      setAviso({ tipo: "ok", texto: "Ajustes salvos." });
      return true;
    } catch (e: any) {
      setAviso({ tipo: "erro", texto: e.message });
      return false;
    }
  }, []);

  const onNovos = useCallback((n: number, av: number, pronto: boolean) => { setNovos(n); setAvPendentes(av); setSomPronto(pronto); }, []);
  const ir = (secao: string, sub?: string) => { window.location.hash = sub ? `${secao}/${encodeURIComponent(sub)}` : secao; };
  const pronto = cardapio && ajustes;

  return (
    <div className="sq">
      <aside className={"sq-lateral" + (menuAberto ? " aberto" : "")} aria-label="Menu do painel">
        <div className="sq-marca">
          <img src="/fotos/logo-panela-do-chef.png" alt="" />
          <div>
            <strong>Panela do Chef</strong>
            <span>Painel da loja</span>
          </div>
        </div>
        <nav>
          {MENU.map((m, i) =>
            "titulo" in m ? (
              <span key={i} className="sq-menu-titulo">{m.titulo}</span>
            ) : (
              <a key={m.id} href={`#${m.id}`} className="sq-menu-item" aria-current={rota.secao === m.id ? "page" : undefined}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={m.icone} /></svg>
                <span>{m.nome}</span>
                {m.id === "pedidos" && novos > 0 && <span className="sq-contador">{novos}</span>}
                {m.id === "avaliacoes" && avPendentes > 0 && <span className="sq-contador">{avPendentes}</span>}
              </a>
            ),
          )}
        </nav>
        <div className="sq-lateral-pe">
          <a href="/" target="_blank" rel="noreferrer" className="sq-menu-item">Ver o site</a>
          <form method="post" action="/api/sair">
            <input type="hidden" name="area" value="painel" />
            <button className="sq-menu-item">Sair</button>
          </form>
        </div>
      </aside>
      {menuAberto && <div className="sq-veu" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <div className="sq-corpo">
        <header className="sq-topo">
          <button className="sq-hamburguer" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <span className="sq-topo-titulo">Panela do Chef</span>
          {ajustes && <EstadoLoja ajustes={ajustes} />}
        </header>

        {!somPronto && (
          <button type="button" className="sq-faixa-som">🔔 Toque aqui para ligar o alarme de pedidos novos</button>
        )}
        {novos > 0 && (
          <a href="#pedidos" className="sq-faixa-novo" role="alert">
            <span aria-hidden="true">🔔</span>
            <strong>{novos === 1 ? "1 pedido novo esperando você aceitar" : `${novos} pedidos novos esperando você aceitar`}</strong>
            <span className="sq-faixa-acao">Ver agora →</span>
          </a>
        )}
        <main className="sq-conteudo">
          {/* Pedidos fica sempre montado: continua tocando o som de pedido novo em qualquer tela. */}
          <div hidden={rota.secao !== "pedidos" && rota.secao !== "avaliacoes"}>
            <Painel secao={rota.secao === "avaliacoes" ? "avaliacoes" : "pedidos"} onNovos={onNovos} />
          </div>

          {!pronto && rota.secao !== "pedidos" && rota.secao !== "avaliacoes" && <p className="sq-carregando">Carregando...</p>}
          {pronto && rota.secao === "inicio" && <Inicio cardapio={cardapio} ajustes={ajustes} salvarAjustes={salvarAjustes} ir={ir} />}
          {pronto && rota.secao === "itens" && <Itens cardapio={cardapio} salvar={salvarCardapio} aberto={rota.sub} ir={ir} avisar={setAviso} />}
          {pronto && rota.secao === "modificadores" && <Modificadores cardapio={cardapio} salvar={salvarCardapio} />}
          {pronto && rota.secao === "categorias" && <Categorias cardapio={cardapio} salvar={salvarCardapio} />}
          {pronto && rota.secao === "horarios" && <HorariosEntrega ajustes={ajustes} salvar={salvarAjustes} />}
        </main>
      </div>

      {aviso && (
        <div className={"sq-toast " + aviso.tipo} role={aviso.tipo === "erro" ? "alert" : "status"}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

function EstadoLoja({ ajustes }: { ajustes: Ajustes }) {
  const [, tique] = useState(0);
  useEffect(() => { const t = setInterval(() => tique((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const e = estadoLoja(ajustes.horarios, ajustes.pausado);
  return (
    <a href="#inicio" className={"sq-estado " + (e.aberto ? "aberta" : "fechada")}>
      <span className="ponto" aria-hidden="true" />
      {e.aberto ? `Aberta até ${e.fechaAs}` : ajustes.pausado ? "Fechada por você" : `Fechada · abre ${e.proxima?.quando ?? ""} ${e.proxima?.abre ?? ""}`}
    </a>
  );
}
