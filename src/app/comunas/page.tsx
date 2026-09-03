import type { Metadata } from "next";
import Link from "next/link";
import { getAllComunasStats, fmtCLP, tieneArriendoPropio, esComunaEstimada, rangoArriendoComuna } from "@/lib/data/comunas-seo";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { CtaAnalizar } from "@/components/CtaAnalizar";
import { ChipEstimado } from "@/components/comunas/ChipEstimado";

export const revalidate = 86400; // ISR: 24 hours

export const metadata: Metadata = {
  title: "Rentabilidad por Comuna — Franco",
  description:
    "Datos reales de rentabilidad de departamentos en las principales comunas de Santiago. Actualizado semanalmente.",
  alternates: { canonical: "/comunas" },
  openGraph: {
    title: "Rentabilidad por Comuna — Franco",
    description:
      "¿En qué comuna conviene más invertir? Datos reales de arriendos, precios y rentabilidad en Santiago.",
    url: "https://refranco.ai/comunas",
    siteName: "Franco",
    locale: "es_CL",
    // openGraph propio reemplaza al del root → la imagen va explícita.
    images: ["/opengraph-image"],
  },
};

function rentColor(r: number) {
  if (r >= 5) return "var(--franco-positive)";
  if (r >= 3) return "var(--franco-warning)";
  return "#C8323C";
}

export default async function ComunasIndexPage() {
  const stats = await getAllComunasStats();
  const porSlug = new Map(stats.map((c) => [c.slug, c]));

  // El índice lista SIEMPRE el roster completo: si una comuna se queda sin
  // muestra esta semana, su card queda sin cifras pero el enlace interno sigue
  // ahí. Sacarla dejaría su página huérfana justo cuando Google la acaba de
  // indexar.
  //
  // Tres bloques, en este orden:
  //  1. El RANKING: comunas con al menos una tipología con arriendos propios,
  //     ordenadas por rentabilidad y con puesto.
  //  2. Comunas con arriendo 100% ESTIMADO desde el m² comunal (±6-16% de
  //     error): su cifra informa, pero no compite por un puesto. Van aparte,
  //     sin número, con su rango y con la marca.
  //  3. Sin avisos suficientes ni para estimar: card sin cifras, link vivo.
  const conDatos = COMUNAS_ROSTER
    .map((c) => porSlug.get(c.slug))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const ranking = conDatos
    .filter(tieneArriendoPropio)
    .sort((a, b) => b.rentabilidadBruta - a.rentabilidadBruta);
  const estimadas = conDatos
    .filter(esComunaEstimada)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sinDatos = COMUNAS_ROSTER.filter((c) => !porSlug.has(c.slug));

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <UnifiedNav variant="marketing" />

      <main className="mx-auto max-w-[1100px] px-6 py-16">
        {/* Hero */}
        <h1 className="font-heading text-3xl font-bold text-[var(--franco-text)] sm:text-4xl">
          ¿En qué comuna conviene más invertir en un departamento?
        </h1>
        <p className="mt-3 font-body text-base text-[var(--franco-text-secondary)]">
          Ranking de rentabilidad en {COMUNAS_ROSTER.length} comunas del Gran
          Santiago, con datos reales de mercado actualizados cada semana.
        </p>

        {/* Grid del ranking */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranking.map((c, i) => (
            <Link
              key={c.slug}
              href={`/comunas/${c.slug}`}
              className="group rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 transition-colors hover:border-[var(--franco-border-hover)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">
                  <span className="mr-2 font-mono text-[11px] font-medium tracking-[0.06em] text-[var(--franco-text-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {c.nombre}
                </h2>
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: rentColor(c.rentabilidadBruta) }}
                >
                  {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <p className="mt-0.5 font-body text-xs text-[var(--franco-text-muted)]">Rentabilidad bruta</p>
              {/* Una comuna con ALGUNA fila estimada lo dice también acá: el arriendo
                  promedio de la card la incluye. Las 100% estimadas van abajo. */}
              {c.tipologias.some((t) => t.referencia.fuente === "comunalPorM2") && (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)]">
                  Arriendo estimado en {c.tipologias.filter((t) => t.referencia.fuente === "comunalPorM2").length} de{" "}
                  {c.tipologias.length} tipologías
                </p>
              )}

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

          {/* Ni mediana propia ni muestra comunal para estimar: card sin cifras, link vivo. */}
          {sinDatos.map((c) => (
            <Link
              key={c.slug}
              href={`/comunas/${c.slug}`}
              className="group rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 transition-colors hover:border-[var(--franco-border-hover)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">{c.nombre}</h2>
              </div>
              <p className="mt-0.5 font-body text-xs text-[var(--franco-text-muted)]">
                Sin avisos suficientes esta semana, ni para estimar
              </p>
            </Link>
          ))}
        </div>

        {/* Comunas con arriendo 100% estimado: fuera del ranking, sin puesto. */}
        {estimadas.length > 0 && (
          <section className="mt-14">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--franco-text-tertiary)]">
              Fuera del ranking
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--franco-text)]">
              Comunas con arriendo estimado
            </h2>
            <p className="mt-2 max-w-[74ch] font-body text-sm text-[var(--franco-text-secondary)]">
              En estas comunas ninguna tipología junta arriendos publicados propios, así que el arriendo sale del
              metro cuadrado de la comuna, con un margen de error de hasta 16%. Una cifra así te sirve para ubicarte,
              no para ordenar: por eso no compiten por un puesto con las comunas que sí tienen arriendos publicados.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {estimadas.map((c) => {
                const rango = rangoArriendoComuna(c);
                return (
                  <Link
                    key={c.slug}
                    href={`/comunas/${c.slug}`}
                    className="group rounded-xl border border-dashed border-[var(--franco-border)] bg-[var(--franco-card)] p-5 transition-colors hover:border-[var(--franco-border-hover)]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-lg font-bold text-[var(--franco-text)]">
                        {c.nombre}
                        <ChipEstimado />
                      </h3>
                      <span className="font-mono text-lg font-bold text-[var(--franco-text)]">
                        {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                    <p className="mt-0.5 font-body text-xs text-[var(--franco-text-muted)]">
                      Rentabilidad bruta estimada
                    </p>

                    <div className="mt-3 flex gap-4 text-xs">
                      <div>
                        <span className="text-[var(--franco-text-secondary)]">Arriendo estimado</span>
                        <div className="font-mono font-medium text-[var(--franco-text)]">
                          {rango ? `${fmtCLP(rango.min)}–${fmtCLP(rango.max)}` : fmtCLP(c.arriendoRepresentativo)}
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                          rango · {c.tipologias.length} {c.tipologias.length === 1 ? "tipología" : "tipologías"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[var(--franco-text-secondary)]">UF/m²</span>
                        <div className="font-mono font-medium text-[var(--franco-text)]">
                          {c.precioM2Promedio.toFixed(1).replace(".", ",")}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[#C8323C]/20 bg-[#C8323C]/[0.06] p-10 text-center">
          <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)]">¿Tienes un depto?</h2>
          <p className="mt-2 font-body text-sm text-[var(--franco-text-secondary)]">
            Analízalo gratis en 2 minutos. Franco te dice si comprar, negociar o seguir buscando.
          </p>
          <CtaAnalizar origen="comunas_indice"
            className="mt-5 inline-block rounded-lg bg-[#C8323C] px-8 py-3 font-body text-sm font-bold text-white hover:bg-[#b02a33]"
          >
            Analizar gratis
          </CtaAnalizar>
        </div>
      </main>

      {/* Footer */}
      <AppFooter variant="minimal" />
    </div>
  );
}
