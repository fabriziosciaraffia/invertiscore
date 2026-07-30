"use client";

// Tier del usuario (identidad + créditos) para el botón final del resumen.
// SOLO refleja estado — el gate real es server-side (audit auth/créditos). Reusa
// el contrato de /api/me/tier y el helper canAnalyzeFromTier de v3.

import { useEffect, useState } from "react";
import { canAnalyzeFromTier, type TierInfo } from "@/components/formulario-v3/Paso3Modalidad";

export { canAnalyzeFromTier, type TierInfo };

const GUEST: TierInfo = { tier: "guest", isAdmin: false, credits: 0, email: null };

/**
 * ¿Usuario NUEVO con su análisis de bienvenida sin estrenar? Segmento de
 * adquisición que mide la campaña: logueado, con el welcome virgen y SIN ninguna
 * otra vía de acceso.
 *
 * No alcanza con `welcomeAvailable`. Dos casos lo ensucian:
 *  - Ilimitado: chargeAnalysisCredit retorna en is_unlimited ANTES de tocar el
 *    flag, así que su welcome queda virgen para siempre.
 *  - Plan finito (plan10/plan50) recién suscrito: todavía no estrenó el welcome,
 *    pero es un pagador, no una activación nueva.
 * Ambos son ruido para el funnel gratis → se excluyen explícitamente, igual que
 * el admin y quien ya compró créditos.
 *
 * Espejo conceptual del gate server-side (mode === 'welcome' en el cobro): mide
 * el mismo segmento, leído desde el estado en vez del resultado del cobro. Es
 * SOLO para instrumentación — el gating real de "¿puede analizar?" sigue siendo
 * canAnalyzeFromTier + la autoridad del backend.
 */
export function esNuevoConAnalisisGratis(info: TierInfo | null): boolean {
  if (!info) return false;
  if (info.tier === "guest") return false;
  if (info.isAdmin) return false;
  if (info.isUnlimited) return false;
  if (info.activePlan) return false;
  if (info.credits > 0) return false;
  return info.welcomeAvailable === true;
}

export function useWizardV4Tier(): { tier: TierInfo | null; isLoggedIn: boolean } {
  const [tier, setTier] = useState<TierInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/tier")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TierInfo | null) => {
        if (alive) setTier(d ?? GUEST);
      })
      .catch(() => {
        if (alive) setTier(GUEST);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { tier, isLoggedIn: tier != null && tier.tier !== "guest" };
}
