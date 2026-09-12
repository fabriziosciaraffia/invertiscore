"use client";

import type { Hallazgo } from "@/lib/types";
import { findingDisplay } from "./GenericFindingCard";
import { referenciaHallazgo } from "./referencia-hallazgo";

/**
 * PRINCIPALES HALLAZGOS — la fila es UNA LÍNEA (08-sep-2026).
 *
 * Contrato: `docs/wireframes/rediseno-informe/la-fila-como-linea.html`, opción 2.
 * Frase corta a la izquierda, cifra a la derecha con su referencia debajo.
 *
 * MURIERON de la fila, y por qué:
 *   · la numeración 01-0n — la jerarquía ya la dice el orden;
 *   · el punto de dirección y el kicker «en contra / a favor» — la frase lo dice
 *     con palabras, y ahora la flecha lo repite en un símbolo;
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
 *
 * LA FILA NO ES CLICABLE (09-sep-2026). Es informativa. Sin puntero, sin hover y sin
 * rol de botón: apretar y perder el hilo es peor que no tener puerta. Nada queda
 * inalcanzable — cada capítulo de «Cómo funciona como inversión» es su propio botón en
 * el acordeón, así que la fila era un atajo, no la única puerta.
 *
 * SÍMBOLO, NO COLOR (09-sep-2026) — SUPERADA POR EL CONTRATO §4 (11-sep-2026).
 *
 * ACTA. Aquella decisión sacó el color del bloque entero porque estaba en todos lados
 * —cifras, textos y flechas—, y un bloque donde todo grita no jerarquiza nada. La
 * flecha quedó en Ink y la dirección la dijo el símbolo.
 *
 * El contrato §4 la reemplaza, y no la revierte: el color vuelve SOLO a las flechas,
 * a 20 px, ↓ en «--signal-red» y ↑ en «--up». Las cifras y los textos siguen en tinta,
 * con la única excepción de siempre —el monto negativo en Signal Red—. Lo que se
 * mantiene de la decisión vieja es lo que la motivaba: el color no se reparte.
 *
 * La regla base `.hz-fl` sigue en tinta y la de `.doc-dictamen` la repunta; desde el
 * 12-sep-2026 (retiro del andamio) el rediseño es el único camino y no hay informe sin marco.
 */
/** 0 = frena (va arriba), 1 = ayuda o no mueve la aguja. */
const grupo = (h: Hallazgo): number => (h.direccion === "adverso" ? 0 : 1);

export function PrincipalesHallazgos({
  hallazgos,
  currency,
  valorUF,
}: {
  /** Ya ordenados por `ordenarHallazgosPiramide`; se muestran los primeros 4. */
  hallazgos: Hallazgo[];
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  // ORDEN AGRUPADO: en contra primero, a favor después. Sin encabezados de grupo — con
  // las flechas el agrupamiento se ve solo, y un encabezado para dos filas pesa más que
  // lo que ordena.
  //
  // SE AGRUPA DESPUÉS DE CORTAR, y sobre una COPIA. Dos motivos que no son de estilo:
  // cortar primero deja intacto CUÁLES cuatro hallazgos entran (eso lo decide la
  // decisividad del motor, no esta vista); y `ordenarHallazgosPiramide` es fuente única
  // del coronado — la lee el user prompt, el PDF y los catch-tests del golden — así que
  // reordenarla acá movería la apertura de la prosa. El agrupamiento es de PRESENTACIÓN.
  //
  // `sort` es estable en V8, así que dentro de cada grupo sobrevive el orden por
  // decisividad que ya venía. `neutral` viaja con «a favor»: no frena nada.
  const top = hallazgos.slice(0, 4);
  const enOrden = [...top].sort((a, b) => grupo(a) - grupo(b));
  if (top.length === 0) return null;
  return (
    <div className="hz-list">
      {enOrden.map((h) => {
        // De `findingDisplay` sobrevive SOLO el KPI: el título y el kicker murieron.
        const { kpi, kpiNegativo } = findingDisplay(h, currency, valorUF);
        const ref = referenciaHallazgo(h, currency, valorUF);
        const frase = h.titular;
        // `neutral` existe como tercera dirección y no lleva flecha: la celda queda
        // vacía pero conserva su ancho, así la frase arranca en el mismo sitio en las
        // cuatro filas.
        const flecha = h.direccion === "adverso" ? "↓" : h.direccion === "favorable" ? "↑" : "";
        return (
          <div key={h.id} className="hz-lin">
            {/* La flecha REPITE lo que la frase ya dice con palabras: es apoyo visual,
                no información nueva, así que no entra al árbol de accesibilidad — y por
                eso el color de §4 puede ser lo único que la distinga: no carga
                significado que el texto no traiga ya. */}
            <span className="hz-fl" data-dir={h.direccion} aria-hidden="true">{flecha}</span>
            <p>{frase}</p>
            <span className={`hz-n${kpiNegativo ? " neg" : ""}`}>
              {kpi}
              {/* El slot de la referencia se renderiza SIEMPRE, con o sin texto: si no
                  reservara su alto, la fila sin referencia (p. ej. «Pie 20%») se
                  hundiría respecto de las otras tres. */}
              <small>{ref || " "}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
