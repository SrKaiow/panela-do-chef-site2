/** Reduz a foto no navegador (lado maior até `lado` px, WebP) antes de enviar: sobe rápido e o site carrega leve. */
export async function reduzirFoto(arquivo: File, lado = 1200): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não consegui abrir essa foto. Tente uma JPG ou PNG."));
      i.src = url;
    });
    const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const gerar = (tipo: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
    let b = await gerar("image/webp", 0.82);
    if (!b || b.type !== "image/webp") b = await gerar("image/jpeg", 0.85);
    if (!b) throw new Error("Não consegui preparar a foto.");
    return b;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto de perfil: recorta o meio em quadrado (como no WhatsApp) e reduz para `lado` px. */
export async function fotoPerfil(arquivo: File, lado = 400): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("Não consegui abrir essa foto. Tente uma JPG ou PNG."));
      i.src = url;
    });
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    const l = Math.min(lado, m);
    const c = document.createElement("canvas");
    c.width = l;
    c.height = l;
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, l, l);
    const gerar = (tipo: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
    let b = await gerar("image/webp", 0.85);
    if (!b || b.type !== "image/webp") b = await gerar("image/jpeg", 0.88);
    if (!b) throw new Error("Não consegui preparar a foto.");
    return b;
  } finally {
    URL.revokeObjectURL(url);
  }
}
