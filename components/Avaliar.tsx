"use client";

import { useEffect, useRef, useState } from "react";
import { fotoPerfil, reduzirFoto } from "@/lib/reduzirFoto";

export const ROTULOS_NOTA = ["", "Satisfeito", "Muito bom", "Ótimo", "Excelente", "AMEIIIIIII"];
const CARINHAS = ["", "🙂", "😊", "😄", "🤩", "😍"];

/**
 * Formulário de avaliação. Com `token` (veio da página de um pedido entregue),
 * vira "pedido verificado" e o cliente pode mandar uma foto de como recebeu.
 */
export default function Avaliar({ token, nomeInicial = "", onFechar }: { token?: string; nomeInicial?: string; onFechar?: () => void }) {
  const [nota, setNota] = useState(5);
  // Quem avalia: vem sempre do pedido (nome e bairro), nunca digitado.
  const [ident, setIdent] = useState<{ nome: string; local: string | null; numero: number } | null>(null);
  const [conferindo, setConferindo] = useState(!!token);
  const [numeroPedido, setNumeroPedido] = useState("");
  const [telefone, setTelefone] = useState("");
  const nome = ident?.nome ?? nomeInicial;
  const [texto, setTexto] = useState("");
  const [site, setSite] = useState(""); // campo-isca contra robôs (fica escondido)
  const [foto, setFoto] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inputAvatar = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  async function conferir(dados: object) {
    setErro("");
    setConferindo(true);
    try {
      const r = await fetch("/api/avaliacoes/pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || "Não achamos esse pedido.");
      setIdent(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não achamos esse pedido.");
    } finally {
      setConferindo(false);
    }
  }
  useEffect(() => {
    if (token) conferir({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function escolherFoto(arquivo?: File | null, perfil = false) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha uma foto.");
    setErro("");
    setSubindo(true);
    try {
      const blob = perfil ? await fotoPerfil(arquivo, 400) : await reduzirFoto(arquivo, 1400);
      const form = new FormData();
      if (token) form.append("token", token);
      form.append("foto", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
      const r = await fetch("/api/avaliacoes/foto", { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui enviar a foto.");
      if (perfil) setAvatar(d.url);
      else setFoto(d.url);
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
        body: JSON.stringify({ nota, texto, token, numero: numeroPedido, telefone, site, foto, avatar }),
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

  // Ainda não sabemos qual pedido: pela página do pedido confere sozinho; na página inicial pede nº + telefone.
  if (!ident) {
    if (token) {
      return <div className="avaliar">{conferindo ? <p className="dica">Carregando seu pedido...</p> : <p className="erro" role="alert">{erro || "Não foi possível avaliar este pedido."}</p>}</div>;
    }
    return (
      <form className="avaliar" onSubmit={(e) => { e.preventDefault(); conferir({ numero: numeroPedido, telefone }); }}>
        <p className="dica">As avaliações são só de quem pediu pelo site. Confirme o seu pedido: o seu nome e o bairro aparecem como estão nele (sem endereço, número ou postcode).</p>
        <div className="avaliar-linha">
          <label className="campo" htmlFor="av-num">Nº do pedido
            <input id="av-num" required inputMode="numeric" maxLength={8} value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder="Ex.: 93" />
          </label>
          <label className="campo" htmlFor="av-tel">Telefone do pedido
            <input id="av-tel" required type="tel" autoComplete="tel" maxLength={20} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="07..." />
          </label>
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="principal" type="submit" disabled={conferindo}>
          <span>{conferindo ? "Conferindo..." : "Confirmar pedido"}</span><span aria-hidden="true">→</span>
        </button>
        <p className="dica">O nº do pedido está na mensagem de confirmação e na página de acompanhamento.</p>
      </form>
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
      <div className="perfil-avaliacao">
        <button type="button" className="perfil-bolinha" onClick={() => inputAvatar.current?.click()} disabled={subindo} aria-label={avatar ? "Trocar sua foto de perfil" : "Colocar sua foto de perfil"}>
          {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{nome.trim().charAt(0).toUpperCase() || "🙂"}</span>}
          <i aria-hidden="true">{avatar ? "✎" : "+"}</i>
        </button>
        <div>
          <strong>Sua foto de perfil <span className="dica">(opcional)</span></strong>
          <span className="dica">Aparece na bolinha ao lado do seu nome, para todo mundo ver que a avaliação é de verdade.</span>
          {avatar && <button type="button" className="perfil-tirar" onClick={() => setAvatar(null)}>Remover foto</button>}
        </div>
        <input ref={inputAvatar} type="file" accept="image/*" hidden onChange={(e) => { escolherFoto(e.target.files?.[0], true); e.target.value = ""; }} />
      </div>
      <div className="avaliar-quem">
        <span aria-hidden="true">🔒</span>
        <span>Vai aparecer como <strong>{ident.nome}{ident.local ? ` · ${ident.local}` : ""}</strong> <span className="dica">(do seu pedido #{ident.numero})</span></span>
      </div>
      <input className="isca" tabIndex={-1} autoComplete="off" aria-hidden="true" value={site} onChange={(e) => setSite(e.target.value)} name="site" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="principal" type="submit" disabled={estado === "enviando" || subindo}>
        <span>{estado === "enviando" ? "Enviando..." : "Enviar avaliação"}</span><span aria-hidden="true">{CARINHAS[nota]}</span>
      </button>
    </form>
  );
}
