import Link from "next/link";

/**
 * Sección 05 · CTA primario — fondo Ink 200, centered.
 */
export default function SectionCTAPrimary() {
  return (
    <section className="bg-[#E8E6E1]">
      <div className="mx-auto max-w-[820px] px-6 py-24 text-center md:py-32">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#0F0F0F]/55">
          05 · Tu turno
        </span>
        <h2 className="mt-5 font-heading text-[36px] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F0F0F] md:text-[52px]">
          Antes de firmar,
          <br />
          ve si los números cierran.
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] font-body text-[16px] leading-[1.55] text-[#0F0F0F]/72 md:text-[17px]">
          Ingresas precio, comuna y arriendo esperado. Franco te entrega
          veredicto en 30 segundos.
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
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
            Sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en 30s
          </p>
        </div>
      </div>
    </section>
  );
}
