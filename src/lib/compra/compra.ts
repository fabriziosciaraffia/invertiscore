// ─────────────────────────────────────────────────────────────────────────────
// EL CAMINO DE COMPRA (19-oct-2026, decisión de Fabrizio): UNA SOLA PANTALLA ANTES DE FLOW. /checkout dice el producto,
// el precio y lo que incluye en una línea; sin sesión pide el correo («o con Google») y el botón «Pagar $19.990» manda el
// código, y al confirmarlo va directo a Flow; con sesión, el correo puesto y solo el botón de pagar. /entrar no entra en
// este camino. A la vuelta de Flow, un solo botón: «Ver mis análisis» si pagó, «Reintentar» si no.
//
// Módulo PURO (sin React ni Supabase): qué dice la pantalla de cada producto, adónde reintenta un pago que no pasó y
// adónde lleva el botón después de pagar. Lo fija el tier COMPRA.
// ─────────────────────────────────────────────────────────────────────────────
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";
import { fmtCLP } from "@/lib/pricing";
import { PLANES_COPY, PRODUCTO_PLAN, seVende } from "@/lib/planes";
import { PRODUCTO_TRES } from "@/lib/tres-analisis";
import { PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { REANALISIS_COPY } from "@/lib/reanalisis";

export const COMPRA = {
  volverPlanes: "Volver a planes",
  volver: "Volver",
  correo: "Tu correo",
  placeholderCorreo: "tu@correo.cl",
  placeholderCodigo: "Código",
  google: "o con Google",
  pagar: (precio: string) => `Pagar ${precio}`,
  codigo: (correo: string) => `Mandamos un código de 6 dígitos a ${correo}. Escríbelo y pasas a pagar.`,
  noLlego: "¿No llegó? Revisa spam o",
  mandarDeNuevo: "mándalo de nuevo",
  otroCorreo: "Usar otro correo",
  reenviado: "Listo, va otro código.",
  noEsTuCorreo: "¿No es tu correo?",
  yendo: "Llevándote a Flow…",
  pie: "El pago se hace en Flow. Franco analiza deptos del Gran Santiago.",
  yaPlan: "Ya tienes el Plan Franco.",
  verCuenta: "Ver mi cuenta",
  errorPago: "No pudimos abrir el pago. Intenta de nuevo.",
  errorConexion: "Error de conexión. Intenta de nuevo.",
} as const;

export type ResumenCompra = {
  nombre: string;
  /** Lo que se cobra, como se lee: «$19.990». */
  precio: string;
  /** «pago único» o «al mes». */
  unidad: string;
  /** Lo que incluye, en una línea. */
  incluye: string;
  monto: number;
  unico: boolean;
  endpoint: "/api/payments/create" | "/api/subscriptions/create";
};

/**
 * Lo que la pantalla dice del producto. `null` = no existe o ya no se vende (19-oct-2026, planes.ts › VENTA_RETIRADA):
 * la pantalla dice «Plan no encontrado» y no pide nada.
 */
export function resumenCompra(key: string, opts: { analysisId?: string | null; companionStrId?: string | null; comuna?: string | null; reanalisis?: { direccion: string | null; precioUF: number } | null } = {}): ResumenCompra | null {
  const p = (FLOW_PRODUCTS as Record<string, (typeof FLOW_PRODUCTS)[FlowProductKey]>)[key];
  if (!p || !seVende(key)) return null;
  const unico = p.kind === "one_time";
  const base = { precio: fmtCLP(p.amount), monto: p.amount, unico, unidad: unico ? "pago único" : "al mes", endpoint: unico ? "/api/payments/create" as const : "/api/subscriptions/create" as const };
  if (key === PRODUCTO_PLAN) {
    return { ...base, nombre: PLANES_COPY.plan.nombre, incluye: `${PLANES_COPY.plan.resumen}. ${PLANES_COPY.plan.condicion}.` };
  }
  if (key === PRODUCTO_TRES || key === PRODUCTO_PACK) {
    return { ...base, nombre: PLANES_COPY.pack.nombre, incluye: `${p.capacity ?? 3} análisis que no vencen.` };
  }
  // El re-análisis al precio recomendado sin saldo (21-oct-2026, lib/reanalisis.ts): el depto y el precio a la vista.
  if (key === "single" && opts.analysisId && opts.reanalisis) {
    return {
      ...base,
      nombre: opts.reanalisis.direccion ? `Tu análisis de ${opts.reanalisis.direccion}` : opts.comuna ? `Tu análisis en ${opts.comuna}` : "Tu análisis",
      incluye: REANALISIS_COPY.compraIncluye(opts.reanalisis.precioUF),
    };
  }
  if (key === "single" && opts.analysisId) {
    return {
      ...base,
      nombre: opts.comuna ? `Tu análisis en ${opts.comuna}` : "Tu análisis",
      incluye: opts.companionStrId ? "El informe completo de este depto, en renta larga y en renta corta." : "El informe completo de este depto.",
    };
  }
  if (key === "single") return { ...base, nombre: "1 análisis", incluye: "Un análisis que no vence." };
  return { ...base, nombre: p.subject.replace(/^Franco — /, ""), incluye: unico ? `${p.capacity ?? 1} análisis.` : `${p.capacity ?? ""} análisis al mes.` };
}

/** La URL de esta misma compra, con todo lo que la acompaña. `pagar` = al volver con sesión (Google o el enlace del
 *  correo), seguir directo a Flow. */
export function urlCompra(q: { product: string; analysisId?: string | null; companionStrId?: string | null; origen?: string | null; variante?: string | null; volver?: string | null }, pagar = false): string {
  const p = new URLSearchParams({ product: q.product });
  if (q.analysisId) p.set("analysisId", q.analysisId);
  if (q.companionStrId) p.set("companionStrId", q.companionStrId);
  if (q.origen) p.set("origen", q.origen);
  if (q.variante) p.set("variante", q.variante);
  if (q.volver) p.set("volver", q.volver);
  if (pagar) p.set("pagar", "1");
  return `/checkout?${p.toString()}`;
}

// ── LA VUELTA DE FLOW ───────────────────────────────────────────────────────
export const RETORNO = {
  procesando: { titulo: "Confirmando tu pago…", cuerpo: "Esto toma unos segundos. No cierres esta página." },
  abriendo: { titulo: "Pago confirmado.", cuerpo: "Abriendo tu análisis…" },
  /** La compra salió de un depto de la selección (22-oct-2026, decisión de Fabrizio): la vuelta de Flow genera el
   *  informe sola y lo abre; mientras, dice de cuál (el depto como en las tarjetas: compra-desde-depto.ts › nombreDelDepto). */
  generandoDepto: (depto: string) => `Generando el informe de ${depto}…`,
  /** El estado C del mockup 4-ticket-y-popups.html (24-oct-2026): «Franco está analizando X. En unos segundos se abre el
   *  informe.» y, debajo de la barra, cuántos le quedan para cualquier otro depto. */
  desdeDepto: { antes: "Franco está analizando ", despues: ". En unos segundos se abre el informe." },
  quedanOtros: (n: number) => (n === 1 ? "Te queda 1 análisis para cualquier otro depto." : `Te quedan ${n} análisis para cualquier otro depto.`),
  pagado: {
    titulo: "Pago confirmado.",
    tres: "Tienes 3 análisis más.",
    uno: "Tienes un análisis más.",
  },
  rechazado: { titulo: "El pago no pasó.", cuerpo: "Flow lo rechazó o se canceló. No se hizo ningún cargo." },
  /** Sin depto de por medio (22-oct-2026): «Tienes un análisis más» y este botón. */
  irAlDashboard: "Ir a mi dashboard",
  volverDeptos: "Volver a los deptos",
  /** La compra salió del mapa de Explorar (23-oct-2026): de vuelta al mapa, con el depto que la pidió. */
  volverMapa: "Volver al mapa",
  seguir: "Seguir",
  reintentar: "Reintentar",
  pie: "Pagos procesados de forma segura por Flow.cl",
} as const;

/** El botón después de pagar: «Ir a mi dashboard», o de vuelta a los deptos si la compra salió de ahí y el informe no se
 *  pudo generar solo. Desde el 21-oct-2026 la selección vive en el dashboard: una vuelta a un depto (`/dashboard?t=…&a=…`)
 *  vuelve a ese depto. */
export function botonTrasPagar(volver: string | null | undefined): { texto: string; href: string } {
  if (volver && /^\/dashboard\?(?:[^#]*&)?t=[0-9a-f]{20,80}&a=/i.test(volver)) return { texto: RETORNO.volverDeptos, href: volver };
  if (!volver || volver === "/dashboard" || volver.startsWith("/dashboard?")) return { texto: RETORNO.irAlDashboard, href: "/dashboard" };
  if (volver.startsWith("/semanal")) return { texto: RETORNO.volverDeptos, href: volver };
  if (volver === "/explorar" || volver.startsWith("/explorar?")) return { texto: RETORNO.volverMapa, href: volver };
  return { texto: RETORNO.seguir, href: volver };
}

/** Adónde lleva «Reintentar»: la misma pantalla de compra, con lo que la compra traía. Sin producto conocido, a planes. */
export function rutaReintentar(r: { suscripcion?: boolean; producto?: string | null; analysisId?: string | null; companionStrId?: string | null; origen?: string | null; variante?: string | null; volver?: string | null }): string {
  if (r.suscripcion) return urlCompra({ product: PRODUCTO_PLAN });
  if (!r.producto || !seVende(r.producto)) return "/pricing";
  return urlCompra({
    product: r.producto,
    analysisId: r.producto === "single" || r.producto === PRODUCTO_PACK ? r.analysisId : null,
    companionStrId: r.producto === "single" ? r.companionStrId : null,
    origen: r.origen,
    variante: r.variante,
    volver: r.volver,
  });
}
