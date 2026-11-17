/**
 * Cartão fidelidade na página do pedido.
 * A mão desce com o carimbo da Panela do Chef, carimba o espaço do pedido de hoje e sai.
 * Os espaços ainda não conquistados ficam com cadeado.
 */

/** Marca de tinta do carimbo (anel com o nome e a panela no meio). */
function Tinta({ giro = 0 }: { giro?: number }) {
  return (
    <svg className="tinta" viewBox="0 0 100 100" style={{ ["--giro" as string]: `${giro}deg` }} aria-hidden="true">
      <defs>
        <filter id="tinta-falha" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="ruido" />
          <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" result="buracos" />
          <feComposite in="SourceGraphic" in2="buracos" operator="in" result="falhado" />
          <feDisplacementMap in="falhado" in2="ruido" scale="1.6" />
        </filter>
        <path id="anel-cima" d="M 17 50 A 33 33 0 0 1 83 50" />
        <path id="anel-baixo" d="M 14 50 A 36 36 0 0 0 86 50" />
      </defs>
      <g filter="url(#tinta-falha)" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="46" strokeWidth="3.2" />
        <circle cx="50" cy="50" r="40.5" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="23" strokeWidth="1.4" />
        <text fill="currentColor" stroke="none" fontSize="9.6" fontWeight="900" letterSpacing="1.4" fontFamily="var(--fonte-titulo), Impact, sans-serif">
          <textPath href="#anel-cima" startOffset="50%" textAnchor="middle">PANELA DO CHEF</textPath>
        </text>
        <text fill="currentColor" stroke="none" fontSize="7.4" fontWeight="900" letterSpacing="1.6" fontFamily="var(--fonte-titulo), Impact, sans-serif">
          <textPath href="#anel-baixo" startOffset="50%" textAnchor="middle">★ FIDELIDADE ★</textPath>
        </text>
        {/* panela com chama */}
        <g fill="currentColor" stroke="none">
          <path d="M37 50 h26 a3 3 0 0 1 0 0 v2 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10 v-2 z" />
          <rect x="33" y="48" width="34" height="3" rx="1.5" />
          <rect x="62" y="49" width="10" height="2.4" rx="1.2" />
          <path d="M50 46 c-4 -3 -3 -7 0 -10 c0 3 3 3 3 6 c1 -1 1 -3 1 -4 c3 3 2 7 -1 8 z" />
        </g>
      </g>
    </svg>
  );
}

/** A mão segurando o carimbo de madeira. */
function MaoCarimbo() {
  return (
    <svg className="mao-carimbo" viewBox="0 0 120 170" aria-hidden="true">
      <defs>
        <linearGradient id="madeira" x1="0" x2="1">
          <stop offset="0" stopColor="#7a4a22" />
          <stop offset=".45" stopColor="#c08048" />
          <stop offset="1" stopColor="#6a3c18" />
        </linearGradient>
        <linearGradient id="pele" x1="0" x2="1">
          <stop offset="0" stopColor="#c98f63" />
          <stop offset=".5" stopColor="#e2ad81" />
          <stop offset="1" stopColor="#b97e53" />
        </linearGradient>
        <linearGradient id="borracha" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#111" />
        </linearGradient>
      </defs>
      {/* braço/punho */}
      <path d="M44 0 h34 l-2 46 h-30 z" fill="url(#pele)" />
      <rect x="40" y="2" width="42" height="14" rx="4" fill="#f4f1ea" />
      {/* mão fechada em volta do cabo */}
      <path d="M30 46 q0 -8 10 -8 h42 q10 0 10 9 v16 q0 9 -9 9 h-44 q-9 0 -9 -9 z" fill="url(#pele)" />
      <g stroke="#a8714a" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".75">
        <path d="M43 52 v14" /><path d="M54 51 v15" /><path d="M65 51 v15" /><path d="M76 52 v13" />
      </g>
      {/* polegar */}
      <path d="M28 52 q-8 2 -6 12 q2 8 12 6 l8 -3 v-12 z" fill="url(#pele)" />
      {/* cabo de madeira */}
      <rect x="49" y="72" width="22" height="34" rx="4" fill="url(#madeira)" />
      <ellipse cx="60" cy="74" rx="15" ry="5" fill="url(#madeira)" />
      {/* base do carimbo */}
      <rect x="16" y="104" width="88" height="26" rx="6" fill="url(#madeira)" />
      <rect x="20" y="128" width="80" height="14" rx="3" fill="url(#borracha)" />
      <rect x="22" y="140" width="76" height="4" rx="2" fill="#FFD814" opacity=".9" />
      {/* etiqueta no carimbo */}
      <rect x="40" y="110" width="40" height="13" rx="3" fill="#111" opacity=".85" />
      <text x="60" y="119.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#FFD814" fontFamily="var(--fonte-titulo), Impact, sans-serif" letterSpacing=".6">PANELA</text>
    </svg>
  );
}

const Cadeado = () => (
  <svg viewBox="0 0 24 24" width="40%" height="40%" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

// Giros fixos para os carimbos antigos (cada um um pouquinho torto, como carimbo de verdade).
const GIROS = [-12, 8, -4, 14, -9, 5, -15, 10, -6, 12, -3, 7, -11, 9, -7, 4, -13, 11, -5, 6];

export default function CartaoFidelidade({ carimbos, meta }: { carimbos: number; meta: number }) {
  const feitos = Math.min(carimbos, meta);
  const completo = carimbos >= meta;
  const faltam = meta - feitos;
  return (
    <section className="fidelidade" aria-labelledby="fid-titulo">
      <div className="fid-cab">
        <div>
          <span className="fid-kicker">Cartão fidelidade</span>
          <h2 id="fid-titulo">{completo ? "Cartão completo!" : "Parabéns! Você ganhou um carimbo"}</h2>
          <p>
            {completo
              ? "Você completou o seu cartão fidelidade. Tem um brinde da nossa cozinha esperando por você!"
              : `Ao completar ${meta} carimbos pedindo pelo site, você ganha um brinde da nossa cozinha.`}
          </p>
        </div>
      </div>

      <div className="fid-cartela" role="img" aria-label={`${feitos} de ${meta} carimbos`}>
        {Array.from({ length: meta }, (_, i) => {
          const tem = i < feitos;
          const novo = i === feitos - 1;
          return (
            <span key={i} className={"fid-casa" + (tem ? " cheia" : " trancada") + (novo ? " nova" : "")}>
              {tem ? <Tinta giro={GIROS[i % GIROS.length]} /> : <Cadeado />}
              {!tem && <small>{i + 1}</small>}
              {novo && <MaoCarimbo />}
            </span>
          );
        })}
      </div>

      <p className="fid-faltam">
        {completo
          ? "🎁 Fale com a gente no WhatsApp para receber o seu brinde."
          : faltam === 1
            ? "Faça o próximo pedido para completar o cartão e ganhar o brinde!"
            : `Faça o próximo pedido para liberar o próximo carimbo. Faltam ${faltam}.`}
      </p>
    </section>
  );
}
