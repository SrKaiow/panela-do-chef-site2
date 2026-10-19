import { notFound } from "next/navigation";
import Link from "next/link";
import Rastreio from "@/components/Rastreio";
import { buscarPorToken, confirmarPagamentoCartao, pedidoJaAvaliado } from "@/lib/db";
import { situacaoAoVivo } from "@/lib/rastreio";
import { formatar, loja } from "@/lib/cardapio";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu pedido | Panela do Chef", robots: { index: false } };


export default async function PaginaPedido({ params, searchParams }: { params: { token: string }; searchParams: { sessao?: string; cancelado?: string } }) {
  let pedido = await buscarPorToken(params.token);
  if (!pedido) notFound();

  // Voltou do Stripe: confere o pagamento direto com o Stripe (não depende só do webhook).
  if (pedido.pagamento === "cartao" && !pedido.pago && searchParams.sessao && searchParams.sessao === pedido.stripeSessao) {
    try {
      const s = await stripe().checkout.sessions.retrieve(searchParams.sessao);
      if (s.payment_status === "paid") {
        await confirmarPagamentoCartao(pedido.numero);
        pedido = (await buscarPorToken(params.token))!;
      }
    } catch (e) { console.error("[pedido] stripe", e); }
  }

  const aguardando = pedido.status === "aguardando_pagamento";
  const cancelado = pedido.status === "cancelado";
  const aoVivo = await situacaoAoVivo(pedido);
  const jaAvaliado = await pedidoJaAvaliado(pedido.numero);

  return (
    <>
      <header className="topo">
        <div className="miolo">
          <Link href="/" style={{ textDecoration: "none" }}><img src="/fotos/logo-panela-do-chef.png" alt={loja.nome} style={{ width: 130, height: "auto", display: "block" }} /></Link>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
            {cancelado ? "Pedido cancelado" : aguardando ? "Pagamento não concluído" : `Pedido nº ${pedido.numero} recebido!`}
          </h1>
          <p className="slogan" style={{ margin: 0 }}>
            {cancelado
              ? "Este pedido foi cancelado. Se tiver dúvida, fale com a gente pelo Instagram."
              : aguardando
                ? "O pagamento no cartão não foi finalizado, então o pedido ainda não foi para a cozinha."
                : pedido.pagamento === "dinheiro"
                  ? `Tenha ${formatar(pedido.trocoPara ?? pedido.total)} em dinheiro para pagar o entregador${pedido.trocoPara ? ` (troco de ${formatar(pedido.trocoPara - pedido.total)})` : ""}.`
                  : "Pagamento no cartão confirmado. Obrigado!"}
          </p>
        </div>
      </header>

      <main className="miolo" style={{ display: "grid", gap: 22, paddingBlock: "24px 80px" }}>
        {aguardando ? (
          <Link href="/" className="principal" style={{ textDecoration: "none" }}><span>Voltar e tentar de novo</span><span>→</span></Link>
        ) : (
          !cancelado && <Rastreio token={pedido.token} inicial={aoVivo} nome={pedido.nome} jaAvaliado={jaAvaliado} />
        )}

        <section style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Resumo</h2>
          <div className="linhas">
            {pedido.itens.map((l, i) => (
              <div className="linha" key={i}>
                <div>
                  <div className="nome">{l.qtd}× {l.nome}</div>
                  {l.detalhes.map((d) => <div className="det" key={d}>{d}</div>)}
                  {l.obs && <div className="det">Obs.: {l.obs}</div>}
                </div>
                <div className="preco" style={{ fontWeight: 700 }}>{formatar(l.total)}</div>
              </div>
            ))}
          </div>
          <div className="totais preco" style={{ marginTop: 8 }}>
            <div><span>Subtotal</span><span>{formatar(pedido.subtotal)}</span></div>
            <div><span>Entrega</span><span>{pedido.taxa ? formatar(pedido.taxa) : "Grátis"}</span></div>
            <div className="total"><span>Total</span><span>{formatar(pedido.total)}</span></div>
            <div style={{ color: "var(--texto-2)" }}><span>Pagamento</span><span>{pedido.pagamento === "dinheiro" ? "Dinheiro na entrega" : pedido.pago ? "Cartão (pago)" : "Cartão (pendente)"}</span></div>
          </div>
        </section>

        <section style={{ color: "var(--texto-2)" }}>
          Entrega para <strong style={{ color: "var(--texto)" }}>{pedido.nome}</strong>, {pedido.endereco}, {pedido.postcode}.
          <br />Guarde este link: é por ele que você acompanha o pedido ao vivo.
        </section>
      </main>
    </>
  );
}
