/**
 * Sección 02 · Problema — fondo Ink 100 (#FAFAF8).
 * Header → 3 cards (la 3ra destacada con wash Signal Red 0.06)
 * → bloque negro inferior con 92.1% en Signal Red.
 */
export default function SectionProblem() {
  return (
    <section className="flex min-h-screen items-center bg-[#FAFAF8]">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-14 md:py-[72px]">
        {/* Header */}
        <div className="max-w-[760px]">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#0F0F0F]/55">
            02 · El problema
          </span>
          <h2 className="mt-4 font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F0F0F] md:text-[40px]">
            La matemática del depto de inversión cambió.
          </h2>
          <p className="mt-4 max-w-[640px] font-body text-[15px] leading-[1.55] text-[#0F0F0F]/70 md:text-[16px]">
            Tasas más altas, arriendos que no acompañaron y gastos que nadie suma
            en el análisis.
          </p>
        </div>

        {/* Grid 3 cards */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          <ProblemCard
            label="01 · Tasa hipotecaria"
            big="4.5%"
            bigColor="#0F0F0F"
            sublabel="Hace 5 años: 2.0%"
            body="El dividendo de un mismo depto hoy es 40% más alto que en 2020."
          />
          <ProblemCard
            label="02 · Cap rate mediano"
            big="5.0%"
            bigColor="#0F0F0F"
            sublabel="n=12.944 · Gran Santiago"
            body="El arriendo bruto rinde menos que el dividendo. Antes de descontar gastos."
          />
          <ProblemCard
            label="03 · Gastos sobre arriendo"
            big="31.7%"
            bigColor="#C8323C"
            sublabel="GGCC · contrib · vacancia · comisión"
            body="Casi un tercio del arriendo desaparece antes de llegar a tu bolsillo."
            highlighted
          />
        </div>

        {/* Bloque negro */}
        <div className="mt-8 rounded-2xl bg-[#0F0F0F] p-7 md:p-10">
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1px_1fr] md:gap-10">
            <p className="font-heading text-[56px] font-bold leading-none tracking-[-0.025em] text-[#C8323C] md:text-[76px]">
              92,1%
            </p>
            <div className="hidden h-full w-px bg-[rgba(250,250,248,0.12)] md:block" aria-hidden="true" />
            <div className="md:pl-2">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#FAFAF8]/55">
                Resultado
              </p>
              <p className="mt-2.5 font-heading text-[20px] font-bold leading-[1.25] text-[#FAFAF8] md:text-[24px]">
                de los deptos de inversión pierden plata cada mes.
              </p>
              <p className="mt-2.5 font-body text-[14px] leading-[1.55] text-[#FAFAF8]/70 md:text-[15px]">
                Más de la mitad pone $200.000 o más cada mes, durante 25 años.
              </p>
            </div>
          </div>
        </div>

        {/* Footnote */}
        <p className="mt-5 max-w-[860px] font-body text-[11px] leading-[1.55] text-[#0F0F0F]/45">
          Datos sobre 12.944 departamentos en venta, 24 comunas Gran Santiago.
          Cap rate y flujo con precio publicado ajustado −10%. Supuestos: pie
          20%, crédito 25 años, tasa 4.5% UF, gastos 31.7%.
        </p>
      </div>
    </section>
  );
}

function ProblemCard({
  label,
  big,
  bigColor,
  sublabel,
  body,
  highlighted = false,
}: {
  label: string;
  big: string;
  bigColor: string;
  sublabel: string;
  body: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
      style={
        highlighted
          ? {
              background: "rgba(200,50,60,0.06)",
              border: "0.5px solid rgba(200,50,60,0.25)",
              boxShadow: "0 1px 0 rgba(200,50,60,0.04)",
            }
          : {
              background: "#FFFFFF",
              border: "0.5px solid rgba(15,15,15,0.10)",
              boxShadow: "0 1px 0 rgba(15,15,15,0.03)",
            }
      }
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/55">
        {label}
      </p>
      <p
        className="mt-4 font-heading font-bold leading-none tracking-[-0.02em]"
        style={{ color: bigColor, fontSize: "48px" }}
      >
        {big}
      </p>
      <p className="mt-3 font-mono text-[11px] font-medium text-[#0F0F0F]/55">
        {sublabel}
      </p>
      <div
        className="my-4 h-px w-full"
        style={{ background: highlighted ? "rgba(200,50,60,0.18)" : "rgba(15,15,15,0.08)" }}
      />
      <p className="font-body text-[14px] leading-[1.55] text-[#0F0F0F]/80">
        {body}
      </p>
    </div>
  );
}
