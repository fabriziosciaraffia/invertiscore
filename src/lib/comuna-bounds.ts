// ─────────────────────────────────────────────────────────────────────────────
// CAJAS GEOGRÁFICAS PARA ACOTAR EL AUTOCOMPLETADO DE DIRECCIONES
//
// EL PROBLEMA QUE RESUELVEN
// ─────────────────────────
// El widget de Places solo aceptaba `componentRestrictions: { country: "cl" }`,
// que es lo único que ese campo admite —la API legacy no tiene restricción por
// región ni por comuna—. Resultado medido en producción el 20-ago-2026:
// escribir "Av. Providencia 1500" con el chip de Providencia tocado devolvía
//
//   Providencia · Ovalle · Valdivia · Arica · La Florida
//
// El chip prometía acotar el terreno y no acotaba nada, y encima invitaba a
// elegir una dirección de otra región que después el gate de cobertura rechaza.
//
// QUÉ ES FILTRO DURO Y QUÉ ES SESGO — la distinción importa
// ─────────────────────────────────────────────────────────
// Medido contra la API real, con el mismo texto y las mismas opciones:
//
//   solo país (hoy)          → Providencia, Ovalle, Valdivia, Arica, La Florida
//   + bounds RM, SIN strict  → Providencia, La Florida, Ovalle, Valdivia, Linares
//   + bounds RM, CON strict  → Providencia, La Florida, Padre Hurtado
//   + bounds comuna, strict  → Providencia
//
// `bounds` SOLO es un SESGO: reordena, no excluye — Ovalle y Valdivia siguen
// apareciendo, e incluso entra Linares. Como piso no sirve para nada.
// `strictBounds: true` sí EXCLUYE: es el único filtro duro que la API ofrece.
//
// Por eso acá no hay sesgo: la comuna elegida se aplica como FILTRO DURO
// (`strictBounds` sobre su caja), y como toda caja comunal está recortada
// contra el piso de cobertura, ese piso se cumple por construcción. Ovalle,
// Valdivia y Arica no pueden aparecer elija lo que elija el usuario.
//
// LA CAJA NO ES LA VERDAD, ES EL EMBUDO
// ─────────────────────────────────────
// Una caja es un rectángulo y una comuna no lo es, así que el rectángulo de
// Providencia muerde pedazos de Ñuñoa, Las Condes y Santiago. Eso está bien y es
// deliberado: la comuna DEFINITIVA se sigue derivando de los `address_components`
// de la dirección elegida, que ya mandan sobre el chip. La caja decide qué se
// ofrece; la dirección decide qué se guarda.
//
// DE DÓNDE SALEN LOS NÚMEROS
// ──────────────────────────
// De datos propios, no de una API: percentiles 0,5-99,5 de lat/lng de las
// 41.406 filas con coordenadas de `scraped_properties`, más 0,012° de margen
// (~1,3 km) y recorte contra el piso de cobertura.
//
// Percentiles y no min/max porque el scraping trae basura: La Florida tenía una
// fila en latitud +27,6 (hemisferio norte) que habría estirado su caja hasta el
// Caribe.
//
// COSTO MEDIDO DE FILTRAR DURO: 0,58% de los avisos propios cae fuera de la caja
// de su comuna (peor caso Estación Central, 1,12%). Ese ~1% es la razón por la
// que la pantalla SIEMPRE ofrece salida cuando no encuentra nada — sin esa
// salida, filtrar duro reintroduciría un callejón sin salida.
//
// Cuándo regenerar: si se abre cobertura a una comuna nueva. Los límites
// comunales no se mueven, así que la tabla no envejece por sí sola.
// ─────────────────────────────────────────────────────────────────────────────

/** `[sur, oeste, norte, este]` en grados. */
export type Caja = readonly [number, number, number, number];

