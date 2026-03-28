import { getAllComunasStats, fmtCLP } from "@/lib/data/comunas-seo";
import FrancoLogo from "@/components/franco-logo";
import WaitlistForm from "@/components/waitlist-form";

export const revalidate = 86400;

function rentColor(r: number) {
  if (r >= 5) return "#B0BEC5";
  if (r >= 3) return "#FBBF24";
  return "#C8323C";
}

export default async function ProximamentePage() {
  const comunas = await getAllComunasStats();
  const totalProps = comunas.reduce((s, c) => s + c.totalPropiedades, 0);

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Top accent line */}
      <div className="h-[2px] bg-[#C8323C]" />

      {/* Header — logo only */}
      <header className="mx-auto flex h-16 max-w-[1100px] items-center px-6">
        <FrancoLogo size="header" inverted href="/" />
      </header>

      <main className="mx-auto max-w-[700px] px-6">
        {/* Hero */}
        <section className="pb-16 pt-12 text-center sm:pt-20">
          {/* Badge */}
          <span className="inline-block rounded-full border border-[#C8323C]/30 bg-[#C8323C]/[0.08] px-4 py-1.5 font-mono text-xs font-medium text-[#C8323C]">
            Próximamente
          </span>

          <h1 className="mt-6 font-heading text-3xl font-bold leading-tight text-[#FAFAF8] sm:text-[42px] sm:leading-[1.15]">
            El mercado inmobiliario necesitaba honestidad.
          </h1>

          <p className="mx-auto mt-4 max-w-[480px] font-body text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.5)" }}>
            Franco analiza inversiones con datos reales. Si conviene, te lo dice. Si no conviene, también.
          </p>

          {/* Email capture */}
          <div className="mx-auto mt-10 max-w-[460px]">
            <p className="mb-3 font-body text-sm font-medium text-[#FAFAF8]">Sé el primero en acceder.</p>
            <WaitlistForm />
          </div>
        </section>

        {/* Divider */}
        <div className="mx-auto h-px w-16" style={{ background: "rgba(250,250,248,0.08)" }} />

        {/* Ranking de comunas */}
        <section className="py-16">
          <h2 className="text-center font-heading text-2xl font-bold text-[#FAFAF8] sm:text-3xl">
            ¿En qué comuna conviene más invertir?
          </h2>
          <p className="mt-3 text-center font-body text-sm" style={{ color: "rgba(250,250,248,0.4)" }}>
            Datos reales de {totalProps.toLocaleString("es-CL")} propiedades en {comunas.length} comunas de Santiago.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {comunas.map((c, i) => (
              <div
                key={c.slug}
                className="rounded-xl border p-4 transition-colors"
                style={{ borderColor: "rgba(250,250,248,0.06)", background: "rgba(250,250,248,0.02)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-medium" style={{ color: "rgba(250,250,248,0.2)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-body text-sm font-semibold text-[#FAFAF8]">{c.nombre}</span>
                  </div>
                  <span className="font-mono text-base font-bold" style={{ color: rentColor(c.rentabilidadBruta) }}>
                    {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-[11px]">
                  <span style={{ color: "rgba(250,250,248,0.3)" }}>
                    Arriendo <span className="font-mono text-[#FAFAF8]/60">{fmtCLP(c.arriendoRepresentativo)}/mes</span>
                  </span>
                  <span style={{ color: "rgba(250,250,248,0.3)" }}>
                    <span className="font-mono text-[#FAFAF8]/60">{c.precioM2Promedio.toFixed(1).replace(".", ",")}</span> UF/m²
                  </span>
                  <span style={{ color: "rgba(250,250,248,0.3)" }}>
                    <span className="font-mono text-[#FAFAF8]/60">{c.totalPropiedades.toLocaleString("es-CL")}</span> props
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center font-body text-xs" style={{ color: "rgba(250,250,248,0.25)" }}>
            ¿Quieres analizar un depto específico? Déjanos tu email arriba y te avisamos cuando Franco esté listo.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center" style={{ borderColor: "rgba(250,250,248,0.06)" }}>
        <p className="font-body text-[11px]" style={{ color: "rgba(250,250,248,0.2)" }}>
          Análisis informativo, no constituye asesoría de inversión. Datos actualizados semanalmente desde fuentes públicas.
        </p>
      </footer>
    </div>
  );
}
