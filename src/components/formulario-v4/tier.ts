// El nivel del usuario para el wizard: qué dice /api/me/tier y si puede iniciar un análisis.
// Vivía en `formulario-v3/Paso3Modalidad.tsx`; se mudó acá el 25-sep-2026 al retirarse el wizard v3
// (`/analisis/nuevo-v2`), porque el v4 lo sigue usando (`useWizardV4Tier`).

export interface TierInfo {
  tier: "guest" | "free" | "premium" | "subscriber";
  isAdmin: boolean;
  credits: number;
  welcomeAvailable?: boolean;
  email: string | null;
  // Estado del plan (de /api/me/tier; lectura, NO gating — la autoridad es el backend).
  // El front los usa para distinguir un suscriptor FINITO (plan10/plan50: saldo real,
  // bloquea en 0) de un ILIMITADO (is_unlimited: free-pass). Opcionales: los callsites
  // con fallback {tier,isAdmin,credits,email} siguen tipando.
  activePlan?: string | null;
  isUnlimited?: boolean;
  nextCharge?: string | null;
  /** Cap anónimo (F2-2): true cuando el guest de ESTE navegador todavía puede
   *  generar su análisis gratis sin registro (no existe la cookie franco_anon).
   *  Solo viene en la rama guest de /api/me/tier; lectura, NO gating — el
   *  enforcement real es server-side en las rutas de creación. */
  anonCapAvailable?: boolean;
}

/**
 * ¿Puede iniciar/enviar un análisis desde el front? Espejo del backend (Etapa 1):
 *   - admin / ilimitado → siempre (free-pass real).
 *   - saldo del ledger > 0 → sí (finito-con-saldo O no-suscriptor con créditos comprados).
 *   - welcome disponible → sí (el backend cobra welcome ANTES del ledger).
 *   - resto → no (finito-en-0 sin welcome, O no-suscriptor sin nada).
 * El backend sigue siendo la autoridad (403 = defensa en profundidad); esto solo evita
 * que el usuario llene el wizard para que lo rechacen al final.
 */
export function canAnalyzeFromTier(info: TierInfo | null): boolean {
  if (!info) return false;
  if (info.isAdmin) return true;
  if (info.isUnlimited) return true;
  if (info.credits > 0) return true;
  if (info.welcomeAvailable) return true;
  return false;
}
