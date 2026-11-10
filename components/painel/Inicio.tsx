"use client";

import { useEffect, useState } from "react";
import type { Cardapio } from "@/lib/cardapio";
import { DIAS, type Ajustes } from "@/lib/ajustes";
import { emLondres, estadoLoja } from "@/lib/horario";
import type { Pedido } from "@/lib/db";
import type { Salvar } from "./Admin";

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const diaLondres = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });

export default function Inicio({ cardapio, ajustes, salvarAjustes, ir }: { cardapio: Cardapio; ajustes: Ajustes; salvarAjustes: Salvar<Ajustes>; ir: (s: string, sub?: string) => void }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const r = await fetch("/api/painel/pedidos", { cache: "no-store" });
        if (r.ok && vivo) setPedidos((await r.json()).pedidos);
      } catch {}
    };
    carregar();
    const t = setInterval(carregar, 20000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const estado = estadoLoja(ajustes.horarios, ajustes.pausado);
  const hoje = diaLondres(new Date());
  const validos = pedidos.filter((p) => p.status !== "cancelado" && p.status !== "aguardando_pagamento");
  const deHoje = validos.filter((p) => diaLondres(new Date(p.criadoEm)) === hoje);
  const vendas = deHoje.reduce((s, p) => s + p.total, 0);
  const ticket = deHoje.length ? Math.round(vendas / deHoje.length) : 0;
  const ativos = validos.filter((p) => ["novo", "confirmado", "preparando", "saiu"].includes(p.status));
  const reservas = validos.filter((p) => p.agendadoPara && new Date(p.agendadoPara).getTime() > Date.now() && p.status !== "entregue");
  const semFoto = cardapio.itens.filter((i) => !i.imagem);
  const esgotados = cardapio.itens.filter((i) => !i.disponivel);

  // Mais vendidos (últimos pedidos carregados).
  const contagem = new Map<string, number>();
  for (const p of validos) for (const l of p.itens) contagem.set(l.nome, (contagem.get(l.nome) ?? 0) + l.qtd);
  const top = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  async function alternarPausa() {
    setSalvando(true);
    await salvarAjustes({ ...ajustes, pausado: !ajustes.pausado });
    setSalvando(false);
  }

  const diaHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Olá, Chef</h1>
          <p className="sq-sub">{diaHoje.charAt(0).toUpperCase() + diaHoje.slice(1)}</p>
        </div>
      </div>

      <section className={"sq-cartao sq-loja " + (estado.aberto ? "aberta" : "fechada")}>
        <div>
          <span className="sq-rotulo">Loja online</span>
          <strong>{estado.aberto ? "Aberta, recebendo pedidos" : ajustes.pausado ? "Fechada por você" : "Fechada (fora do horário)"}</strong>
          <span className="sq-sub">
            {estado.aberto
              ? `Fecha sozinha às ${estado.fechaAs}. Depois disso o site mostra "Cozinha fechada" e aceita reservas.`
              : estado.proxima
                ? `Reabre ${estado.proxima.quando} às ${estado.proxima.abre}. Enquanto isso, os clientes podem reservar.`
                : "Nenhum horário de abertura configurado."}
          </span>
        </div>
        <button className={"sq-btn " + (ajustes.pausado ? "sq-btn-primario" : "sq-btn-perigo")} onClick={alternarPausa} disabled={salvando}>
          {ajustes.pausado ? "Reabrir a cozinha" : "Fechar a cozinha agora"}
        </button>
      </section>

      <section className="sq-metricas" aria-label="Resumo de hoje">
        <div className="sq-cartao"><span className="sq-rotulo">Vendas hoje</span><strong className="num">{gbp(vendas)}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Pedidos hoje</span><strong className="num">{deHoje.length}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Ticket médio</span><strong className="num">{gbp(ticket)}</strong></div>
        <button className="sq-cartao sq-clicavel" onClick={() => ir("pedidos")}><span className="sq-rotulo">Em andamento</span><strong className="num">{ativos.length}</strong></button>
      </section>

      <div className="sq-duas">
        <section className="sq-cartao">
          <h2>Reservas para depois</h2>
          {reservas.length === 0 ? (
            <p className="sq-sub">Nenhuma reserva. Quando a cozinha estiver fechada, os pedidos agendados aparecem aqui.</p>
          ) : (
            <ul className="sq-lista">
              {reservas.slice(0, 6).map((p) => (
                <li key={p.numero}>
                  <span>#{p.numero} · {p.nome}</span>
                  <span className="sq-sub">{new Date(p.agendadoPara!).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} · {gbp(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sq-cartao">
          <h2>Mais pedidos</h2>
          {top.length === 0 ? <p className="sq-sub">Ainda sem pedidos para mostrar.</p> : (
            <ol className="sq-lista">
              {top.map(([nome, n]) => <li key={nome}><span>{nome}</span><span className="num">{n}</span></li>)}
            </ol>
          )}
        </section>

        <section className="sq-cartao">
          <h2>Cardápio</h2>
          <ul className="sq-lista">
            <li><span>Itens no cardápio</span><span className="num">{cardapio.itens.length}</span></li>
            <li>
              <button className="sq-link" onClick={() => ir("itens")}>Itens sem foto</button>
              <span className={"num" + (semFoto.length ? " sq-alerta" : "")}>{semFoto.length}</span>
            </li>
            <li>
              <button className="sq-link" onClick={() => ir("itens")}>Esgotados</button>
              <span className="num">{esgotados.length}</span>
            </li>
          </ul>
        </section>

        <section className="sq-cartao">
          <h2>Horários da semana</h2>
          <ul className="sq-lista">
            {ajustes.horarios.map((h, i) => (
              <li key={i} className={i === emLondres(new Date()).dow ? "sq-hoje" : ""}>
                <span>{DIAS[i]}</span>
                <span className="sq-sub">{h ? `${h[0]} – ${h[1]}` : "Fechado"}</span>
              </li>
            ))}
          </ul>
          <button className="sq-link" onClick={() => ir("horarios")}>Editar horários</button>
        </section>
      </div>
    </div>
  );
}
