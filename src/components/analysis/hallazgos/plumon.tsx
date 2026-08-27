"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PLUMÓN — el render de las marcas `**…**` de la prosa IA (FASE 4).
//
// Cierra el ciclo que FASE 2 dejó sembrado: el prompt marca las frases clave, el
// render tolerante las strippeaba (cero cambio visual), y acá pasan a pintarse
// con el fondo de plumón. `stripMarcasDeep` sigue existiendo para las
// superficies que NO son el informe web (el PDF de /documento).
//
// Regla editorial del contrato: máx 2 marcas por párrafo y cada marca se lee
// sola como mini-hallazgo. El render no la enforza — la enforza el prompt y la
// mide el golden; acá solo se pinta lo que llegue.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";

/** Parte un texto por `**…**` y pinta los núcleos con <mark>. Preserva los
 *  saltos de párrafo (\n\n). Sin marcas devuelve el texto tal cual. */
export function renderPlumon(texto: string | null | undefined): ReactNode {
  if (!texto) return null;
  const parrafos = texto.split(/\n\n+/);
  return parrafos.map((par, i) => (
    <p key={i} className={i > 0 ? "mt-3 mb-0" : "m-0"}>
      {par.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
        parte.startsWith("**") && parte.endsWith("**") ? (
          <mark key={j}>{parte.slice(2, -2)}</mark>
        ) : (
          <span key={j}>{parte}</span>
        ),
      )}
    </p>
  ));
}

/** Variante inline (sin <p>): para textos de una línea dentro de otra caja. */
export function plumonInline(texto: string | null | undefined): ReactNode {
  if (!texto) return null;
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <mark key={j}>{parte.slice(2, -2)}</mark>
    ) : (
      <span key={j}>{parte}</span>
    ),
  );
}
