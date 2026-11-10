import Stripe from "stripe";

let s: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Pagamento com cartão não está configurado.");
  if (!s) s = new Stripe(process.env.STRIPE_SECRET_KEY);
  return s;
}

/** Endereço do site. Usa SITE_URL; se vazio, o endereço de onde veio o pedido (ex.: o link da Vercel). */
export const siteUrl = (req?: Request) => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (req) {
    const h = req.headers;
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
};
