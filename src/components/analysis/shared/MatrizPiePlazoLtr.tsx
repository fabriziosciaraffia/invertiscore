// ─────────────────────────────────────────────────────────────────────────────
// MATRIZ PIE × PLAZO (LTR) — la sensibilización, ahora en el pop-up (08-sep-2026).
//
// Se intercambió con la matriz de palancas: aquella contesta «qué te separa del
// veredicto» y subió al flujo; esta contesta «qué pasa si muevo pie y plazo», que
// es explorar, no decidir. Explorar es justo lo que un pop-up hace bien.
//
// Vivía inline en el capítulo III de CapitulosInversion. Se extrajo con su toggle
// (Flujo | TIR) y con los derivados que usaba de ese componente, que se rearman acá
// desde `results` + moneda: la pieza no depende del capítulo que la hospedaba.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import type { FullAnalysisResult, HallazgoTIR } from "@/lib/types";
import { Matriz, nombreVeredicto } from "./Matriz";
import { VViz } from "@/components/analysis/hallazgos/vocabulario";

const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

export function MatrizPiePlazoLtr({
  results,
  currency,
  valorUF,
}: {
  results: FullAnalysisResult;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  // El toggle vivía en CapitulosInversion; se muda con la pieza.
  const [serie, setSerie] = useState<"flujo" | "tir">("flujo");

  // La arma el builder del servidor (recomputeResultsForLegacy) con la mediana, el UF
  // y la fecha congelados del informe; acá solo se pinta. Resultados persistidos viejos
  // y el demo no la traen.
  const matriz = results.matrizPiePlazo && results.matrizPiePlazo.celdas.length ? results.matrizPiePlazo : null;
  if (!matriz) return null;

  const precioCLP = results.metrics?.precioCLP ?? 0;
  const tirH = (results.hallazgos ?? []).find((h): h is HallazgoTIR => h.id === "tir");
  const umbralTir = tirH?.valor.umbralPct ?? 6;

  const money = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") {
      const uf = abs / (valorUF || 1);
      return "UF " + (uf >= 100 ? Math.round(uf).toLocaleString("es-CL") : pct1(uf));
    }
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${money(n)}`;
  const compact = (n: number) => {
    const abs = Math.abs(n);
    if (currency === "UF") return "UF " + Math.round(abs / (valorUF || 1)).toLocaleString("es-CL");
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace(".", ",")} MM`;
    return "$" + Math.round(abs).toLocaleString("es-CL");
  };
  const cortoMx = (n: number) =>
    `${n < 0 ? "−" : ""}${currency === "UF" ? `UF ${Math.round(Math.abs(n) / (valorUF || 1))}` : `$${Math.round(Math.abs(n) / 1000)}k`}`;

  const notaMatrizFlujo = (() => {
    const verde = matriz.celdas
      .filter((c) => c.flujoMensual >= 0)
      .sort((a, b) => a.piePct - b.piePct || a.plazoAnios - b.plazoAnios)[0];
    return verde
      ? `El mes cierra desde ${Number.isInteger(verde.piePct) ? verde.piePct : pct1(verde.piePct)}% de pie a ${verde.plazoAnios} años. Más pie y más plazo alivian la cuota; el precio es lo que da vuelta el signo.`
      : "Ninguna combinación cierra el mes. Más pie y más plazo alivian la cuota; el precio es lo que da vuelta el signo.";
  })();

  return (
    <VViz t={serie === "flujo" ? "Tu flujo mensual según pie y plazo" : "Tu TIR a 10 años según pie y plazo"}>
      <Matriz
        id="mz-ltr-iii"
        cabecera="Cuánto cambia el mes según pie y plazo"
        toggle={{
          opciones: [
            { id: "flujo", label: "Flujo" },
            { id: "tir", label: "TIR" },
          ],
          activo: serie,
          onChange: (id) => setSerie(id as "flujo" | "tir"),
        }}
        ejeX={{ label: "→ más plazo", niveles: matriz.plazos.map((z) => ({ k: String(z), sub: "años" })) }}
        ejeY={{
          label: "↓ más pie",
          niveles: matriz.pies.map((p) => ({ k: `${Number.isInteger(p) ? p : pct1(p)}%`, sub: compact(precioCLP * (p / 100)) })),
        }}
        celdas={matriz.pies.map((p) =>
          matriz.plazos.map((z) => {
            const c = matriz.celdas.find((x) => x.piePct === p && x.plazoAnios === z);
            if (!c) return { v: "—" };
            const tir = c.tirPct != null ? `${pct1(c.tirPct)}%` : "—";
            const v = serie === "flujo" ? cortoMx(c.flujoMensual) : tir;
            const umbral = serie === "flujo" ? c.flujoMensual >= 0 : c.tirPct != null && c.tirPct >= umbralTir;
            return {
              v,
              neg: serie === "flujo" && c.flujoMensual < 0,
              umbral,
              veredicto: c.veredicto,
              hoy: c.esActual,
              title: `${signed(c.flujoMensual)} al mes · TIR ${tir} · ${nombreVeredicto(c.veredicto)} · ${Number.isInteger(p) ? p : pct1(p)}% de pie a ${z} años`,
            };
          }),
        )}
        veredictoBase={results.veredicto}
        leyenda={{
          hoy: "hoy",
          umbral: serie === "flujo" ? "cierra el mes" : `sobre TIR ${pct1(umbralTir)}%`,
          umbralCorto: serie === "flujo" ? "cierra" : `TIR ≥ ${pct1(umbralTir)}%`,
        }}
        nota={serie === "flujo" ? notaMatrizFlujo : undefined}
      />
    </VViz>
  );
}
