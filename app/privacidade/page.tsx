import type { Metadata } from "next";
import { getAjustes } from "@/lib/dados";
import { telefoneBonito } from "@/lib/ajustes";

export const metadata: Metadata = {
  title: "Política de privacidade | Panela do Chef",
  description: "Como a Panela do Chef usa e protege os seus dados.",
};

export const dynamic = "force-dynamic";

const ATUALIZADA = "11 de novembro de 2026";

export default async function Privacidade() {
  const a = await getAjustes();
  const email = <a href={`mailto:${a.email}`}>{a.email}</a>;

  return (
    <main className="texto-legal">
      <a className="voltar" href="/">← Voltar para o cardápio</a>
      <h1>Política de privacidade</h1>
      <p>Atualizada em {ATUALIZADA}. <a href="#english">English version below.</a></p>

      <h2>Quem somos</h2>
      <p>
        <strong>Panela do Chef</strong> (Panela do Chef LTD), cozinha brasileira com entrega em {a.entrega.regiao}. Somos os
        responsáveis pelos seus dados. Fale com a gente pelo e-mail {email} ou pelo WhatsApp {telefoneBonito(a.telefone)}.
      </p>

      <h2>Quais dados usamos</h2>
      <ul>
        <li><strong>Para entregar o seu pedido:</strong> nome, telefone, endereço, postcode, observações e o que você pediu.</li>
        <li><strong>Pagamento:</strong> se você pagar no site, o cartão é digitado na página da Stripe. Nós nunca vemos nem guardamos o número do cartão; recebemos só a confirmação de que o pagamento entrou.</li>
        <li><strong>Avaliações:</strong> se você avaliar um pedido, o primeiro nome, a nota e o texto aparecem no site depois da nossa aprovação.</li>
        <li><strong>Segurança:</strong> o endereço de internet (IP) é usado por pouco tempo para barrar tentativas de abuso, como pedidos falsos em massa, e é apagado automaticamente.</li>
        <li><strong>No seu aparelho:</strong> o carrinho fica guardado só no seu navegador até você finalizar o pedido.</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Preparar e entregar o pedido e falar com você sobre ele (por exemplo, avisar pelo WhatsApp quando o entregador estiver chegando).</li>
        <li>Mostrar o andamento do pedido na página de acompanhamento, que só abre com o link enviado para você.</li>
        <li>Cumprir obrigações legais, como registros de vendas para impostos.</li>
        <li>Proteger o site contra fraude e abuso.</li>
      </ul>
      <p>
        A base legal é a execução do seu pedido (contrato), as nossas obrigações legais e o nosso interesse legítimo em manter o site seguro.
        Não vendemos os seus dados e não usamos cookies de propaganda nem de rastreamento.
      </p>

      <h2>Com quem compartilhamos</h2>
      <p>Só com os serviços que fazem o site funcionar, e só o necessário:</p>
      <ul>
        <li><strong>Cloudflare:</strong> hospedagem do site.</li>
        <li><strong>Turso:</strong> banco de dados onde ficam os pedidos.</li>
        <li><strong>Stripe:</strong> pagamentos online.</li>
        <li><strong>postcodes.io:</strong> recebe só o postcode, para calcular a distância e a taxa de entrega.</li>
        <li><strong>WhatsApp:</strong> mensagens sobre o pedido para você e para a nossa cozinha.</li>
        <li><strong>OpenStreetMap:</strong> mapa da entrega na página do pedido.</li>
      </ul>
      <p>Alguns desses serviços guardam dados fora do Reino Unido, sempre com as proteções que a lei exige.</p>

      <h2>Por quanto tempo guardamos</h2>
      <p>
        Os registros de pedidos ficam guardados por até 6 anos, que é o prazo exigido para registros de vendas no Reino Unido. Os dados de segurança
        (IP) são apagados em até um dia. As avaliações ficam no site até você pedir para tirar.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir uma cópia dos seus dados, corrigir, apagar (quando não formos obrigados por lei a guardar) ou se opor ao uso. É só
        escrever para {email}. Se não ficar satisfeito, você pode reclamar no ICO, o órgão de proteção de dados do Reino Unido:{" "}
        <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        O site não usa cookies para clientes. O carrinho fica guardado no próprio navegador. Só a equipe usa um cookie de login, necessário
        para entrar no painel da loja.
      </p>

      <hr />

      <section id="english" lang="en">
        <h1>Privacy policy</h1>
        <p>Last updated: 11 November 2026.</p>
        <h2>Who we are</h2>
        <p>
          <strong>Panela do Chef</strong> (Panela do Chef LTD) is the controller of your data. Contact us at {email} or on WhatsApp{" "}
          {telefoneBonito(a.telefone)}.
        </p>
        <h2>What we collect and why</h2>
        <ul>
          <li><strong>To deliver your order:</strong> name, phone, address, postcode, notes and the items ordered.</li>
          <li><strong>Payments:</strong> card details are entered on Stripe&apos;s page. We never see or store your card number.</li>
          <li><strong>Reviews:</strong> first name, rating and text, shown on the site after approval.</li>
          <li><strong>Security:</strong> your IP address is used briefly to stop abuse (such as fake orders) and deleted automatically.</li>
          <li><strong>On your device:</strong> your basket is kept in your own browser until you place the order.</li>
        </ul>
        <p>
          Lawful bases: performance of a contract, legal obligations and our legitimate interest in keeping the site secure. We do not sell your
          data and we use no advertising or tracking cookies.
        </p>
        <h2>Who we share it with</h2>
        <p>
          Only the services that run the site: Cloudflare (hosting), Turso (database), Stripe (payments), postcodes.io (postcode only, to work out
          the delivery fee), WhatsApp (order messages) and OpenStreetMap (delivery map). Some of them store data outside the UK, with the
          safeguards required by law.
        </p>
        <h2>How long we keep it</h2>
        <p>Order records: up to 6 years (UK record-keeping rules). Security data (IP): up to one day. Reviews: until you ask us to remove them.</p>
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of your data, or for it to be corrected or erased (unless we must keep it by law), or object to its use, by
          emailing {email}. You can also complain to the ICO:{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk</a>.
        </p>
        <h2>Cookies</h2>
        <p>Customers get no cookies. Your basket is stored in your browser. Staff use one login cookie, strictly necessary for the shop panel.</p>
      </section>

      <hr />
      <a className="voltar" href="/">← Voltar para o cardápio</a>
    </main>
  );
}
