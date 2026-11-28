import { notFound } from "next/navigation";
import Link from "next/link";
import AvaliarAlmoco from "@/components/AvaliarAlmoco";
import { pratoDoLink, REGIOES } from "@/lib/almoco";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ prato: string }> }) {
  const prato = pratoDoLink((await props.params).prato);
  return { title: `Avalie o seu almoço${prato ? ` · ${prato}` : ""} | Panela do Chef`, robots: { index: false } };
}

/** Link de avaliação dos almoços: /avaliar/almoco/costela-no-bafo */
export default async function PaginaAvaliarAlmoco(props: { params: Promise<{ prato: string }> }) {
  const { prato: slug } = await props.params;
  const prato = pratoDoLink(slug);
  if (!prato) notFound();
  return (
    <>
      <header className="topo">
        <div className="miolo">
          <Link href="/" style={{ textDecoration: "none" }}><img src="/fotos/logo-panela-do-chef.png" alt="Panela do Chef" style={{ width: 130, height: "auto", display: "block" }} /></Link>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Como estava a {prato.toLowerCase()}?</h1>
          <p className="slogan" style={{ margin: 0 }}>Obrigado por pedir o almoço da Panela do Chef! Conta pra gente o que achou: leva 1 minutinho.</p>
        </div>
      </header>
      <main className="miolo" style={{ display: "grid", gap: 22, paddingBlock: "24px 80px", maxWidth: 640 }}>
        <AvaliarAlmoco slug={slug} prato={prato} regioes={REGIOES} />
      </main>
    </>
  );
}
