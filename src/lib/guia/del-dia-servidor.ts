// ─────────────────────────────────────────────────────────────────────────────
// El correo del día del lado del servidor (16-oct-2026; las reglas en del-dia.ts). Una fila de `semanal_selecciones` con
// `tipo` = 'del_dia' por cuenta nueva de /deptos, encolada al nacer la cuenta. Cada vuelta (la primera en el momento,
// las siguientes el cron correo-del-dia cada 10 minutos) arma su selección con la MISMA preparación del semanal —su
// perfil manual, el origen sintético, sus comunas y las vecinas, los negociables— y chequea las fichas dentro del cupo
// compartido; cuando se arma (o pasa la hora), manda el correo una sola vez y queda como el semanal de esa semana.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { leerSaldo } from "@/lib/casa-saldo";
import { nombreReal } from "@/lib/welcome";
import { sendSemanalEmail } from "@/lib/email";
import { correoSemanal, correoSemanalVacio, textoBusca } from "@/lib/email/correo-semanal";
import { regaloAltaVivo } from "@/lib/regalo-alta-servidor";
import { diaChile } from "@/lib/regalo-alta";
import { enlacesSemanal, itemDe, prepararSeleccion, type ItemSemanal, type PresupuestoFichas } from "./semanal-servidor";
import { prepararSeleccionStr } from "./semanal-str-servidor";
import { estadoDeFila, type EstadoBloque } from "./semanal-str";
import { elegirSemanal, MEMORIA_SEMANAL_MS, REGLA_CORTA } from "./semanal";
import { chequearPublicacion, MEMORIA_PUBLICACION_MS, type EstadoPublicacion } from "./publicacion";
import { almacenPublicacion, bajarFicha } from "./ficha-servidor";
import { claveEdificio } from "./ficha-anio";
import type { Candidato } from "./semanal-candidatos";
import type { Evaluado } from "./seleccion";
import { cuandoSeVio, LECTURAS_POR_VUELTA_DEL_DIA, pasoDelDia, REGLA_DEL_DIA } from "./del-dia";

const RUTA = "lib/guia/del-dia";

export interface FilaDelDia {
  id: string;
  user_id: string;
  token: string;
  armada_at: string;
  intentos: number;
}

export const COLUMNAS_DEL_DIA = "id, user_id, token, armada_at, intentos";

