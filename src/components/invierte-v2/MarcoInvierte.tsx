// ─────────────────────────────────────────────────────────────────────────────
// EL MARCO DE LAS PÁGINAS DEL FLUJO NUEVO (etapa 1 de Invierte con Franco, 18-nov-2026).
//   · En el CELULAR: la cabecera con el degradado («Invierte con Franco» y volver) y el cuerpo en los tokens de la página. El paso
//     ya no va en la cabecera: lo dice el indicador de pasos, arriba del contenido (IndicadorPasos, quinta entrega).
//   · En el PC (con `pc`, la firma y Partimos; láminas 2.1-firma-pc y 2.2-partimos-pc): el HeaderFranco real, ancho de escritorio,
//     «← Volver» y el cuerpo en dos columnas (`layout`). El degradado solo vive en la cabecera del celular. Una sola fuente, la
//     sans de la app (18-nov-2026).
// Sin "use client": lo usan páginas de servidor; volver es un enlace.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import Link from "next/link";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { URL_BASE, URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import "@/components/invierte/invierte.css";
import "./invierte-v2.css";

export function MarcoInvierte({ volver, children, pantalla, pc, layout, cabecera, franja, miInversion = false }: {
  volver: string | null;
  children: ReactNode;
  pantalla: string;
  /** El formato de PC: el header de Franco, con la sesión de la página. */
  pc?: { sesionEmail: string | null; /** Firmó la orden: el header lleva «Mi inversión» sin consultar (láminas del 19-nov-2026). */ invierte?: boolean };
  /** firma y partimos: dos columnas en el PC; formulario: el formulario en una tarjeta centrada (perfil, etapa 2); contenido:
   *  dos columnas de contenido (resultado y base, etapa 2). */
  layout?: "firma" | "partimos" | "formulario" | "contenido";
  /** El título de la cabecera del celular (por defecto «Invierte con Franco»). */
  cabecera?: string;
  /** A todo el ancho, bajo la cabecera: la franja «Orden firmada» del perfil la primera vez (lámina 3.1 del 19-nov-2026). */
  franja?: ReactNode;
  /** Las páginas de Invierte que no son la base (y a las que /invierte no lleva solo) llevan «← Mi inversión» arriba para volver
   *  (LEEME del 19-nov-2026): va a /invierte, que decide (la base, el resultado o Partimos). */
  miInversion?: boolean;
}) {
  return (
    <main className={`iv2-pagina${pc ? " iv2-con-pc" : ""}`} data-inv2={pantalla}>
      <ChipVeredictoTokens />
      {pc && (
        <div className="iv2-solo-pc" data-inv2="header-pc">
          <HeaderFranco sesion={pc.sesionEmail != null ? { email: pc.sesionEmail } : null} invierte={pc.invierte} />
        </div>
      )}
      <div className="iv2-marco">
        <div className="inv-cab">
          {volver ? (
            <Link href={volver} className="inv-atras" aria-label={FLUJO_COPY.volver} data-inv2="volver">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          ) : (
            <span className="inv-cab-hueco" aria-hidden="true" />
          )}
          <span className="inv-cab-t">{cabecera ?? FLUJO_COPY.cabecera}</span>
          <span className="inv-cab-hueco" aria-hidden="true" />
        </div>
        {/* En el PC, «← Mi inversión» reemplaza a «← Volver» cuando volver iba a la base o a nada; si volver lleva a otro lado
            (el mapa, desde «Súmalo»), van los dos. */}
        {pc && volver && !(miInversion && (volver === URL_BASE || volver === URL_INVIERTE)) && (
          <div className="iv2-pc-barra">
            <Link href={volver} className="iv2-pc-volver" data-inv2="volver-pc">← {FLUJO_COPY.volver}</Link>
          </div>
        )}
        {miInversion && (
          <div className="iv2-mi-inversion">
            <Link href={URL_INVIERTE} className="iv2-mi-inversion-a" data-inv2="mi-inversion">← {FLUJO_COPY.miInversion}</Link>
          </div>
        )}
        {franja}
        <div className={`inv-cuerpo iv2-cuerpo${layout ? ` iv2-${layout}` : ""}`}>{children}</div>
      </div>
    </main>
  );
}
