/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER FICHA-COMPARABLES (24-sep-2026) · la ficha del depto y «Ver los comparables» LTR.
//
// Decisión de Fabrizio (mockups `ficha-depto.html` forma A y `comparables-ltr.html`). Fija:
//   1 · TU ARRIENDO APARECE SIN REFERENCIA DE RADIO: la card de zona pinta el arriendo
//       declarado aunque no haya mediana con que compararlo (420 de 1.218 filas LTR decían «—»).
// Verificado EN ROJO por mutación. Corre solo:
//   node --import tsx scripts/eval/golden/ficha-comparables-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildZonaLtr, buildZonaLtrR2, ZonaCeldasLtrR2 } from "../../../src/components/analysis/zona/ZonaLtr";

// El JSX de los componentes compila a React.createElement bajo tsx: el global lo resuelve.
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

/** El valor grande de la primera tarjeta («Tu arriendo»), tal como sale en el HTML. */
const valorTuArriendo = (h: string): string | null => {
  const i = h.indexOf("Tu arriendo");
  if (i < 0) return null;
  const m = /class="zc-v">([^<]*)</.exec(h.slice(i));
  return m ? m[1] : null;
};

/** Una fila LTR con arriendo declarado; `conRadio` le pone la referencia de radio. */
function zona(arriendo: number, conRadio: boolean) {
  const inputData: any = { arriendo, precio: 3800, superficie: 68, comuna: "Providencia" };
  if (conRadio) inputData.zonaRadio = { arriendoPromedio: 980000, sampleSizeArriendo: 47, radioMetros: 1500 };
  const base = buildZonaLtr({ stats: null, sobre: null, medianaResolvedAt: null, arriendoUsuarioCLP: arriendo, comuna: "Providencia" });
  return buildZonaLtrR2({ base, inputData, arriendoUsuarioCLP: arriendo, precioUF: 3800, superficie: 68 });
}

export function runFichaComparablesTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n── Tier FICHA-COMPARABLES (la ficha y los comparables LTR) ──");

  // ── 1 · tu arriendo aparece aunque no haya referencia de radio ──
  const sinRef = zona(750000, false);
  if (sinRef.arriendoTuyo !== 750000) F(`1 · buildZonaLtrR2 sin referencia de radio devuelve arriendoTuyo = ${sinRef.arriendoTuyo}, no el declarado (750000)`);
  if (sinRef.arriendo !== null) F("1 · sin zonaRadio la referencia de arriendo tendría que ser null");
  const vSin = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: sinRef, currency: "CLP", valorUF: 40849 })));
  if (vSin !== "$750 mil") F(`1 · sin referencia de radio la card pinta «${vSin}» en «Tu arriendo», no «$750 mil»`);
  const vUf = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: sinRef, currency: "UF", valorUF: 40849 })));
  if (!vUf || !/^UF \d/.test(vUf)) F(`1 · en UF, sin referencia, «Tu arriendo» pinta «${vUf}»`);
  const conRef = zona(750000, true);
  const vCon = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: conRef, currency: "CLP", valorUF: 40849 })));
  if (vCon !== "$750 mil") F(`1 · con referencia de radio la card pinta «${vCon}», no «$750 mil»`);
  const vCero = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: zona(0, false), currency: "CLP", valorUF: 40849 })));
  if (vCero !== "—") F(`1 · sin arriendo declarado ni referencia la card tendría que decir «—» y dice «${vCero}»`);

  if (fallas.length) {
    console.log(`  ✗ FICHA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — tu arriendo aparece con y sin referencia de radio, en CLP y en UF");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFichaComparablesTier();
  process.exit(hard ? 1 : 0);
}
