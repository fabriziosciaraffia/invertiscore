// ─────────────────────────────────────────────────────────────────────────────
// El referido, del lado del servidor (16-oct-2026; las reglas en referido.ts). Tres momentos:
//   1 · EL ENLACE (`asegurarInvitacion`): el de siempre o, si lo pide, el que dice su nombre. Cada vez que quien invita
//       lo abre en un navegador, ese dispositivo queda anotado (en hash): es contra lo que se mide el «mismo dispositivo».
//       OJO (20-oct-2026): también lo anota pedir el enlace —«Invita a alguien» del dashboard y compartir un informe
//       (GET /api/invitacion)—, así que un dispositivo anotado NO es una visita a /i/. Las visitas, en `invitacion_vista`.
//   2 · EL COBRO DEL CÓDIGO (`vincularInvitacion`): al registrarse, por cualquier puerta —el reclamo después del código,
//       /auth/callback (enlace y Google), el alta de /deptos y de la página del invitado, el ticket, el dashboard como
//       red—, la cookie de la invitación liga la cuenta a quien invitó. Una fila por invitado (su clave es la cuenta): una
//       cuenta, una invitación. La cuenta que ya existía queda anotada como `cuenta_previa` y no cuenta. La nueva queda
//       con la puerta C (`fijarPuertaReferido`).
//   3 · EL PREMIO (`pagarPremioReferido`): cuando el invitado, con sesión, contesta el «cuándo». Mismo dispositivo, tope de
//       cinco, o el análisis más (60 días) y el correo a quien invitó. El lugar entre los cinco lo guarda el índice único
//       (invitador, premio_n): dos premios a la vez no pasan de cinco.
// Nunca lanzan: un referido perdido no puede romper un registro.
// ─────────────────────────────────────────────────────────────────────────────
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { fijarPuertaReferido } from "@/lib/attribution";
import { sendPremioReferidoEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import type { Huella } from "@/lib/regalo-alta-servidor";
import {
  COOKIE_INVITACION, cuentaNuevaParaInvitacion, INVITACION_USADA, VIDA_COOKIE_INVITACION_S, decidirPremio, DIAS_VIGENCIA_PREMIO_REFERIDO, FUENTE_PREMIO_REFERIDO, generarCodigo,
  leerCookieInvitacion, nombreInvitacion, normalizarCodigo, PREFIJO_DETALLE_INVITACION, TOPE_PREMIOS_REFERIDO, type DecisionPremio, type EstadoReferido,
} from "@/lib/referido";

const RUTA = "lib/referido";
/** Los dispositivos que se recuerdan por enlace: los últimos. */
const MAX_DISPOSITIVOS = 20;

export interface Invitacion {
  codigo: string;
  userId: string;
  conNombre: boolean;
  nombre: string | null;
}

/** La cookie de la invitación de un pedido (la cabecera `cookie`), o null. */
export function cookieInvitacionDeCabeceras(h: { get(nombre: string): string | null }): string | null {
  const m = (h.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE_INVITACION}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function leerInvitacion(admin: SupabaseClient, codigo: string): Promise<Invitacion | null> {
  const c = normalizarCodigo(codigo);
  if (!c) return null;
  const { data, error } = await admin.from("invitaciones").select("codigo, user_id, con_nombre, nombre").eq("codigo", c).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-invitacion" });
  if (!data) return null;
  return { codigo: data.codigo as string, userId: data.user_id as string, conNombre: data.con_nombre === true, nombre: (data.nombre as string | null) ?? null };
}

/** ¿Quien invita es una cuenta de prueba? Marca la visita a su enlace (el panel la saca). Ante la duda, no. */
export async function invitadorDePrueba(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.from("test_accounts").select("user_id").eq("user_id", userId).maybeSingle();
    reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-prueba", userId });
    return !!data;
  } catch {
    return false;
  }
}

/** Anota el dispositivo en los enlaces de la persona (si no estaba). */
export async function anotarDispositivoInvitador(admin: SupabaseClient, userId: string, dispositivo: string | null | undefined): Promise<void> {
  if (!dispositivo) return;
  try {
    const { data, error } = await admin.from("invitaciones").select("codigo, dispositivos").eq("user_id", userId);
    reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-dispositivos", userId });
    for (const f of (data ?? []) as Array<{ codigo: string; dispositivos: string[] | null }>) {
      const xs = f.dispositivos ?? [];
      if (xs.includes(dispositivo)) continue;
      const { error: e } = await admin.from("invitaciones").update({ dispositivos: [...xs, dispositivo].slice(-MAX_DISPOSITIVOS) }).eq("codigo", f.codigo);
      reportarFalloQuery(e, { ruta: RUTA, operacion: "anotar-dispositivo", userId });
    }
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "anotar-dispositivo", userId });
  }
}

