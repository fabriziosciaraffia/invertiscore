// ─────────────────────────────────────────────────────────────────────────────
// UNA SOLA PÁGINA PARA LA SELECCIÓN (21-oct-2026, recorrido real de Fabrizio por la puerta B): la selección —la del correo
// semanal, la del correo del día y la de un aviso inmediato— vive en el dashboard, como tarjetas con «Analizar este». El
// enlace del correo entra con el token y aterriza ahí, con el depto clicado arriba; /semanal redirige al dashboard. Esto
// es lo que hacía la página /semanal, sacado a un solo cargador: la selección viva (el caído trae su reemplazo), los dos
// bloques, las finanzas del aviso antes de gastar, el saldo y lo ya analizado. «¿Cuándo piensas comprar?» ya no va arriba:
// en el dashboard la pregunta el perfil de la casa (PerfilBusquedaCasa), a quien nunca la contestó, y no se repite.
// LO YA ANALIZADO, EN VIVO: en renta larga se lee de los informes de la persona hechos desde un aviso
// (`input_data.origenAviso.avisoId`), no solo de lo que la selección traía al armarse; así, al volver del informe, la
// tarjeta ya dice «Ya lo analizaste · Ver informe», también en la primera selección del día.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoSaldo, leerSaldo, type EstadoSaldo } from "@/lib/casa-saldo";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { bloqueDelDestacado, type FilaPaginaSemanal } from "@/lib/guia/semanal";
import { resumenSeleccion, type ResumenBloque } from "@/lib/guia/seleccion-casa";
import { clasePinDeItem } from "@/lib/casa/mapa-casa";
import type { ClasePin } from "@/lib/explorar/colores-pin";
import type { ResumenInforme } from "@/lib/informe-propio";
import { resumenesDeInformes } from "@/lib/informe-propio-servidor";
import {
  condicionesDeAvisos, conCondicion, finanzasDeSeleccion, informesEnRentaCorta, noDanEnRentaCorta, seleccionDeEstaSemana, seleccionPorToken, seleccionViva, type ItemSemanal, type SeleccionPorToken,
} from "@/lib/guia/semanal-servidor";

const TOKEN = /^[0-9a-f]{20,80}$/i;

export interface BloquePagina {
  origenId: string | null;
  combinacion: { piePct: number; plazoAnios: number; tasaPct?: number | null } | null;
  filas: Array<FilaPaginaSemanal<ItemSemanal>>;
  finanzas: { tasa: number | null; uf: number | null; arriendos: Record<string, number> };
  noDan: string[];
  /** El enlace a la publicación de los que no dieron (05-nov-2026): la tarjeta lo muestra junto a «Analizar igual». */
  publicaciones?: Record<string, string>;
  informes: Record<string, string>;
  /** El resumen de cada informe de la persona que muestra la página (05-nov-2026, informe-propio.ts): la tarjeta de un ya
   *  analizado dice su informe, no la noche. Por id de informe. */
  resumenes: Record<string, ResumenInforme>;
}

export interface SeleccionPagina {
  /** El token es de otra cuenta: la página lo dice y no muestra nada. */
  otraCuenta: boolean;
  token: string;
  fuente: SeleccionPorToken["fuente"];
  variante: SeleccionPorToken["variante"];
  saldo: EstadoSaldo;
  /** Sin saldo, el pack va al precio del ticket: la cuenta tiene menos de 24 horas y no lo pagó (compra-desde-depto.ts). */
  ticket: boolean;
  /** Con el ticket vivo (22-oct-2026): cuándo nació la cuenta, para la línea «Hoy, 3 más por $14.990 · vence …» con saldo. */
  cuentaCreadaAt: string | null;
  destacado: string | null;
  largo: BloquePagina | null;
  corto: BloquePagina | null;
  /** El depto clicado está en el bloque de renta corta: ese va primero. */
  cortoPrimero: boolean;
}

/** ¿Hay deptos que mostrar? La selección es de quien entró y tiene alguna fila en alguno de sus bloques. */
export function hayDeptos(s: SeleccionPagina | null): s is SeleccionPagina {
  return !!s && !s.otraCuenta && (s.largo?.filas.length ?? 0) + (s.corto?.filas.length ?? 0) > 0;
}

/**
 * EL MAPA Y LAS TARJETAS EN EL MISMO ORDEN (28-oct-2026, decisión de Fabrizio): los bloques en el orden en que se dibujan
 * (el del depto clicado primero), cada uno con el número de su primera tarjeta —el segundo sigue la cuenta del primero—, y
 * los deptos del mapa en ese orden, el reemplazo del caído en su lugar. El pin N es la tarjeta N, tenga la persona renta
 * larga, renta corta o las dos (antes el mapa leía solo el bloque largo y quien tenía solo renta corta no lo veía).
 */
