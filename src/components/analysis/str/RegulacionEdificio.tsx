// ─────────────────────────────────────────────────────────────────────────────
// LA REGULACIÓN DEL EDIFICIO — determinista, cero IA (09-sep-2026).
//
// DÓNDE VA Y POR QUÉ. Dentro de «Qué determina el veredicto», debajo de las cuatro
// líneas de hallazgo. No es una sección propia por dos razones: cuando el reglamento
// dice no, esto ES lo que determina el veredicto (es un gate del motor, no un matiz),
// así que pertenece a ese bloque; y como solo renderiza en dos de los tres estados,
// una sección haría que la alternancia de papeles de la página fuera CONDICIONAL —
// paper/paper2 dependiendo de un input, que es una forma de romper el contrato T2.
//
// Se lee como la quinta razón: la única que no es un número.
//
// El texto y la normalización viven en `src/lib/regulacion-edificio.ts` (módulo puro),
// que es lo que importa el catch-test de 0 tokens. Acá solo se pinta.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { bloqueRegulacion, normalizarRegulacion } from "@/lib/regulacion-edificio";
import { fmtMoney } from "@/components/analysis/utils";

export function RegulacionEdificio({
  inputData,
  currency,
  valorUF,
}: {
  inputData: Record<string, unknown> | null | undefined;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  const estado = normalizarRegulacion(inputData);
  const amoblamiento = Number(inputData?.costoAmoblamiento) || 0;
  const bloque = bloqueRegulacion(estado, amoblamiento > 0 ? fmtMoney(amoblamiento, currency, valorUF) : null);
  if (!bloque) return null;
  return (
    <div className={`reg${bloque.critico ? " crit" : ""}`}>
      <p className="reg-t">{bloque.titulo}</p>
      <p className="reg-p">{bloque.cuerpo}</p>
    </div>
  );
}
