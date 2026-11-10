import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sem cache extra: as páginas da loja são dinâmicas (horário, cardápio do banco).
export default defineCloudflareConfig({});
