import { ForceDark } from "@/components/force-dark";
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

  return (
    <div className="min-h-screen bg-th-page">
      <ForceDark />
      {/* Top accent line */}
      <div className="h-[2px] bg-[#C8323C]" />

      {/* Header — logo only */}
      <header className="mx-auto flex h-16 max-w-[1100px] items-center px-6">
        <FrancoLogo size="header" inverted href="/" />
      </header>

      <main className="mx-auto max-w-[700px] px-6">
        {/* Hero */}
        <section className="pb-16 pt-12 text-center sm:pt-20">
          {/* Wordmark lockup */}
          <div className="flex justify-center">
            <FrancoLogo size="xl" inverted showTagline />
          </div>

          {/* Badge */}
          <span className="mt-6 inline-block rounded-full border border-[#C8323C]/30 bg-[#C8323C]/[0.08] px-4 py-1.5 font-mono text-xs font-medium text-[#C8323C]">
            Próximamente
          </span>

          <h1 className="mt-6 font-heading text-3xl font-bold leading-tight text-th-text sm:text-[42px] sm:leading-[1.15]">
            El mercado inmobiliario necesitaba honestidad.
          </h1>

          <p className="mx-auto mt-4 max-w-[480px] font-body text-base leading-relaxed" style={{ color: "var(--franco-text-secondary)" }}>
            Franco analiza inversiones con datos reales. Si conviene, te lo dice. Si no conviene, también.
          </p>

          {/* Email capture */}
          <div className="mx-auto mt-10 max-w-[460px]">
            <p className="mb-3 font-body text-sm font-medium text-th-text">Sé el primero en acceder.</p>
            <WaitlistForm />
          </div>
        </section>

        {/* Divider */}
        <div className="mx-auto h-px w-16" style={{ background: "var(--franco-border-strong)" }} />

        {/* Ranking de comunas */}
        <section className="py-16">
          <h2 className="text-center font-heading text-2xl font-bold text-th-text sm:text-3xl">
            ¿En qué comuna conviene más invertir?
          </h2>
          <p className="mt-3 text-center font-body text-sm" style={{ color: "var(--franco-text-secondary)" }}>
            Datos reales de 20.000+ propiedades en 24 comunas de Santiago.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {comunas.map((c, i) => (
              <div
                key={c.slug}
                className="rounded-xl border p-4 transition-colors"
                style={{ borderColor: "var(--franco-border)", background: "var(--franco-input-bg)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-medium" style={{ color: "var(--franco-text-muted)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-body text-sm font-semibold text-th-text">{c.nombre}</span>
                  </div>
                  <span className="font-mono text-base font-bold" style={{ color: rentColor(c.rentabilidadBruta) }}>
                    {c.rentabilidadBruta.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-[11px]">
                  <span style={{ color: "rgba(250,250,248,0.3)" }}>
                    Arriendo <span className="font-mono text-th-text-secondary">{fmtCLP(c.arriendoRepresentativo)}/mes</span>
                  </span>
                  <span style={{ color: "rgba(250,250,248,0.3)" }}>
                    <span className="font-mono text-th-text-secondary">{c.precioM2Promedio.toFixed(1).replace(".", ",")}</span> UF/m²
                  </span>
                  {c.arriendoUFm2Mes > 0 && (
                    <span style={{ color: "rgba(250,250,248,0.3)" }}>
                      <span className="font-mono text-th-text-secondary">{c.arriendoUFm2Mes.toFixed(2).replace(".", ",")}</span> UF/m²/mes
                    </span>
                  )}
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
        <div className="flex justify-center mb-4">
          <FrancoLogo size="md" inverted showTagline />
        </div>
        <p className="font-body text-[11px]" style={{ color: "var(--franco-text-muted)" }}>
          Análisis informativo, no constituye asesoría de inversión. Datos actualizados semanalmente desde fuentes públicas.
        </p>
      </footer>
    </div>
  );
}
