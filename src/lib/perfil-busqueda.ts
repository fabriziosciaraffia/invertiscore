// ─────────────────────────────────────────────────────────────────────────────
// El perfil de búsqueda de una persona (02-oct-2026, decisión de Fabrizio): se alimenta de TODOS sus
// informes. Reglas:
//   · LO EDITADO A MANO MANDA sobre lo inferido, campo por campo (tabla `perfil_busqueda`; y dentro
//     de cada informe, lo elegido en «Estás dentro» —`pref_*`— manda sobre lo que dijo ese informe);
//   · LAS COMUNAS SE SUMAN: todas las de sus informes, sin repetir;
//   · EL RANGO DE PRECIO ES UN CHIP DE /deptos (26-oct-2026, decisión de Fabrizio): el de los cuatro —hasta UF 3.000,
//     3.000 a 4.000, 4.000 a 6.000, más de 6.000— que contiene el precio analizado, igual que lo elige una persona en la
//     puerta B. Con varios informes, del chip del más barato al del más caro. Hasta el 26-oct era una banda de UF 100
//     alrededor del precio (y con un precio redondo el semanal buscaba desde UF 0). Un precio fuera de UF 500 a 50.000 es un
//     error de tipeo (pesos escritos como UF, ceros de más) y no arma rango;
//   · dormitorios: todos los que analizó; modalidad, pie y plazo: los del informe más reciente;
//   · «¿Cuándo piensas comprar?»: lo editado, o la última respuesta que dio en un informe.
//   · SIN INFORMES (16-oct-2026, la puerta B): la cuenta que nace en /deptos tiene solo lo editado a mano —comunas,
//     dormitorios, un RANGO de precio (piso y tope), modalidad, pie y plazo— y con eso se busca igual.
// Puro: el tier CASA lo prueba con filas de ejemplo.
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { RANGOS_UF, type RangoUf } from "@/lib/deptos/respuesta";

/** Los precios con que la inferencia arma un rango: fuera de esto es un error de tipeo y se descarta. */
export const PRECIO_INFERIBLE_MIN_UF = 500;
export const PRECIO_INFERIBLE_MAX_UF = 50_000;
export const precioInferible = (uf: number | null | undefined): uf is number =>
  uf != null && Number.isFinite(uf) && uf >= PRECIO_INFERIBLE_MIN_UF && uf <= PRECIO_INFERIBLE_MAX_UF;

/** El chip de /deptos que contiene un precio. El borde va al de abajo: «hasta UF 3.000» incluye 3.000 (la misma cuenta
 *  que `deptos_conteo`, que busca con `between`). */
export function rangoDelPrecio(uf: number): RangoUf {
  return RANGOS_UF.find((r) => uf <= r.max) ?? RANGOS_UF[RANGOS_UF.length - 1];
}

export type Horizonte = "ya" | "meses" | "mirando";
export type Modalidad = "ltr" | "str";

/** Una fila de `perfiles_inversion` (un informe), con el plazo de su `input_data`. */
export interface FilaPerfilInforme {
  creadoAt: string;
  tipologia: string | null;
  comuna: string | null;
  modalidad: Modalidad;
  presupuestoUf: number | null;
  piePct: number | null;
  plazoAnios: number | null;
  prefTipologia: string | null;
  prefComuna: string | null;
  prefModalidad: Modalidad | null;
  horizonte: Horizonte | null;
}

/** Lo editado a mano (`perfil_busqueda`); null = no lo tocó. */
export interface PerfilManual {
  dormitorios: number[] | null;
  comunas: string[] | null;
  precioMaxUf: number | null;
  /** El piso del rango, elegido a mano (/deptos, 16-oct-2026): se busca desde ahí, sin la holgura de lo inferido. */
  precioMinUf?: number | null;
  modalidad: Modalidad | null;
  piePct: number | null;
  plazoAnios: number | null;
  horizonte: Horizonte | null;
}

export const MANUAL_VACIO: PerfilManual = { dormitorios: null, comunas: null, precioMaxUf: null, precioMinUf: null, modalidad: null, piePct: null, plazoAnios: null, horizonte: null };

