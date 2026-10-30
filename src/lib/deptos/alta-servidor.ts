// ─────────────────────────────────────────────────────────────────────────────
// EL ALTA DE /deptos (16-oct-2026, la puerta B), sacada de la ruta el 22-oct-2026 para que la corran los dos caminos: la
// ruta de siempre (POST /api/deptos/alta, al volver por el enlace del correo o por Google) y la entrada por código, que
// ahora verifica y da de alta en un solo pedido (POST /api/deptos/entrar; entrada.ts). Lee lo que la persona eligió en
// /deptos (deptos_pendientes) y:
//   · CUENTA NUEVA —el correo no tenía cuenta al pedir el código y la cuenta nació después (tipoDeAlta)—: la cuenta nace
//     con ese perfil manual (comunas, tipología, rango, modalidad y el financiamiento por defecto (pie 20 % y 30 años)), su regalo (regalo-alta.ts), la
//     puerta B en la atribución, sin el correo de bienvenida (su bienvenida es el correo del día) y el correo del día en
//     cola, con la primera vuelta en el momento;
//   · CUENTA QUE YA EXISTÍA: nada se duplica ni se pisa; devuelve las comunas que su perfil no tiene, para preguntarle si
//     las agrega.
// CON GOOGLE (16-oct-2026): lo elegido llega a nombre del correo porque el callback lo pasó (reclavarPendienteGoogle);
// si no alcanzó a pasarlo, la pantalla manda la clave (`{ p }`) y se pasa acá. Desde ahí, igual que por código.
// LA PÁGINA DEL INVITADO (16-oct-2026, la puerta C) entra por acá con las mismas preguntas: la cookie de la invitación se
// cobra primero, y la cuenta invitada queda con la puerta C en vez de la B (ya la fijó el cobro, o el callback de Google).
// EXPLORAR SIN CUENTA (29-oct-2026, la puerta E) también: lo elegido trae `puerta = 'E'` y el detalle de la llegada
// («explorar:landing» o «explorar:directo»); la cuenta nace con el perfil del pin que miraba, su regalo y el correo del día,
// y la atribución queda en E (salvo que sea invitada: la C manda).
// ─────────────────────────────────────────────────────────────────────────────
import { waitUntil } from "@vercel/functions";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { guardarAtribucion } from "@/lib/attribution";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { asegurarRegaloDeAlta, huellaDeRequest, regaloAltaVivo } from "@/lib/regalo-alta-servidor";
import { esCuentaNueva } from "@/lib/entrar/entrada";
import { busquedaDePerfil, CLAVE_GOOGLE, comunasParaAgregar } from "./respuesta";
import { borrarPendiente, leerPendiente, reclavarPendienteGoogle } from "./servidor";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";
import { cookieInvitacionDeCabeceras, VINCULO_TERMINADO, vincularInvitacion } from "@/lib/referido-servidor";
import { datosRegistro, emitirRegistroAlCrear } from "@/lib/meta/registro";
import { EVENTOS_META, idRegistro } from "@/lib/meta/ids";
import { contextoDeRequest, esCuentaDePrueba } from "@/lib/meta/servidor";
import { ordenarAlta, type PiezasAlta, type PuertaAlta } from "./alta-orden";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { SIN_CRONOMETRO, type Cronometro } from "@/lib/cronometro";
import { detalleExplorar, EVENTOS_ABIERTO, origenDeDetalle } from "@/lib/explorar/abierto";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export interface AltaDeptos {
  cuerpo: Record<string, unknown>;
  status?: number;
  /** La invitación quedó cobrada: la respuesta lleva la cookie que la marca usada. */
  invitacionUsada: boolean;
  /** Lo que el pixel repite (22-oct-2026): el CompleteRegistration de la cuenta nueva. La ruta lo deja en la cookie. */
  espejos: EventoEspejo[];
}

/**
 * LA MISMA CUENTA, OTRA VEZ (25-oct-2026, recorrido de Fabrizio con +qadeptos4): un segundo pedido de alta —el reintento del
 * navegador a los segundos, por código o al volver de Google— ya no encuentra lo elegido en /deptos porque el primero lo
 * usó. Si la cuenta nació hace minutos (esCuentaNueva) y ya tiene su perfil, el alta está hecha: la respuesta vuelve a
 * ser «nueva», con su regalo y su búsqueda, y la pantalla muestra «Estás dentro» en vez de irse al dashboard.
 */
