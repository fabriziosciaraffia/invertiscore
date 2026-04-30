import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComunaStats, getAllComunasStats, fmtCLP, fmtUF, UF_CLP } from "@/lib/data/comunas-seo";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";

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
    description: `Rentabilidad bruta promedio ${stats.rentabilidadBruta}% en ${stats.nombre}. Arriendo promedio ${fmtCLP(stats.arriendoRepresentativo)}/mes. Basado en ${stats.totalPropiedades} propiedades reales.`,
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
  if (r >= 5) return "var(--franco-positive)";
  if (r >= 3) return "var(--franco-warning)";
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
    ? { text: "Una de las comunas más rentables de Santiago", color: "var(--franco-positive)" }
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
    <div className="min-h-screen bg-[var(--franco-bg)]">
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Navbar */}
      <AppNav
        variant="marketing"
        linksSlot={
          <>
            <Link href="/comunas" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]">Comunas</Link>
            <Link href="/pricing" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]">Precios</Link>
          </>
        }
        ctaSlot={<NavPrimaryCTA href="/analisis/nuevo-v2" />}
        mobileMenuItems={[
          { label: "Comunas", href: "/comunas" },
          { label: "Precios", href: "/pricing" },
        ]}
      />

      <main className="mx-auto max-w-[1100px] px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 font-body text-xs text-[var(--franco-text-muted)]">
          <Link href="/" className="hover:text-[var(--franco-text-secondary)]">Inicio</Link>
          {" → "}
          <Link href="/comunas" className="hover:text-[var(--franco-text-secondary)]">Comunas</Link>
          {" → "}
          <span className="text-[var(--franco-text-secondary)]">{stats.nombre}</span>
        </nav>

        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
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
          <div className="mt-4 rounded-lg border border-[var(--franco-v-adjust-bg)] bg-[var(--franco-v-adjust-bg)] px-4 py-3">
            <p className="font-body text-xs text-[var(--franco-warning)]">
              Datos limitados — menos de 10 propiedades analizadas en esta comuna.
            </p>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Rentabilidad bruta", value: `${stats.rentabilidadBruta.toFixed(1).replace(".", ",")}%`, color: rentColor(stats.rentabilidadBruta) },
            { label: "Arriendo promedio", value: `${fmtCLP(stats.arriendoRepresentativo)}/mes`, color: "var(--franco-text)" },
            { label: "Precio/m² promedio", value: fmtUF(stats.precioM2Promedio), color: "var(--franco-text)" },
            { label: "Propiedades analizadas", value: stats.totalPropiedades.toLocaleString("es-CL"), sub: "actualizado esta semana", color: "var(--franco-text)" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
              <p className="font-body text-xs text-[var(--franco-text-secondary)]">{m.label}</p>
              <p className="mt-1 font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</p>
              {"sub" in m && m.sub && <p className="mt-0.5 font-body text-[10px] text-[var(--franco-text-muted)]">{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* Análisis de Franco */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Qué dicen los datos</h2>
          <div className="mt-4 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-6">
            <p className="font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
              En {stats.nombre}, el precio promedio por m² es de {fmtUF(stats.precioM2Promedio)} ({fmtCLP(precioM2CLP)}).
              El arriendo mensual promedio es de {fmtCLP(stats.arriendoRepresentativo)}/mes, lo que resulta en una
              rentabilidad bruta de {stats.rentabilidadBruta.toFixed(1).replace(".", ",")}% — {evaluacion}.
            </p>
            <p className="mt-4 font-body text-[11px] italic text-[var(--franco-text-muted)]">
              Este análisis es informativo y no constituye asesoría de inversión. Los datos se actualizan semanalmente desde fuentes públicas.
            </p>
          </div>
        </section>

        {/* Comparativa */}
        {similares.length > 0 && (
          <section className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Comparativa con comunas similares</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--franco-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--franco-border)] text-left">
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Comuna</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Rentabilidad</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">Arriendo prom.</th>
                    <th className="px-4 py-3 font-body font-medium text-[var(--franco-text-secondary)]">UF/m²</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--franco-border)] bg-[var(--franco-card)]">
                    <td className="px-4 py-3 font-body font-semibold text-[var(--franco-text)]">{stats.nombre}</td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: rentColor(stats.rentabilidadBruta) }}>{stats.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--franco-text)]">{fmtCLP(stats.arriendoRepresentativo)}</td>
                    <td className="px-4 py-3 font-mono font-medium text-[var(--franco-text)]">{stats.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
                  </tr>
                  {similares.map((c) => (
                    <tr key={c.slug} className="border-b border-[var(--franco-border)]">
                      <td className="px-4 py-3">
                        <Link href={`/comunas/${c.slug}`} className="font-body text-[var(--franco-text)] hover:text-[var(--franco-text)]">{c.nombre}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{c.rentabilidadBruta.toFixed(1).replace(".", ",")}%</td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{fmtCLP(c.arriendoRepresentativo)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--franco-text-secondary)]">{c.precioM2Promedio.toFixed(1).replace(".", ",")}</td>
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
            <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">¿Tienes un departamento en {stats.nombre}?</h2>
            <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
              Analízalo en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
            </p>
            <Link
              href={`/analisis/nuevo-v2?comuna=${encodeURIComponent(stats.nombre)}`}
              className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
            >
              Analizar depto en {stats.nombre}
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">Preguntas frecuentes</h2>
          <div className="mt-4 space-y-4">
            {(faqSchema.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q, i) => (
              <div key={i} className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
                <h3 className="font-body text-sm font-semibold text-[var(--franco-text)]">{q.name}</h3>
                <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">{q.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
