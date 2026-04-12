import type { Metadata } from "next";
import Link from "next/link";
import { getAllComunasStats, fmtCLP } from "@/lib/data/comunas-seo";
import FrancoLogo from "@/components/franco-logo";

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
  if (r >= 5) return "#B0BEC5";
  if (r >= 3) return "#FBBF24";
  return "#C8323C";
}

export default async function ComunasIndexPage() {
  const comunas = await getAllComunasStats();

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
{/* Navbar */}
      <header className="border-b border-white/[0.06] bg-[#0F0F0F]">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <FrancoLogo size="header" inverted href="/" />
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/comunas" className="font-body text-sm font-medium text-[#FAFAF8]">Comunas</Link>
            <Link href="/pricing" className="font-body text-sm text-white/50 hover:text-[#FAFAF8]">Precios</Link>
            <Link href="/analisis/nuevo" className="rounded-lg bg-[#C8323C] px-5 py-2.5 font-body text-sm font-bold text-white hover:bg-[#b02a33]">
              Analizar gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-16">
        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[#FAFAF8] sm:text-4xl">
          ¿En qué comuna conviene más invertir en un departamento?
        </h1>
        <p className="mt-3 font-body text-base text-white/50">
          Datos reales de 20.000+ propiedades en 24 comunas de Santiago.
        </p>

        {/* Grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comunas.map((c) => (
            <Link
              key={c.slug}
              href={`/comunas/${c.slug}`}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.04] p-5 transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-[#FAFAF8]">{c.nombre}</h2>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: rentColor(c.rentabilidadBruta) }}
                >
                  {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <p className="mt-0.5 font-body text-xs text-white/[0.35]">Rentabilidad bruta</p>

              <div className="mt-3 flex gap-4 text-xs">
                <div>
                  <span className="text-white/50">Arriendo prom.</span>
                  <div className="font-mono font-medium text-[#FAFAF8]">
                    {fmtCLP(c.arriendoRepresentativo)}/mes
                  </div>
                </div>
                <div>
                  <span className="text-white/50">UF/m²</span>
                  <div className="font-mono font-medium text-[#FAFAF8]">
                    {c.precioM2Promedio.toFixed(1).replace(".", ",")}
                  </div>
                </div>
                {c.arriendoUFm2Mes > 0 && (
                  <div>
                    <span className="text-white/50">UF/m²/mes</span>
                    <div className="font-mono font-medium text-[#FAFAF8]">
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
          <h2 className="font-heading text-2xl font-bold text-[#FAFAF8]">¿Tienes un depto?</h2>
          <p className="mt-2 font-body text-sm text-white/50">
            Analízalo gratis en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
          </p>
          <Link
            href="/analisis/nuevo"
            className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
          >
            Analizar gratis
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="font-body text-xs text-white/[0.35]">
          Análisis informativo, no constituye asesoría de inversión. Datos actualizados semanalmente desde fuentes públicas.
        </p>
      </footer>
    </div>
  );
}
