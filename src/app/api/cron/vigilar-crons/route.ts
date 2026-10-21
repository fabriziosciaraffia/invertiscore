import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { latirCron, leerLatidos } from "@/lib/cron-heartbeat";
import { avisar, cerrarCron, CORRIDA_FALLIDA, FUENTE_ALERTA } from "@/lib/cron-resultado";
import { alVigilar, condicionBloqueo, condicionesDelCron, CRONS_AL_RESUMEN, esperaResumen, ESTADO_INICIAL, METRICA_RESUMEN, VIGILANTE } from "@/lib/cron-alertas";
import { guardarEstadoCron, leerEstadosCron } from "@/lib/cron-estado";
import { guardarMetrica } from "@/lib/metrics-daily";
import { almacenSupabase, vaciarColaVencida } from "@/lib/agentes-navegador";

// ─────────────────────────────────────────────────────────────────────────────
// La vigilancia de los crons (29-sep-2026; reglas de las alertas desde el 15-oct-2026, cron-alertas.ts). Cada 6 horas
// lee el estado de todos los crons vigilados (cron-heartbeat.ts › leerLatidos, y su estado entre corridas en
// `cron_estado`) y avisa a hola@ SOLO cuando hace falta una persona:
//   · un cron de UNA corrida al día, en el acto: dos corridas seguidas fallidas (una que latió y no cerró cuenta),
//     dos saltadas (atrasado), un día sin una buena, o que dejó de escribir su dato;
//   · los crons de VARIAS corridas al día, en UN correo por día —el resumen de lo que quedó sin resolver al cierre—,
//     armado por la primera vigilancia del día siguiente; y en ese mismo resumen los de CRONS_AL_RESUMEN (prosa-comunas,
//     semanal), desde su primera corrida fallida;
//   · la lectura de fichas, si pasa un día sin una lectura buena mientras hay bloqueos.
// Sus propias fallas no esperan el resumen que arma ella: dos seguidas avisan al cerrar (cron-alertas.ts › esperaResumen).
// Cada episodio avisa una vez: lo ya avisado queda en el estado del cron hasta que se resuelve. Lo resuelto solo queda
// en el registro y en el panel.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const NOMBRE = VIGILANTE;
/** La lectura de fichas como si fuera un cron: su estado y sus avisos viven con los demás. */
const FICHA = "ficha";

/** Lo que dicen las lecturas de ficha de las últimas 24 horas: los bloqueos, las que no tuvieron respuesta (19-oct-2026:
 *  con el proxy caído no hay bloqueos, solo «error» y «tiempo») y la última lectura buena. */
async function estadoFicha(sb: SupabaseClient): Promise<{ bloqueos24h: number; sinRespuesta24h: number; ultimaBuena: string | null }> {
  const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
  const [{ count, error: e1 }, { count: sinResp, error: e3 }, { data, error: e2 }] = await Promise.all([
    sb.from("lecturas_ficha").select("id", { count: "exact", head: true }).eq("motivo", "bloqueo").gte("leido_at", desde),
    sb.from("lecturas_ficha").select("id", { count: "exact", head: true }).in("motivo", ["error", "tiempo"]).gte("leido_at", desde),
    sb.from("lecturas_ficha").select("leido_at").in("motivo", ["publicado", "despublicado"]).order("leido_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw new Error(`lecturas_ficha: ${(e1 ?? e2 ?? e3)!.message}`);
  return { bloqueos24h: count ?? 0, sinRespuesta24h: sinResp ?? 0, ultimaBuena: (data?.leido_at as string | undefined) ?? null };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await latirCron(sb, NOMBRE);
  const ahora = new Date();
  const ayer = new Date(ahora.getTime() - 864e5).toISOString().slice(0, 10);

  try {
    const [latidos, estados, { data: hecho }] = await Promise.all([
      leerLatidos(sb),
      leerEstadosCron(sb),
      sb.from("metrics_daily").select("valor").eq("fecha", ayer).eq("fuente", FUENTE_ALERTA).eq("metrica", METRICA_RESUMEN).maybeSingle(),
    ]);
    // El resumen de ayer lo arma la primera vigilancia de hoy (y solo esa).
    const esResumen = !hecho;
    const estado = latidos.filter((c) => c.nombre !== NOMBRE);
    const resumen: Array<{ cron: string; texto: string }> = [];
    let alertas = 0;
    for (const c of estado) {
      const e = estados.get(c.nombre) ?? { ...ESTADO_INICIAL };
      const condiciones = condicionesDelCron(c.intervaloHoras, e, {
        atrasado: c.atrasado, textoAtrasado: c.motivos.atrasado, sinEscribir: c.sinEscribir, textoSinEscribir: c.motivos["sin-escribir"],
      }, ahora, CRONS_AL_RESUMEN.has(c.nombre));
      const r = alVigilar(e, condiciones, esperaResumen(c.nombre), esResumen);
      if (r.estado.alertas.join("|") !== e.alertas.join("|")) await guardarEstadoCron(sb, c.nombre, r.estado);
      for (const a of r.inmediatos) { await avisar(sb, c.nombre, a); alertas++; }
      for (const a of r.resumen) resumen.push({ cron: c.nombre, texto: a.texto });
    }
    // La lectura de fichas: un bloqueo avisa solo si pasa un día sin una lectura buena.
    const eFicha = estados.get(FICHA) ?? { ...ESTADO_INICIAL };
    const bloqueo = condicionBloqueo(await estadoFicha(sb), ahora);
    const rFicha = alVigilar(eFicha, bloqueo ? [bloqueo] : [], false, false);
    if (rFicha.estado.alertas.join("|") !== eFicha.alertas.join("|")) await guardarEstadoCron(sb, FICHA, rFicha.estado);
    for (const a of rFicha.inmediatos) { await avisar(sb, FICHA, a); alertas++; }
    // El resumen del día (a lo más uno): la marca va siempre, para que la vigilancia siguiente no lo repita.
    let colaSinAgente: { enviados: number; fallidos: number } | null = null;
    if (esResumen) {
      await guardarMetrica(sb, { fecha: ayer, fuente: FUENTE_ALERTA, metrica: METRICA_RESUMEN, valor: resumen.length });
      if (resumen.length) {
        const { sendResumenCronsInterno } = await import("@/lib/email");
        await sendResumenCronsInterno({ fecha: ayer, items: resumen });
        alertas++;
      }
      // La cola de eventos sin agente (21-oct-2026, agentes-navegador.ts): lo que lleva más de 24 horas esperando sale
      // con su hora, el agente genérico de Franco y agente_origen = ninguno. Después del resumen, con tope de tiempo:
      // lo que no alcance queda para mañana. Nunca lanza.
      colaSinAgente = await vaciarColaVencida(almacenSupabase(() => sb));
    }
    // La vigilancia misma sale bien aunque haya crons en rojo: su trabajo es verlos y avisar.
    return cerrarCron(sb, NOMBRE, { procesados: estado.length, exitosos: estado.length, fallidos: 0 }, {
      enRojo: estado.filter((c) => c.enRojo).map((c) => ({ cron: c.nombre, motivo: c.motivo })),
      alertasEnviadas: alertas,
      resumen: esResumen ? resumen.length : null,
      colaSinAgente,
    });
  } catch (e) {
    return cerrarCron(sb, NOMBRE, CORRIDA_FALLIDA, { error: `leer el estado: ${String(e).slice(0, 200)}` });
  }
}