/**
 * El enlace de la persona: el de siempre (`conNombre` false: el invitado ve «un amigo») o el que dice su nombre. Si no
 * existe lo crea; si cambió el nombre lo actualiza. Anota el dispositivo. Null si falla o si pide nombre sin nombre.
 */
export async function asegurarInvitacion(
  admin: SupabaseClient,
  p: { userId: string; conNombre: boolean; nombre?: string | null; dispositivo?: string | null },
): Promise<Invitacion | null> {
  const nombre = p.conNombre ? nombreInvitacion(p.nombre) : null;
  if (p.conNombre && !nombre) return null;
  try {
    const buscar = () => admin.from("invitaciones").select("codigo, nombre").eq("user_id", p.userId).eq("con_nombre", p.conNombre).maybeSingle();
    const { data: previa, error: e0 } = await buscar();
    reportarFalloQuery(e0, { ruta: RUTA, operacion: "leer-enlace", userId: p.userId });
    if (e0) return null;
    let codigo = (previa?.codigo as string | undefined) ?? null;
    if (previa && p.conNombre && previa.nombre !== nombre) {
      const { error } = await admin.from("invitaciones").update({ nombre }).eq("codigo", codigo!);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "cambiar-nombre", userId: p.userId });
    }
    for (let i = 0; !codigo && i < 5; i++) {
      const nuevo = generarCodigo(randomInt);
      const { error } = await admin.from("invitaciones").insert({ codigo: nuevo, user_id: p.userId, con_nombre: p.conNombre, nombre, dispositivos: [] });
      if (!error) { codigo = nuevo; break; }
      if ((error as { code?: string }).code !== "23505") { reportarFalloQuery(error, { ruta: RUTA, operacion: "crear-enlace", userId: p.userId }); return null; }
      // Otro pedido lo creó a la vez (o el código ya existía): se usa el que quedó.
      const { data: otra } = await buscar();
      codigo = (otra?.codigo as string | undefined) ?? null;
    }
    if (!codigo) return null;
    await anotarDispositivoInvitador(admin, p.userId, p.dispositivo);
    return { codigo, userId: p.userId, conNombre: p.conNombre, nombre };
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "asegurar-enlace", userId: p.userId });
    return null;
  }
}

/** Cuántos premios lleva la persona (pagados), para lo que se le muestra al invitar. Null = no se sabe. */
export async function premiosPagados(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { count, error } = await admin.from("referidos").select("invitado_id", { count: "exact", head: true }).eq("invitador_id", userId).eq("estado", "pagado");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "contar-premios", userId });
  return error || count == null ? null : count;
}

export type ResultadoVinculo = EstadoReferido | "ya" | "propio" | "sin_invitacion" | "fallo";
/** Con estos, la cookie ya hizo lo suyo y queda «usada» (con «fallo» se queda como estaba, para el próximo intento). */
export const VINCULO_TERMINADO: ReadonlySet<ResultadoVinculo> = new Set<ResultadoVinculo>(["pendiente", "cuenta_previa", "ya", "propio", "sin_invitacion"]);

/** La cookie de una invitación ya cobrada: «usada», para que el middleware no deje otra en este navegador. */
export const COOKIE_INVITACION_USADA = {
  name: COOKIE_INVITACION,
  value: INVITACION_USADA,
  options: { path: "/", maxAge: VIDA_COOKIE_INVITACION_S, sameSite: "lax" as const, httpOnly: true },
};

/**
 * EL COBRO DEL CÓDIGO al registrarse. `cookie` es el valor de la cookie de la invitación; sin ella no hace nada. La
 * cuenta que ya existía cuando se abrió el enlace queda como `cuenta_previa`; la nueva, `pendiente`, con la puerta C.
 */
