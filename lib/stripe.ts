import Stripe from "stripe";

let s: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Pagamento com cartão não está configurado.");
  if (!s) s = new Stripe(process.env.STRIPE_SECRET_KEY);
  return s;
}

export const siteUrl = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
