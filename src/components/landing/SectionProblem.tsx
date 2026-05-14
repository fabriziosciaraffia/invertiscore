"use client";

import Reveal, { RevealItem } from "./Reveal";
import SectionHeader from "./SectionHeader";

/**
 * Sección 02 · Problema — fondo Ink 100 (#FAFAF8).
 * Header → 3 cards (la 3ra destacada con wash Signal Red 0.06)
 * → bloque negro inferior con 92.1% en Signal Red.
 * Animación de entrada: stagger en cards (0.1s entre cada).
 */
export default function SectionProblem() {
  return (
    <section className="relative flex min-h-screen items-center">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:py-12">
        <SectionHeader
          eyebrow="02 · El problema"
          title={"La matemática del depto\nde inversión cambió."}
          subhead="Tasas más altas, arriendos que no acompañaron y gastos que nadie suma en el análisis."
          className="max-w-[760px]"
        />

        <Reveal
          as="div"
          className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
          stagger={0.1}
          delay={0.1}
        >
          <ProblemCard
            label="01 · Tasa hipotecaria"
            big="4.5%"
            bigColor="var(--landing-text)"
            sublabel="Hace 5 años: 2.0%"
            body="El dividendo de un mismo depto hoy es 40% más alto que en 2020."
          />
          <ProblemCard
            label="02 · Cap rate mediano"
            big="5.0%"
            bigColor="var(--landing-text)"
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
        </Reveal>

        <Reveal as="div" className="mt-6 rounded-xl p-6 md:p-8" delay={0.2}>
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[auto_1px_1fr] md:gap-8">
            <p className="font-heading text-[48px] font-bold leading-none tracking-[-0.025em] text-[#C8323C] md:text-[64px]">
              92,1%
            </p>
            <div className="hidden h-full w-px bg-[rgba(250,250,248,0.12)] md:block" aria-hidden="true" />
            <div className="md:pl-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
                Resultado
              </p>
              <p className="mt-2 font-heading text-[18px] font-bold leading-[1.25] text-[var(--landing-text)] md:text-[22px]">
                de los deptos de inversión pierden plata cada mes.
              </p>
              <p className="mt-2 font-body text-[13px] leading-[1.5] text-[var(--landing-text-secondary)] md:text-[14px]">
                Más de la mitad pone $200.000 o más cada mes, durante 25 años.
              </p>
            </div>
          </div>
        </Reveal>

        <p className="mt-4 max-w-[860px] font-body text-[11px] leading-[1.5] text-[var(--landing-text-muted)]">
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
    <RevealItem
      className="rounded-xl p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5"
      style={
        highlighted
          ? {
              background: "rgba(200,50,60,0.06)",
              border: "0.5px solid rgba(200,50,60,0.25)",
              boxShadow: "0 1px 0 rgba(200,50,60,0.04)",
            }
          : {
              background: "var(--landing-card-bg)",
              border: "0.5px solid var(--landing-card-border)",
              boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
            }
      }
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
        {label}
      </p>
      <p
        className="mt-3 font-heading font-bold leading-none tracking-[-0.02em]"
        style={{ color: bigColor, fontSize: "42px" }}
      >
        {big}
      </p>
      <p className="mt-2.5 font-mono text-[11px] font-medium text-[var(--landing-text-muted)]">
        {sublabel}
      </p>
      <div
        className="my-3.5 h-px w-full"
        style={{ background: highlighted ? "rgba(200,50,60,0.18)" : "var(--landing-divider)" }}
      />
      <p className="font-body text-[13px] leading-[1.5] text-[var(--landing-text-secondary)]">
        {body}
      </p>
    </RevealItem>
  );
}
