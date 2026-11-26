"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pagamento no próprio site: Apple Pay (iPhone/Safari) e Google Pay (Android/Chrome), pela Square.
 * O cliente já preencheu os dados no site, então aqui é só tocar no botão e confirmar.
 * Se nenhuma carteira estiver disponível no aparelho, mostra "Pagar com cartão" (página segura da Square).
 */

type Carteira = { tokenize: () => Promise<{ status: string; token?: string; errors?: unknown }>; attach?: (sel: string, o?: object) => Promise<void> };
type SquarePayments = {
  paymentRequest: (o: object) => unknown;
  applePay: (r: unknown) => Promise<Carteira>;
  googlePay: (r: unknown) => Promise<Carteira>;
};
declare global {
  interface Window { Square?: { payments: (appId: string, locationId: string) => SquarePayments } }
}

function carregarScript(src: string) {
  return new Promise<void>((ok, falhou) => {
    if (window.Square) return ok();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => falhou(new Error("script"));
    document.head.appendChild(s);
  });
}

export default function PagarCarteira({ token, total, link }: { token: string; total: number; link: string | null }) {
  const [estado, setEstado] = useState<"carregando" | "pronto" | "pagando" | "pago">("carregando");
  const [apple, setApple] = useState<Carteira | null>(null);
  const [google, setGoogle] = useState<Carteira | null>(null);
  const [erro, setErro] = useState("");
  // Depois de uma falha na carteira, o "Pagar com cartão" vira o botão principal.
  const [falhou, setFalhou] = useState(false);

  function registrarFalha(carteira: string, etapa: string, detalhe: unknown) {
    try {
      const texto = typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe, Object.getOwnPropertyNames(detalhe ?? {}));
      fetch(`/api/pedido/${token}/erro-carteira`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carteira, etapa, detalhe: texto }), keepalive: true }).catch(() => {});
    } catch {}
  }
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    (async () => {
      try {
        const r = await fetch("/api/square/carteira", { cache: "no-store" });
        const c = await r.json();
        if (!c.ok) throw new Error("sem square");
        await carregarScript(c.sandbox ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js");
        const payments = window.Square!.payments(c.appId, c.locationId);
        const pedido = () =>
          payments.paymentRequest({ countryCode: "GB", currencyCode: "GBP", total: { amount: (total / 100).toFixed(2), label: "Panela do Chef" } });
        try {
          setApple(await payments.applePay(pedido()));
        } catch {
          /* aparelho sem Apple Pay */
        }
        try {
          const g = await payments.googlePay(pedido());
          await g.attach!("#gpay-botao", { buttonColor: "white", buttonSizeMode: "fill", buttonType: "pay" });
          setGoogle(g);
        } catch {
          /* aparelho sem Google Pay */
        }
      } catch (e) {
        console.error("[carteira]", e);
      }
      setEstado("pronto");
    })();
  }, [total]);

  async function pagar(c: Carteira | null, nome: string) {
    if (!c || estado === "pagando") return;
    setErro("");
    let res;
    try {
      // tokenize() precisa ser a primeira coisa do toque (exigência da Apple Pay).
      res = await c.tokenize();
    } catch (e) {
      registrarFalha(nome, "abrir", e);
      setFalhou(true);
      setErro(`Não deu para pagar com ${nome} neste celular. Toque em "Pagar com cartão" abaixo e digite o cartão.`);
      return;
    }
    if (res.status !== "OK" || !res.token) {
      // Fechou a janela sem pagar (Cancel) não é erro; qualquer outra coisa é falha da carteira.
      if (res.status !== "Cancel") {
        registrarFalha(nome, "status " + res.status, res.errors ?? res);
        setFalhou(true);
        setErro(`Não deu para pagar com ${nome} neste celular. Toque em "Pagar com cartão" abaixo e digite o cartão.`);
      }
      return;
    }
    setEstado("pagando");
    try {
      const r = await fetch(`/api/pedido/${token}/pagar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: res.token }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "O pagamento não foi aprovado.");
      setEstado("pago");
      window.location.replace(`/pedido/${token}`);
    } catch (e) {
      setFalhou(true);
      setErro((e instanceof Error ? e.message : "O pagamento não foi aprovado.") + ' Se preferir, toque em "Pagar com cartão" abaixo.');
      setEstado("pronto");
    }
  }

  const nenhuma = estado !== "carregando" && !apple && !google;
  return (
    <section className="pagar-carteira" aria-label="Pagamento">
      {estado === "carregando" && <div className="pagar-carregando">Carregando o pagamento...</div>}
      {apple && (
        <button type="button" className="apple-pay-botao" aria-label="Pagar com Apple Pay" onClick={() => pagar(apple, "Apple Pay")} disabled={estado === "pagando"} />
      )}
      {/* O Google Pay desenha o próprio botão aqui dentro. */}
      <div id="gpay-botao" className={"gpay-botao" + (google ? "" : " oculto")} onClick={() => pagar(google, "Google Pay")} role="button" aria-label="Pagar com Google Pay" />
      {estado === "pagando" && <div className="pagar-carregando">Confirmando o pagamento...</div>}
      {erro && <p className="pagar-erro" role="alert">{erro}</p>}
      {nenhuma && link && (
        <a href={link} className="principal" style={{ textDecoration: "none" }}><span>Pagar com cartão</span><span>→</span></a>
      )}
      {!nenhuma && estado !== "carregando" && link && (
        <>
          <span className="pagar-ou">ou</span>
          <a href={link} className={falhou ? "principal" : "pagar-cartao"} style={{ textDecoration: "none" }}>
            <span>💳 Pagar com cartão</span><span>→</span>
          </a>
          <span className="pagar-dica">Digite o cartão na página segura da Square.</span>
        </>
      )}
      {nenhuma && !link && <p className="pagar-erro">Pagamento indisponível agora. Fale com a gente no WhatsApp.</p>}
    </section>
  );
}
