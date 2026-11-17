/** Cartão fidelidade na página do pedido: o carimbo que o cliente acabou de ganhar. */
export default function CartaoFidelidade({ carimbos, meta }: { carimbos: number; meta: number }) {
  const completo = carimbos >= meta;
  const faltam = meta - carimbos;
  return (
    <section className="fidelidade" aria-labelledby="fid-titulo">
      <div className="fid-cab">
        <span className="fid-icone" aria-hidden="true">🎁</span>
        <div>
          <h2 id="fid-titulo">{completo ? "Cartão completo!" : "Parabéns! Você ganhou um carimbo no seu cartão fidelidade"}</h2>
          <p>
            {completo
              ? "Você completou o seu cartão fidelidade. Tem um brinde da nossa cozinha esperando por você!"
              : `Ao completar ${meta} pedidos pelo site, você ganha um brinde da nossa cozinha.`}
          </p>
        </div>
      </div>
      <div className="fid-carimbos" role="img" aria-label={`${Math.min(carimbos, meta)} de ${meta} carimbos`}>
        {Array.from({ length: meta }, (_, i) => (
          <span key={i} className={(i < carimbos ? "cheio" : "") + (i === Math.min(carimbos, meta) - 1 ? " novo" : "")}>{i < carimbos ? "" : i + 1}</span>
        ))}
      </div>
      {!completo && <p className="fid-faltam">{faltam === 1 ? "Falta só 1 pedido!" : `Faltam ${faltam} pedidos`}</p>}
    </section>
  );
}
