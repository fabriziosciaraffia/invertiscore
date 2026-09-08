"use client";

import type { Hallazgo } from "@/lib/types";
import { findingDisplay } from "./GenericFindingCard";
import { referenciaHallazgo } from "./referencia-hallazgo";

/**
 * PRINCIPALES HALLAZGOS — la fila es UNA LÍNEA (08-sep-2026).
 *
 * Contrato: `docs/wireframes/rediseno-informe/la-fila-como-linea.html`, opción 2.
 * Frase corta a la izquierda, cifra a la derecha con su referencia debajo. La línea
 * entera es el botón que lleva al desarrollo.
 *
 * MURIERON de la fila, y por qué:
 *   · la numeración 01-0n — la jerarquía ya la dice el orden;
 *   · el punto de dirección y el kicker «en contra / a favor» — la frase lo dice
 *     con palabras, y el color de la cifra lo repite;
 *   · el `title` de `findingDisplay` — en seis tipos LTR era neutro («Cómo estás
 *     financiando») y el juicio vivía en el `titular` del motor;
 *   · la `fraseCanonica` en pantalla y el «↓ Ver detalle».
 *
 * LA FRASE ES EL `titular` DEL MOTOR, no el `title` del render. Es la única de las
 * dos que trae juicio en todos los tipos: «Rinde por sobre lo que el mercado paga»
 * contra «Lo que renta hoy vs lo que debería». Esa es la línea entre simplificar y
 * vaciar — la fila corta el texto, no la opinión.
 *
 * La `fraseCanonica` NO se borra: sigue viva en el hallazgo y sigue entrando al
 * user prompt como insumo. Solo desaparece de esta superficie.
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
  /** Lleva al desarrollo del hallazgo (ancla del capítulo). */
  onVerDetalle: (h: Hallazgo) => void;
}) {
  const top = hallazgos.slice(0, 4);
  if (top.length === 0) return null;
  return (
    <div className="hz-list">
      {top.map((h) => {
        // De `findingDisplay` sobrevive SOLO el KPI: el título y el kicker murieron.
        const { kpi, kpiRed } = findingDisplay(h, currency, valorUF);
        const ref = referenciaHallazgo(h, currency, valorUF);
        const frase = h.titular;
        const tono = h.direccion === "adverso" ? "mal" : h.direccion === "favorable" ? "bien" : "neu";
        return (
          // La línea entera es un <button>: accesible por teclado y con foco visible,
          // sin el `role="button"` que obliga a manejar Enter/Space a mano.
          <button key={h.id} type="button" className="hz-lin" onClick={() => onVerDetalle(h)}>
            <p>{frase}</p>
            <span className={`hz-n ${kpiRed ? "mal" : tono}`}>
              {kpi}
              {ref && <small>{ref}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
