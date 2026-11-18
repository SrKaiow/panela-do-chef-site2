/**
 * Cabeçalhos de segurança aplicados a todas as páginas.
 * - CSP: o navegador só carrega scripts, estilos, imagens e conexões das origens listadas.
 * - Sem iframe de outros sites (contra golpes de "clique sequestrado").
 * - Sem revelar a tecnologia do site (sem X-Powered-By).
 */
const csp = [
  "default-src 'self'",
  // Square (Apple Pay / Google Pay no site): web.squarecdn.com, pci-connect.squareup.com e Google Pay.
  "script-src 'self' 'unsafe-inline' https://unpkg.com https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pay.google.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.gstatic.com https://*.googleusercontent.com https://pay.google.com",
  "font-src 'self' data: https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  "media-src 'self'",
  "connect-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com https://o160250.ingest.sentry.io https://pay.google.com https://google.com",
  // Próprio site (o painel usa um quadro escondido para imprimir o recibo) e os quadros seguros da Square/Google Pay.
  "frame-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pay.google.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const seguranca = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), payment=(self "https://pay.google.com" "https://web.squarecdn.com"), usb=(), geolocation=(self)' },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const privado = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [{ source: "/.well-known/apple-developer-merchantid-domain-association", destination: "/api/square/apple-dominio" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: seguranca },
      { source: "/painel/:path*", headers: privado },
      { source: "/painel", headers: privado },
      { source: "/entregador/:path*", headers: privado },
      { source: "/entregador", headers: privado },
      { source: "/api/painel/:path*", headers: privado },
      { source: "/api/entregador/:path*", headers: privado },
    ];
  },
};

export default nextConfig;

// Deixa as ligações da Cloudflare disponíveis no `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