export interface PerfilBusqueda {
  dormitorios: number[];
  comunas: string[];
  precioMinUf: number | null;
  precioMaxUf: number | null;
  modalidad: Modalidad;
  piePct: number | null;
  plazoAnios: number | null;
  horizonte: Horizonte | null;
  /** Qué campos vienen de la mano de la persona. */
  editado: Array<"dormitorios" | "comunas" | "precio" | "precioMin" | "modalidad" | "pie" | "plazo" | "horizonte">;
  /** Hay con qué buscar: al menos una comuna, un dormitorio y un tope. */
  completo: boolean;
}

/** «2D2B» → 2; «Studio» → 0; «3D» → 3. */
export function dormitoriosDe(tipologia: string | null | undefined): number | null {
  if (!tipologia) return null;
  if (/^studio/i.test(tipologia.trim())) return 0;
  const m = tipologia.match(/(\d+)\s*D/i);
  return m ? Number(m[1]) : null;
}


export function perfilDeBusqueda(filas: FilaPerfilInforme[], manual: PerfilManual = MANUAL_VACIO): PerfilBusqueda {
  const orden = [...filas].sort((a, b) => b.creadoAt.localeCompare(a.creadoAt));
  const reciente = orden[0];
  const editado: PerfilBusqueda["editado"] = [];

  // Dormitorios: los de todos sus informes (lo elegido en el informe manda sobre lo que dijo).
  let dormitorios = Array.from(new Set(orden.map((f) => dormitoriosDe(f.prefTipologia ?? f.tipologia)).filter((d): d is number => d != null))).sort((a, b) => a - b);
  if (manual.dormitorios && manual.dormitorios.length > 0) { dormitorios = Array.from(new Set(manual.dormitorios)).sort((a, b) => a - b); editado.push("dormitorios"); }

  // Comunas: se suman.
  let comunas = Array.from(new Set(orden.map((f) => (f.prefComuna ?? f.comuna)?.trim()).filter((c): c is string => !!c)));
  if (manual.comunas && manual.comunas.length > 0) { comunas = Array.from(new Set(manual.comunas.map((c) => c.trim()).filter(Boolean))); editado.push("comunas"); }

  // Precio: el chip de /deptos de lo analizado (del chip del más barato al del más caro); lo mal tipeado no cuenta.
  const precios = orden.map((f) => f.presupuestoUf).filter(precioInferible);
  let precioMaxUf = precios.length ? rangoDelPrecio(Math.max(...precios)).max : null;
  let precioMinUf = precios.length ? rangoDelPrecio(Math.min(...precios)).min : null;
  if (manual.precioMaxUf != null && manual.precioMaxUf > 0) {
    // Lo editado manda entero: con el tope elegido a mano, el piso es el que eligió (abajo) o ninguno —el perfil dice
    // «Hasta UF X» y busca desde cero—, nunca el piso de los informes debajo de un tope que no es el suyo.
    precioMaxUf = manual.precioMaxUf;
    precioMinUf = null;
    editado.push("precio");
  }
  if (manual.precioMinUf != null && manual.precioMinUf > 0 && (precioMaxUf == null || manual.precioMinUf < precioMaxUf)) {
    precioMinUf = manual.precioMinUf;
    editado.push("precioMin");
  }

  let modalidad: Modalidad = reciente ? (reciente.prefModalidad ?? reciente.modalidad) : "ltr";
  if (manual.modalidad) { modalidad = manual.modalidad; editado.push("modalidad"); }

  const ltrReciente = orden.find((f) => (f.prefModalidad ?? f.modalidad) === "ltr");
  let piePct = ltrReciente?.piePct ?? reciente?.piePct ?? null;
  if (manual.piePct != null) { piePct = manual.piePct; editado.push("pie"); }
  let plazoAnios = ltrReciente?.plazoAnios ?? null;
  if (manual.plazoAnios != null) { plazoAnios = manual.plazoAnios; editado.push("plazo"); }

  let horizonte = orden.find((f) => f.horizonte != null)?.horizonte ?? null;
  if (manual.horizonte) { horizonte = manual.horizonte; editado.push("horizonte"); }

  return {
    dormitorios, comunas, precioMinUf, precioMaxUf, modalidad, piePct, plazoAnios, horizonte, editado,
    completo: comunas.length > 0 && dormitorios.length > 0 && precioMaxUf != null,
  };
}

