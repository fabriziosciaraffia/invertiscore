import { NextResponse } from "next/server";
import { latirCron } from "@/lib/cron-heartbeat";
import { createClient } from "@supabase/supabase-js";
import { parseNumeroBCCH, esUFPlausible, esTasaPlausible } from "@/lib/uf";
import { captureApiError } from "@/lib/observabilidad";
import { cerrarCron } from "@/lib/cron-resultado";
import { fetchBCCH } from "@/lib/bcch";

const RUTA = "POST /api/data/update-market";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// La serie del BCCh, con reintento y motivo, vive en @/lib/bcch (30-sep-2026).

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió".
  await latirCron(supabase, "update-market");
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const firstDate = threeMonthsAgo.toISOString().split("T")[0];

  const results: Record<string, { value?: number; date?: string; error?: string; source?: string }> = {};

  // 1. Tasa hipotecaria vivienda (serie mensual)
  // (Histórico: hasta 7f27a9b esta ruta no tenía cron — el de vercel.json apuntaba
  // al fantasma /api/scraping/update-market-data, hoy borrado. Desde entonces el
  // cron diario de las 10:00 UTC llama ESTA ruta y la UF/tasa se refrescan solas;
  // el botón del admin queda como disparo manual de respaldo.)
  const tasaR = await fetchBCCH("F022.VIV.TIP.MA03.UF.Z.M", firstDate, today);
  const tasaObs = tasaR.obs;
  if (tasaObs && tasaObs.length > 0) {
    const latest = tasaObs[tasaObs.length - 1];
    const value = parseNumeroBCCH(latest.value);
    // Guarda de plausibilidad: si el valor no entra en la banda, NO se escribe.
    // Dejar el dato viejo es mejor que pisarlo con basura — el stale se ve en el
    // panel con su fecha, el corrupto no se ve hasta que alguien lo audita.
    if (esTasaPlausible(value)) {
      const { error } = await supabase
        .from("config")
        .upsert({ key: "tasa_hipotecaria", value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
      results.tasa = { value, source: "banco_central", error: error?.message };
      if (error) {
        captureApiError(error, { ruta: RUTA, operacion: "upsert-tasa", extra: { value } });
      }
    } else {
      console.error("[update-market] tasa implausible, no se escribe:", latest.value, "→", value);
      results.tasa = { error: `Valor implausible del BCCh: ${String(latest.value)}` };
      captureApiError(new Error("Tasa fuera de banda de plausibilidad — no se escribe"), {
        ruta: RUTA,
        operacion: "validar-tasa",
        tags: { guard: "plausibilidad" },
        extra: { crudo: String(latest.value), parseado: value },
      });
    }
  } else {
    results.tasa = { error: `tasa: ${tasaR.error}` };
    captureApiError(new Error(`BCCh no devolvió serie de tasa: ${tasaR.error}`), {
      ruta: RUTA,
      operacion: "fetch-tasa-bcch",
    });
  }

  // 2. UF (serie diaria)
  let ufValue: number | null = null;
  let ufCrudo = "";
  const ufR = await fetchBCCH("F073.UFF.PRE.Z.D", today, today);
  const ufObs = ufR.obs;
  let ufError = ufR.error ?? "";
  if (ufObs && ufObs.length > 0) {
    ufCrudo = String(ufObs[0].value);
    ufValue = parseNumeroBCCH(ufCrudo);
  } else {
    // Si no hay dato de hoy, intentar ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split("T")[0];
    const ufR2 = await fetchBCCH("F073.UFF.PRE.Z.D", yDate, yDate);
    const ufObs2 = ufR2.obs;
    if (ufR2.error) ufError = `hoy: ${ufError} · ayer: ${ufR2.error}`;
    if (ufObs2 && ufObs2.length > 0) {
      ufCrudo = String(ufObs2[0].value);
      ufValue = parseNumeroBCCH(ufCrudo);
      results.uf = { date: yDate };
    }
  }

  // Misma guarda que la tasa. Acá importa el doble: este es el valor que quedó
  // ×100 en config desde el 2026-03-16 y nadie lo notó, porque el único chequeo
  // que había río abajo era `> 30000` — que 3.984.172 cumple de sobra.
  if (esUFPlausible(ufValue)) {
    const { error } = await supabase
      .from("config")
      .upsert({ key: "uf_value", value: String(Math.round(ufValue)), updated_at: new Date().toISOString() }, { onConflict: "key" });
    results.uf = { ...results.uf, value: Math.round(ufValue), source: "banco_central", error: error?.message };
    if (error) {
      captureApiError(error, { ruta: RUTA, operacion: "upsert-uf", extra: { value: Math.round(ufValue) } });
    }
  } else if (ufValue != null) {
    console.error("[update-market] UF implausible, no se escribe:", ufCrudo, "→", ufValue);
    results.uf = { ...results.uf, error: `Valor implausible del BCCh: ${ufCrudo}` };
    // Esta guarda existe porque el valor quedó ×100 en config desde el 2026-03-16
    // y nadie lo notó. Que frene la escritura ya no alcanza: tiene que avisar.
    captureApiError(new Error("UF fuera de banda de plausibilidad — no se escribe"), {
      ruta: RUTA,
      operacion: "validar-uf",
      tags: { guard: "plausibilidad" },
      extra: { crudo: ufCrudo, parseado: ufValue },
    });
  } else if (!results.uf?.date) {
    results.uf = { error: `uf: ${ufError}` };
    captureApiError(new Error(`BCCh no devolvió UF ni de hoy ni de ayer: ${ufError}`), {
      ruta: RUTA,
      operacion: "fetch-uf-bcch",
    });
  }

  // El `success: true` era incondicional: devolvía éxito con `results.uf = { error }`
  // adentro. Ahora success dice lo que hizo — escribió los dos valores o no.
  const tasaOk = results.tasa?.value != null && !results.tasa.error;
  const ufOk = results.uf?.value != null && !results.uf.error;
  const escritos = (tasaOk ? 1 : 0) + (ufOk ? 1 : 0);
  // Los motivos viajan en `errors`: es lo que cerrarCron pone en el correo de la alerta.
  const errors = [results.tasa?.error, results.uf?.error].filter((e): e is string => !!e);
  return cerrarCron(supabase, "update-market",
    { procesados: 2, exitosos: escritos, fallidos: 2 - escritos },
    { success: escritos === 2, results, errors });
}

// Vercel Cron dispara GET. Reusamos el handler POST (con su validación Bearer
// CRON_SECRET) para no duplicar lógica ni perder la auth — mismo patrón que
// /api/data/scrape-properties y compañía.
//
// Sin esta línea, apuntarle el cron a esta ruta devolvía 405: era el motivo real
// por el que la UF no se podía automatizar, más allá de que el cron estuviera
// apuntando a otro path. El botón de /admin/operacion sigue llamando por POST.
export const GET = POST;
