"use client";

// Dry-run del resumen (FASE 5). Llama a /api/analisis/dry-run EN SILENCIO al
// llegar al resumen; re-dispara solo ante cambio de un input dominante. NO
// bloquea el botón de generar; si falla o expira, no hay card (fallo silencioso).
//
// Solo LTR por ahora (STR/BOTH entra tras su calibración). La tasa se perturba
// solo si el usuario aceptó la estimación (tasaModo === "estimada"), nunca su
// pre-aprobada (refinamiento #1).

import { useEffect, useState } from "react";
import type { WizardV4Answers } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { buildLtrPayload, type SubmitContext } from "./wizardV4Submit";

export interface DryRunResult {
  alFilo: boolean;
  variablesSensibles: string[];
}

const EMPTY: DryRunResult = { alFilo: false, variablesSensibles: [] };

export function useWizardV4DryRun(answers: WizardV4Answers, data: WizardV4Data): DryRunResult {
  const [res, setRes] = useState<DryRunResult>(EMPTY);
  const mod = answers.modalidad;

  // Clave de inputs dominantes: re-dispara el dry-run solo si cambia alguno.
  const key = [
    mod, answers.precio, answers.arriendo, answers.pieMonto, answers.pieUnidad,
    answers.tasaInteres, answers.tasaModo, answers.plazoCredito, answers.arrModo,
    answers.tipoPropiedad, answers.comuna,
  ].join("|");

  useEffect(() => {
    // Solo LTR por ahora. STR/BOTH: tras calibrar Δ_STR.
    if (mod !== "ltr" || !answers.precio || !answers.arriendo) {
      setRes(EMPTY);
      return;
    }
    const ctx: SubmitContext = {
      ufCLP: data.ufCLP,
      arriendoSugerido: data.arriendoSugerido,
      arriendoN: data.arriendoN,
      precioM2UF: data.precioM2UF,
      radiusUsed: data.radiusUsed,
      ggccSugerido: data.ggccSugerido,
    };
    let alive = true;
    const t = setTimeout(() => {
      fetch("/api/analisis/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modalidad: "ltr",
          ltr: buildLtrPayload(answers, ctx),
          flags: {
            arriendoEstimacion: answers.arrModo === "estimacion",
            tasaPerturbable: answers.tasaModo === "estimada",
            tasaEstimacion: answers.tasaModo === "estimada",
          },
        }),
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
