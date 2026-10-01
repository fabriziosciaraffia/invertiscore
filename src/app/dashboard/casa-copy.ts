// ─────────────────────────────────────────────────────────────────────────────
// La casa (02-oct-2026, mockup aprobado por Fabrizio): el copy del dashboard de quien ya tiene informes.
// Arriba el saldo; si compró el pack, la selección; después «Tu perfil de búsqueda»; abajo sus informes.
// Quien no tiene análisis compra el SUELTO, no el pack: el pack de 3 vive solo en el ticket (lo fija el
// tier CASA). El tier también fija cada frase.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";

const SUELTO = fmtCLP(SINGLE_PRICE);

export const CASA = {
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  sin: {
    titulo: (informes: number) => (informes <= 1 ? "Tu primer informe ya está en tu cuenta." : `Tus ${informes} informes están en tu cuenta.`),
    bajada: `Para analizar otro: ${SUELTO}, o con un plan.`,
    boton: `Analizar otro depto · ${SUELTO}`,
    planes: "Ver planes",
  },
  regalo: {
    titulo: "Tienes 1 análisis. Va por cuenta de Franco.",
    boton: "Analizar otro depto",
  },
  con: {
    titulo: (n: number) => (n === 1 ? "Te queda 1 análisis" : `Te quedan ${n} análisis`),
    noVencen: "No vencen.",
    boton: "Analizar otro depto",
  },
  plan: {
    titulo: "Tu plan está activo.",
    bajada: "Analizar no descuenta de tu saldo.",
    boton: "Analizar otro depto",
  },
  guiaTitulo: "Te recomendamos empezar por estos",
  perfil: {
    titulo: "Tu perfil de búsqueda",
    bajada: "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil. Cámbialo cuando quieras.",
    bajadaComprador: "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil.",
    cuando: "¿Cuándo piensas comprar?",
    horizonte: { ya: "Ya", meses: "En los próximos meses", mirando: "Solo estoy mirando" } as Record<"ya" | "meses" | "mirando", string>,
    respondido: { ya: "Piensas comprar ya", meses: "Piensas comprar en los próximos meses", mirando: "Por ahora solo estás mirando" } as Record<"ya" | "meses" | "mirando", string>,
    cambiar: "cambiar",
    masComuna: "+ comuna",
    masDormitorio: "+ dormitorios",
    quitar: "Quitar",
    tope: (uf: string) => `Hasta UF ${uf}`,
    sinTope: "Precio tope",
    pie: (p: string) => `Pie ${p}%`,
    plazo: (a: number) => `${a} años`,
    dormitorios: (d: number) => (d === 0 ? "Studio" : d === 1 ? "1 dormitorio" : `${d} dormitorios`),
    error: "No pudimos guardarlo. Intenta de nuevo.",
  },
  informes: "Tus informes",
} as const;
