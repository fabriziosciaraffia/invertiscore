"use client";

// IndiceRow — una fila del ÍNDICE del hero (orden único, opción 3 del mockup
// mockup-orden-pagina.html): número + dot de dirección + título de la card +
// cifra, clickeable con ancla a la card de la pirámide. Compartida por HeroLTR
// y HeroSTR para que el índice no drifte entre modalidades (misma numeración,
// mismo gesto, mismos tokens).

import type { Hallazgo } from "@/lib/types";
import { findingDisplay } from "./GenericFindingCard";
import { anchorHallazgo } from "@/lib/orden-hallazgos";

// Dirección → color del dot (mismo criterio que GenericFindingCard: favorable
// en Ink, adverso en Signal Red, neutral en tertiary — cero verde).
function dotColor(dir: string): string {
  if (dir === "adverso") return "var(--franco-v-avoid)";
  if (dir === "favorable") return "var(--franco-v-buy)";
  return "var(--franco-text-tertiary)";
}

export function IndiceRow({
  rank,
  h,
  currency,
  valorUF,
}: {
  /** Posición en el orden único ("01"…"03") — la pirámide continúa la numeración. */
  rank: string;
  h: Hallazgo;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const d = findingDisplay(h, currency, valorUF);
  const anchor = anchorHallazgo(h);
  return (
    <a
      href={`#${anchor}`}
      className="franco-card-target flex items-center gap-2.5 min-h-[48px] px-3 py-2 mb-1.5 rounded-[9px] no-underline"
      style={{ border: "0.5px solid var(--franco-border)", background: "var(--franco-card)", color: "var(--franco-text)" }}
      onClick={(e) => {
        // Fallback validado en el mockup: algunos contenedores embebidos suprimen la
        // navegación por fragmento, pero scrollIntoView sí funciona. En un browser
        // normal el gesto es el mismo (smooth scroll + hash en la URL).
        const el = document.getElementById(anchor);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${anchor}`);
      }}
    >
      <span className="font-mono text-[13px] font-bold w-[26px] shrink-0">{rank}</span>
      <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ background: dotColor(h.direccion) }} aria-hidden />
      {/* Título de la CARD (findingDisplay), no el titular del motor: el índice
          anuncia la card a la que ancla — mismo texto arriba y abajo. */}
      <span className="font-body text-[12.5px] leading-[1.35] flex-1 min-w-0">{d.title || h.titular}</span>
      <span
        className="font-mono text-[12px] font-medium whitespace-nowrap shrink-0"
        style={{ color: d.kpiRed ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {d.kpi}
      </span>
      <span aria-hidden className="font-mono text-[11px] shrink-0" style={{ color: "var(--franco-text-muted)" }}>
        ↓
      </span>
    </a>
  );
}
