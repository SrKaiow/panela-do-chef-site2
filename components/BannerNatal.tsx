/** Banner da Ceia de Natal no topo da página inicial, de ponta a ponta. Leva para a página de montar o kit. */
export default function BannerNatal() {
  return (
    <a href="/natal" className="bn" aria-label="Ceia de Natal: monte o seu kit natalino">
      <span className="bn-foto" aria-hidden="true" />
      <span className="bn-miolo">
        <span className="bn-noel" aria-hidden="true">🎅</span>
        <span className="bn-textos">
          <span className="bn-sobre">Ceia de Natal · Panela do Chef</span>
          <strong className="bn-titulo">Monte o seu kit natalino</strong>
          <span className="bn-sub">Ceias completas: Chester, peru, pernil, carnes recheadas e porções. Encomendas até 20/12 às 22h · entrega grátis até 9 milhas.</span>
        </span>
        <span className="bn-botao">Montar minha ceia <span aria-hidden="true">→</span></span>
      </span>
    </a>
  );
}
