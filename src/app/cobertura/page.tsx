import type { Metadata } from "next";
import Link from "next/link";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";

export const metadata: Metadata = {
  title: "¿Dónde está disponible Franco?",
  description:
    "Franco analiza departamentos como inversión en las comunas de Gran Santiago. Mira en qué comunas hoy tienes el análisis completo con datos reales.",
  alternates: { canonical: "https://refranco.ai/cobertura" },
  openGraph: {
    title: "¿Dónde está disponible Franco?",
    description:
      "Las comunas de Gran Santiago donde Franco analiza departamentos con datos reales.",
    url: "https://refranco.ai/cobertura",
    siteName: "Franco",
    locale: "es_CL",
  },
};

// Orden alfabético chileno (respeta acentos y la Ñ).
const comunas = [...COMUNAS_DISPONIBLES].sort((a, b) => a.localeCompare(b, "es"));

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
          Franco analiza departamentos en estas {COMUNAS_DISPONIBLES.length} comunas
          de Gran Santiago.
        </p>

        {/* Chips de comunas — sin links, orden alfabético */}
        <ul className="mt-10 flex flex-wrap gap-2.5">
          {comunas.map((nombre) => (
            <li
              key={nombre}
              className="rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3.5 py-2 font-body text-sm text-[var(--franco-text)]"
            >
              {nombre}
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
          <Link
            href="/register"
            className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
          >
            Analiza tu departamento
          </Link>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
