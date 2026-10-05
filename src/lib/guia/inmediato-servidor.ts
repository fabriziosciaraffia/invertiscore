// ─────────────────────────────────────────────────────────────────────────────
// El aviso inmediato del lado del servidor (05-oct-2026). Las reglas viven en inmediato.ts (puro); acá se
// lee el perfil y el «Ya», se elige con la misma preparación que el semanal (pero con los avisos NUEVOS),
// se chequean las fichas con el presupuesto de siempre y se manda UN correo por día por persona. La fila
// del día se toma antes de mandar y se suelta si Resend falla.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { leerSaldo } from "@/lib/casa-saldo";
import { nombreReal } from "@/lib/welcome";
import { sendInmediatoEmail, sendPreguntaYaEmail } from "@/lib/email";
import { textoBusca } from "@/lib/email/correo-semanal";
import { correoInmediato, correoPreguntaYa } from "@/lib/email/correo-inmediato";
import { VENTANA_NUEVOS_HORAS, RUTA_SUELTO_INMEDIATO, diaDelAviso, elegirInmediato, estadoYa, type HorizonteCompra } from "./inmediato";
import { avisadosAlMomento, prepararSeleccion, publicadoConPresupuesto, type ItemSemanal, type PresupuestoFichas } from "./semanal-servidor";

const RUTA = "lib/guia/inmediato";
const fecha = (s: string | null | undefined) => (s ? new Date(s) : null);

/** Los enlaces del aviso: el clic y la compra pasan por /api/semanal (la misma página); la baja es propia. */
export function enlacesInmediato(sitio: string, token: string) {
  return {
    depto: (avisoId: string) => `${sitio}/api/semanal/clic?t=${token}&a=${avisoId}`,
    boton: `${sitio}/api/semanal/clic?t=${token}`,
    comprar: `${sitio}/api/semanal/clic?t=${token}&ir=comprar`,
    baja: `${sitio}/api/inmediato/baja?t=${token}`,
  };
}

export type ResultadoInmediato = "enviado" | "pregunta" | "nada" | "ya" | "no" | "fallido";

/** La pregunta de los 60 días, una vez: se marca antes de mandar (dos corridas no la mandan dos veces). */
async function preguntar(admin: SupabaseClient, userId: string, yaDesde: Date, sitio: string): Promise<ResultadoInmediato> {
  const token = randomBytes(18).toString("hex");
  await admin.from("perfil_busqueda").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: ganada, error } = await admin.from("perfil_busqueda").update({ ya_pregunta_at: new Date().toISOString(), ya_pregunta_token: token })
    .eq("user_id", userId).or(`ya_pregunta_at.is.null,ya_pregunta_at.lt.${yaDesde.toISOString()}`).select("user_id");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-pregunta", userId });
  if ((ganada?.length ?? 0) !== 1) return "ya";
  const { data: u } = await admin.auth.admin.getUserById(userId);
  if (!u?.user?.email) return "no";
  const correo = correoPreguntaYa({ nombre: nombreReal(u.user.user_metadata), urlRespuesta: (h) => `${sitio}/api/inmediato/horizonte?t=${token}&h=${h}` });
  const ok = await sendPreguntaYaEmail(u.user.email, correo, userId);
  if (!ok) {
    await admin.from("perfil_busqueda").update({ ya_pregunta_at: null, ya_pregunta_token: null }).eq("user_id", userId).eq("ya_pregunta_token", token);
    return "fallido";
  }
  void capturarServidor({ event: "aviso_inmediato_pregunta", distinctId: userId, uuid: uuidDeterminista(`aviso_inmediato_pregunta:${token}`), properties: {} }).catch(() => {});
  return "pregunta";
}

