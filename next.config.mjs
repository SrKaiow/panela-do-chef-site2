/**
 * Cabeçalhos de segurança aplicados a todas as páginas.
 * - CSP: o navegador só carrega scripts, estilos, imagens e conexões das origens listadas.
 * - Sem iframe de outros sites (contra golpes de "clique sequestrado").
 * - Sem revelar a tecnologia do site (sem X-Powered-By).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const seguranca = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
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
