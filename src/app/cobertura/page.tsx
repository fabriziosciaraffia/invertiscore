import type { Metadata } from "next";
import Link from "next/link";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { CtaAnalizar } from "@/components/CtaAnalizar";

export const metadata: Metadata = {
  title: "¿Dónde está disponible Franco?",
  description:
    "Franco analiza departamentos como inversión en las comunas de Gran Santiago. Mira en qué comunas hoy tienes el análisis con datos reales.",
  alternates: { canonical: "/cobertura" },
  openGraph: {
    title: "¿Dónde está disponible Franco?",
    description:
      "Las comunas de Gran Santiago donde Franco analiza departamentos con datos reales.",
    url: "https://refranco.ai/cobertura",
    siteName: "Franco",
    locale: "es_CL",
    // openGraph propio reemplaza al del root → la imagen va explícita.
    images: ["/opengraph-image"],
  },
};

// La lista sale del ROSTER de comunas publicadas (25), no de COMUNAS_DISPONIBLES:
// esa lista valida el wizard y quedó en 24 (sin Renca), así que esta página
// prometía cobertura distinta de la que /comunas publica. Una sola fuente para
// "dónde hay página", y cada chip enlaza a la suya — antes eran texto plano y
// la página de cobertura no aportaba ningún enlace interno.
// Orden alfabético chileno (respeta acentos y la Ñ).
const comunas = [...COMUNAS_ROSTER].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export default function CoberturaPage() {
  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Navbar */}
      <UnifiedNav variant="marketing" />

      <main className="mx-auto max-w-[1100px] px-6 py-16">
        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          ¿Dónde está disponible Franco?
        </h1>
        <p className="mt-3 font-body text-base text-[var(--franco-text-secondary)]">
          Franco analiza departamentos en estas {COMUNAS_ROSTER.length} comunas de Gran Santiago.
          Cada una tiene su página con precios, arriendos y rentabilidad por tipología.
        </p>

        {/* Chips de comunas, cada uno enlaza a su página */}
        <ul className="mt-10 flex flex-wrap gap-2.5">
          {comunas.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/comunas/${c.slug}`}
                className="block rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3.5 py-2 font-body text-sm text-[var(--franco-text)] transition-colors hover:border-[var(--franco-border-hover)] hover:text-[var(--franco-text)]"
              >
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>

        {/* Cierre — comuna fuera de cobertura */}
        <p className="mt-10 font-body text-sm text-[var(--franco-text-secondary)]">
          ¿Tu comuna no está?{" "}
          <a
            href="mailto:hola@refranco.ai"
            className="font-medium text-[#C8323C] hover:underline"
          >
            Escríbenos a hola@refranco.ai
          </a>
        </p>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">
            ¿Tu depto está en una de estas comunas?
          </h2>
          <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
            Analízalo en 2 minutos. Franco te dice si comprar, negociar o seguir
            buscando.
          </p>
          <CtaAnalizar origen="cobertura"
            className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
          >
            Analiza tu departamento
          </CtaAnalizar>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
