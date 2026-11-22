"use client";

import { useEffect, useState } from "react";

/**
 * Gera o PDF da fatura no próprio celular e abre o "Compartilhar" (escolhe o WhatsApp e o cliente).
 * No computador, baixa o PDF e abre o WhatsApp Web com a mensagem para anexar.
 */
export default function BotoesFatura({ arquivo, mensagem, linkZap }: { arquivo: string; mensagem: string; linkZap: string | null }) {
  const [estado, setEstado] = useState<"" | "gerando" | "erro">("");

  // A folha é sempre A4 (794 px); no celular só diminui na tela, para o PDF sair igual.
  useEffect(() => {
    const ajustar = () => document.documentElement.style.setProperty("--fat-zoom", String(Math.min(1, (window.innerWidth - 16) / 794)));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  async function gerarPdf(): Promise<File> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const folha = document.querySelector(".fat-folha") as HTMLElement;
    const canvas = await html2canvas(folha, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: 900,
      onclone: (doc) => doc.documentElement.style.setProperty("--fat-zoom", "1"),
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const largura = 210;
    const altura = (canvas.height * largura) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    // Fatura comprida: continua nas páginas seguintes.
    let y = 0;
    pdf.addImage(img, "JPEG", 0, y, largura, altura);
    while (altura + y > 298) {
      y -= 297;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, y, largura, altura);
    }
    return new File([pdf.output("blob")], arquivo, { type: "application/pdf" });
  }

  async function compartilhar() {
    setEstado("gerando");
    try {
      const pdf = await gerarPdf();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [pdf] })) {
        try {
          await nav.share({ files: [pdf], text: mensagem });
        } catch {
          /* fechou o compartilhar */
        }
      } else {
        baixar(pdf);
        if (linkZap) window.open(linkZap, "_blank", "noopener");
      }
      setEstado("");
    } catch (e) {
      console.error("[fatura]", e);
      setEstado("erro");
    }
  }

  async function soBaixar() {
    setEstado("gerando");
    try {
      baixar(await gerarPdf());
      setEstado("");
    } catch (e) {
      console.error("[fatura]", e);
      setEstado("erro");
    }
  }

  function baixar(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="fat-botoes">
      <button type="button" className="fat-zap" onClick={compartilhar} disabled={estado === "gerando"}>
        {estado === "gerando" ? "Gerando o PDF..." : "📲 Enviar PDF no WhatsApp"}
      </button>
      <button type="button" className="fat-sec" onClick={soBaixar} disabled={estado === "gerando"}>⬇ Baixar PDF</button>
      <button type="button" className="fat-sec" onClick={() => window.print()}>🖨 Imprimir</button>
      {estado === "erro" && <p className="fat-erro">Não consegui gerar o PDF aqui. Use &quot;Imprimir&quot; e escolha &quot;Salvar como PDF&quot;.</p>}
      <p className="fat-dica">No celular: toque em &quot;Enviar PDF no WhatsApp&quot;, escolha o WhatsApp e o cliente. No computador o PDF é baixado e o WhatsApp abre com a mensagem: é só anexar.</p>
    </div>
  );
}
