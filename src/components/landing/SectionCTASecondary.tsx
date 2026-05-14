import Link from "next/link";

/**
 * Sección 07 · CTA secundario — fondo Ink 100, centered.
 */
export default function SectionCTASecondary() {
  return (
    <section className="snap-section-start flex min-h-[80vh] items-center bg-[#FAFAF8]">
      <div className="mx-auto w-full max-w-[820px] px-6 py-14 text-center md:py-[72px]">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#0F0F0F]/55">
          07 · Ya lo sabes todo
        </span>
        <h2 className="mt-4 font-heading text-[32px] font-bold leading-[1.1] tracking-[-0.01em] text-[#0F0F0F] md:text-[44px]">
          30 segundos y decides
          <br />
          con fundamentos.
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] font-body text-[15px] leading-[1.55] text-[#0F0F0F]/70 md:text-[16px]">
          Sin tarjeta, sin compromiso. Si los números no cierran, mejor saberlo
          ahora.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
          >
            Analizar mi departamento ahora
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#0F0F0F]/45">
            1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;30 segundos
          </p>
        </div>
      </div>
    </section>
  );
}
