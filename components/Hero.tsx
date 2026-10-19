import { loja } from "@/lib/cardapio";

export default function Hero({ dinheiro, cartao }: { dinheiro: boolean; cartao: boolean }) {
  const pagamento = dinheiro && cartao ? "Dinheiro na entrega ou cartão" : dinheiro ? "Dinheiro na entrega" : "Cartão, Apple Pay e Google Pay";
  return (
    <header className="hero">
      <nav className="nav-topo" aria-label="Topo">
        <div className="miolo">
          <a className="logo-img" href="#">
            <img src="/fotos/logo-panela-do-chef.png" alt="Panela do Chef" />
          </a>
          <div className="nav-direita">
            <a className="nav-link" href="#cardapio">Cardápio</a>
            <a className="nav-link" href="#quanto-pedir">Quanto pedir?</a>
            <span className={"status" + (loja.aberto ? "" : " fechado")}>
              <span className="ponto" aria-hidden="true" />
              {loja.aberto ? "Aberto agora" : "Fechado agora"}
            </span>
          </div>
        </div>
      </nav>

      <div className="miolo hero-grade">
        <div className="hero-texto">
          <p className="welcome">Welcome to</p>
          <h1 className="brazil">Brazil</h1>
          <p className="slogan">{loja.slogan}</p>
          <div className="cta">
            <a className="botao" href="#cardapio">Fazer meu pedido →</a>
            <a className="botao vazado" href="#quanto-pedir">Quanto devo pedir?</a>
          </div>
          <ul className="prova">
            <li><strong>{loja.clientesSatisfeitos}</strong> clientes satisfeitos</li>
            <li><span className="estrela" aria-hidden="true">★</span> <strong>5,0</strong> nas avaliações</li>
            <li>{pagamento}</li>
          </ul>
        </div>

        <figure className="hero-visual">
          <div className="hero-brilho" aria-hidden="true" />
          <img src="/fotos/chef-kaio-flambando.jpg" alt="Chef Kaio flambando na frigideira" />
          <figcaption className="cartao-flutua cima">
            <span className="tag-fogo">Feito na hora</span>
            <strong>Chef Kaio</strong>
          </figcaption>
          <div className="cartao-flutua baixo" aria-hidden="true">
            <strong>Pastel gigante</strong>
            <span>até 700g só de recheio</span>
          </div>
        </figure>
      </div>
    </header>
  );
}

export function Faixa() {
  const frases = ["Pastel gigante", "Açaí de verdade", "Batata top", "Feito na hora", "Sabor de Goiás", "Entrega quentinha"];
  const todas = [...frases, ...frases]; // duplicado para o loop não ter emenda
  return (
    <div className="faixa" aria-hidden="true">
      <div className="faixa-trilho">
        {[...todas, ...todas].map((f, i) => <span key={i}>{f}</span>)}
      </div>
    </div>
  );
}