/**
 * PISO DURO — el área que Franco CUBRE, no la Región Metropolitana entera.
 *
 * El piso pedido era "la RM", pero un rectángulo alrededor de la RM **no puede
 * excluir a Viña del Mar**: la RM no es un rectángulo y Viña (-33,02 · -71,55)
 * cae adentro de cualquier caja que contenga el extremo poniente y el norte de
 * la región. Lo cazó un test antes de que llegara a producción.
 *
 * Este piso es la UNIÓN de las 24 comunas cubiertas más 0,03° (~3 km) de margen.
 * Es estrictamente más fuerte que la RM: excluye Ovalle, Valdivia, Arica,
 * Linares y también Viña, y además coincide con la cobertura real del producto
 * en vez de con una frontera administrativa que Franco no usa para nada.
 *
 * Se usa cuando todavía no hay comuna elegida, cuando la comuna no tiene caja
 * propia, y como recorte de todas las demás.
 *
 * Ojo con el camino de la lista de espera: quien elige por el buscador una
 * comuna de la RM sin cobertura ve el rechazo y la captura de correo APENAS la
 * elige, sin necesidad de escribir una dirección. Que su comuna quede fuera de
 * este piso no le cierra ninguna puerta.
 */
export const CAJA_COBERTURA: Caja = [-33.67, -70.83, -33.3, -70.45];

/** Cajas por comuna cubierta. Ver la cabecera para la metodología. */
const CAJAS: Record<string, Caja> = {
  santiago: [-33.5621, -70.7706, -33.3958, -70.5688],
  providencia: [-33.4828, -70.6778, -33.3999, -70.5712],
  "las condes": [-33.4428, -70.6163, -33.3586, -70.4877],
  vitacura: [-33.4276, -70.6213, -33.3566, -70.5071],
  "lo barnechea": [-33.4609, -70.6813, -33.3282, -70.4757],
  nunoa: [-33.5168, -70.6778, -33.3999, -70.559],
  "la reina": [-33.4738, -70.6095, -33.4194, -70.5139],
  macul: [-33.5219, -70.6323, -33.4594, -70.567],
  penalolen: [-33.5232, -70.6107, -33.4502, -70.5118],
  "la florida": [-33.5773, -70.6228, -33.4928, -70.5215],
  "san joaquin": [-33.5197, -70.6535, -33.4583, -70.6039],
  maipu: [-33.5415, -70.7992, -33.4576, -70.7181],
  pudahuel: [-33.4832, -70.7844, -33.414, -70.7198],
  cerrillos: [-33.527, -70.751, -33.4373, -70.6306],
  "estacion central": [-33.4972, -70.7427, -33.4356, -70.6323],
  "quinta normal": [-33.4567, -70.7272, -33.3996, -70.666],
  independencia: [-33.4636, -70.6895, -33.3836, -70.6201],
  recoleta: [-33.4895, -70.6778, -33.3674, -70.5926],
  huechuraba: [-33.4411, -70.7005, -33.3364, -70.5931],
  conchali: [-33.4472, -70.7039, -33.3587, -70.6423],
  quilicura: [-33.3996, -70.7599, -33.34, -70.7064],
  "san miguel": [-33.529, -70.677, -33.4656, -70.6252],
  "la cisterna": [-33.5572, -70.6954, -33.4412, -70.6261],
  "puente alto": [-33.6416, -70.6297, -33.5464, -70.5288],
};

function normalizar(comuna: string): string {
  return comuna
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Caja con la que acotar el autocompletado.
 *
 * Sin comuna, o con una comuna sin caja propia (fuera de cobertura, o del
 * dataset interno con otro nombre), cae a la RM: el piso duro NUNCA se pierde.
 * Devolver `undefined` sería volver al "todo Chile" que este módulo viene a
 * cerrar.
 */
export function cajaParaComuna(comuna: string | null | undefined): Caja {
  if (!comuna) return CAJA_COBERTURA;
  // "Santiago Centro" es el nombre del dataset interno para la misma comuna que
  // Places devuelve como "Santiago" (mismo alias que `comunas-disponibles.ts`).
  const k = normalizar(comuna);
  return CAJAS[k] ?? CAJAS[k === "santiago centro" ? "santiago" : ""] ?? CAJA_COBERTURA;
}

/** ¿La comuna tiene caja propia, o se está cayendo al piso regional? */
export function tieneCajaPropia(comuna: string | null | undefined): boolean {
  if (!comuna) return false;
  const k = normalizar(comuna);
  return k in CAJAS || k === "santiago centro";
}

/** ¿El punto cae dentro de la caja? Usado por los tests y por diagnósticos. */
export function dentroDeCaja(caja: Caja, lat: number, lng: number): boolean {
  const [s, w, n, e] = caja;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}
