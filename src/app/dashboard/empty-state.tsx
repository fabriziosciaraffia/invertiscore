/**
 * Estado vacío del dashboard: usuario que ya pasó el onboarding y todavía no
 * tiene análisis (o los borró todos). Quien no completó el onboarding ve
 * `OnboardingClient`, no esto.
 *
 * Sin header, sin stats, sin archivo: la pantalla entera es la venta del primer
 * análisis. El copy no se disculpa por estar vacío — dice qué pasa al apretar
 * el botón. Vocabulario de UI: «el análisis», nunca «créditos».
 */

import Link from "next/link";
import { DEMO_ID } from "./dashboard-helpers";

const BLOQUES = [
  {
    label: "Toma 4 minutos",
    texto: "Dirección, precio y pie. El resto Franco lo estima con datos de mercado y lo puedes corregir.",
  },
  {
    label: "Veredicto, no opinión",
    texto: "COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA. Sin matices en el veredicto; los matices van en el análisis.",
    destacado: true,
  },
  {
    label: "Sirve para negociar",
    texto: "El precio que dicen los datos, no el que pide el vendedor. Con eso haces la oferta.",
  },
];

export function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mb-6 flex select-none items-baseline justify-center opacity-[0.08]" aria-hidden="true">
        <span className="font-heading text-[62px] font-normal italic leading-none tracking-tight text-[var(--franco-text)]">
          re
        </span>
        <span className="font-heading text-[62px] font-bold leading-none tracking-tight text-[var(--franco-text)]">
          franco
        </span>
      </div>

      <h1 className="mb-2 font-heading text-[26px] font-bold text-[var(--franco-text)]">
        Analiza tu primera inversión
      </h1>
      <p className="mx-auto mb-6 max-w-[420px] font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
        Ingresas el depto, Franco te dice si los números dan: score, veredicto y cuánto sale de tu bolsillo cada mes.
        Renta larga, renta corta o las dos comparadas.
      </p>

      <Link
        href="/analisis/nuevo-v4"
        className="inline-block rounded-lg bg-signal-red px-7 py-3 font-body text-sm font-medium text-white no-underline shadow-[0_2px_12px_color-mix(in_srgb,var(--signal-red)_20%,transparent)]"
      >
        Analizar tu primera inversión →
      </Link>

      <Link
        href={`/analisis/${DEMO_ID}`}
        className="mt-3.5 block font-body text-xs text-[var(--franco-text-secondary)] no-underline hover:text-[var(--franco-text)]"
      >
        O mira un análisis de ejemplo primero →
      </Link>

      <div className="mx-auto mt-10 grid max-w-[700px] grid-cols-1 gap-2.5 text-left sm:grid-cols-3">
        {BLOQUES.map((b) => (
          <div key={b.label} className="rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] p-3.5">
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-[var(--franco-text-muted)]">
              {b.label}
            </div>
            <div className="font-body text-[12.5px] leading-relaxed text-[var(--franco-text-secondary)]">
              {b.destacado ? (
                <>
                  <span className="font-medium text-[var(--franco-text)]">
                    COMPRAR · AJUSTA SUPUESTOS · BUSCAR OTRA.
                  </span>{" "}
                  Sin matices en el veredicto; los matices van en el análisis.
                </>
              ) : (
                b.texto
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
