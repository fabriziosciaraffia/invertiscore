// ─────────────────────────────────────────────────────────────────────────────
// El copy del dashboard vacío (29-sep-2026; corto desde el 01-oct-2026): lo primero que ve quien entra
// por /registro sin informes. Dice lo que Franco hace por un usuario registrado —analizar sus deptos y
// hacerle llegar oportunidades de inversión— y lleva al primer análisis. Nada más: salieron los tres
// pasos, el informe de ejemplo, los planes y la caja «se arma con tu primer análisis» (decisión de
// Fabrizio, 01-oct-2026). En tuteo, sin mono; el tier DASHBOARD-VACIO fija estas frases.
// ─────────────────────────────────────────────────────────────────────────────
import { COMPARABLES_TEXTO } from "@/lib/stats";

export const BIENVENIDA = {
  /** Solo con el nombre REAL de la persona (nombreReal); nunca la parte del correo antes de la @. */
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  titular: "Esto es lo que Franco hace por ti.",
  hace: [
    {
      titulo: "Analiza tus deptos.",
      texto: `Pones la dirección y el precio. Franco lo cruza con ${COMPARABLES_TEXTO} propiedades reales y te dice si conviene:`,
    },
    {
      titulo: "Te hace llegar oportunidades de inversión.",
      texto: "Franco tiene un portafolio de deptos para invertir, y todos pasaron por el mismo análisis que vas a hacer tú. Estamos abriendo el acceso: te escribimos apenas tengamos uno que calce con lo que buscas.",
    },
  ],
  /** El botón dice «gratis» solo si es verdad: la cuenta tiene el crédito de bienvenida sin usar. */
  boton: (gratis: boolean) => (gratis ? "Analiza tu primer depto gratis" : "Analiza tu primer depto"),
  cargando: "Cargando…",
  errorGuardar: "No pudimos anotarlo. Intenta de nuevo.",
} as const;

/** ¿El primer análisis es gratis? Sí, si el crédito de bienvenida no se usó (chargeAnalysisCredit lo gasta primero). */
export function primerAnalisisGratis(fila: { welcome_credit_used?: boolean | null } | null | undefined): boolean {
  return fila?.welcome_credit_used === false;
}
