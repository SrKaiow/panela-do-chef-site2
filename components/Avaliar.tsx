"use client";

import { useRef, useState } from "react";
import { reduzirFoto } from "@/lib/reduzirFoto";

export const ROTULOS_NOTA = ["", "Satisfeito", "Muito bom", "Ótimo", "Excelente", "AMEIIIIIII"];
const CARINHAS = ["", "🙂", "😊", "😄", "🤩", "😍"];

/**
 * Formulário de avaliação. Com `token` (veio da página de um pedido entregue),
 * vira "pedido verificado" e o cliente pode mandar uma foto de como recebeu.
 */
export default function Avaliar({ token, nomeInicial = "", onFechar }: { token?: string; nomeInicial?: string; onFechar?: () => void }) {
  const [nota, setNota] = useState(5);
  const [nome, setNome] = useState(nomeInicial);
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [site, setSite] = useState(""); // campo-isca contra robôs (fica escondido)
  const [foto, setFoto] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function escolherFoto(arquivo?: File | null) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma foto.");
    setErro("");
    setSubindo(true);
    try {
      const blob = await reduzirFoto(arquivo, 1400);
      const form = new FormData();
      if (token) form.append("token", token);
      form.append("foto", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
      const r = await fetch("/api/avaliacoes/foto", { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui enviar a foto.");
      setFoto(d.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui enviar a foto.");
    } finally {
      setSubindo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEstado("enviando");
    try {
      const r = await fetch("/api/avaliacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota, nome, local, texto, token, site, foto }),
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
        <span className="avaliar-ok-emoji" aria-hidden="true">{CARINHAS[nota]}</span>
        <strong>Valeu demais, {nome.split(" ")[0] || "você"}!</strong>
        <span>Sua avaliação chegou para o Chef Kaio e aparece no site assim que ele aprovar.</span>
        {onFechar && <button type="button" className="secundario" onClick={onFechar}>Fechar</button>}
      </div>
    );
  }

  return (
    <form className="avaliar" onSubmit={enviar}>
      <div className="nota-escolha">
        <span className="rotulo" id="r-nota">Como foi o seu pedido?</span>
        <div className="estrelas-escolha" role="radiogroup" aria-labelledby="r-nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}: ${ROTULOS_NOTA[n]}`}
              className={n <= nota ? "cheia" : ""}
              onClick={() => setNota(n)}
            >
              ★
            </button>
          ))}
        </div>
        <span className={"nota-rotulo nota-" + nota} aria-live="polite">
          <span aria-hidden="true">{CARINHAS[nota]}</span> {ROTULOS_NOTA[nota]}
        </span>
      </div>

      {(
        <div className="foto-avaliacao">
          <span className="rotulo">Foto de como chegou <span className="dica">(opcional)</span></span>
          {foto ? (
            <div className="foto-previa">
              <img src={foto} alt="Sua foto do pedido" />
              <button type="button" className="secundario" onClick={() => setFoto(null)}>Trocar foto</button>
            </div>
          ) : (
            <button type="button" className="foto-botao" onClick={() => input.current?.click()} disabled={subindo}>
              <span aria-hidden="true">📸</span>
              <span>{subindo ? "Enviando a foto..." : "Mandar foto do pedido"}</span>
              <span className="dica">Tira na hora ou escolhe da galeria</span>
            </button>
          )}
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      <label className="campo" htmlFor="av-texto">Conta pra gente
        <textarea id="av-texto" required minLength={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que achou da comida, do tamanho e da entrega?" />
      </label>
      <div className="avaliar-linha">
        <label className="campo" htmlFor="av-nome">Seu nome
          <input id="av-nome" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana T." />
        </label>
        <label className="campo" htmlFor="av-local">Cidade ou bairro <span className="dica">(opcional)</span>
          <input id="av-local" maxLength={40} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Epsom" />
        </label>
      </div>
      <input className="isca" tabIndex={-1} autoComplete="off" aria-hidden="true" value={site} onChange={(e) => setSite(e.target.value)} name="site" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="principal" type="submit" disabled={estado === "enviando" || subindo}>
        <span>{estado === "enviando" ? "Enviando..." : "Enviar avaliação"}</span><span aria-hidden="true">{CARINHAS[nota]}</span>
      </button>
    </form>
  );
}