export function bloquesEnOrden(s: SeleccionPagina): Array<{ bloque: "largo" | "corto"; desde: number; filas: BloquePagina["filas"] }> {
  const orden: Array<["largo" | "corto", BloquePagina | null]> = s.cortoPrimero ? [["corto", s.corto], ["largo", s.largo]] : [["largo", s.largo], ["corto", s.corto]];
  const out: Array<{ bloque: "largo" | "corto"; desde: number; filas: BloquePagina["filas"] }> = [];
  let n = 1;
  for (const [bloque, b] of orden) {
    if (!b || b.filas.length === 0) continue;
    out.push({ bloque, desde: n, filas: b.filas });
    n += b.filas.length;
  }
  return out;
}

/** Los deptos del mapa, en el orden de las tarjetas (bloquesEnOrden). Sin deptos, ninguno. */
export function deptosDelMapa(s: SeleccionPagina | null): Array<{ avisoId: string; comuna: string; clase: ClasePin }> {
  if (!hayDeptos(s)) return [];
  // La clase del pin (03-nov-2026): el ya analizado (en vivo, por sus informes), el que conviene negociando o el que conviene.
  const informes = { ...(s.largo?.informes ?? {}), ...(s.corto?.informes ?? {}) };
  return bloquesEnOrden(s).flatMap((b) => b.filas.map((f) => f.reemplazo ?? f.item)).map((i) => ({ avisoId: i.avisoId, comuna: i.comuna, clase: clasePinDeItem(i, informes) }));
}

/** El resumen para el banner de arriba del dashboard (casa-arriba.ts): los deptos vivos de cada bloque. null: no hay. */
export function resumenDePagina(s: SeleccionPagina | null): ResumenBloque[] | null {
  if (!hayDeptos(s)) return null;
  const items = (b: BloquePagina | null) => (b?.filas ?? []).map((f) => f.reemplazo ?? f.item);
  return resumenSeleccion({ conLargo: !!s.largo, items: items(s.largo), corto: s.corto ? { items: items(s.corto) } : null });
}

/** Los informes de renta larga de la persona hechos desde estos avisos: aviso → informe (el más reciente). */
export async function informesDeAvisos(admin: SupabaseClient, userId: string, avisoIds: string[]): Promise<Record<string, string>> {
  if (avisoIds.length === 0) return {};
  const { data, error } = await admin.from("analisis").select("id, aviso:input_data->origenAviso->>avisoId, created_at")
    .eq("user_id", userId).eq("tipo_analisis", "long-term").in("input_data->origenAviso->>avisoId", avisoIds.slice(0, 100))
    .order("created_at", { ascending: true });
  reportarFalloQuery(error, { ruta: "lib/guia/seleccion-pagina-servidor", operacion: "informes-de-avisos", userId });
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; aviso: string | null }>) if (r.aviso) out[r.aviso] = r.id;
  return out;
}

