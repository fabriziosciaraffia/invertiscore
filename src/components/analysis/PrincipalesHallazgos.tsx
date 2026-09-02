"use client";

import type { Hallazgo } from "@/lib/types";
import { findingDisplay, fraseCanonicaCard } from "./GenericFindingCard";
import { numeroHallazgo } from "@/lib/orden-hallazgos";

/**
 * PRINCIPALES HALLAZGOS — contrato CONGELADO 02-sep-2026 (T2).
 *
 * Los cuatro hallazgos que mueven el veredicto, en el ORDEN ÚNICO (el mismo array
 * que ordena el acordeón y que espeja el Golden): un `slice(0, 4)`, nada más. Rol:
 * asesoría — qué pesa en ESTE deal. Cada fila lleva número, pregunta, cifra, la
 * dirección y su decisividad, y cierra con la fraseCanonica del hallazgo con el
 * plumón sobre la PRIMERA ORACIÓN (decisión de Fabrizio: determinista, sin
 * prompt — la frase-fuerza es la que abre). Al margen derecho, un solo enlace
 * «↓ Ver detalle» hacia el desarrollo del hallazgo en el relato.
 *
 * El diagrama y el juicio largo NO viven acá: existen una sola vez, en la
 * sección de la inversión. Acá va la fila y su cierre.
 */
export function PrincipalesHallazgos({
  hallazgos,
  currency,
  valorUF,
  onVerDetalle,
}: {
  /** Ya ordenados por `ordenarHallazgosPiramide`; se muestran los primeros 4. */
  hallazgos: Hallazgo[];
  currency: "CLP" | "UF";
  valorUF: number;
  /** Lleva al desarrollo del hallazgo (ancla del acordeón / capítulo). */
  onVerDetalle: (h: Hallazgo) => void;
}) {
  const top = hallazgos.slice(0, 4);
  if (top.length === 0) return null;
  return (
    <div className="hz-list">
      {top.map((h, i) => {
        const d = findingDisplay(h, currency, valorUF);
        const frase = fraseCanonicaCard(h, currency, valorUF);
        const { marcada, resto } = primeraOracion(frase);
        const adverso = h.direccion === "adverso";
        const favorable = h.direccion === "favorable";
        return (
          <div key={h.id} className="hz">
            <div className="hz-head">
              <span className="num">{numeroHallazgo(i)}</span>
              <span className="q">
                <span className={`dot-dir ${adverso ? "adv" : favorable ? "fav" : "neu"}`} aria-hidden="true" />
                {d.title || h.titular}
                {/* Sin la cifra de decisividad: regla de la pirámide desde su diseño — la
                    jerarquía la dicen el orden, el tamaño y el color, nunca un número. */}
                <small>
                  {d.kick.toLowerCase()} · {adverso ? "en contra" : favorable ? "a favor" : "neutral"}
                </small>
              </span>
              <span className={`val${d.kpiRed ? "" : " ink"}`}>{d.kpi}</span>
            </div>
            {frase && (
              <p className="hz-cierre">
                <mark>{marcada}</mark>
                {resto ? ` ${resto}` : ""}
              </p>
            )}
            <div className="hz-foot">
              <button type="button" className="doc-lnk" onClick={() => onVerDetalle(h)}>
                ↓ Ver detalle
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Primera oración de la fraseCanonica (hasta el primer `. ? !` seguido de espacio)
 *  y el resto. Si no hay corte, toda la frase es la marcada. */
function primeraOracion(texto: string): { marcada: string; resto: string } {
  const t = (texto ?? "").trim();
  const m = t.match(/^(.+?[.?!])(?:\s+|$)([\s\S]*)$/);
  if (!m) return { marcada: t, resto: "" };
  return { marcada: m[1].trim(), resto: m[2].trim() };
}