export async function vincularInvitacion(
  admin: SupabaseClient,
  p: { userId: string; creadaAt: string | null | undefined; cookie: string | null | undefined; huella: Huella },
  ahora: Date = new Date(),
): Promise<ResultadoVinculo> {
  try {
    const inv = leerCookieInvitacion(p.cookie);
    if (!inv) return "sin_invitacion";
    const { data: previo, error: e0 } = await admin.from("referidos").select("estado").eq("invitado_id", p.userId).maybeSingle();
    reportarFalloQuery(e0, { ruta: RUTA, operacion: "leer-referido", userId: p.userId });
    if (e0) return "fallo";
    if (previo) return "ya";
    const invitacion = await leerInvitacion(admin, inv.codigo);
    if (!invitacion) return "sin_invitacion";
    if (invitacion.userId === p.userId) return "propio";
    const nueva = cuentaNuevaParaInvitacion({ creadaAt: p.creadaAt, visitaMs: inv.visitaMs, ahoraMs: ahora.getTime() });
    const estado: EstadoReferido = nueva ? "pendiente" : "cuenta_previa";
    const { error } = await admin.from("referidos").insert({
      invitado_id: p.userId, invitador_id: invitacion.userId, codigo: invitacion.codigo, estado, dispositivo_hash: p.huella.dispositivo,
      vinculado_at: ahora.toISOString(), decidido_at: nueva ? null : ahora.toISOString(),
    });
    if (error) {
      if ((error as { code?: string }).code === "23505") return "ya";
      reportarFalloQuery(error, { ruta: RUTA, operacion: "vincular", userId: p.userId });
      return "fallo";
    }
    if (nueva) await fijarPuertaReferido(admin, p.userId, `${PREFIJO_DETALLE_INVITACION}${invitacion.codigo}`);
    void capturarServidor({
      event: "referido_vinculado", distinctId: p.userId, uuid: uuidDeterminista(`referido_vinculado:${p.userId}`),
      properties: { estado, invitador: invitacion.userId, codigo: invitacion.codigo, con_nombre: invitacion.conNombre },
    }).catch(() => {});
    return estado;
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "vincular", userId: p.userId });
    return "fallo";
  }
}

export interface ResultadoPremio {
  estado: DecisionPremio | "ya" | "sin_referido" | "fallo";
  /** Cuándo vence el análisis que recibió quien invitó, si se pagó. */
  vence?: string;
  pagados?: number;
}

type Enviar = typeof sendPremioReferidoEmail;

/** El correo a quien invitó. Las cuentas de prueba no lo reciben (salvo las marcadas con `recibe_correos`). */
async function avisarInvitador(admin: SupabaseClient, invitadorId: string, vence: string, pagados: number, enviar: Enviar): Promise<"enviado" | "fallo" | "omitido_prueba" | "sin_correo"> {
  const [{ data: u }, { data: prueba, error: eP }, { data: enlace }] = await Promise.all([
    admin.auth.admin.getUserById(invitadorId),
    admin.from("test_accounts").select("recibe_correos").eq("user_id", invitadorId).maybeSingle(),
    admin.from("invitaciones").select("codigo").eq("user_id", invitadorId).eq("con_nombre", false).maybeSingle(),
  ]);
  // Sin saber si es de prueba no se manda: mejor un correo de menos que uno a quien no corresponde.
  if (eP) return "fallo";
  if (prueba && (prueba as { recibe_correos?: boolean }).recibe_correos !== true) return "omitido_prueba";
  const user = u?.user;
  if (!user?.email) return "sin_correo";
  const ok = await enviar(user.email, { nombre: nombreReal(user.user_metadata), vence, pagados, codigo: (enlace?.codigo as string | undefined) ?? null }, { userId: invitadorId });
  return ok ? "enviado" : "fallo";
}

/**
 * EL PREMIO, cuando el invitado contesta el «cuándo». Solo para una invitación `pendiente`: la decide una vez. El invitado
 * no recibe nada acá: su regalo es el de cuenta nueva (regalo-alta-servidor.ts), el mismo de todos.
 */
