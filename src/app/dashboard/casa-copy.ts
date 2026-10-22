// ─────────────────────────────────────────────────────────────────────────────
// La casa (02-oct-2026, mockup aprobado por Fabrizio): el copy del dashboard de quien ya tiene informes.
// Arriba el saldo; si compró el pack, la selección; después «Tu perfil de búsqueda»; abajo sus informes.
// Quien no tiene análisis compra el pack de tres por $19.990 (13-oct-2026, decisión de Fabrizio; lib/tres-analisis.ts),
// con el suelto debajo. El ticket de $14.990 (pack3) sigue solo en el ticket, para el usuario nuevo en sus 24 horas
// (lo fija el tier CASA). El tier también fija cada frase.
// EL TICKET DE LA CUENTA NUEVA (21-oct-2026, recorrido real de Fabrizio por la puerta B): desde esa fecha el ticket es de
// toda cuenta nueva, por cualquier puerta, mientras tenga menos de 24 horas (lib/guia/compra-desde-depto.ts). Sin saldo,
// la casa ofrece el pack al mismo precio que el pop-up de la selección (packDeCasa): $14.990 en esas 24 horas.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { rutaTres, TRES_COPY, TRES_PRECIO_CLP } from "@/lib/tres-analisis";
import { PACK_PRECIO_CLP, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { urlCompra } from "@/lib/compra/compra";
import { COMPRA_DEPTO } from "@/lib/guia/compra-desde-depto";

const SUELTO = fmtCLP(SINGLE_PRICE);

/** Sin saldo, el pack que ofrece la casa —el banner y la línea del saldo—: el de tres, o el del ticket si la cuenta tiene
 *  menos de 24 horas y no lo pagó. Vuelve al dashboard después de pagar. */
export function packDeCasa(ticket: boolean): { href: string; boton: string; bajada: string; bajadaPrimero: string } {
  if (!ticket) return { href: rutaTres("dashboard", { volver: "/dashboard" }), boton: CASA.sin.boton, bajada: CASA.sin.bajada, bajadaPrimero: CASA.sin.bajadaPrimero };
  const precio = fmtCLP(PACK_PRECIO_CLP);
  return {
    href: urlCompra({ product: PRODUCTO_PACK, volver: "/dashboard" }),
    boton: COMPRA_DEPTO.pack(PACK_PRECIO_CLP),
    bajada: `Para analizar otros: 3 análisis por ${precio}, sin caducidad.`,
    bajadaPrimero: `Para analizar un depto: 3 análisis por ${precio}, sin caducidad.`,
  };
}

export const CASA = {
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  sin: {
    titulo: (informes: number) => (informes === 0 ? "Todavía no tienes análisis." : informes === 1 ? "Tu primer informe ya está en tu cuenta." : `Tus ${informes} informes están en tu cuenta.`),
    bajada: `Para analizar otros: 3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}, sin caducidad.`,
    /** Sin informes (16-oct-2026, la cuenta de /deptos que topó el regalo). */
    bajadaPrimero: `Para analizar un depto: 3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}, sin caducidad.`,
    boton: TRES_COPY.boton,
    suelto: `O uno solo · ${SUELTO}`,
    planes: "Ver planes",
    /** El saldo plano (17-oct-2026), cuando arriba manda la selección. */
    plano: "No te quedan análisis.",
  },
  // El regalo (16-oct-2026): el de registrarse, el de reactivación o el viejo de los 14 días.
  regalo: {
    titulo: "Tienes un análisis de regalo.",
    boton: "Analizar otro depto",
    botonPrimero: "Analizar un depto",
  },
  con: {
    titulo: (n: number) => (n === 1 ? "Te queda 1 análisis" : `Te quedan ${n} análisis`),
    noVencen: "No vencen.",
    boton: "Analizar otro depto",
  },
  plan: {
    titulo: "Tu plan Ilimitado está activo.",
    bajada: "Analizar no descuenta de tu saldo.",
    boton: "Analizar otro depto",
  },
  guiaTitulo: "Te recomendamos empezar por estos",
  perfil: {
    titulo: "Tu perfil de búsqueda",
    bajada: "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil. Cámbialo cuando quieras.",
    bajadaComprador: "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil.",
    cuando: "¿Cuándo piensas comprar?",
    // Renombrado el 16-oct-2026 (decisión de Fabrizio): «Ya» desaparece, va «Quiero comprar ya»; el valor guardado sigue siendo 'ya'.
    horizonte: { ya: "Quiero comprar ya", meses: "En los próximos meses", mirando: "Solo estoy mirando" } as Record<"ya" | "meses" | "mirando", string>,
    respondido: { ya: "Quieres comprar ya", meses: "Piensas comprar en los próximos meses", mirando: "Por ahora solo estás mirando" } as Record<"ya" | "meses" | "mirando", string>,
    cambiar: "cambiar",
    masComuna: "+ comuna",
    masDormitorio: "+ dormitorios",
    quitar: "Quitar",
    tope: (uf: string) => `Hasta UF ${uf}`,
    /** Con el piso elegido en /deptos (16-oct-2026). */
    rango: (min: string, max: string) => `UF ${min} a ${max}`,
    sinTope: "Precio tope",
    pie: (p: string) => `Pie ${p}%`,
    plazo: (a: number) => `${a} años`,
    dormitorios: (d: number) => (d === 0 ? "Studio" : d === 1 ? "1 dormitorio" : `${d} dormitorios`),
    error: "No pudimos guardarlo. Intenta de nuevo.",
  },
  informes: "Tus informes",
} as const;

/** El saldo en una línea, para el dashboard vacío (14-oct-2026: el saldo o el plan, visible arriba para cualquier
 *  cuenta). Sin saldo no hay línea: ahí manda el botón al primer análisis. */
export function lineaSaldo(e: EstadoSaldo): string | null {
  return e.tipo === "con" ? CASA.con.titulo(e.n) : e.tipo === "plan" ? CASA.plan.titulo : e.tipo === "regalo" ? CASA.regalo.titulo : null;
}
