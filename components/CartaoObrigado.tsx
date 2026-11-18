/**
 * Cartão "Obrigado" colorido, na página do pedido (junto com o cartão fidelidade).
 * Logo, bandeira do Brasil e as cores da marca. Não vai para a impressora.
 */
function Losango() {
  return (
    <svg className="ob-los" viewBox="0 0 12 8" aria-hidden="true">
      <polygon points="6,0.6 11.4,4 6,7.4 0.6,4" />
    </svg>
  );
}

function Emblema() {
  return (
    <svg className="ob-emb" viewBox="0 0 200 22" aria-hidden="true">
      <line className="fio" x1="4" y1="11" x2="76" y2="11" />
      <line className="fio" x1="124" y1="11" x2="196" y2="11" />
      <circle className="ponto" cx="70" cy="11" r="1.8" />
      <circle className="ponto" cx="130" cy="11" r="1.8" />
      <rect className="ret" x="84" y="2" width="32" height="18" rx="1.5" />
      <polygon className="los" points="100,4.2 113.5,11 100,17.8 86.5,11" />
      <circle className="glo" cx="100" cy="11" r="4.6" />
      <path className="fx" d="M95.6 10.2 Q100 8.4 104.5 11.6" />
    </svg>
  );
}

export default function CartaoObrigado({ nome }: { nome: string }) {
  const p = (nome.trim().split(/\s+/)[0] || "").toLowerCase();
  const primeiro = p.charAt(0).toUpperCase() + p.slice(1);
  return (
    <section className="cartao-obrigado" aria-label="Obrigado pelo seu pedido">
      <img className="ob-logo" src="/fotos/logo-cartao-cor.png" alt="Panela do Chef" />
      <div className="ob-sub"><Losango /> SABORES DO BRASIL EM LONDRES <Losango /></div>
      <Emblema />
      <div className="ob-titulo">OBRIGADO</div>
      <div className="ob-pelo">pelo seu pedido,</div>
      {primeiro && <div className="ob-nome">{primeiro}!</div>}
      <p className="ob-texto">Foi um prazer cozinhar pra você. Cada pedido é feito na hora, com o tempero de casa.</p>
      <Emblema />
      <div className="ob-assina">Chef Kaio</div>
      <div className="ob-cargo">FUNDADOR &amp; CHEF</div>
      <div className="ob-insta">@ochefkaio</div>
    </section>
  );
}
