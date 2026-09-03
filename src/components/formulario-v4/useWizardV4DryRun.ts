"use client";

// Dry-run del resumen (FASE 5). Llama a /api/analisis/dry-run EN SILENCIO al
// llegar al resumen; re-dispara solo ante cambio de un input dominante. NO
// bloquea el botón de generar; si falla o expira, no hay card (fallo silencioso).
//
// LTR / STR / BOTH. Reglas de perturbación (viven server-side):
//  · LTR: arriendo ±Δ + tasa ±Δ (tasa solo si tasaModo === "estimada").
//  · STR: tarifa ±10% rel + ocupación ±5pp abs; adrEstimacion=true prioriza las
//    no corregidas (adrModo !== "corregir").
//  · BOTH: cada rama con su Δ; variablesSensibles = unión con dedup (server).

import { useEffect, useState } from "react";
import type { WizardV4Answers } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { buildLtrPayload, buildStrPayload, type SubmitContext } from "./wizardV4Submit";

export interface DryRunResult {
  alFilo: boolean;
  variablesSensibles: string[];
}

const EMPTY: DryRunResult = { alFilo: false, variablesSensibles: [] };

export function useWizardV4DryRun(answers: WizardV4Answers, data: WizardV4Data): DryRunResult {
  const [res, setRes] = useState<DryRunResult>(EMPTY);
  const mod = answers.modalidad;

  // Clave de inputs dominantes: re-dispara el dry-run solo si cambia alguno.
  // Incluye los dominantes de STR (tarifa/ocupación/gestión/regulación) además
  // de los de LTR, para que la card se recompute al tocarlos.
  const key = [
    mod, answers.precio, answers.arriendo, answers.pieMonto, answers.pieUnidad,
    answers.tasaInteres, answers.tasaModo, answers.plazoCredito, answers.arrModo,
    answers.tipoPropiedad, answers.comuna,
    // STR dominantes:
    answers.adrModo, answers.adrTarifa, answers.adrOcupacion, answers.modoGestion,
    answers.edificioPermiteAirbnb, answers.comisionStrPct,
    answers.dormitorios, answers.superficieUtil, answers.banos,
  ].join("|");

  useEffect(() => {
    const precioOk = !!answers.precio;
    const arriendoOk = !!answers.arriendo;
    // Guard por modalidad. STR no exige arriendo (no mueve su veredicto); LTR y
    // el lado LTR de BOTH sí. AirROI/dirección faltantes → fallo silencioso server.
    const enabled =
      (mod === "ltr" && precioOk && arriendoOk) ||
      (mod === "str" && precioOk) ||
      (mod === "both" && precioOk && arriendoOk);
    if (!enabled) {
      setRes(EMPTY);
      return;
    }
    const ctx: SubmitContext = {
      ufCLP: data.ufCLP,
      tasaMercado: data.tasaMercado,
      arriendoSugerido: data.arriendoSugerido,
      arriendoN: data.arriendoN,
      arriendoFuente: data.arriendoFuente,
      arriendoRango: data.arriendoRango,
      precioM2UF: data.precioM2UF,
      radiusUsed: data.radiusUsed,
      ggccSugerido: data.ggccSugerido,
      ventaN: data.ventaN,
      ventaFuente: data.ventaFuente,
      ventaUniverso: data.ventaUniverso,
      ventaRadio: data.ventaRadio,
    };
    const flags = {
      arriendoEstimacion: answers.arrModo === "estimacion",
      tasaPerturbable: answers.tasaModo === "estimada",
      tasaEstimacion: answers.tasaModo === "estimada",
      adrEstimacion: answers.adrModo !== "corregir",
    };
    const payload =
      mod === "ltr"
        ? { modalidad: "ltr", ltr: buildLtrPayload(answers, ctx), flags }
        : mod === "str"
          ? { modalidad: "str", str: buildStrPayload(answers, ctx), flags }
          : {
              modalidad: "both",
              ltr: buildLtrPayload(answers, ctx),
              str: buildStrPayload(answers, ctx),
              flags,
            };
    let alive = true;
    const t = setTimeout(() => {
      fetch("/api/analisis/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setRes({ alFilo: !!d.alFilo, variablesSensibles: Array.isArray(d.variablesSensibles) ? d.variablesSensibles : [] });
        })
        .catch(() => { /* fallo silencioso: sin card */ });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return res;
}
