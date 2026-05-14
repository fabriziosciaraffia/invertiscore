import Link from "next/link";

/**
 * Sección 01 · Hero — fondo Ink 200 (#E8E6E1).
 * 2 columnas desktop (copy izq + card ejemplo der), stack en mobile.
 */
export default function SectionHero() {
  return (
    <section className="relative bg-[#E8E6E1]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-6 pb-24 pt-16 md:grid-cols-[1.05fr_1fr] md:gap-16 md:pb-32 md:pt-24">
        {/* Columna izquierda — copy */}
        <div className="flex flex-col">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#0F0F0F]/55">
            34.000+ deptos · arriendo largo y airbnb · 24 comunas
          </span>

          <h1 className="mt-7 font-heading text-[44px] font-bold leading-[1.05] tracking-[-0.01em] text-[#0F0F0F] md:text-[64px]">
            ¿Y si el depto no se paga solo?
          </h1>

          <p className="mt-6 max-w-[480px] font-body text-[17px] leading-[1.55] text-[#0F0F0F]/72 md:text-[18px]">
            Antes de invertir, ve si dan los números para no terminar poniendo
            plata de tu bolsillo cada mes.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
            >
              Analizar mi departamento
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>

            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/45">
              Precio · comuna · arriendo&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en 30s&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1 análisis gratis
            </p>
          </div>
        </div>

        {/* Columna derecha — card ejemplo */}
        <ExampleCard />
      </div>
    </section>
  );
}

function ExampleCard() {
  const score = 61;

  return (
    <div className="relative">
      <div className="rounded-2xl border border-[rgba(15,15,15,0.10)] bg-[#FAFAF8] p-6 shadow-[0_24px_48px_-16px_rgba(15,15,15,0.18),_0_1px_0_rgba(15,15,15,0.04)] md:p-8">
        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-dashed border-[rgba(15,15,15,0.12)] pb-4">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
            Análisis · Ejemplo
          </span>
          <span className="font-heading text-[14px] font-bold leading-tight text-[#0F0F0F]">
            Depto 2D2B Providencia
          </span>
        </div>

        {/* Score block */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
              Franco Score
            </p>
            <p className="mt-2 font-heading text-[56px] font-bold leading-none tracking-[-0.02em] text-[#0F0F0F]">
              {score}
              <span className="font-heading text-[24px] font-bold text-[#0F0F0F]/35">/100</span>
            </p>
          </div>

          <span className="inline-flex items-center rounded-md border border-[#C8323C]/45 bg-[rgba(200,50,60,0.04)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C8323C]">
            Ajustar supuestos
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-5">
          <div className="relative h-1 w-full rounded-full bg-[rgba(15,15,15,0.08)]">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${score}%`,
                background: "linear-gradient(90deg, #C8323C 0%, #5F5E5A 60%, #B4B2A9 100%)",
              }}
            />
            <div
              className="absolute -top-[3px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-[#0F0F0F] bg-[#FAFAF8] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
              style={{ left: `${score}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2.5 flex justify-between font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[#0F0F0F]/45">
            <span>Buscar otra</span>
            <span>Ajustar</span>
            <span>Comprar</span>
          </div>
        </div>

        {/* Operación recomendada */}
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-[rgba(15,15,15,0.04)] px-4 py-3">
          <span className="inline-flex items-center rounded-sm bg-[#0F0F0F] px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#FAFAF8]">
            Airbnb
          </span>
          <span className="font-mono text-[12px] font-medium text-[#0F0F0F]">
            +$148K/mes <span className="text-[#0F0F0F]/55">vs arriendo tradicional</span>
          </span>
        </div>

        {/* Caja Franco */}
        <div className="mt-5 border-l-[3px] border-[#C8323C] bg-[rgba(200,50,60,0.04)] py-4 pl-5 pr-4 rounded-r-md">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
            Siendo franco
          </p>
          <p className="mt-2 font-body text-[14px] italic leading-[1.55] text-[#0F0F0F]/85">
            &ldquo;Buena ubicación, precio incómodo. Negocia hasta UF 4.900 y opera
            en Airbnb. Así el flujo se sostiene.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
