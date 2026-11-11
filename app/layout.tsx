import type { Metadata, Viewport } from "next";
import { Anton, Figtree, Yellowtail } from "next/font/google";
import "./globals.css";

// Fontes baixadas na hora do build e servidas pelo próprio site (mais rápido, sem chamar o Google).
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--f-anton", display: "swap" });
const yellowtail = Yellowtail({ weight: "400", subsets: ["latin"], variable: "--f-yellowtail", display: "swap" });
const figtree = Figtree({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--f-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Panela do Chef | Comida brasileira com entrega",
  description: "Açaí, pastéis, batatas recheadas e marmitas do Chef Kaio. Peça online e pague em dinheiro na entrega ou no cartão.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${yellowtail.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