export async function pagarPremioReferido(
  admin: SupabaseClient,
  p: { invitadoId: string; enviar?: Enviar },
  ahora: Date = new Date(),
): Promise<ResultadoPremio> {
  const enviar = p.enviar ?? sendPremioReferidoEmail;
  try {
    const { data: r, error: e0 } = await admin.from("referidos").select("invitador_id, codigo, estado, dispositivo_hash").eq("invitado_id", p.invitadoId).maybeSingle();
    reportarFalloQuery(e0, { ruta: RUTA, operacion: "leer-referido", userId: p.invitadoId });
    if (e0) return { estado: "fallo" };
    if (!r) return { estado: "sin_referido" };
    if (r.estado !== "pendiente") return { estado: "ya" };
    const invitador = r.invitador_id as string;
    const decidido = ahora.toISOString();

    const contarPagados = () => premiosPagados(admin, invitador);
    const [{ data: enlaces, error: e1 }, { data: regalo, error: e2 }, pagados0] = await Promise.all([
      admin.from("invitaciones").select("dispositivos").eq("user_id", invitador),
      admin.from("regalos_alta").select("dispositivo_hash").eq("user_id", invitador).maybeSingle(),
      contarPagados(),
    ]);
    // Un conteo sin número es «no sé», no cero: no se paga a ciegas (se reintenta en el próximo «cuándo»).
    if (e1 || e2 || pagados0 == null) {
      reportarFalloQuery(e1 ?? e2, { ruta: RUTA, operacion: "leer-invitador", userId: invitador });
      return { estado: "fallo" };
    }
    const dispositivos = [
      ...((enlaces ?? []) as Array<{ dispositivos: string[] | null }>).flatMap((f) => f.dispositivos ?? []),
      ...(regalo?.dispositivo_hash ? [regalo.dispositivo_hash as string] : []),
    ];
    let pagados = pagados0;
    let decision = decidirPremio({ dispositivoInvitado: (r.dispositivo_hash as string | null) ?? null, dispositivosInvitador: dispositivos, pagados });

    // El lugar entre los cinco: el índice único (invitador, premio_n) rechaza un segundo premio con el mismo número.
    let tomado = false;
    for (let intento = 0; decision === "pagar" && !tomado && intento < 3; intento++) {
      const n = pagados + 1;
      if (n > TOPE_PREMIOS_REFERIDO) { decision = "tope"; break; }
      const { data: filas, error } = await admin.from("referidos").update({ estado: "pagado", premio_n: n, decidido_at: decidido })
        .eq("invitado_id", p.invitadoId).eq("estado", "pendiente").select("invitado_id");
      if (error) {
        if ((error as { code?: string }).code !== "23505") { reportarFalloQuery(error, { ruta: RUTA, operacion: "tomar-lugar", userId: invitador }); return { estado: "fallo" }; }
        const otra = await contarPagados();
        if (otra == null) return { estado: "fallo" };
        pagados = otra;
        continue;
      }
      if ((filas?.length ?? 0) !== 1) return { estado: "ya" };
      tomado = true;
      pagados = n;
    }

    if (decision !== "pagar") {
      await admin.from("referidos").update({ estado: decision, decidido_at: decidido }).eq("invitado_id", p.invitadoId).eq("estado", "pendiente");
      void capturarServidor({
        event: "referido_sin_premio", distinctId: invitador, uuid: uuidDeterminista(`referido_premio:${p.invitadoId}`),
        properties: { motivo: decision, invitado: p.invitadoId, codigo: r.codigo },
      }).catch(() => {});
      return { estado: decision };
    }
    if (!tomado) return { estado: "fallo" };

    const vence = new Date(ahora.getTime() + DIAS_VIGENCIA_PREMIO_REFERIDO * 864e5).toISOString();
    const { data: g, error: eG } = await admin.from("credit_grants").insert({
      user_id: invitador, amount: 1, remaining: 1, source: FUENTE_PREMIO_REFERIDO, granted_at: decidido, expires_at: vence,
    }).select("id").single();
    if (eG || !g) {
      reportarFalloQuery(eG, { ruta: RUTA, operacion: "cargar-premio", userId: invitador });
      // Sin el análisis no hay premio: el lugar se suelta y la invitación vuelve a esperar el próximo «cuándo».
      await admin.from("referidos").update({ estado: "pendiente", premio_n: null, decidido_at: null }).eq("invitado_id", p.invitadoId);
      return { estado: "fallo" };
    }
    await admin.from("referidos").update({ grant_id: g.id }).eq("invitado_id", p.invitadoId);
    const correo = await avisarInvitador(admin, invitador, vence, pagados, enviar).catch(() => "fallo" as const);
    await admin.from("referidos").update({ correo_estado: correo }).eq("invitado_id", p.invitadoId);
    void capturarServidor({
      event: "referido_premiado", distinctId: invitador, uuid: uuidDeterminista(`referido_premio:${p.invitadoId}`),
      properties: { invitado: p.invitadoId, codigo: r.codigo, premio_n: pagados, vence, correo },
    }).catch(() => {});
    return { estado: "pagar", vence, pagados };
  } catch (e) {
    reportarFalloQuery(e, { ruta: RUTA, operacion: "pagar", userId: p.invitadoId });
    return { estado: "fallo" };
  }
}

/**
 * Lo que corre al contestar el «cuándo» con sesión: si la cuenta todavía no cobró el código (llegó a contestar sin pasar
 * por un registro que lo cobrara), lo cobra; después, el premio.
 */
export async function referidoAlContestarCuando(
  admin: SupabaseClient,
  p: { userId: string; creadaAt: string | null | undefined; cookie: string | null | undefined; huella: Huella },
): Promise<ResultadoPremio> {
  if (p.cookie) await vincularInvitacion(admin, p);
  return pagarPremioReferido(admin, { invitadoId: p.userId });
}
