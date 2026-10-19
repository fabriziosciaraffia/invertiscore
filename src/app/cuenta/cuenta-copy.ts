// ─────────────────────────────────────────────────────────────────────────────
// /cuenta (19-oct-2026, decisión de Fabrizio): plana y clara. El correo, el plan o el saldo, el perfil de búsqueda, cómo
// entrar y darse de baja. Copy acá; lo fija el tier PLANES.
// ─────────────────────────────────────────────────────────────────────────────
import { COMO_ENTRAR } from "@/lib/guia/semanal";
import { PLANES_COPY } from "@/lib/planes";

export const CUENTA_COPY = {
  titulo: "Tu cuenta",
  plan: {
    titulo: "Tu plan",
    renueva: (fecha: string) => `Se renueva el ${fecha}.`,
    teQuedan: (n: number) => (n === 1 ? "Te queda 1 análisis." : `Te quedan ${n} análisis.`),
    legado: "Lo sigues teniendo como lo contrataste.",
    cancelado: (fecha: string) => `Lo cancelaste: tienes acceso hasta el ${fecha}.`,
    pendiente: (fecha: string) => `Tu último cobro no se pudo hacer. Tienes acceso hasta el ${fecha}.`,
    volver: "Volver al Plan Franco",
    actualizarPago: "Ver cómo pagar",
  },
  saldo: {
    titulo: "Tu saldo",
    ninguno: "No te quedan análisis.",
    comprar: "Ver el pack y el plan",
  },
  compras: "Tus compras",
  perfil: {
    sin: "Todavía no tienes perfil de búsqueda. Se arma con tus informes, o eligiendo comunas, tipología y precio.",
    armar: "Armarlo ahora",
  },
  entrar: {
    titulo: "Cómo entras",
    codigo: COMO_ENTRAR,
    google: "También puedes entrar con Google.",
  },
  baja: {
    titulo: "Darte de baja",
    bajada: "Deja de recibir los correos de Franco cuando quieras. Si quieres irte del todo, pide que eliminemos tu cuenta.",
  },
  correos: {
    semanal: "La selección semanal",
    inmediato: "El aviso cuando aparece un depto",
    recibes: "la recibes",
    noRecibes: "no la recibes",
    dejar: "Dejar de recibirla",
    volver: "Volver a recibirla",
  },
  guardando: "Guardando…",
  error: "No pudimos guardarlo. Intenta de nuevo.",
  cancelar: {
    boton: "Cancelar el plan",
    pregunta: "¿Cancelas el plan?",
    texto: "No se renueva más. Los análisis que ya tienes siguen vigentes hasta que vencen.",
    si: "Sí, cancelar",
    no: "No, mantenerlo",
    cancelando: "Cancelando…",
  },
} as const;

/** El nombre de lo comprado, para «Tus compras». */
export function etiquetaCompra(product: string): string {
  switch (product) {
    case "single": return "1 análisis";
    case "pack3": case "tres_analisis": return "3 análisis";
    case "plan10_mensual": return PLANES_COPY.plan.nombre;
    case "plan10_annual": return "Plan 10 anual";
    case "plan50_mensual": case "plan50_annual": return "Plan 50";
    case "unlimited_mensual": case "unlimited_annual": return "Plan Ilimitado";
    case "unlock": return "Informe completo";
    case "pro": return "Análisis";
    default: return "Compra";
  }
}