/** Encola el correo del día de una cuenta nueva (una fila por cuenta y día). Devuelve la fila, o null si no se pudo. */
export async function encolarDelDia(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<FilaDelDia | null> {
  const semana = diaChile(ahora);
  const { data, error } = await admin.from("semanal_selecciones")
    .insert({ user_id: userId, semana, tipo: "del_dia", estado: "pendiente", items: [], armada_at: ahora.toISOString() })
    .select(COLUMNAS_DEL_DIA).maybeSingle();
  if (data) return data as FilaDelDia;
  // Ya tenía una fila ese día (la cuenta se registró dos veces, o la del semanal): no se duplica.
  if ((error as { code?: string } | null)?.code !== "23505") reportarFalloQuery(error, { ruta: RUTA, operacion: "encolar", userId });
  const { data: previa } = await admin.from("semanal_selecciones").select(COLUMNAS_DEL_DIA).eq("user_id", userId).eq("semana", semana).eq("tipo", "del_dia").maybeSingle();
  return (previa as FilaDelDia | null) ?? null;
}

/** El chequeo del día: la memoria de 24 horas y el cupo de la vuelta. Con `soloMemoria`, lo que ya se vio en la semana. */
function publicadoDelDia(admin: SupabaseClient, presupuesto: PresupuestoFichas, soloMemoria: boolean) {
  const almacen = almacenPublicacion(admin);
  return async (c: Candidato): Promise<EstadoPublicacion> => {
    const r = await chequearPublicacion({ id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "guia", almacen, bajarFicha, {
      sinLeer: soloMemoria || presupuesto.bloqueada || presupuesto.lecturas >= LECTURAS_POR_VUELTA_DEL_DIA,
      memoriaMs: soloMemoria ? MEMORIA_SEMANAL_MS : MEMORIA_PUBLICACION_MS,
    });
    presupuesto.lecturas += r.lectura?.gets ?? 0;
    if (r.lectura?.leida && r.lectura.motivo === "bloqueo") presupuesto.bloqueada = true;
    return r.estado;
  };
}

type Elegidos = { items: Array<{ c: Candidato; ev: Evaluado; tramo: string }>; estado: EstadoBloque };
const aItems = (g: Elegidos): ItemSemanal[] =>
  g.items.map(({ c, ev, tramo }) => ({ ...itemDe(c, ev), ...(tramo === "vecina" || tramo === "negociar" ? { tramo } : {}) }));

/**
 * Una vuelta del correo del día. «espera»: faltó cupo y todavía hay tiempo (la vuelta siguiente sigue); «enviada»: salió
 * (con deptos o el vacío); «descartada»: se dio de baja, o la cuenta no tiene correo.
 */
export async function procesarDelDia(
  admin: SupabaseClient,
  fila: FilaDelDia,
  cfg: { uf: number; tasa: number },
  sitio: string,
  presupuesto: PresupuestoFichas,
  ahora: Date = new Date(),
): Promise<"enviada" | "espera" | "descartada" | "ya" | "fallida"> {
  const pp = await leerPerfilBusqueda(admin, fila.user_id);
  const descartar = async () => {
    await admin.from("semanal_selecciones").update({ estado: "descartada" }).eq("id", fila.id).is("enviada_at", null);
    return "descartada" as const;
  };
  if (pp.semanalBajaAt) return descartar();
  const [prep, prepStr] = await Promise.all([
    prepararSeleccion(admin, fila.user_id, cfg, { perfilLeido: pp, delDia: true }),
    prepararSeleccionStr(admin, fila.user_id, cfg, pp),
  ]);
  if (prep.tipo === "baja") return descartar();
  const elegir = async (soloMemoria: boolean): Promise<{ largo: Elegidos | null; corto: Elegidos | null }> => {
    const publicado = publicadoDelDia(admin, presupuesto, soloMemoria);
    const largo = prep.tipo === "lista"
      ? await elegirSemanal(prep.p.candidatos, prep.p.evaluar, publicado, prep.p.respaldo, REGLA_DEL_DIA)
      : null;
    const corto = prepStr?.tipo === "lista"
      ? await elegirSemanal(prepStr.p.candidatos, prepStr.p.evaluar, publicado, prepStr.p.respaldo, REGLA_CORTA)
      : null;
    return { largo, corto };
  };
  let g = await elegir(false);
  const estadoDe = (x: typeof g) => estadoDeFila(
    x.largo?.estado ?? (pp.perfilLtr ? "sin_match" : null),
    x.corto?.estado ?? (prepStr ? "sin_match" : null),
  );
  const minutos = (ahora.getTime() - Date.parse(fila.armada_at)) / 60_000;
  const paso = pasoDelDia({ estado: estadoDe(g), minutos, vueltas: fila.intentos + 1 });
  const columnas = (x: typeof g) => ({
    items: x.largo ? aItems(x.largo) : [],
    items_str: x.corto ? aItems(x.corto) : [],
    estado_str: x.corto ? x.corto.estado : prepStr ? "sin_match" : null,
    combinacion: prep.tipo === "lista" ? prep.p.combo : null,
    perfil: prep.tipo === "lista" ? prep.p.perfil : pp.perfilLtr,
    origen_analysis_id: prep.tipo === "lista" ? prep.p.origen.analysisId : null,
    combinacion_str: prepStr?.tipo === "lista" ? prepStr.p.combo : null,
    perfil_str: prepStr?.tipo === "lista" ? prepStr.p.perfil : prepStr?.perfil ?? null,
    origen_str_analysis_id: prepStr?.tipo === "lista" ? prepStr.p.origen.analysisId : null,
    variante: "tarjetas",
  });
  if (paso === "esperar") {
    const { error } = await admin.from("semanal_selecciones").update({ ...columnas(g), intentos: fila.intentos + 1 }).eq("id", fila.id).is("enviada_at", null);
    reportarFalloQuery(error, { ruta: RUTA, operacion: "esperar", userId: fila.user_id });
    return "espera";
  }
  // Se copó el cupo y pasó la hora: sale con lo que ya se vio publicado (el prechequeo de la noche u otra lectura).
  if (paso === "enviar_lo_visto") g = await elegir(true);
  return enviarDelDia(admin, fila, { ...columnas(g), estado: estadoDe(g) }, sitio, ahora, paso === "enviar_lo_visto");
}

interface ColumnasDelDia {
  items: ItemSemanal[];
  items_str: ItemSemanal[];
  estado_str: EstadoBloque | "sin_match" | null;
  combinacion: { piePct: number; plazoAnios: number } | null;
  perfil: unknown;
  origen_analysis_id: string | null;
  combinacion_str: { piePct: number; plazoAnios: number } | null;
  perfil_str: unknown;
  origen_str_analysis_id: string | null;
  variante: string;
  estado: EstadoBloque;
}

/** Manda el correo del día una sola vez (la fila se toma antes de mandar; si Resend falla, se suelta) y mide. */
async function enviarDelDia(
  admin: SupabaseClient,
  fila: FilaDelDia,
  col: ColumnasDelDia,
  sitio: string,
  ahora: Date,
  loVisto: boolean,
): Promise<"enviada" | "descartada" | "ya" | "fallida"> {
  const { data: u } = await admin.auth.admin.getUserById(fila.user_id);
  const user = u?.user;
  if (!user?.email) {
    await admin.from("semanal_selecciones").update({ estado: "descartada" }).eq("id", fila.id).is("enviada_at", null);
    return "descartada";
  }
  const { estado, ...guardar } = col;
  const { data: tomada } = await admin.from("semanal_selecciones").update({ ...guardar, estado: "enviada", enviada_at: ahora.toISOString(), intentos: fila.intentos + 1 })
    .eq("id", fila.id).is("enviada_at", null).select("id");
  if ((tomada?.length ?? 0) !== 1) return "ya";

  const deptos = col.combinacion ? col.items : [];
  const cortos = col.combinacion_str ? col.items_str : [];
  const ids = [...deptos, ...cortos].map((d) => d.avisoId);
  const [{ data: pubs }, regaloVence, saldo] = await Promise.all([
    ids.length ? admin.from("publicacion_avisos").select("chequeado_at").in("aviso_id", ids).eq("estado", "publicado") : Promise.resolve({ data: [] as Array<{ chequeado_at: string }> }),
    regaloAltaVivo(admin, fila.user_id, ahora),
    leerSaldo(admin, fila.user_id),
  ]);
  // «Publicados al [hora]»: el chequeo más antiguo de lo que va en el correo.
  const masAntiguo = ((pubs ?? []) as Array<{ chequeado_at: string }>).map((p) => p.chequeado_at).sort()[0] ?? null;
  const enlaces = enlacesSemanal(sitio, fila.token);
  const nombre = nombreReal(user.user_metadata);
  const n = deptos.length + cortos.length;
  const perfil = col.perfil as Parameters<typeof textoBusca>[0] | null;
  const perfilStr = col.perfil_str as Parameters<typeof textoBusca>[0] | null;
  const correo = n > 0 && masAntiguo
    ? correoSemanal({
        variante: "tarjetas",
        nombre,
        busca: perfil ? textoBusca(perfil) : "",
        piePct: (col.combinacion ?? col.combinacion_str)!.piePct,
        plazoAnios: (col.combinacion ?? col.combinacion_str)!.plazoAnios,
        deptos: deptos.map((d) => ({ ...d, url: enlaces.depto(d.avisoId) })),
        largo: !!col.combinacion,
        corto: col.combinacion_str && perfilStr ? {
          deptos: cortos.map((d) => ({ ...d, url: enlaces.depto(d.avisoId) })),
          busca: textoBusca(perfilStr), piePct: col.combinacion_str.piePct, plazoAnios: col.combinacion_str.plazoAnios,
        } : null,
        saldo: saldo.plan ? null : saldo.disponibles,
        conRegalo: false,
        regaloAltaVence: regaloVence,
        presentacion: true,
        delDia: { publicadosAl: cuandoSeVio(masAntiguo, ahora) },
        urlBoton: enlaces.boton,
        urlTres: enlaces.tres,
        urlBaja: enlaces.baja,
      })
    : correoSemanalVacio({ nombre, presentacion: true, urlPerfil: enlaces.perfil, urlBaja: enlaces.baja, delDia: true, regaloAltaVence: regaloVence });
  const conDeptos = n > 0 && !!masAntiguo;
  const r = await sendSemanalEmail(user.email, correo, fila.user_id, enlaces.baja, conDeptos ? "del_dia" : "del_dia_vacio");
  if (!r.ok) {
    await admin.from("semanal_selecciones").update({ estado: "pendiente", enviada_at: null }).eq("id", fila.id);
    return "fallida";
  }
  await admin.from("semanal_selecciones").update({ resend_id: r.id, publicados_al: conDeptos ? masAntiguo : null, ...(conDeptos ? {} : { items: [], items_str: [] }) }).eq("id", fila.id);
  void capturarServidor({
    event: "correo_del_dia_enviado", distinctId: fila.user_id, uuid: uuidDeterminista(`correo_del_dia:${fila.id}`),
    properties: { n: conDeptos ? n : 0, lo_visto: loVisto, minutos: Math.round((ahora.getTime() - Date.parse(fila.armada_at)) / 60_000), con_regalo: !!regaloVence, estado },
  }).catch(() => {});
  return "enviada";
}

/** Las filas del día por mandar, las más antiguas primero. */
export async function delDiaPendientes(admin: SupabaseClient, tope = 50): Promise<FilaDelDia[]> {
  const { data, error } = await admin.from("semanal_selecciones").select(COLUMNAS_DEL_DIA)
    .eq("tipo", "del_dia").eq("estado", "pendiente").is("enviada_at", null).order("armada_at").limit(tope);
  if (error) throw new Error(`del día: ${error.message}`);
  return (data ?? []) as FilaDelDia[];
}