// Lo que llega de «Tu perfil de búsqueda» (PUT /api/perfil-busqueda): cada campo opcional, `null` vuelve
// a lo inferido. Devuelve las columnas de `perfil_busqueda` a escribir.
const HORIZONTES_OK = new Set(["ya", "meses", "mirando"]);
const MODALIDADES_OK = new Set(["ltr", "str"]);
const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);

type Cambios = Record<string, unknown>;

export function validarCambiosPerfil(b: Record<string, unknown>): { ok: true; cambios: Cambios } | { ok: false; error: string } {
  const c: Cambios = {};
  if ("dormitorios" in b) {
    if (b.dormitorios === null) c.dormitorios = null;
    else if (Array.isArray(b.dormitorios) && b.dormitorios.length > 0 && b.dormitorios.length <= 5 && b.dormitorios.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 5)) c.dormitorios = Array.from(new Set(b.dormitorios as number[])).sort();
    else return { ok: false, error: "Dormitorios inválidos" };
  }
  if ("comunas" in b) {
    if (b.comunas === null) c.comunas = null;
    else if (Array.isArray(b.comunas) && b.comunas.length > 0 && b.comunas.length <= 8 && b.comunas.every((x) => typeof x === "string" && COMUNAS_OK.has(x))) c.comunas = Array.from(new Set(b.comunas as string[]));
    else return { ok: false, error: "Comunas inválidas" };
  }
  if ("precioMinUf" in b) {
    if (b.precioMinUf === null) c.precio_min_uf = null;
    else if (typeof b.precioMinUf === "number" && b.precioMinUf >= 500 && b.precioMinUf <= 60000) c.precio_min_uf = Math.round(b.precioMinUf);
    else return { ok: false, error: "Precio inválido" };
  }
  if ("precioMaxUf" in b) {
    if (b.precioMaxUf === null) c.precio_max_uf = null;
    else if (typeof b.precioMaxUf === "number" && b.precioMaxUf >= 500 && b.precioMaxUf <= 60000) c.precio_max_uf = Math.round(b.precioMaxUf);
    else return { ok: false, error: "Precio inválido" };
  }
  if ("modalidad" in b) {
    if (b.modalidad === null) c.modalidad = null;
    else if (MODALIDADES_OK.has(String(b.modalidad))) c.modalidad = String(b.modalidad);
    else return { ok: false, error: "Modalidad inválida" };
  }
  if ("piePct" in b) {
    if (b.piePct === null) c.pie_pct = null;
    else if (typeof b.piePct === "number" && b.piePct >= 0 && b.piePct <= 60) c.pie_pct = b.piePct;
    else return { ok: false, error: "Pie inválido" };
  }
  if ("plazoAnios" in b) {
    if (b.plazoAnios === null) c.plazo_anios = null;
    else if (Number.isInteger(b.plazoAnios) && (b.plazoAnios as number) >= 5 && (b.plazoAnios as number) <= 40) c.plazo_anios = b.plazoAnios;
    else return { ok: false, error: "Plazo inválido" };
  }
  if ("horizonte" in b) {
    if (b.horizonte === null) c.horizonte_compra = null;
    else if (HORIZONTES_OK.has(String(b.horizonte))) c.horizonte_compra = String(b.horizonte);
    else return { ok: false, error: "Horizonte inválido" };
  }
  if (typeof c.precio_min_uf === "number" && typeof c.precio_max_uf === "number" && c.precio_min_uf >= c.precio_max_uf) return { ok: false, error: "Precio inválido" };
  if (Object.keys(c).length === 0) return { ok: false, error: "Nada que guardar" };
  return { ok: true, cambios: c };
}
