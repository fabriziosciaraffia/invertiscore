// ─────────────────────────────────────────────────────────────────────────────
// EL ALTA DE /deptos (16-oct-2026, la puerta B), sacada de la ruta el 22-oct-2026 para que la corran los dos caminos: la
// ruta de siempre (POST /api/deptos/alta, al volver por el enlace del correo o por Google) y la entrada por código, que
// ahora verifica y da de alta en un solo pedido (POST /api/deptos/entrar; entrada.ts). Lee lo que la persona eligió en
// /deptos (deptos_pendientes) y:
//   · CUENTA NUEVA —el correo no tenía cuenta al pedir el código y la cuenta nació después (tipoDeAlta)—: la cuenta nace
//     con ese perfil manual (comunas, tipología, rango, modalidad, pie 20 % y 25 años), su regalo (regalo-alta.ts), la
//     puerta B en la atribución, sin el correo de bienvenida (su bienvenida es el correo del día) y el correo del día en
//     cola, con la primera vuelta en el momento;
//   · CUENTA QUE YA EXISTÍA: nada se duplica ni se pisa; devuelve las comunas que su perfil no tiene, para preguntarle si
//     las agrega.
// CON GOOGLE (16-oct-2026): lo elegido llega a nombre del correo porque el callback lo pasó (reclavarPendienteGoogle);
// si no alcanzó a pasarlo, la pantalla manda la clave (`{ p }`) y se pasa acá. Desde ahí, igual que por código.
// LA PÁGINA DEL INVITADO (16-oct-2026, la puerta C) entra por acá con las mismas preguntas: la cookie de la invitación se
// cobra primero, y la cuenta invitada queda con la puerta C en vez de la B (ya la fijó el cobro, o el callback de Google).
// ─────────────────────────────────────────────────────────────────────────────
import { waitUntil } from "@vercel/functions";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { guardarAtribucion } from "@/lib/attribution";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { asegurarRegaloDeAlta, huellaDeRequest, regaloAltaVivo } from "@/lib/regalo-alta-servidor";
import { esCuentaNueva } from "@/lib/entrar/entrada";
import { busquedaDePerfil, CLAVE_GOOGLE, comunasParaAgregar, tipoDeAlta } from "./respuesta";
import { borrarPendiente, leerPendiente, reclavarPendienteGoogle } from "./servidor";
import { encolarPrimeraSeleccion } from "@/lib/guia/del-dia-servidor";
import { cookieInvitacionDeCabeceras, VINCULO_TERMINADO, vincularInvitacion } from "@/lib/referido-servidor";
import { emitirRegistroAlCrear } from "@/lib/meta/registro";
import { contextoDeRequest } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { SIN_CRONOMETRO, type Cronometro } from "@/lib/cronometro";

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

