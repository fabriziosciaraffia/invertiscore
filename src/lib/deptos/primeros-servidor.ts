// ─────────────────────────────────────────────────────────────────────────────
// Los primeros deptos de una cuenta (16-oct-2026, la puerta B; 20-oct-2026, todas las puertas): lo que muestra «Estás
// dentro» al terminar —en /deptos, en la página del invitado y SOBRE el informe (el banner)— y el dashboard de una cuenta
// sin informes. Si el correo del día ya eligió (sus deptos chequeados), esos, con la hora en que se vieron publicados; si
// todavía no, los mejores de la evaluación de la noche para su perfil (o de las comunas vecinas, si en las suyas no hay),
// con el día y la hora de su último chequeo si es de la última semana y «por confirmar» si no. Sin fichas: lo que ya se sabe.
// DESDE EL 20-oct-2026 CADA UNO SE PUEDE ANALIZAR DESDE YA: los de la noche quedan escritos en la fila pendiente del día
// (rellenarDeLaNoche) para que «Analizar este» valide el aviso por el token, y la respuesta trae lo que el aviso antes de
// gastar necesita (la combinación, el saldo, la tasa, la UF y el arriendo evaluado). Si el perfil no alcanza, dice qué
// chips faltan (`faltan`) y la pantalla los pide en un toque.
// LO YA ANALIZADO, EN VIVO (21-oct-2026): cada depto trae su informe si la persona ya lo analizó (`informeId`), para que la
// tarjeta diga «Ya lo analizaste · Ver informe» también en la primera selección del día.
// ─────────────────────────────────────────────────────────────────────────────
import type { DatosMapaCasa } from "@/lib/casa/mapa-casa-servidor";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { rangoSemanal } from "@/lib/guia/semanal";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { condicionesDeAvisos, conCondicion, finanzasDeSeleccion, origenDePersona, type ItemSemanal } from "@/lib/guia/semanal-servidor";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { estadoSaldo, leerSaldo, type EstadoSaldo } from "@/lib/casa-saldo";
import { regaloAltaVivo } from "@/lib/regalo-alta-servidor";
import { MAX_PRIMEROS, primerosDeptos, type PrimerDepto } from "./servidor";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "./estandar";
import { faltanDelPerfil, MINUTOS_CUPO_DEL_DIA, type FaltaDelPerfil } from "@/lib/guia/del-dia";
import { rellenarDeLaNoche } from "@/lib/guia/del-dia-servidor";
import { comunasVecinas } from "@/lib/comunas-vecinas";
import { informesDeAvisos } from "@/lib/guia/seleccion-pagina-servidor";

export interface FinanzasPrimeros {
  tasa: number | null;
  uf: number | null;
  arriendos: Record<string, number>;
}

export interface PrimerosDeLaCuenta {
  /** El correo del día todavía está revisando fichas (la pantalla vuelve a preguntar). */
  revisando: boolean;
  items: PrimerDepto[];
  /** El token de su selección del día: «Analizar este» valida el aviso con él (/api/lo-que-sigue/guia/analizar). */
  token: string | null;
  regaloVence: string | null;
  /** En sus comunas no había ninguno: estos son de las comunas vecinas (el mismo respaldo que el correo). */
  vecinas?: boolean;
  /** De dónde salieron: su selección del día ya chequeada, la evaluación de la noche, o nada. */
  fuente: "del_dia" | "noche" | "ninguno";
  /** El informe de origen de la selección (la puerta A), o null (el origen sintético de B y C). */
  origenId: string | null;
  /** El pie y el plazo con que se analiza cada uno. */
  combinacion: { piePct: number; plazoAnios: number } | null;
  /** Los chips que faltan para armar una selección (la pantalla los pide en un toque). */
  faltan: FaltaDelPerfil[];
  saldo: EstadoSaldo;
  finanzas: FinanzasPrimeros;
  /** Sin saldo, el pack va al precio del ticket (la cuenta tiene menos de 24 horas). Lo pone la ruta, que tiene la cuenta. */
  ticket?: boolean;
  /** Con el ticket vivo (22-oct-2026): cuándo nació la cuenta, para la línea del ticket con saldo. Lo pone la ruta. */
  cuentaCreadaAt?: string | null;
  /** El mapa de la selección: quieto en «Estás dentro» (`mapa=1`, 24-oct-2026), el de la casa con los grises para el
   *  respaldo del dashboard (`mapa=casa`, 28-oct-2026). Lo pone la ruta. */
  mapa?: DatosMapaCasa | null;
  /** Cuántos convenían anoche en Santiago, para el botón del mapa de la casa. Lo pone la ruta. */
  totalNoche?: number | null;
}

