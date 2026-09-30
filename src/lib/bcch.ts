// ─────────────────────────────────────────────────────────────────────────────
// Una serie del BCCh (SieteRestWS), con la razón si no llega (30-sep-2026).
//
// Antes (dentro de update-market) devolvía null ante cualquier cosa —credenciales, HTTP, Codigo ≠ 0,
// excepción— y la alerta decía solo «no data». El cron falló entero el 25-sep, a medias el 26 y entero
// el 30 a las 10:00; a las 10:09 la misma llamada desde producción salió bien. La falla es transitoria
// del lado del BCCh: por eso hasta INTENTOS_BCCH intentos con espera, y el último motivo viaja a la
// respuesta del cron (y de ahí al correo de la alerta).
// ─────────────────────────────────────────────────────────────────────────────

export const BCCH_BASE_URL = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";
export const INTENTOS_BCCH = 3;
export const ESPERA_BCCH_MS = [0, 5_000, 15_000];

export type ObsBCCH = { value: string; statusCode: string; indexDateString?: string };
export type RespuestaBCCH = { obs: ObsBCCH[]; error?: undefined } | { obs: null; error: string };

export async function fetchBCCH(
  seriesId: string,
  firstDate: string,
  lastDate: string,
  esperas: number[] = ESPERA_BCCH_MS,
): Promise<RespuestaBCCH> {
  let error = "";
  for (let i = 0; i < INTENTOS_BCCH; i++) {
    if (esperas[i]) await new Promise((r) => setTimeout(r, esperas[i]));
    const r = await fetchBCCHUnaVez(seriesId, firstDate, lastDate);
    if (r.obs) return r;
    error = r.error;
    if (error.startsWith("sin credenciales")) return r; // reintentar no lo arregla
  }
  return { obs: null, error: `${error} (tras ${INTENTOS_BCCH} intentos)` };
}

async function fetchBCCHUnaVez(seriesId: string, firstDate: string, lastDate: string): Promise<RespuestaBCCH> {
  const user = process.env.BCCH_API_USER;
  const pass = process.env.BCCH_API_PASS;
  if (!user || !pass) return { obs: null, error: "sin credenciales BCCH_API_USER/BCCH_API_PASS" };
  const params = new URLSearchParams({ user, pass, function: "GetSeries", timeseries: seriesId, firstdate: firstDate, lastdate: lastDate });
  try {
    const response = await fetch(`${BCCH_BASE_URL}?${params.toString()}`);
    if (!response.ok) return { obs: null, error: `BCCh http ${response.status}` };
    const data = await response.json();
    if (data.Codigo !== 0) return { obs: null, error: `BCCh Codigo ${data.Codigo}: ${String(data.Descripcion ?? "").slice(0, 120)}` };
    const obs = ((data.Series?.Obs ?? []) as ObsBCCH[]).filter((o) => o.statusCode === "OK");
    return obs.length ? { obs } : { obs: null, error: `BCCh sin observaciones ${firstDate}..${lastDate}` };
  } catch (e) {
    return { obs: null, error: `BCCh no respondió: ${String(e instanceof Error ? e.message : e).slice(0, 120)}` };
  }
}
