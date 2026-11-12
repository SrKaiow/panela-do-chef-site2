# Panela do Chef · site de pedidos

Loja online da Panela do Chef: o cliente monta o pedido, escolhe **dinheiro na entrega** ou **cartão** (Stripe, com Apple Pay e Google Pay) e o pedido cai no **painel** (`/painel`).

## Pagamento online pela Square (recomendado)

Usa a mesma conta da maquininha: o dinheiro e os relatórios ficam no painel da Square. O cliente paga na página da Square (cartão, Apple Pay, Google Pay) e volta para o acompanhamento do pedido. O pedido só vai para a cozinha depois que a Square confirma o pagamento.

1. developer.squareup.com → entre com a conta da Square → **Create application** (nome: Panela do Chef site).
2. No app, troque para **Production**. Em **Credentials**, copie o **Production Access token** → na Cloudflare, segredo `SQUARE_ACCESS_TOKEN`.
3. Em **Locations**, copie o **Location ID** da loja → segredo `SQUARE_LOCATION_ID`.
4. Em **Webhooks → Subscriptions → Add subscription** (Production): URL `https://SEU-SITE/api/square/webhook`, eventos `payment.created` e `payment.updated`. Salve e copie a **Signature key** → segredo `SQUARE_WEBHOOK_SIGNATURE_KEY`.
5. Confira se `SITE_URL` é exatamente o endereço do site usado no webhook. Implante de novo.

## Pagamento online (Stripe): cartão e transferência

