"use client";

import { useState } from "react";
import { DIAS, type Ajustes, type Faixa } from "@/lib/ajustes";
import type { Salvar } from "./Admin";

export default function HorariosEntrega({ ajustes, salvar }: { ajustes: Ajustes; salvar: Salvar<Ajustes> }) {
  const [a, setA] = useState<Ajustes>(ajustes);
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(a) !== JSON.stringify(ajustes);

  const mudarDia = (i: number, v: [string, string] | null) => setA((x) => ({ ...x, horarios: x.horarios.map((h, j) => (j === i ? v : h)) }));
  const mudarEntrega = <K extends keyof Ajustes["entrega"]>(k: K, v: Ajustes["entrega"][K]) => setA((x) => ({ ...x, entrega: { ...x.entrega, [k]: v } }));
  const mudarFaixa = (i: number, f: Partial<Faixa>) => mudarEntrega("faixas", a.entrega.faixas.map((x, j) => (j === i ? { ...x, ...f } : x)));

  async function gravar(ev: React.FormEvent) {
    ev.preventDefault();
    setSalvando(true);
    const ok = await salvar(a);
    setSalvando(false);
    if (!ok) return;
  }

  const num = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));

  return (
    <form className="sq-pagina" onSubmit={gravar}>
      <div className="sq-cabeca sq-cabeca-fixa">
        <h1>Horários e entrega</h1>
        <button className="sq-btn sq-btn-primario" disabled={!mudou || salvando}>{salvando ? "Salvando..." : mudou ? "Salvar" : "Salvo"}</button>
      </div>

      <section className="sq-cartao">
        <h2>Horário de funcionamento</h2>
        <p className="sq-sub">O site abre e fecha sozinho nesses horários (hora de Londres). Fora do horário aparece "Cozinha fechada" e o cliente pode reservar para o próximo horário.</p>
        <div className="sq-dias">
          {DIAS.map((nome, i) => {
            const h = a.horarios[i];
            return (
              <div key={i} className="sq-dia">
                <label className="sq-interruptor">
                  <input type="checkbox" checked={!!h} onChange={(e) => mudarDia(i, e.target.checked ? ["12:00", "22:00"] : null)} />
                  <span className="trilho" aria-hidden="true" />
                  <span className="sq-dia-nome">{nome}</span>
                </label>
                {h ? (
                  <span className="sq-horas">
                    <input type="time" aria-label={`${nome}: abre`} value={h[0]} onChange={(e) => mudarDia(i, [e.target.value, h[1]])} />
                    <span>às</span>
                    <input type="time" aria-label={`${nome}: fecha`} value={h[1]} onChange={(e) => mudarDia(i, [h[0], e.target.value])} />
                  </span>
                ) : <span className="sq-sub">Fechado</span>}
              </div>
            );
          })}
        </div>
        <label className="sq-campo" style={{ maxWidth: 260 }}>Tempo médio de preparo (min)
          <input type="number" min={5} max={120} value={a.preparoMin} onChange={(e) => setA({ ...a, preparoMin: +e.target.value })} />
          <span className="sq-sub">Usado para mostrar ao cliente quando o pedido chega.</span>
        </label>
      </section>

      <section className="sq-cartao">
        <h2>Entrega</h2>
        <div className="sq-linha2">
          <label className="sq-campo">Postcode da cozinha
            <input value={a.entrega.cozinha.postcode} onChange={(e) => mudarEntrega("cozinha", { ...a.entrega.cozinha, postcode: e.target.value.toUpperCase() })} />
          </label>
          <label className="sq-campo">Raio de entrega (milhas)
            <input type="number" step="0.5" min={0.5} value={a.entrega.raioMilhas} onChange={(e) => mudarEntrega("raioMilhas", num(e.target.value))} />
          </label>
        </div>
        <div className="sq-linha2">
          <label className="sq-campo">Pedido mínimo (£)
            <input inputMode="decimal" value={a.entrega.pedidoMinimo} onChange={(e) => mudarEntrega("pedidoMinimo", num(e.target.value))} />
          </label>
          <label className="sq-campo">Regiões atendidas (aparece no site)
            <input value={a.entrega.regiao} onChange={(e) => mudarEntrega("regiao", e.target.value)} />
          </label>
        </div>

        <h3 className="sq-h3">Taxa por distância</h3>
        <div className="sq-faixas">
          <div className="sq-faixa sq-opcao-cab" aria-hidden="true"><span>Até (milhas)</span><span>Taxa (£)</span><span>Grátis acima de (£)</span><span /></div>
          {a.entrega.faixas.map((f, i) => (
            <div key={i} className="sq-faixa">
              <input aria-label="Até milhas" type="number" step="0.5" min={0.5} value={f.ateMilhas} onChange={(e) => mudarFaixa(i, { ateMilhas: num(e.target.value) })} />
              <input aria-label="Taxa" inputMode="decimal" value={f.taxa} onChange={(e) => mudarFaixa(i, { taxa: num(e.target.value) })} />
              <input aria-label="Grátis acima de" inputMode="decimal" placeholder="nunca" value={f.gratisAcima ?? ""} onChange={(e) => mudarFaixa(i, { gratisAcima: e.target.value === "" ? null : num(e.target.value) })} />
              <button type="button" className="sq-icone" onClick={() => mudarEntrega("faixas", a.entrega.faixas.filter((_, j) => j !== i))} aria-label="Remover faixa">✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="sq-btn" onClick={() => {
          const ult = a.entrega.faixas[a.entrega.faixas.length - 1];
          mudarEntrega("faixas", [...a.entrega.faixas, { ateMilhas: (ult?.ateMilhas ?? 0) + 1, taxa: ult?.taxa ?? 3, gratisAcima: null }]);
        }}>+ Adicionar faixa</button>
        <p className="sq-sub">A distância é em linha reta da cozinha até o postcode do cliente, igual à Square.</p>
      </section>

      <section className="sq-cartao">
        <h2>Pagamento e contato</h2>
        <label className="sq-interruptor">
          <input type="checkbox" checked={a.pagamentos.dinheiro} onChange={(e) => setA({ ...a, pagamentos: { ...a.pagamentos, dinheiro: e.target.checked } })} />
          <span className="trilho" aria-hidden="true" /><span>Aceitar dinheiro na entrega</span>
        </label>
        <label className="sq-interruptor">
          <input type="checkbox" checked={a.pagamentos.cartao} onChange={(e) => setA({ ...a, pagamentos: { ...a.pagamentos, cartao: e.target.checked } })} />
          <span className="trilho" aria-hidden="true" /><span>Aceitar cartão online (precisa da chave do Stripe)</span>
        </label>
        <div className="sq-linha2">
          <label className="sq-campo">WhatsApp / telefone
            <input type="tel" value={a.telefone} onChange={(e) => setA({ ...a, telefone: e.target.value })} />
          </label>
          <label className="sq-campo">E-mail
            <input type="email" value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} />
          </label>
        </div>
        <label className="sq-campo">Instagram (sem @)
          <input value={a.instagram} onChange={(e) => setA({ ...a, instagram: e.target.value.replace(/^@/, "") })} />
        </label>
      </section>
    </form>
  );
}