type FilaDia = { id: string; token: string; estado: string; items: unknown; armada_at: string; enviada_at: string | null; intentos: number; combinacion: unknown; origen_analysis_id: string | null };

export async function primerosDeLaCuenta(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<PrimerosDeLaCuenta> {
  const [{ data: filaCruda }, regaloVence, cfg, datosSaldo] = await Promise.all([
    admin.from("semanal_selecciones").select("id, token, estado, items, armada_at, enviada_at, intentos, combinacion, origen_analysis_id").eq("user_id", userId).eq("tipo", "del_dia")
      .order("armada_at", { ascending: false }).limit(1).maybeSingle(),
    regaloAltaVivo(admin, userId, ahora),
    leerConfigGuia(admin),
    leerSaldo(admin, userId),
  ]);
  const fila = (filaCruda ?? null) as FilaDia | null;
  const saldo = estadoSaldo(datosSaldo);
  const items = ((fila?.items ?? []) as ItemSemanal[]).filter((i) => i.veredicto);
  const minutos = fila ? (ahora.getTime() - Date.parse(fila.armada_at)) / 60_000 : Infinity;
  const revisando = !!fila && fila.estado === "pendiente" && !fila.enviada_at && minutos < MINUTOS_CUPO_DEL_DIA + 15;
  const token = fila?.token ?? null;
  const comboFila = (fila?.combinacion ?? null) as { piePct: number; plazoAnios: number } | null;
  const finanzasDe = (origenId: string | null, ids: string[]) => finanzasDeSeleccion(admin, origenId, ids, cfg.uf, cfg.tasa);

  // La fila del día ya tiene deptos: los chequeados por la cola, o los de la noche que esta misma pantalla escribió.
  if (items.length > 0 && fila) {
    const ids = items.map((i) => i.avisoId);
    const [{ data: pubs }, finanzas, informes, delAviso] = await Promise.all([
      admin.from("publicacion_avisos").select("aviso_id, chequeado_at").in("aviso_id", ids).eq("estado", "publicado"),
      finanzasDe(fila.origen_analysis_id, ids),
      informesDeAvisos(admin, userId, ids),
      // Nuevo o usado (28-oct-2026): lo escrito antes de que el ítem trajera la condición, la del aviso.
      condicionesDeAvisos(admin, items.filter((i) => !i.condicion).map((i) => i.avisoId)),
    ]);
    const at = new Map(((pubs ?? []) as Array<{ aviso_id: string; chequeado_at: string }>).map((p) => [p.aviso_id, p.chequeado_at]));
    return {
      revisando, token, regaloVence, fuente: "del_dia", origenId: fila.origen_analysis_id, combinacion: comboFila, faltan: [], saldo, finanzas,
      vecinas: items.every((i) => i.tramo === "vecina"),
      items: items.slice(0, MAX_PRIMEROS).map((i) => conCondicion(i, delAviso)).map((i) => ({
        avisoId: i.avisoId, comuna: i.comuna, tipologia: i.tipologia, m2: i.m2, precioUF: i.precioUF, veredicto: i.veredicto ?? "COMPRAR",
        score: i.score, flujo: i.flujo, vistoAt: at.get(i.avisoId) ?? null, enSeleccion: true, informeId: informes[i.avisoId] ?? null,
        ...(i.condicion ? { condicion: i.condicion } : {}),
      })),
    };
  }
  // Todavía sin la selección del día: los mejores de la noche para su perfil.
  const pp = await leerPerfilBusqueda(admin, userId);
  const perfil = pp.perfilLtr ?? pp.perfil;
  const rango = rangoSemanal(perfil);
  const faltan = faltanDelPerfil(perfil);
  const vacio = (fuente: "ninguno"): PrimerosDeLaCuenta => ({
    revisando, items: [], token, regaloVence, fuente, origenId: null, combinacion: null, faltan, saldo, finanzas: { tasa: cfg.tasa, uf: cfg.uf, arriendos: {} },
  });
  if (faltan.length > 0 || !rango) return vacio("ninguno");
  const pie = (perfil.piePct ?? PIE_DEPTOS) >= 30 ? 30 : PIE_DEPTOS;
  // El plazo de la persona (el elegido o el de su informe); sin plazo, el por defecto. La noche tiene 25 y 30 años.
  const plazo = perfil.plazoAnios == null ? PLAZO_DEPTOS : perfil.plazoAnios >= 30 ? 30 : 25;
  const buscar = (comunas: string[]) => primerosDeptos(admin, {
    comunas, dorms: perfil.dormitorios, ufMin: rango.ufMin, ufMax: rango.ufMax, pie, plazo,
  }, ahora);
  const propias = perfil.comunas.map(comunaDeAviso);
  const deLaNoche = await buscar(propias);
  // Sin ninguno en sus comunas, las vecinas (como el correo del día, semanal.ts › el respaldo).
  const vecinas = deLaNoche.length === 0 ? await buscar(comunasVecinas(propias).filter((c) => !propias.includes(c))) : [];
  const elegidos = deLaNoche.length ? deLaNoche : vecinas;
  if (elegidos.length === 0) return vacio("ninguno");
  const combinacion = { piePct: pie, plazoAnios: plazo };
  // «Analizar este» desde ya: los de la noche quedan en la fila pendiente del día, con lo que hace falta para validarlos.
  let origenId: string | null = null;
  let enSeleccion = false;
  if (fila && fila.estado === "pendiente" && !fila.enviada_at) {
    origenId = pp.soloManual ? null : ((await origenDePersona(admin, userId))?.analysisId ?? null);
    const comoItems: ItemSemanal[] = elegidos.map((d) => ({
      avisoId: d.avisoId, comuna: d.comuna, tipologia: d.tipologia, m2: d.m2, precioUF: d.precioUF, veredicto: d.veredicto, score: d.score, flujo: d.flujo,
      ...(d.condicion ? { condicion: d.condicion } : {}),
      ...(deLaNoche.length === 0 ? { tramo: "vecina" as const } : {}),
    }));
    enSeleccion = await rellenarDeLaNoche(admin, fila, { items: comoItems, combinacion, perfil, origenAnalysisId: origenId });
    // Otra pasada la llenó primero (la cola, o esta misma pantalla en otra pestaña): se lee lo que quedó.
    if (!enSeleccion) return primerosDeLaCuenta(admin, userId, ahora);
  }
  const [finanzas, informes] = await Promise.all([finanzasDe(origenId, elegidos.map((d) => d.avisoId)), informesDeAvisos(admin, userId, elegidos.map((d) => d.avisoId))]);
  return {
    revisando, token: enSeleccion ? token : null, regaloVence, fuente: "noche", origenId, combinacion, faltan: [], saldo, finanzas,
    items: elegidos.map((d) => ({ ...d, enSeleccion, informeId: informes[d.avisoId] ?? null })), vecinas: deLaNoche.length === 0 && vecinas.length > 0,
  };
}