export async function ejecutarAlta(admin: SupabaseClient, user: User, request: Request, p: { clave?: unknown; ruta: string; crono?: Cronometro }): Promise<AltaDeptos> {
  if (!user.email) return { cuerpo: { error: "sin-sesion" }, status: 401, invitacionUsada: false, espejos: [] };
  // EL CRONÓMETRO (25-oct-2026): cada paso queda en la cabecera Server-Timing de la respuesta.
  const c = p.crono ?? SIN_CRONOMETRO;
  const correo = user.email;
  let pend = await c.medir("leer-pendiente", leerPendiente(admin, correo));
  if (!pend && typeof p.clave === "string" && CLAVE_GOOGLE.test(p.clave) && await c.medir("reclavar-google", reclavarPendienteGoogle(admin, { clave: p.clave, correo, cuentaCreadaAt: user.created_at }))) {
    pend = await c.medir("leer-pendiente-2", leerPendiente(admin, correo));
  }
  if (!pend) {
    // ¿Es el segundo pedido de un alta que ya se hizo? (respuestaDeAltaRepetida)
    if (esCuentaNueva(user.created_at)) {
      const [{ data: perfil }, regaloVence] = await c.medir("alta-repetida", Promise.all([
        admin.from("perfil_busqueda").select("comunas, dormitorios, precio_min_uf, precio_max_uf").eq("user_id", user.id).maybeSingle(),
        regaloAltaVivo(admin, user.id),
      ]));
      const repetida = respuestaDeAltaRepetida({ creadaAt: user.created_at, perfil: perfil as Record<string, unknown> | null, regaloVence });
      if (repetida) return { cuerpo: repetida, invitacionUsada: false, espejos: [] };
    }
    return { cuerpo: { estado: "sin-pendiente" }, invitacionUsada: false, espejos: [] };
  }
  // La invitación (la puerta C): se cobra antes de la puerta B, y si la cuenta es invitada, la puerta es la C.
  const cookieInv = cookieInvitacionDeCabeceras(request.headers);
  const vinculo = cookieInv ? await c.medir("invitacion", vincularInvitacion(admin, { userId: user.id, creadaAt: user.created_at, cookie: cookieInv, huella: huellaDeRequest(request) })) : null;
  const { data: ref } = await c.medir("referido", Promise.resolve(admin.from("referidos").select("estado").eq("invitado_id", user.id).maybeSingle()));
  const puerta = ref && ref.estado !== "cuenta_previa" ? "C" : "B";
  const invitacionUsada = !!vinculo && VINCULO_TERMINADO.has(vinculo);
  // Si ya tiene perfil con comunas, no se pisa: entra y se le pregunta si agrega las comunas.
  const { data: perfilPrevio } = await c.medir("perfil-previo", Promise.resolve(admin.from("perfil_busqueda").select("comunas").eq("user_id", user.id).maybeSingle()));
  const yaTienePerfil = Array.isArray(perfilPrevio?.comunas) && (perfilPrevio.comunas as unknown[]).length > 0;
  const tipo = tipoDeAlta({ existiaAlPedir: pend.existe, cuentaCreadaAt: user.created_at, pedidoAt: pend.creadoAt, yaTienePerfil });
  // La puerta B (atribucion-puerta.ts): la primera gana; el orgánico cede. La invitada ya tiene la C.
  if (puerta === "B") waitUntil(guardarAtribucion(admin, user.id, { puerta: "B", puerta_detalle: "deptos" }).then(() => undefined));

  if (tipo === "existente") {
    const pp = await leerPerfilBusqueda(admin, user.id);
    const elegidas = Array.isArray(pend.perfil.comunas) ? (pend.perfil.comunas as string[]) : [];
    const comunasNuevas = comunasParaAgregar(pp.perfil.comunas, elegidas);
    await borrarPendiente(admin, user.email);
    return { cuerpo: { estado: "existente", comunasNuevas, comunas: pp.perfil.comunas }, invitacionUsada, espejos: [] };
  }

  // La cuenta nace con su perfil manual.
  const { error: ePerfil } = await c.medir("perfil", Promise.resolve(admin.from("perfil_busqueda").upsert({ user_id: user.id, ...pend.perfil, actualizado_at: new Date().toISOString() }, { onConflict: "user_id" })));
  reportarFalloQuery(ePerfil, { ruta: p.ruta, operacion: "perfil", userId: user.id });
  if (ePerfil) return { cuerpo: { error: "perfil" }, status: 500, invitacionUsada, espejos: [] };
  // Su bienvenida es el correo del día: la de siempre no sale (welcome.ts).
  await c.medir("creditos", async () => {
    await admin.from("user_credits").upsert({ user_id: user.id, credits: 0, subscription_status: "none", welcome_email_sent: true }, { onConflict: "user_id", ignoreDuplicates: true });
    await admin.from("user_credits").update({ welcome_email_sent: true }).eq("user_id", user.id);
  });
  const regalo = await c.medir("regalo", asegurarRegaloDeAlta(admin, { userId: user.id, creadaAt: user.created_at, huella: huellaDeRequest(request), puerta, crono: c }));
  // CompleteRegistration al crear la cuenta (22-oct-2026, meta/registro.ts): con la puerta —la que el alta ya sabe— y el
  // «cuándo» si ya está. El pixel lo repite con el espejo que la ruta deja en la cookie.
  const registro = await c.medir("meta-registro", emitirRegistroAlCrear(admin, user, contextoDeRequest(request), { origen: "alta", puerta }));
  if (registro) waitUntil(registro.envio);
  await c.medir("borrar-pendiente", borrarPendiente(admin, correo));

  // El correo del día, en cola; la primera vuelta ahora (las siguientes, el cron cada 10 minutos). Las cuentas de
  // prueba no reciben correos, salvo las marcadas. Desde el 20-oct-2026 es el mismo encolado de todas las puertas
  // (encolarPrimeraSeleccion); acá la cuenta YA nació con su perfil, así que la primera vuelta busca con él.
  await c.medir("encolar-del-dia", encolarPrimeraSeleccion(admin, user, { sitio: SITIO, enSegundoPlano: waitUntil, ruta: p.ruta }));
  void capturarServidor({ event: "deptos_alta", distinctId: user.id, uuid: uuidDeterminista(`deptos_alta:${user.id}`), properties: { regalo: regalo.estado, puerta } }).catch(() => {});
  // La búsqueda con que nació la cuenta (21-oct-2026): la línea «Buscas: … · Cambiar» de «Estás dentro». Va en la
  // respuesta porque quien vuelve por el enlace del correo o por Google ya no tiene los chips en la pantalla.
  return { cuerpo: { estado: "nueva", regaloVence: regalo.vence, busqueda: busquedaDePerfil(pend.perfil as Record<string, unknown>) }, invitacionUsada, espejos: registro?.espejo ? [registro.espejo] : [] };
}
