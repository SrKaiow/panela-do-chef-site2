"use client";

import { useRef, useState } from "react";
import { reduzirFoto } from "@/lib/reduzirFoto";
import { ROTULOS_NOTA } from "./Avaliar";

const CARINHAS = ["", "🙂", "😊", "😄", "🤩", "😍"];

/** Avaliação do almoço (marmita pedida no WhatsApp): estrelas, foto, texto, nome e região. */
export default function AvaliarAlmoco({ slug, prato, regioes }: { slug: string; prato: string; regioes: string[] }) {
  const [nota, setNota] = useState(5);
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("");
  const [regiao, setRegiao] = useState("");
  const [outra, setOutra] = useState("");
  const [site, setSite] = useState(""); // campo-isca contra robôs
  const [foto, setFoto] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const local = regiao === "outra" ? outra : regiao;

  async function escolherFoto(arquivo?: File | null) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma foto.");
    setErro("");
    setSubindo(true);
    try {
      const blob = await reduzirFoto(arquivo, 1400);
      const form = new FormData();
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
      const r = await fetch("/api/avaliacoes/almoco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prato: slug, nota, texto, nome, local, foto, site }),
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
        <strong>Valeu demais, {nome.trim().split(" ")[0] || "você"}!</strong>
        <span>Sua avaliação chegou para o Chef Kaio. Obrigado por pedir o nosso almoço!</span>
        <a className="secundario" href="/" style={{ textAlign: "center", textDecoration: "none" }}>Ver o cardápio do site</a>
      </div>
    );
  }

  return (
    <form className="avaliar" onSubmit={enviar}>
      <div className="nota-escolha">
        <span className="rotulo" id="r-nota">Como estava a sua {prato.toLowerCase()}?</span>
        <div className="estrelas-escolha" role="radiogroup" aria-labelledby="r-nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}: ${ROTULOS_NOTA[n]}`} className={n <= nota ? "cheia" : ""} onClick={() => setNota(n)}>
              ★
            </button>
          ))}
        </div>
        <span className={"nota-rotulo nota-" + nota} aria-live="polite">
          <span aria-hidden="true">{CARINHAS[nota]}</span> {ROTULOS_NOTA[nota]}
        </span>
      </div>

      <div className="foto-avaliacao">
        <span className="rotulo">Foto da sua marmita <span className="dica">(opcional)</span></span>
        {foto ? (
          <div className="foto-previa">
            <img src={foto} alt="Sua foto do almoço" />
            <button type="button" className="secundario" onClick={() => setFoto(null)}>Trocar foto</button>
          </div>
        ) : (
          <button type="button" className="foto-botao" onClick={() => input.current?.click()} disabled={subindo}>
            <span aria-hidden="true">📸</span>
            <span>{subindo ? "Enviando a foto..." : "Mandar foto de como chegou"}</span>
            <span className="dica">Tira na hora ou escolhe da galeria</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <label className="campo" htmlFor="al-texto">Conta pra gente
        <textarea id="al-texto" required minLength={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que achou do sabor, do tamanho e da entrega?" />
      </label>

      <div className="avaliar-linha">
        <label className="campo" htmlFor="al-nome">Seu nome
          <input id="al-nome" required minLength={2} maxLength={40} autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria" />
        </label>
        <label className="campo" htmlFor="al-regiao">Sua região
          <select id="al-regiao" required value={regiao} onChange={(e) => setRegiao(e.target.value)}>
            <option value="" disabled>Escolha</option>
            {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="outra">Outra...</option>
          </select>
        </label>
      </div>
      {regiao === "outra" && (
        <label className="campo" htmlFor="al-outra">Qual região?
          <input id="al-outra" required minLength={2} maxLength={30} value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Ex.: Hook" />
        </label>
      )}
      <p className="dica">Vai aparecer só o seu nome e a região{nome.trim() && local ? <> (<strong>{nome.trim()} · {local}</strong>)</> : null}. Nada de endereço ou telefone.</p>

      <input className="isca" tabIndex={-1} autoComplete="off" aria-hidden="true" value={site} onChange={(e) => setSite(e.target.value)} name="site" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="principal" type="submit" disabled={estado === "enviando" || subindo}>
        <span>{estado === "enviando" ? "Enviando..." : "Enviar avaliação"}</span><span aria-hidden="true">{CARINHAS[nota]}</span>
      </button>
    </form>
  );
}
