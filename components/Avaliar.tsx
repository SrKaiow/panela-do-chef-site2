"use client";

import { useState } from "react";

/** Formulário de avaliação. Com `token`, a avaliação fica marcada como "cliente verificado" (veio de um pedido). */
export default function Avaliar({ token, nomeInicial = "", onFechar }: { token?: string; nomeInicial?: string; onFechar?: () => void }) {
  const [nota, setNota] = useState(5);
  const [nome, setNome] = useState(nomeInicial);
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [site, setSite] = useState(""); // campo-isca contra robôs (fica escondido)
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEstado("enviando");
    try {
      const r = await fetch("/api/avaliacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota, nome, local, texto, token, site }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || "Não foi possível enviar.");
      setEstado("enviado");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
      setEstado("editando");
    }
  }

  if (estado === "enviado") {
    return (
      <div className="avaliar-ok" role="status">
        <strong>Obrigado pela avaliação!</strong>
        <span>Ela aparece no site assim que o Chef Kaio aprovar.</span>
        {onFechar && <button type="button" className="secundario" onClick={onFechar}>Fechar</button>}
      </div>
    );
  }

  return (
    <form className="avaliar" onSubmit={enviar}>
      <div className="grupo">
        <span className="rotulo" id="r-nota">Sua nota</span>
        <div className="estrelas-escolha" role="radiogroup" aria-labelledby="r-nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              className={n <= nota ? "cheia" : ""}
              onClick={() => setNota(n)}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="avaliar-linha">
        <label className="campo" htmlFor="av-nome">Seu nome
          <input id="av-nome" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana T." />
        </label>
        <label className="campo" htmlFor="av-local">Cidade ou bairro <span className="dica">(opcional)</span>
          <input id="av-local" maxLength={40} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Epsom" />
        </label>
      </div>
      <label className="campo" htmlFor="av-texto">Como foi?
        <textarea id="av-texto" required minLength={10} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Conta pra gente o que achou da comida e da entrega." />
      </label>
      <input className="isca" tabIndex={-1} autoComplete="off" aria-hidden="true" value={site} onChange={(e) => setSite(e.target.value)} name="site" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="principal" type="submit" disabled={estado === "enviando"}>
        <span>{estado === "enviando" ? "Enviando..." : "Enviar avaliação"}</span><span>★</span>
      </button>
    </form>
  );
}
