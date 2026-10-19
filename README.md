# Panela do Chef · site de pedidos

Loja online da Panela do Chef: o cliente monta o pedido, escolhe **dinheiro na entrega** ou **cartão** (Stripe, com Apple Pay e Google Pay) e o pedido cai no **painel** (`/painel`).

## Mudar cardápio e preços (o dia a dia)

Tudo fica em **um arquivo**: `data/cardapio.json`. Edite pelo próprio GitHub (ícone de lápis) e salve; a Vercel publica sozinha em ~1 minuto.

| Quero... | Faço |
|---|---|
| Mudar preço | troque `"preco": 9.0` |
| Colocar em promoção | `"preco": 7.0, "precoAntigo": 10.0` (aparece riscado + selo Promoção) |
| Marcar esgotado | `"disponivel": false` (volta com `true`) |
| Esgotar um adicional | na opção, `{ "nome": "Camarão", "esgotado": true }` |
| Cobrar por um adicional | `{ "nome": "Nutella extra", "preco": 1.5 }` |
| Item novo | copie um bloco `{ ... }` dentro de `"itens"` e troque `id`, `nome`, `preco` |
| Foto do item | coloque a imagem em `public/fotos/` e use `"imagem": "/fotos/pastel-carne.jpg"` |

Antes de salvar, se quiser conferir: `npm run verificar-cardapio` (aponta vírgula faltando, categoria errada etc.).

**"Quanto devo pedir?"**: a fala do Chef (o pastel com 700g de recheio) fica em `falaDoChef` no `data/loja.json`. A conta de quanto cada pessoa come fica em `lib/fome.ts` (`NIVEIS`): 1 porção = 1 pastel gigante ou 1 batata top. A logo usada no site fica em `public/fotos/logo-panela-do-chef.png`; fotos e vídeos ficam em `public/fotos` e `public/videos`.

Configurações da loja ficam em `data/loja.json`: aberto/fechado, **taxa de entrega**, pedido mínimo, região, quais pagamentos aceitar e contatos.

## Painel de pedidos

Acesse `/painel` com a senha `ADMIN_PASSWORD`. Ele atualiza sozinho a cada 15 segundos, toca um alerta em pedido novo (clique em "Ligar som") e mostra:

- **Dinheiro**: quanto cobrar e quanto levar de troco para o driver.
- **Cartão**: se já foi pago. Pedido no cartão só aparece em "Ativos" depois de pago.
- Botões para avançar: Novo → Preparando → Saiu para entrega → Entregue, e link direto para o WhatsApp do cliente e o mapa.

O cliente acompanha o status pelo link que recebe ao finalizar o pedido.

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
4. Na Vercel, preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_MODELO_SAIU`, `WHATSAPP_MODELO_CHEGANDO`.

A Meta cobra por conversa iniciada pela empresa (valores na página de preços dela).

## Colocar no ar (uma vez)

1. **Repositório**: crie um repositório novo no GitHub (ex.: `SrKaiow/panela-do-chef-site`) e suba esta pasta.
2. **Banco de dados (grátis)**: crie uma conta no [Turso](https://turso.tech), crie um banco e copie a URL (`libsql://...`) e o token.
3. **Stripe**: em [dashboard.stripe.com](https://dashboard.stripe.com) > Developers > API keys, copie a *Secret key* (`sk_live_...`). Para testar antes, use a `sk_test_...` e o cartão 4242 4242 4242 4242.
4. **Vercel**: importe o repositório em [vercel.com](https://vercel.com) e preencha as variáveis de `.env.example`:
   `SITE_URL`, `ADMIN_PASSWORD`, `DRIVER_PASSWORD`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `STRIPE_SECRET_KEY`.
5. **Webhook do Stripe (recomendado)**: Developers > Webhooks > Add endpoint → `https://SEU-SITE/api/stripe/webhook`, evento `checkout.session.completed`. Cole o *Signing secret* em `STRIPE_WEBHOOK_SECRET`.
6. **Domínio**: na Vercel, Settings > Domains, adicione `paneladochef.co.uk` e aponte o DNS conforme ela indicar. Só faça isso quando quiser desligar o site do Square.

Sem `STRIPE_SECRET_KEY`, o site funciona só com dinheiro na entrega.

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
