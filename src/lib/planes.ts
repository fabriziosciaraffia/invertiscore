// ─────────────────────────────────────────────────────────────────────────────
// LA OFERTA (19-oct-2026, decisión de Fabrizio). Cuatro productos y nada más:
//   · el SUELTO, $9.990: visible y comprable, en segundo plano, como precio de referencia («o 1 por $9.990»);
//   · el TICKET de 24 horas, 3 por $14.990: el pack con descuento para el usuario nuevo (lo-que-sigue/oferta-pack.ts);
//   · el PACK, 3 por $19.990, sin vencimiento (tres-analisis.ts);
//   · el PLAN FRANCO, 20 análisis al mes por $39.990: los lotes se acumulan y vencen a los 12 meses. Es el producto
//     `plan10_mensual` de Flow con 20 por ciclo —el mismo planId y el mismo monto—, así la persona que tenía el plan de 10
//     pasa a 20 en su renovación sin tocar su suscripción.
// El plan de 50, el ilimitado, los anuales y el «informe completo» de $4.990 dejan de mostrarse y de venderse
// (VENTA_RETIRADA): las rutas de cobro los rechazan. Lo ya comprado se respeta: siguen en el catálogo de Flow, así que
// una suscripción vigente renueva y un lote ya otorgado vale hasta su vencimiento.
// La página de planes muestra tres columnas —gratis, pack y plan— y el suelto como botón secundario bajo el del pack. Lo
// fija el tier PLANES.
// ─────────────────────────────────────────────────────────────────────────────
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";
import { fmtCLP } from "@/lib/pricing";
import { PRODUCTO_TRES, TRES_PRECIO_CLP } from "@/lib/tres-analisis";

/** El producto de Flow del Plan Franco. */
export const PRODUCTO_PLAN: FlowProductKey = "plan10_mensual";
export const PLAN_ANALISIS_MES = FLOW_PRODUCTS.plan10_mensual.capacity ?? 20;
export const PLAN_PRECIO_CLP = FLOW_PRODUCTS.plan10_mensual.amount;

/** Lo que dejó de venderse el 19-oct-2026. Lo ya comprado sigue vigente. */
export const VENTA_RETIRADA: ReadonlySet<FlowProductKey> = new Set<FlowProductKey>([
  "plan10_annual", "plan50_mensual", "plan50_annual", "unlimited_mensual", "unlimited_annual", "unlock",
]);

export function seVende(key: string): boolean {
  return key in FLOW_PRODUCTS && !VENTA_RETIRADA.has(key as FlowProductKey);
}

/** Las rutas de compra (el checkout pide sesión y vuelve). */
export const RUTA_PLAN = `/checkout?product=${PRODUCTO_PLAN}`;
export const RUTA_SUELTO_PLANES = "/checkout?product=single";

/** El precio de cada análisis dentro de un producto: el pack, $19.990 / 3 = $6.663; el plan, $39.990 / 20 = $2.000. */
export const porAnalisis = (total: number, cantidad: number) => fmtCLP(Math.round(total / cantidad));
const SUELTO_CLP = FLOW_PRODUCTS.single.amount;

/**
 * LA PÁGINA DE PLANES, SEGUNDA PASADA (19-oct-2026, decisión de Fabrizio): una sola línea arriba que dice qué tienen los
 * tres en común (el semanal) y qué cambia (cuántos análisis); las dos tarjetas pagadas con la misma estructura; sin
 * describir qué trae el análisis —para eso, el demo—. La cifra grande es LO QUE SE PAGA ($19.990 de una vez, $39.990 al
 * mes) y la línea de abajo hace la cuenta del ahorro: cuánto sale cada análisis contra el suelto.
 */