/** La selección que muestra el dashboard: la del token del correo (`t`), o la de esta semana de quien entró. null: no hay. */
export async function cargarSeleccionPagina(admin: SupabaseClient, user: { id: string; created_at?: string | null }, p: { t?: string | null; a?: string | null }): Promise<SeleccionPagina | null> {
  const userId = user.id;
  const t = p.t && TOKEN.test(p.t) ? p.t : null;
  const sel = t ? await seleccionPorToken(admin, t) : await seleccionDeEstaSemana(admin, userId);
  if (!sel) return null;
  const otraCuenta = sel.user_id !== userId;
  if (otraCuenta) {
    return { otraCuenta, token: sel.token, fuente: sel.fuente, variante: sel.variante, saldo: { tipo: "sin" }, ticket: false, cuentaCreadaAt: null, destacado: null, largo: null, corto: null, cortoPrimero: false };
  }
  const cfg = await leerConfigGuia(admin);
  const tabla = sel.fuente === "inmediato" ? "avisos_inmediatos" : "semanal_selecciones";
  const [filasGuardadas, filasCortasGuardadas] = await Promise.all([
    sel.conLargo ? seleccionViva(admin, { tabla, id: sel.id, userId, items: sel.items }, cfg) : Promise.resolve([]),
    sel.corto ? seleccionViva(admin, { tabla, id: sel.id, userId, items: sel.corto.items, modalidad: "str" }, cfg) : Promise.resolve([]),
  ]);
  // Nuevo o usado (28-oct-2026, la línea de la ficha): a lo armado antes de que el ítem trajera la condición, la del aviso.
  const delAviso = await condicionesDeAvisos(admin, [...filasGuardadas, ...filasCortasGuardadas].flatMap((f) => [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]).filter((i) => !i.condicion).map((i) => i.avisoId));
  const completar = <F extends { item: ItemSemanal; reemplazo?: ItemSemanal | null }>(fs: F[]): F[] => fs.map((f) => ({ ...f, item: conCondicion(f.item, delAviso), ...(f.reemplazo ? { reemplazo: conCondicion(f.reemplazo, delAviso) } : {}) }));
  const filas = completar(filasGuardadas), filasCortas = completar(filasCortasGuardadas);
  const a = p.a ?? null;
  const primero = <F extends { item: { avisoId: string } }>(fs: F[]) => (a ? [...fs.filter((f) => f.item.avisoId === a), ...fs.filter((f) => f.item.avisoId !== a)] : fs);
  const ids = filas.flatMap((f) => [f.item.avisoId, ...(f.reemplazo ? [f.reemplazo.avisoId] : [])]);
  const idsCortos = filasCortas.flatMap((f) => [f.item.avisoId, ...(f.reemplazo ? [f.reemplazo.avisoId] : [])]);
  const [datosSaldo, ticket, finanzas, finanzasCorto, noDan, informesCortos, informesLargos] = await Promise.all([
    leerSaldo(admin, userId),
    ticketDeCuentaDisponible(admin, user),
    finanzasDeSeleccion(admin, sel.origen_analysis_id, ids, cfg.uf, cfg.tasa),
    sel.corto ? finanzasDeSeleccion(admin, sel.corto.origenId, [], cfg.uf, cfg.tasa) : Promise.resolve(null),
    sel.corto ? noDanEnRentaCorta(admin, userId, idsCortos) : Promise.resolve([] as string[]),
    sel.corto ? informesEnRentaCorta(admin, userId, idsCortos) : Promise.resolve({} as Record<string, string>),
    informesDeAvisos(admin, userId, ids),
  ]);
  // LA TARJETA DE UN ANALIZADO DICE SU INFORME (05-nov-2026): el resumen de cada informe de la persona que la página muestra,
  // de los mapas y de los ítems que ya lo traen (lo visto como «analizado»).
  const idsDeInformes = (fs: typeof filas, mapa: Record<string, string>) => [...Object.values(mapa), ...fs.flatMap((f) => [f.item.informeId, f.reemplazo?.informeId])];
  const [resumenes, publicaciones] = await Promise.all([
    resumenesDeInformes(admin, userId, [...idsDeInformes(filas, informesLargos), ...idsDeInformes(filasCortas, informesCortos)]),
    // «TE MOSTRAMOS LA PUBLICACIÓN IGUAL», también en la tarjeta (05-nov-2026): el enlace de los que no dieron.
    publicacionesDeAvisos(admin, noDan),
  ]);
  const ingresosCortos: Record<string, number> = {};
  for (const f of filasCortas) for (const it of [f.item, ...(f.reemplazo ? [f.reemplazo] : [])]) if (it.ingresoMensual != null && it.ingresoMensual > 0) ingresosCortos[it.avisoId] = it.ingresoMensual;
  return {
    otraCuenta: false,
    token: sel.token,
    fuente: sel.fuente,
    variante: sel.variante,
    saldo: estadoSaldo(datosSaldo),
    ticket,
    cuentaCreadaAt: ticket ? (user.created_at ?? null) : null,
    destacado: a,
    largo: sel.conLargo ? { origenId: sel.origen_analysis_id, combinacion: sel.combinacion, filas: primero(filas), finanzas, noDan: [], informes: informesLargos, resumenes } : null,
    corto: sel.corto ? {
      origenId: sel.corto.origenId, combinacion: sel.corto.combinacion, filas: primero(filasCortas),
      finanzas: { tasa: finanzasCorto?.tasa ?? null, uf: cfg.uf, arriendos: ingresosCortos }, noDan, publicaciones, informes: informesCortos, resumenes,
    } : null,
    cortoPrimero: sel.conLargo && sel.corto != null && bloqueDelDestacado(a, filas, filasCortas) === "corto",
  };
}

/** El enlace a la publicación de cada aviso (scraped_properties.url), para los que no dieron en renta corta. */
export async function publicacionesDeAvisos(admin: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  // Un lote acotado (CLAUDE.md › PostgREST corta en 1.000): los que no dieron de una selección son a lo más unos pocos.
  const { data } = await admin.from("scraped_properties").select("id, url").in("id", ids.slice(0, 100)).order("id").limit(100);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; url: string | null }>) if (r.url) out[r.id] = r.url;
  return out;
}