export function respuestaDeAltaRepetida(p: { creadaAt: string | null | undefined; perfil: Record<string, unknown> | null; regaloVence: string | null }, ahora: number = Date.now()): Record<string, unknown> | null {
  if (!esCuentaNueva(p.creadaAt, ahora)) return null;
  const busqueda = busquedaDePerfil(p.perfil as Parameters<typeof busquedaDePerfil>[0]);
  return busqueda ? { estado: "nueva", regaloVence: p.regaloVence, busqueda, repetida: true } : null;
}

export async function ejecutarAlta(
  admin: SupabaseClient,
  user: User,
  request: Request,
  p: {
    clave?: unknown;
    ruta: string;
    crono?: Cronometro;
    /** Lo elegido en /deptos, pedido de antes (la ruta del código lo pide junto con verificar el código). */
    pendiente?: Promise<Awaited<ReturnType<typeof leerPendiente>>>;
    /** Lo que corre después de responder (el waitUntil de Vercel). */
    despues?: (p: Promise<unknown>) => void;
  },
): Promise<AltaDeptos> {
  if (!user.email) return { cuerpo: { error: "sin-sesion" }, status: 401, invitacionUsada: false, espejos: [] };
  // EL CRONÓMETRO (25-oct-2026): cada paso queda en la cabecera Server-Timing de la respuesta.
  const c = p.crono ?? SIN_CRONOMETRO;
  const despues = p.despues ?? waitUntil;
  const correo = user.email;
  const huella = huellaDeRequest(request);
  const contexto = contextoDeRequest(request);
  // La primera vuelta del correo del día espera este permiso: se suelta después de responder, con el perfil ya escrito.
  let soltarVuelta: () => void = () => {};
  const permisoVuelta = new Promise<void>((ok) => { soltarVuelta = ok; });
  let primerPendiente = p.pendiente ?? null;
  // Lo elegido trae su puerta: E (Explorar) con el detalle de la llegada. Se anota al leerlo; la pieza de la puerta lo usa.
  let puertaElegida: { puerta: string | null; detalle: string | null } = { puerta: null, detalle: null };

  const piezas: PiezasAlta = {
    pendiente: () => {
      const ya = primerPendiente;
      primerPendiente = null;
      return c.medir("leer-pendiente", (ya ?? leerPendiente(admin, correo)).then((pend) => {
        if (pend) puertaElegida = { puerta: pend.puerta ?? null, detalle: pend.puertaDetalle ?? null };
        return pend;
      }));
    },
    reclavarGoogle: typeof p.clave === "string" && CLAVE_GOOGLE.test(p.clave)
      ? () => c.medir("reclavar-google", reclavarPendienteGoogle(admin, { clave: p.clave as string, correo, cuentaCreadaAt: user.created_at }))
      : null,
    repetida: () => c.medir("alta-repetida", (async () => {
      const [{ data: perfil }, regaloVence] = await Promise.all([
        admin.from("perfil_busqueda").select("comunas, dormitorios, precio_min_uf, precio_max_uf").eq("user_id", user.id).maybeSingle(),
        regaloAltaVivo(admin, user.id),
      ]);
      return respuestaDeAltaRepetida({ creadaAt: user.created_at, perfil: perfil as Record<string, unknown> | null, regaloVence });
    })()),
    existente: (pend) => c.medir("existente", (async () => {
      const pp = await leerPerfilBusqueda(admin, user.id);
      const elegidas = Array.isArray(pend.perfil.comunas) ? (pend.perfil.comunas as string[]) : [];
      return { comunasNuevas: comunasParaAgregar(pp.perfil.comunas, elegidas), comunas: pp.perfil.comunas };
    })()),
    // La cuenta nace con su perfil manual; uno que ya estaba no se pisa (ignoreDuplicates: solo devuelve la fila si la creó).
    perfilSiFalta: (perfil) => c.medir("perfil", (async () => {
      const { data, error } = await admin.from("perfil_busqueda").upsert({ user_id: user.id, ...perfil, actualizado_at: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: true }).select("user_id");
      reportarFalloQuery(error, { ruta: p.ruta, operacion: "perfil", userId: user.id });
      if (error) throw new Error(`perfil: ${error.message}`);
      return (data ?? []).length > 0 ? "creado" as const : "ya-estaba" as const;
    })()),
    // La fila del correo del día (sin ella «Analizar este» no tiene token); su primera vuelta, después de responder.
    filaDelDia: () => c.medir("fila-del-dia", encolarPrimeraSeleccion(admin, user, { sitio: SITIO, enSegundoPlano: despues, ruta: p.ruta, antes: permisoVuelta })),
    // Su bienvenida es el correo del día: la de siempre no sale (welcome.ts). UNA escritura (25-oct-2026): el upsert solo
    // toca la marca; si la fila no estaba, nace con los valores por defecto de la tabla (0 créditos, 'none').
    creditos: () => c.medir("creditos", Promise.resolve(admin.from("user_credits").upsert({ user_id: user.id, welcome_email_sent: true }, { onConflict: "user_id" }))),
    // La invitación (la puerta C): se cobra, y si la cuenta es invitada, la puerta es la C.
    puerta: () => c.medir("puerta", (async () => {
      const cookieInv = cookieInvitacionDeCabeceras(request.headers);
      const vinculo = cookieInv ? await vincularInvitacion(admin, { userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella }) : null;
      const { data: ref } = await admin.from("referidos").select("estado").eq("invitado_id", user.id).maybeSingle();
      const puerta: PuertaAlta = ref && ref.estado !== "cuenta_previa" ? "C" : puertaElegida.puerta === "E" ? "E" : "B";
      return { puerta, invitacionUsada: !!vinculo && VINCULO_TERMINADO.has(vinculo) };
    })()),
    esPrueba: () => c.medir("es-prueba", contexto.prueba ? Promise.resolve(true) : esCuentaDePrueba(admin, user.id, correo)),
    regalo: (puerta) => c.medir("regalo", asegurarRegaloDeAlta(admin, { userId: user.id, creadaAt: user.created_at, huella, puerta, crono: c, correo })),
    // ── después de responder ──
    vueltaDelDia: async () => { soltarVuelta(); },
    // La puerta B o E (atribucion-puerta.ts): la primera gana; el orgánico cede. La invitada ya tiene la C.
    atribucion: async (puerta) => {
      if (puerta === "B") await guardarAtribucion(admin, user.id, { puerta: "B", puerta_detalle: "deptos" });
      if (puerta === "E") await guardarAtribucion(admin, user.id, { puerta: "E", puerta_detalle: detalleExplorar(puertaElegida.detalle) });
    },
    // CompleteRegistration (22-oct-2026, meta/registro.ts): el mismo id que el espejo que ya salió en la respuesta.
    meta: async (puerta) => { const r = await emitirRegistroAlCrear(admin, user, contexto, { origen: "alta", puerta }); if (r) await r.envio; },
    borrarPendiente: () => borrarPendiente(admin, correo),
    posthog: async ({ regalo, puerta }) => {
      await capturarServidor({ event: "deptos_alta", distinctId: user.id, uuid: uuidDeterminista(`deptos_alta:${user.id}`), properties: { regalo, puerta } });
      // El embudo de la puerta E (29-oct-2026): «registro hecho», con la llegada (landing o directo).
      if (puerta === "E") await capturarServidor({ event: EVENTOS_ABIERTO.registroHecho, distinctId: user.id, uuid: uuidDeterminista(`${EVENTOS_ABIERTO.registroHecho}:${user.id}`), properties: { regalo, llegada_explorar: origenDeDetalle(detalleExplorar(puertaElegida.detalle)) } });
    },
  };

  try {
    const r = await ordenarAlta(piezas, {
      cuentaCreadaAt: user.created_at,
      cuentaNueva: esCuentaNueva(user.created_at),
      // La búsqueda con que nació la cuenta (21-oct-2026): la línea de «Estás dentro», también para quien vuelve de Google.
      busquedaDe: (perfil) => busquedaDePerfil(perfil),
      espejoDe: (puerta, prueba) => espejoDeRegistro({ userId: user.id, puerta, prueba, consentimiento: contexto.consentimiento === true }),
    }, despues);
    return { cuerpo: r.cuerpo, status: r.status, invitacionUsada: r.invitacionUsada, espejos: r.espejos };
  } catch (e) {
    reportarFalloQuery(e instanceof Error ? { message: e.message } : { message: String(e) }, { ruta: p.ruta, operacion: "alta", userId: user.id });
    return { cuerpo: { error: "perfil" }, status: 500, invitacionUsada: false, espejos: [] };
  }
}

/**
 * EL ESPEJO DEL CompleteRegistration, sin esperar a Meta (25-oct-2026): Meta sale después de responder, y el espejo que el
 * pixel repite tiene que ir en esta respuesta. El mismo id (idRegistro) y los mismos datos (datosRegistro, sin «cuándo»:
 * la cuenta recién nace) que manda el servidor; null en modo prueba, en una cuenta de prueba o sin el «sí» del aviso de
 * cookies —las mismas reglas que meta/servidor.ts › emitirEventoMeta—.
 */
export function espejoDeRegistro(p: { userId: string; puerta: PuertaAlta; prueba: boolean; consentimiento: boolean }): EventoEspejo | null {
  if (p.prueba || !p.consentimiento) return null;
  return { evento: EVENTOS_META.registro, eventId: idRegistro(p.userId), datos: datosRegistro({ puerta: p.puerta, cuando: null }) };
}