export const PLANES_COPY = {
  titulo: "Elige cómo usar Franco",
  bajada: "Con cualquiera de los tres recibes cada semana los deptos que convienen según tu perfil. La diferencia es cuántos análisis tienes para los que te interesan.",
  gratis: {
    nombre: "Gratis",
    precio: "$0",
    incluye: ["Cada semana, los deptos que convienen según tu perfil", "Un análisis gratis al crear tu cuenta", "Un análisis más por cada amigo que invites"],
    // «Empezar gratis» (19-oct-2026, decisión de Fabrizio): a /deptos, que desde planes dice arriba qué hacer ahí.
    boton: "Empezar gratis",
    ruta: "/deptos?desde=planes",
  },
  pack: {
    nombre: "Pack de 3",
    detalle: "Todo lo de Gratis, más 3 análisis",
    precio: fmtCLP(TRES_PRECIO_CLP),
    unidad: "pago único",
    ahorro: `${porAnalisis(TRES_PRECIO_CLP, 3)} cada uno, en vez de ${fmtCLP(SUELTO_CLP)}`,
    condicion: "No vencen",
    boton: "Comprar el pack",
    suelto: `Comprar solo 1 por ${fmtCLP(SUELTO_CLP)}`,
    producto: PRODUCTO_TRES,
  },
  plan: {
    nombre: "Plan Franco",
    detalle: `Todo lo de Gratis, más ${PLAN_ANALISIS_MES} análisis cada mes`,
    /** Lo que se lee en la cuenta: «Plan Franco · 20 análisis al mes». */
    resumen: `${PLAN_ANALISIS_MES} análisis al mes`,
    precio: fmtCLP(PLAN_PRECIO_CLP),
    unidad: "al mes",
    ahorro: `${porAnalisis(PLAN_PRECIO_CLP, PLAN_ANALISIS_MES)} cada uno, en vez de ${fmtCLP(SUELTO_CLP)}`,
    condicion: "Los que no uses se acumulan por un año. Cancelas cuando quieras",
    boton: "Contratar el plan",
  },
  demo: { antes: "¿Quieres ver cómo es un análisis?", enlace: "Mira uno real", ruta: "/demo" },
  /** Para quien ya tiene el plan: el botón no vuelve a venderlo. */
  planActivo: "Ya tienes el Plan Franco",
} as const;

/**
 * EL AUMENTO (19-oct-2026, decisión de Fabrizio): quien tenía el plan de 10 pasa a 20 al mismo precio en su renovación,
 * con un correo que lo cuenta como aumento. Sale UNA vez: en el cobro que otorga el primer lote de 20 a una cuenta que
 * ya había recibido lotes de menos. `montos`: los lotes del plan de la cuenta, con el recién otorgado incluido.
 */
export function correspondeAvisoAumento(montos: readonly number[], capacidad: number = PLAN_ANALISIS_MES): boolean {
  return montos.some((m) => m < capacidad) && montos.filter((m) => m >= capacidad).length === 1;
}

export const AUMENTO_COPY = {
  asunto: `Tu plan ahora trae ${PLAN_ANALISIS_MES} análisis al mes`,
  titular: `Ahora son ${PLAN_ANALISIS_MES} análisis al mes`,
  cuerpo: (precio: string) =>
    `Tu plan pasó a llamarse Plan Franco y desde esta renovación trae ${PLAN_ANALISIS_MES} análisis al mes, el doble, al mismo precio: ${precio}. No tienes que hacer nada.`,
  acumulan: "Los análisis que no uses se acumulan y cada mes vence a los 12 meses, como siempre.",
  boton: "Analizar un depto",
} as const;

/** El nombre de un plan para mostrar (cuenta, correos): el de 10 ya es el Plan Franco. */
export function nombrePlan(activePlan: string | null | undefined, isUnlimited: boolean): string | null {
  if (isUnlimited || activePlan === "unlimited") return "Plan Ilimitado";
  if (activePlan === "plan50") return "Plan 50";
  if (activePlan === "plan10") return PLANES_COPY.plan.nombre;
  return null;
}
