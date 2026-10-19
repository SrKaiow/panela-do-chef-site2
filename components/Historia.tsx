/** Seções com fotos e vídeos reais: a cozinha e a história do Chef Kaio. Arquivos em public/fotos e public/videos. */

export function NaCozinha() {
  return (
    <section className="cozinha" aria-labelledby="cozinha-titulo">
      <div className="miolo cozinha-grade">
        <div className="cozinha-texto">
          <p className="olho">Direto da nossa cozinha</p>
          <h2 id="cozinha-titulo" className="titulo-secao">Feito na hora, <em>no fogo alto</em></h2>
          <p>
            Nada de comida parada no balcão. Cada pedido sai da panela do Chef Kaio na hora em que você pede,
            com tempero de casa e ingrediente de verdade.
          </p>
          <ul className="provas">
            <li><strong>Pastel gigante</strong><span>recheio de verdade, frito na hora</span></li>
            <li><strong>Tempero goiano</strong><span>pequi, gueroba e o sabor raiz de Goiás</span></li>
            <li><strong>Entrega quentinha</strong><span>da nossa cozinha direto pra sua porta</span></li>
          </ul>
        </div>
        <div className="cozinha-midia">
          <figure className="midia alta">
            <video src="/videos/cozinha-flambado.mp4" poster="/fotos/cozinha-flambado-capa.jpg" autoPlay muted loop playsInline preload="metadata" aria-label="Legumes flambando na frigideira" />
          </figure>
          <figure className="midia">
            <video src="/videos/cozinha-chef.mp4" poster="/fotos/cozinha-chef-capa.jpg" autoPlay muted loop playsInline preload="metadata" aria-label="Chef Kaio cozinhando no fogão" />
          </figure>
          <figure className="midia">
            <img src="/fotos/chef-kaio-cozinha.jpg" alt="Chef Kaio na cozinha fazendo sinal de positivo" loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
}

export function SobreChef() {
  return (
    <section className="sobre" aria-labelledby="sobre-titulo">
      <div className="sobre-fundo" aria-hidden="true" />
      <div className="miolo sobre-grade">
        <figure className="sobre-foto">
          <img src="/fotos/chef-kaio-bracos-cruzados.jpg" alt="Chef Kaio Martins de dólmã preto com a bandeira do Brasil" loading="lazy" />
          <figcaption>Kaio Martins, o Chef Kaio</figcaption>
        </figure>
        <div className="sobre-texto">
          <p className="olho">Quem cozinha pra você</p>
          <h2 id="sobre-titulo" className="titulo-secao">De Goiás <em>a Londres</em></h2>
          <p>
            O Chef Kaio trouxe na mala o sabor de casa: o pastel crocante, o açaí bem servido e o tempero goiano
            que é difícil de achar no Reino Unido. A Panela do Chef nasceu pra matar a saudade de quem
            é brasileiro e apresentar o Brasil de verdade pra quem ainda não conhece.
          </p>
          <div className="revista">
            <img src="/fotos/revista-convida-marketing.jpg" alt="Capa da revista Convida Marketing com o Chef Kaio" loading="lazy" />
            <div>
              <span className="tag promo">Na capa</span>
              <strong>Revista Convida Marketing · Edição 06, julho de 2026</strong>
              <span>A história de como Kaio Martins construiu uma marca de gastronomia brasileira no Reino Unido.</span>
            </div>
          </div>
          <a className="botao" href="#cardapio">Provar o sabor do Chef →</a>
        </div>
      </div>
    </section>
  );
}
