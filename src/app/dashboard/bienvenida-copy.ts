// ─────────────────────────────────────────────────────────────────────────────
// El copy del dashboard vacío (29-sep-2026): lo primero que ve quien entra por /registro sin
// informes. Dice lo que Franco hace por un usuario registrado —analizar sus deptos y hacerle llegar
// oportunidades de su portafolio—, coherente con el banner de «Lo que sigue», y cómo es el primer
// análisis. En tuteo, sin mono. Aprobado por Fabrizio el 29-sep-2026 (el bloque de oportunidades, con
// sus palabras); el tier DASHBOARD-VACIO fija esas frases.
// ─────────────────────────────────────────────────────────────────────────────
import { COMPARABLES_TEXTO } from "@/lib/stats";

export const BIENVENIDA = {
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  titular: "Esto es lo que Franco hace por ti.",
  hace: [
    {
      titulo: "Analiza tus deptos.",
      texto: `Pones la dirección y el precio. Franco lo cruza con ${COMPARABLES_TEXTO} propiedades reales y te dice si conviene:`,
    },
    {
      titulo: "Te hace llegar oportunidades.",
      texto: "Franco tiene un portafolio de deptos para invertir, y todos pasaron por el mismo análisis que vas a hacer tú. Estamos abriendo el acceso: te escribimos apenas tengamos uno que calce con lo que buscas.",
    },
  ],
  buscaParaTi: "Franco busca para ti:",
  tocaCambiar: "toca para cambiar",
  sinPerfil: "Lo que Franco busca para ti se arma con tu primer análisis.",
  pasosTitulo: "Cómo es tu primer análisis",
  pasos: [
    { titulo: "Ingresas el depto", texto: "Dirección, precio y superficie. El resto Franco lo estima con datos de mercado y lo puedes corregir." },
    { titulo: "Franco lo cruza con datos reales", texto: `${COMPARABLES_TEXTO.charAt(0).toUpperCase()}${COMPARABLES_TEXTO.slice(1)} propiedades de las comunas donde Franco analiza.` },
    { titulo: "Recibes el veredicto", texto: "Cuánto renta, cuánto pones cada mes y tu resultado a 10 años, en pesos de hoy." },
  ],
  /** El botón dice «gratis» solo si es verdad: la cuenta tiene el crédito de bienvenida sin usar. */
  boton: (gratis: boolean) => (gratis ? "Analiza tu primer depto gratis" : "Analiza tu primer depto"),
  bajoBoton: (gratis: boolean, precioUnitario: string) => (gratis ? "Gratis y sin tarjeta." : `Un análisis cuesta ${precioUnitario}; con un plan, menos.`),
  cargando: "Cargando…",
  ejemplo: "Ver un informe de ejemplo",
  planesTitulo: "Cuando quieras más",
  planesTexto: (gratis: boolean) =>
    gratis ? "Si analizas varios deptos, un plan baja el costo por análisis. Sin apuro: empieza con el gratis." : "Si analizas varios deptos, un plan baja el costo por análisis.",
  verPlan: "Ver plan",
  todosLosPlanes: "Ver todos los planes",
  errorGuardar: "No pudimos anotarlo. Intenta de nuevo.",
} as const;

/** ¿El primer análisis es gratis? Sí, si el crédito de bienvenida no se usó (chargeAnalysisCredit lo gasta primero). */
export function primerAnalisisGratis(fila: { welcome_credit_used?: boolean | null } | null | undefined): boolean {
  return fila?.welcome_credit_used === false;
}