/** El aviso del día de una persona (o la pregunta, si su «Ya» cumplió 60 días sin compra). */
export async function avisarPersona(
  admin: SupabaseClient,
  userId: string,
  cfg: { uf: number; tasa: number },
  presupuesto: PresupuestoFichas,
  sitio: string,
  ahora: Date = new Date(),
): Promise<ResultadoInmediato> {
  const lp = await leerPerfilBusqueda(admin, userId);
  const { data: pago } = await admin.from("payments").select("created_at").eq("user_id", userId).eq("status", "paid")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const yaDesde = fecha(lp.horizonteDesde);
  const estado = estadoYa({
    horizonte: (lp.perfil.horizonte as HorizonteCompra | null) ?? null,
    yaDesde, ultimaCompra: fecha(pago?.created_at as string | undefined), preguntaAt: fecha(lp.yaPreguntaAt), bajaAt: fecha(lp.inmediatoBajaAt), ahora,
  });
  if (estado === "preguntar" && yaDesde) return preguntar(admin, userId, yaDesde, sitio);
  if (estado !== "vigente") return "no";

  const dia = diaDelAviso(ahora);
  const { data: hoy } = await admin.from("avisos_inmediatos").select("id, enviado_at").eq("user_id", userId).eq("dia", dia).maybeSingle();
  if (hoy?.enviado_at) return "ya";

  const nuevosDesde = new Date(ahora.getTime() - VENTANA_NUEVOS_HORAS * 3600_000).toISOString().replace("Z", "");
  const prep = await prepararSeleccion(admin, userId, cfg, { nuevosDesde });
  if (prep.tipo !== "lista") return "no";
  const { perfil, origen, combo, candidatos, evaluar } = prep.p;
  const elegidos = await elegirInmediato(candidatos, await avisadosAlMomento(admin, userId), evaluar, publicadoConPresupuesto(admin, presupuesto));
  if (elegidos.length === 0) return "nada";

  const items: ItemSemanal[] = elegidos.map(({ c, ev }) => ({
    avisoId: c.avisoId, comuna: c.comuna, tipologia: tipologiaDe(c.dormitorios, c.banos), m2: Math.round(c.m2), precioUF: Math.round(c.precioUF),
    veredicto: ev.veredicto, score: ev.score, flujo: ev.flujo,
  }));
  const fila = { user_id: userId, dia, items, aviso_ids: items.map((i) => i.avisoId), combinacion: combo, perfil, origen_analysis_id: origen.analysisId, enviado_at: new Date().toISOString() };
  // Se toma la fila del día ANTES de mandar: dos corridas no mandan dos correos el mismo día.
  const { data: tomada } = hoy
    ? await admin.from("avisos_inmediatos").update(fila).eq("id", hoy.id).is("enviado_at", null).select("id, token").maybeSingle()
    : await admin.from("avisos_inmediatos").insert(fila).select("id, token").maybeSingle();
  if (!tomada) return "ya";

  const [{ data: u }, saldo] = await Promise.all([admin.auth.admin.getUserById(userId), leerSaldo(admin, userId)]);
  const usuario = u?.user ?? null;
  const email = usuario?.email;
  const enlaces = enlacesInmediato(sitio, tomada.token as string);
  if (!email) {
    await admin.from("avisos_inmediatos").update({ enviado_at: null }).eq("id", tomada.id);
    return "no";
  }
  const correo = correoInmediato({
    nombre: nombreReal(usuario?.user_metadata),
    busca: textoBusca(perfil),
    piePct: combo.piePct,
    plazoAnios: combo.plazoAnios,
    deptos: items.map((d) => ({ ...d, url: enlaces.depto(d.avisoId) })),
    saldo: saldo.plan ? null : saldo.disponibles,
    urlBoton: enlaces.boton,
    urlComprar: enlaces.comprar,
    urlBaja: enlaces.baja,
  });
  const r = await sendInmediatoEmail(email, correo, userId, enlaces.baja);
  if (!r.ok) {
    await admin.from("avisos_inmediatos").update({ enviado_at: null }).eq("id", tomada.id);
    return "fallido";
  }
  await admin.from("avisos_inmediatos").update({ resend_id: r.id }).eq("id", tomada.id);
  void capturarServidor({
    event: "aviso_inmediato_enviado", distinctId: userId, uuid: uuidDeterminista(`aviso_inmediato_enviado:${tomada.id}`),
    properties: { dia, n: items.length, saldo: saldo.plan ? "plan" : saldo.disponibles },
  }).catch(() => {});
  return "enviado";
}

/** La ruta de compra del suelto que vino del aviso (la usa el clic de «Analizar uno · $9.990»). */
export const rutaSueltoInmediato = () => RUTA_SUELTO_INMEDIATO;
