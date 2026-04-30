import type { Metadata } from "next";
import Link from "next/link";
import { getAllComunasStats, fmtCLP } from "@/lib/data/comunas-seo";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";

export const revalidate = 86400; // ISR: 24 hours

export const metadata: Metadata = {
  title: "Rentabilidad por Comuna — Franco",
  description:
    "Datos reales de rentabilidad de departamentos en las principales comunas de Santiago. Actualizado semanalmente.",
  openGraph: {
    title: "Rentabilidad por Comuna — Franco",
    description:
      "¿En qué comuna conviene más invertir? Datos reales de arriendos, precios y rentabilidad en Santiago.",
    url: "https://refranco.ai/comunas",
    siteName: "Franco",
    locale: "es_CL",
  },
};

function rentColor(r: number) {
  if (r >= 5) return "var(--franco-positive)";
  if (r >= 3) return "var(--franco-warning)";
  return "#C8323C";
}

export default async function ComunasIndexPage() {
  const comunas = await getAllComunasStats();

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <AppNav
        variant="marketing"
        linksSlot={
          <>
            <Link href="/comunas" className="font-body text-sm font-medium text-[var(--franco-text)]">Comunas</Link>
            <Link href="/pricing" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]">Precios</Link>
          </>
        }
        ctaSlot={<NavPrimaryCTA href="/analisis/nuevo-v2" />}
        mobileMenuItems={[
          { label: "Comunas", href: "/comunas" },
          { label: "Precios", href: "/pricing" },
        ]}
      />

      <main className="mx-auto max-w-[1100px] px-6 py-16">
        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          ¿En qué comuna conviene más invertir en un departamento?
        </h1>
        <p className="mt-3 font-body text-base text-[var(--franco-text-secondary)]">
          Datos reales de 20.000+ propiedades en 24 comunas de Santiago.
        </p>

        {/* Grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comunas.map((c) => (
            <Link
              key={c.slug}
              href={`/comunas/${c.slug}`}
              className="group rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 transition-colors hover:border-[var(--franco-border-hover)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">{c.nombre}</h2>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: rentColor(c.rentabilidadBruta) }}
                >
                  {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <p className="mt-0.5 font-body text-xs text-[var(--franco-text-muted)]">Rentabilidad bruta</p>

              <div className="mt-3 flex gap-4 text-xs">
                <div>
                  <span className="text-[var(--franco-text-secondary)]">Arriendo prom.</span>
                  <div className="font-mono font-medium text-[var(--franco-text)]">
                    {fmtCLP(c.arriendoRepresentativo)}/mes
                  </div>
                </div>
                <div>
                  <span className="text-[var(--franco-text-secondary)]">UF/m²</span>
                  <div className="font-mono font-medium text-[var(--franco-text)]">
                    {c.precioM2Promedio.toFixed(1).replace(".", ",")}
                  </div>
                </div>
                {c.arriendoUFm2Mes > 0 && (
                  <div>
                    <span className="text-[var(--franco-text-secondary)]">UF/m²/mes</span>
                    <div className="font-mono font-medium text-[var(--franco-text)]">
                      {c.arriendoUFm2Mes.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">¿Tienes un depto?</h2>
          <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
            Analízalo gratis en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
          </p>
          <Link
            href="/analisis/nuevo-v2"
            className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
          >
            Analizar gratis
          </Link>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
