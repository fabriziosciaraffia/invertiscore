import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BCCH_BASE_URL = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";

async function fetchBCCH(seriesId: string, firstDate: string, lastDate: string) {
  const user = process.env.BCCH_API_USER;
  const pass = process.env.BCCH_API_PASS;
  if (!user || !pass) return null;

  const params = new URLSearchParams({
    user,
    pass,
    function: "GetSeries",
    timeseries: seriesId,
    firstdate: firstDate,
    lastdate: lastDate,
  });

  try {
    const response = await fetch(`${BCCH_BASE_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.Codigo !== 0) return null;
    return data.Series.Obs.filter((o: { statusCode: string }) => o.statusCode === "OK");
  } catch {
    return null;
  }
}

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
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const firstDate = threeMonthsAgo.toISOString().split("T")[0];

  const results: Record<string, { value?: number; date?: string; error?: string; source?: string }> = {};

  // 1. Tasa hipotecaria vivienda (serie mensual)
  const tasaObs = await fetchBCCH("F022.VIV.TIP.MA03.UF.Z.M", firstDate, today);
  if (tasaObs && tasaObs.length > 0) {
    const latest = tasaObs[tasaObs.length - 1];
    const value = parseFloat(String(latest.value).replace(",", "."));
    if (!isNaN(value) && value > 0) {
      const { error } = await supabase
        .from("config")
        .upsert({ key: "tasa_hipotecaria", value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
      results.tasa = { value, source: "banco_central", error: error?.message };
    }
  } else {
    results.tasa = { error: "No data from BCCH (check BCCH_API_USER/BCCH_API_PASS)" };
  }

  // 2. UF (serie diaria)
  let ufValue: number | null = null;
  const ufObs = await fetchBCCH("F073.UFF.PRE.Z.D", today, today);
  if (ufObs && ufObs.length > 0) {
    ufValue = parseFloat(String(ufObs[0].value).replace(/\./g, "").replace(",", "."));
  } else {
    // Si no hay dato de hoy, intentar ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split("T")[0];
    const ufObs2 = await fetchBCCH("F073.UFF.PRE.Z.D", yDate, yDate);
    if (ufObs2 && ufObs2.length > 0) {
      ufValue = parseFloat(String(ufObs2[0].value).replace(/\./g, "").replace(",", "."));
      results.uf = { date: yDate };
    }
  }

  if (ufValue && !isNaN(ufValue) && ufValue > 0) {
    const { error } = await supabase
      .from("config")
      .upsert({ key: "uf_value", value: String(Math.round(ufValue)), updated_at: new Date().toISOString() }, { onConflict: "key" });
    results.uf = { ...results.uf, value: Math.round(ufValue), source: "banco_central", error: error?.message };
  } else if (!results.uf?.date) {
    results.uf = { error: "No UF data from BCCH" };
  }

  return NextResponse.json({ success: true, results });
}
