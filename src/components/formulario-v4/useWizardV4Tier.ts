"use client";

// Tier del usuario (identidad + créditos) para el botón final del resumen.
// SOLO refleja estado — el gate real es server-side (audit auth/créditos). Reusa
// el contrato de /api/me/tier y el helper canAnalyzeFromTier de v3.

import { useEffect, useState } from "react";
import { canAnalyzeFromTier, type TierInfo } from "@/components/formulario-v3/Paso3Modalidad";

export { canAnalyzeFromTier, type TierInfo };

const GUEST: TierInfo = { tier: "guest", isAdmin: false, credits: 0, email: null };

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
