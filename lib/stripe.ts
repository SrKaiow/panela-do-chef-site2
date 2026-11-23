import type Stripe from "stripe";

// O pacote da Stripe só é carregado quando alguém usa a Stripe (hoje o cartão é pela Square).
// Assim ele não pesa no início de todas as outras páginas.
let s: Stripe | null = null;
export async function stripe(): Promise<Stripe> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Pagamento com cartão não está configurado.");
  if (!s) {
    const { default: StripeSdk } = await import("stripe");
    // fetch e Web Crypto: funciona igual no Node e na Cloudflare.
    s = new StripeSdk(process.env.STRIPE_SECRET_KEY, { httpClient: StripeSdk.createFetchHttpClient() });
  }
  return s;
}

export { siteUrl } from "./site";