1. Crie a conta em stripe.com (conta UK, em libras) e ative os pagamentos.
2. Em **Settings → Payment methods**, deixe ligados: Cards, Apple Pay, Google Pay e **Pay by Bank** (é a transferência: o cliente escolhe o banco e aprova no app dele). O site mostra o que estiver ligado lá.
3. Em **Developers → API keys**, copie a **Secret key** (`sk_live_...`) e coloque na Cloudflare (Variables and Secrets) como `STRIPE_SECRET_KEY`.
4. Em **Developers → Webhooks → Add endpoint**: URL `https://SEU-SITE/api/stripe/webhook`, eventos `checkout.session.completed` e `checkout.session.async_payment_succeeded`. Copie o **Signing secret** (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.
5. Faça o deploy de novo. A opção "Pagar agora no site" aparece no checkout.

Depois de pagar, o cliente volta direto para a página de acompanhamento do pedido. O pedido só vai para a cozinha depois de pago.

## Aviso de pedido no WhatsApp da empresa

Cada pedido que entra na cozinha manda uma mensagem para o seu WhatsApp: "PAGO NO SITE" ou "DINHEIRO NA ENTREGA" com o troco já calculado (ex.: troco para £90 → levar £1.50), os itens, o endereço e o telefone do cliente.

1. Siga as instruções em callmebot.com (seção WhatsApp): salve o número deles nos contatos e mande a mensagem de autorização que eles pedem.
2. Eles respondem com a sua **apikey**. Coloque na Cloudflare como `CALLMEBOT_APIKEY` e faça o deploy de novo.
3. Por padrão a mensagem vai para o telefone do painel. Para mandar para outro número, preencha `WHATSAPP_LOJA`.

O painel continua tocando o som de pedido novo, mesmo sem isso.

## Painel da loja (/painel)

Entre em `/painel` com a senha `ADMIN_PASSWORD`. O layout segue o da Square, com as cores da Panela:

- **Início**: vendas, pedidos e ticket médio de hoje, reservas para depois, mais pedidos, e o botão **Fechar a cozinha agora** (acabou o estoque, imprevisto). Clique de novo para reabrir.
- **Pedidos**: chegam sozinhos (ligue o som). Botões na ordem: **Aceitar pedido** → **Começar na cozinha** → **Saiu para entrega** → **Marcar entregue**. Cada clique aparece na hora na tela do cliente.
- **Biblioteca de itens**: busca, filtro por categoria, "Sem foto" e "Esgotados". Clique na pílula para marcar esgotado/disponível. Clique no item para editar nome, preço, preço antigo (riscado), descrição, categoria, modificadores e **foto** (arraste ou escolha do celular; a foto é reduzida sozinha e fica guardada no banco).
- **Modificadores** e **Categorias**: grupos de opções (toppings, sabores) e a ordem das abas do cardápio.
- **Horários e entrega**: horário de cada dia, tempo de preparo, raio, faixas de taxa por milha (iguais às da Square), pedido mínimo, pagamentos e contato.
- **Avaliações**: aprovar ou esconder o que os clientes mandam.

O cardápio começa com o conteúdo de `data/cardapio.json` e os ajustes com `data/loja.json`. Depois da primeira mudança pelo painel, vale o que está no banco.

## Horário automático e reservas

O site abre e fecha sozinho pelo horário de Londres. Fora do horário (ou com a cozinha fechada pelo painel) aparece a faixa **"Cozinha fechada :C pedir amanhã"** com o botão para o cardápio. O cliente monta o pedido e escolhe um horário (de 30 em 30 minutos, nos próximos dois dias de funcionamento): o pedido fica **reservado** e aparece em "Reservas para depois" no painel.

## Página do pedido do cliente

- Quantos pedidos tem na frente dele na cozinha.
- Mensagens a cada etapa: "Pedido aceito!", "A cozinha começou o seu pedido agora", "Saiu para entrega" com a hora que saiu, e a previsão de chegada.
- No mapa: a cozinha, a casa do cliente e a **motinha** andando e virando na direção em que vai, atualizada a cada 4 segundos.

## Avaliações

- Os 9 depoimentos do site antigo ficam em `data/avaliacoes.json` (dá para editar, tirar ou colocar mais).
- Qualquer cliente pode clicar em **"Deixar minha avaliação"** no site. Quem avalia pela página do pedido entregue ganha o selo **"Pedido verificado"**.
- Nada aparece sozinho: as novas chegam no painel, na aba **Avaliações**, e você escolhe **Aprovar e mostrar no site** ou **Não mostrar**. Isso evita spam e avaliação falsa.

## Rastreio do pedido e aviso de 1 minuto

**O que o cliente vê** (no link que ele recebe ao finalizar o pedido):
Pedido recebido → Confirmado → Preparando → Saiu para entrega → Entregue, atualizando sozinho.
Quando sai para entrega, aparece o **mapa ao vivo** com o entregador e o endereço, a distância e o tempo estimado.
Quando o entregador chega a ~1 minuto, o cliente recebe o **aviso no WhatsApp** e a página mostra "Seu pedido está na porta em ~1 minuto". O celular também vibra.

**Como a cozinha usa** (`/painel`): Confirmar pedido → Começar a preparar. O resto o entregador faz.

**Como o entregador usa** (`/entregador`, senha `DRIVER_PASSWORD`, no celular dele):
1. Toca em **Ligar localização** e permite o GPS.
2. Em cada pedido pronto, toca em **Peguei, saindo para entrega**. O cliente recebe o link do rastreio.
3. Usa **Abrir rota no Maps** para navegar.
4. A ~1 minuto do endereço, o aviso vai sozinho. Se o WhatsApp automático não estiver ligado, aparece um botão verde **"Faltando ~1 min: avisar no WhatsApp"** que abre a conversa com a mensagem pronta.
5. Ao entregar, toca em **Entregue** (no dinheiro, **Entregue e recebido**).

Importante: o navegador do celular só manda a localização com **a tela do entregador aberta e o celular desbloqueado**. Use o celular no suporte do carro/moto com a página aberta (a tela fica acesa sozinha enquanto a localização está ligada).

Ajustes em `data/loja.json` > `entrega`: `avisoChegandoMetros` (padrão 450 m ≈ 1 minuto) e `velocidadeMediaKmh` (padrão 25, usado no tempo estimado). A localização do endereço vem do postcode (serviço gratuito postcodes.io).

### Aviso no WhatsApp automático (opcional)

Sem configurar nada, funciona no modo botão: o entregador ou o painel tocam e o WhatsApp abre com a mensagem pronta.
Para o envio sair sozinho, use a **WhatsApp Business Platform (Cloud API)** da Meta:

1. Em [business.facebook.com](https://business.facebook.com), crie um app do tipo Business com o produto **WhatsApp** e adicione o número da Panela do Chef. O número não pode estar em uso no app WhatsApp comum ao mesmo tempo.
2. Crie dois **modelos de mensagem** (categoria *Utility*, idioma *Portuguese (BR)*):
   - `pedido_saiu`: `Oi {{1}}! Seu pedido da Panela do Chef saiu para entrega. Acompanhe ao vivo: {{2}}`
   - `pedido_chegando`: `Oi {{1}}! Seu pedido da Panela do Chef está chegando, falta mais ou menos 1 minuto. Já pode ir até a porta!`
3. Gere um token permanente (System User) e copie o **Phone number ID**.
4. Na Cloudflare (Variables and Secrets), preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_MODELO_SAIU`, `WHATSAPP_MODELO_CHEGANDO`.

A Meta cobra por conversa iniciada pela empresa (valores na página de preços dela).

## Colocar no ar na Cloudflare (grátis, uso comercial permitido)

O site roda na **Cloudflare Workers** (plano Free) pelo adaptador OpenNext. O banco continua no **Turso**.

1. **Turso**: em [turso.tech](https://turso.tech), abra o banco (ou crie um) e copie a URL (`libsql://...`) e um token.
2. **Cloudflare**: dash.cloudflare.com → **Workers & Pages → Create → Workers → Import a repository** (não é "Pages") → escolha `SrKaiow/panela-do-chef-site2`.
   - Nome do projeto: **panela-do-chef-site2** (precisa ser igual ao `name` do `wrangler.jsonc`).
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Branch: `main`.
3. Depois do primeiro deploy, no Worker: **Settings → Variables and Secrets**, adicione (tipo *Secret*):
   `ADMIN_PASSWORD`, `DRIVER_PASSWORD`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, e quando tiver: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CALLMEBOT_APIKEY`.
   Adicione também `SITE_URL` com o endereço do site (ex.: `https://panela-do-chef.SEU-USUARIO.workers.dev`, ou o domínio).
4. Em **Deployments**, rode o deploy de novo para pegar as variáveis.
5. **Domínio** (quando quiser desligar o Square): **Settings → Domains & Routes → Add → Custom domain** → `paneladochef.co.uk`. O domínio precisa estar na Cloudflare (ela mostra como mudar os nameservers).

Cada envio para a `main` publica sozinho. Sem `STRIPE_SECRET_KEY`, o site funciona só com dinheiro na entrega.

Para testar no motor da Cloudflare no computador: copie `.dev.vars.example` para `.dev.vars`, preencha e rode `npm run preview`.

## Segurança

- Painel e tela do entregador só com senha; 8 tentativas erradas por IP travam o login por 15 minutos.
- Limite de pedidos (6 a cada 10 min e 20 por hora por IP), de avaliações (5 por hora) e de consulta de entrega.
- Campo-isca contra robôs no pedido e na avaliação.
- Envios para a API só aceitos vindos do próprio site (exceto o aviso assinado da Stripe).
- Preço e taxa sempre recalculados no servidor; o navegador não decide valor.
- Fotos conferidas pelo conteúdo (só JPG, PNG e WebP de verdade).
- Cabeçalhos de segurança (CSP, sem iframe, HSTS, nosniff) e sem revelar a tecnologia do site.
- Erros internos nunca aparecem para o cliente.
- Senhas e chaves só nas Variáveis e segredos da Cloudflare, nunca no código.

## Rodar no computador

```bash
cp .env.example .env.local   # preencha a senha
npm install
npm run dev                  # loja: /  ·  painel: /painel  ·  entregador: /entregador
```

## Estrutura

```
data/cardapio.json   cardápio (o que você mais vai mexer)
data/loja.json       taxa de entrega, aberto/fechado, pagamentos, contatos
app/page.tsx         página da loja
app/painel/          painel de pedidos
app/api/pedidos/     cria o pedido (confere preços no servidor) e abre o Stripe
lib/                 cardápio, banco, login do painel, Stripe
```

Os preços sempre são recalculados no servidor a partir do `cardapio.json`, então ninguém consegue mudar o valor pelo navegador.
