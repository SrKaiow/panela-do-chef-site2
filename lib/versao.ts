/**
 * Telas que ficam abertas por horas (painel, entregador, acompanhamento): quando sai uma versão nova
 * do site, aparece uma faixa "Toque para atualizar". Não recarrega sozinho porque o recarregamento
 * desligaria o som do painel, o GPS do entregador e o alarme de coleta (precisam de um toque).
 */
let avisado = false;

export function conferirVersao(r: Response) {
  try {
    const nova = r.headers.get("x-versao-site");
    const minha = process.env.VERSAO_SITE;
    if (avisado || !nova || !minha || nova === minha) return;
    avisado = true;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "🔄 Site atualizado: toque aqui para carregar a versão nova";
    b.setAttribute(
      "style",
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;padding:14px 16px;border:0;border-radius:14px;" +
        "background:#ffd814;color:#111;font:800 15px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);cursor:pointer",
    );
    b.onclick = () => window.location.reload();
    document.body.appendChild(b);
  } catch {
    /* segue com a tela atual */
  }
}
