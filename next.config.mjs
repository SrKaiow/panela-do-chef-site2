/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Deixa as ligações da Cloudflare disponíveis no `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
