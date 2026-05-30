"use client";

import Link from "next/link";

/**
 * Sección 10 · CTA final — franja centrada compacta de cierre en Signal Red
 * (F.11 Phase 2.36). Más generosa que s06/s08 por ser el cierre. Mantiene el
 * subhead (a diferencia de s06/s08). Header inline (sin SectionHeader).
 */
export default function SectionFinalCTA() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#C8323C" }}
    >
      <div className="mx-auto flex w-full max-w-[820px] flex-col items-center px-6 py-16 text-center md:py-20">
        <p
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "#FFD9DC",
            margin: "0 0 14px 0",
          }}
        >
          Tu turno
        </p>
        <h2
          className="font-heading font-bold"
          style={{
            fontSize: "clamp(32px, 5vw, 44px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            margin: "0 0 14px 0",
          }}
        >
          ¿Y si el depto no se paga solo?
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: 16,
            lineHeight: 1.5,
            color: "#FFD9DC",
            maxWidth: 560,
            margin: "0 0 28px 0",
          }}
        >
          30 segundos y decides con fundamentos. Antes de firmar 25 años.
        </p>
        <Link
          href="/register"
          className="group inline-flex items-center gap-2 font-mono font-bold uppercase transition-[transform,background] duration-150 hover:scale-[1.02] hover:bg-[#F4F4F4]"
          style={{
            background: "#FFFFFF",
            color: "#C8323C",
            fontSize: 14,
            letterSpacing: "0.04em",
            padding: "16px 28px",
            borderRadius: 6,
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
            marginBottom: 14,
          }}
        >
          Analizar departamento
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
        <p className="font-body" style={{ fontSize: 12, color: "#FFD9DC" }}>
          1 análisis gratis · sin tarjeta
        </p>
      </div>
    </section>
  );
}
