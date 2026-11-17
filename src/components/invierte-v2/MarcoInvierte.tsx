// ─────────────────────────────────────────────────────────────────────────────
// EL MARCO DE LAS PANTALLAS DEL FLUJO NUEVO (etapa 1 de Invierte con Franco, 18-nov-2026): la cabecera con el degradado
// («Invierte con Franco», volver y el paso), y el cuerpo en los tokens de la página. Sin "use client": lo usan páginas de
// servidor; el botón de volver es un enlace.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import Link from "next/link";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import "@/components/invierte/invierte.css";
import "./invierte-v2.css";

export function MarcoInvierte({ volver, paso, children, pantalla }: { volver: string | null; paso?: string; children: ReactNode; pantalla: string }) {
  return (
    <main className="iv2-pagina" data-inv2={pantalla}>
      <ChipVeredictoTokens />
      <div className="iv2-marco">
        <div className="inv-cab">
          {volver ? (
            <Link href={volver} className="inv-atras" aria-label={FLUJO_COPY.volver} data-inv2="volver">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          ) : (
            <span className="inv-cab-hueco" aria-hidden="true" />
          )}
          <span className="inv-cab-t">{FLUJO_COPY.cabecera}</span>
          {paso ? <span className="iv2-paso">{paso}</span> : <span className="inv-cab-hueco" aria-hidden="true" />}
        </div>
        <div className="inv-cuerpo iv2-cuerpo">{children}</div>
      </div>
    </main>
  );
}
