import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComunaStats, getAllComunasStats, fmtCLP, fmtUF, UF_CLP } from "@/lib/data/comunas-seo";
import FrancoLogo from "@/components/franco-logo";

export const revalidate = 86400;

export async function generateStaticParams() {
  const comunas = await getAllComunasStats();
  return comunas.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const stats = await getComunaStats(params.slug);
  if (!stats) return { title: "Comuna no encontrada — Franco" };

  return {
    title: `Invertir en ${stats.nombre} — Rentabilidad y datos reales | Franco`,
    description: `Rentabilidad bruta promedio ${stats.rentabilidadBruta}% en ${stats.nombre}. Arriendo promedio ${fmtCLP(stats.arriendoPromedio)}/mes. Basado en ${stats.totalPropiedades} propiedades reales.`,
    openGraph: {
      title: `Departamentos en ${stats.nombre} — ¿Vale la pena invertir?`,
      description: `Franco analiza ${stats.totalPropiedades} propiedades en ${stats.nombre}. Rentabilidad promedio: ${stats.rentabilidadBruta}%`,
      url: `https://refranco.ai/comunas/${stats.slug}`,
      siteName: "Franco",
      locale: "es_CL",
    },
  };
}

function rentColor(r: number) {
  if (r >= 5) return "#B0BEC5";
  if (r >= 3) return "#FBBF24";
  return "#C8323C";
}

export default async function ComunaPage({ params }: { params: { slug: string } }) {
  const stats = await getComunaStats(params.slug);
  if (!stats) notFound();

  const allComunas = await getAllComunasStats();

  // 5 most similar by precio/m²
  const similares = allComunas
    .filter((c) => c.slug !== stats.slug && c.precioM2Promedio > 0)
    .sort((a, b) => Math.abs(a.precioM2Promedio - stats.precioM2Promedio) - Math.abs(b.precioM2Promedio - stats.precioM2Promedio))
    .slice(0, 5);

  const avgSantiago = 3.8;
  const evaluacion = stats.rentabilidadBruta >= avgSantiago + 1
    ? "está por encima del promedio de Santiago (3,8%)"
    : stats.rentabilidadBruta >= avgSantiago - 0.5
    ? "está en línea con el promedio de Santiago"
    : "está por debajo del promedio de Santiago (3,8%)";

  const precioM2CLP = Math.round(stats.precioM2Promedio * UF_CLP);
  const year = new Date().getFullYear();
  const lowData = stats.totalPropiedades < 10;

  // Badge
  const badge = stats.rentabilidadBruta >= 5
    ? { text: "Una de las comunas más rentables de Santiago", color: "#B0BEC5" }
    : stats.rentabilidadBruta < 3
    ? { text: "Rentabilidad por debajo del promedio de Santiago", color: "#C8323C" }
    : null;

  // FAQ Schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `¿Cuánto rinde un departamento en ${stats.nombre}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `La rentabilidad bruta promedio en ${stats.nombre} es de ${stats.rentabilidadBruta}%, basado en ${stats.totalPropiedades} propiedades analizadas.`,
        },
      },
      {
        "@type": "Question",
        name: `¿Cuál es el precio del metro cuadrado en ${stats.nombre}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `El precio promedio por m² en ${stats.nombre} es de ${fmtUF(stats.precioM2Promedio)} (${fmtCLP(precioM2CLP)}), según datos actualizados de propiedades en venta.`,
        },
      },
      {
        "@type": "Question",
        name: `¿Conviene invertir en departamentos en ${stats.nombre}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Franco analiza cada propiedad individualmente considerando precio, arriendo estimado, gastos y condiciones del mercado. El análisis es gratuito en refranco.ai.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Navbar */}
      <header className="border-b border-white/[0.06] bg-[#0F0F0F]">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <FrancoLogo size="header" inverted href="/" />
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/comunas" className="font-body text-sm text-[#FAFAF8]/50 hover:text-[#FAFAF8]/80">Comunas</Link>
            <Link href="/pricing" className="font-body text-sm text-[#FAFAF8]/50 hover:text-[#FAFAF8]/80">Precios</Link>
            <Link href="/analisis/nuevo" className="rounded-lg bg-[#C8323C] px-5 py-2.5 font-body text-sm font-bold text-white hover:bg-[#b02a33]">
              Analizar gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 font-body text-xs text-[#FAFAF8]/30">
          <Link href="/" className="hover:text-[#FAFAF8]/50">Inicio</Link>
          {" → "}
          <Link href="/comunas" className="hover:text-[#FAFAF8]/50">Comunas</Link>
          {" → "}
          <span className="text-[#FAFAF8]/50">{stats.nombre}</span>
        </nav>

        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[#FAFAF8] sm:text-4xl">
          Invertir en {stats.nombre} — ¿Vale la pena en {year}?
        </h1>

        {badge && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: `${badge.color}15`, border: `1px solid ${badge.color}30` }}>
            <span className="font-body text-xs font-medium" style={{ color: badge.color }}>
              {stats.rentabilidadBruta >= 5 ? "✓" : "⚠"} {badge.text}
            </span>
          </div>
        )}

        {lowData && (
          <div className="mt-4 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-4 py-3">
            <p className="font-body text-xs text-[#FBBF24]">
              Datos limitados — menos de 10 propiedades analizadas en esta comuna.
            </p>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Rentabilidad bruta", value: `${stats.rentabilidadBruta.toFixed(1).replace(".", ",")}%`, color: rentColor(stats.rentabilidadBruta) },
            { label: "Arriendo promedio", value: `${fmtCLP(stats.arriendoPromedio)}/mes`, color: "#FAFAF8" },
            { label: "Precio/m² promedio", value: fmtUF(stats.precioM2Promedio), color: "#FAFAF8" },
            { label: "Propiedades analizadas", value: stats.totalPropiedades.toLocaleString("es-CL"), sub: "actualizado esta semana", color: "#FAFAF8" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <p className="font-body text-xs text-[#FAFAF8]/40">{m.label}</p>
              <p className="mt-1 font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
              {"sub" in m && m.sub && <p className="mt-0.5 font-body text-[10px] text-[#FAFAF8]/25">{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* Análisis de Franco */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[#FAFAF8]">Qué dicen los datos</h2>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
            <p className="font-body text-sm leading-relaxed text-[#FAFAF8]/60">
              En {stats.nombre}, el precio promedio por m² es de {fmtUF(stats.precioM2Promedio)} ({fmtCLP(precioM2CLP)}).
              El arriendo mensual promedio es de {fmtCLP(stats.arriendoPromedio)}/mes, lo que resulta en una
              rentabilidad bruta de {stats.rentabilidadBruta.toFixed(1).replace(".", ",")}% — {evaluacion}.
            </p>
            <p className="mt-4 font-body text-[11px] italic text-[#FAFAF8]/25">
              Este análisis es informativo y no constituye asesoría de inversión. Los datos se actualizan semanalmente desde fuentes públicas.
            </p>
          </div>
        </section>

        {/* Comparativa */}
        {similares.length > 0 && (
          <section className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-[#FAFAF8]">Comparativa con comunas similares</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="px-4 py-3 font-body font-medium text-[#FAFAF8]/40">Comuna</th>
                    <th className="px-4 py-3 font-body font-medium text-[#FAFAF8]/40">Rentabilidad</th>
                    <th className="px-4 py-3 font-body font-medium text-[#FAFAF8]/40">Arriendo prom.</th>
                    <th className="px-4 py-3 font-body font-medium text-[#FAFAF8]/40">UF/m²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/[0.06] bg-white/[0.05]">
                    <td className="px-4 py-3 font-body font-semibold text-[#FAFAF8]">{stats.nombre}</td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: rentColor(stats.rentabilidadBruta) }}>{stats.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                    <td className="px-4 py-3 font-mono font-medium text-[#FAFAF8]">{fmtCLP(stats.arriendoPromedio)}</td>
                    <td className="px-4 py-3 font-mono font-medium text-[#FAFAF8]">{stats.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
                  </tr>
                  {similares.map((c) => (
                    <tr key={c.slug} className="border-b border-white/[0.04]">
                      <td className="px-4 py-3">
                        <Link href={`/comunas/${c.slug}`} className="font-body text-[#FAFAF8]/70 hover:text-[#FAFAF8]">{c.nombre}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#FAFAF8]/60">{c.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                      <td className="px-4 py-3 font-mono text-[#FAFAF8]/60">{fmtCLP(c.arriendoPromedio)}</td>
                      <td className="px-4 py-3 font-mono text-[#FAFAF8]/60">{c.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-14">
          <div className="rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
            <h2 className="font-heading text-2xl font-bold text-[#FAFAF8]">¿Tienes un departamento en {stats.nombre}?</h2>
            <p className="mt-2 font-body text-sm text-[#FAFAF8]/50">
              Analízalo en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
            </p>
            <Link
              href={`/analisis/nuevo?comuna=${encodeURIComponent(stats.nombre)}`}
              className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
            >
              Analizar depto en {stats.nombre}
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[#FAFAF8]">Preguntas frecuentes</h2>
          <div className="mt-4 space-y-4">
            {(faqSchema.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
                <h3 className="font-body text-sm font-semibold text-[#FAFAF8]">{q.name}</h3>
                <p className="mt-2 font-body text-sm text-[#FAFAF8]/50">{q.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/[0.06] py-8 text-center">
        <p className="font-body text-xs text-[#FAFAF8]/30">
          Análisis informativo, no constituye asesoría de inversión. Datos actualizados semanalmente desde fuentes públicas.
        </p>
      </footer>
    </div>
  );
}
