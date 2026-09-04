// ============================================================================
// Generador · universo STR por comuna (V2) → src/lib/engines/str-universo-santiago.gen.ts
// ============================================================================
// La V1 (12-may-2026) era una tabla escrita a mano ("aproximación heurística") y quedaba
// ARRIBA del parque en 14 de 14 comunas con datos (mediana +8,3 pts, máx +20,6): con la
// decisividad real coronaba informes por construcción. La V2 se calcula desde las
// respuestas de mercado guardadas (`airbnb_estimates.raw_response.percentiles`, el p50 de
// ocupación y tarifa que la estimación devuelve para cada dirección):
//   · comuna por dirección: el segmento antes de "Región Metropolitana" (sin código
//     postal), o un nombre del roster presente en la dirección, o la dirección exacta de
//     un análisis persistido (que sí trae comuna). Sin comuna reconocible ⇒ fuera.
//   · una fila por (dirección, dormitorios): la más reciente.
//   · mediana por comuna con n ≥ 3 direcciones; menos ⇒ la comuna no entra ("sin datos
//     suficientes" en la superficie). Cada valor lleva {valor, n, fecha}.
// El copy visible dice "datos de mercado", nunca el nombre del proveedor.
//
//   node --env-file=.env.local --import tsx scripts/data/generar-str-universo.ts
// ============================================================================
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { COMUNAS_ROSTER } from "../../src/lib/data/comunas-roster";

const MIN_N = 3;
const EXTRA = ["La Granja", "San Bernardo", "Colina", "Lo Prado", "Cerro Navia", "El Bosque", "San Ramón", "Lo Espejo", "Pedro Aguirre Cerda", "La Pintana", "Padre Hurtado"];
const COMUNAS = [...COMUNAS_ROSTER.map((c) => c.nombre as string), ...EXTRA];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const ALIAS: Record<string, string> = { "santiago centro": "Santiago" };
const byNorm = new Map<string, string>(COMUNAS.map((c) => [norm(c), c]));

function comunaDeDireccion(address: string, porDireccion: Map<string, string>): string | null {
  const exacta = porDireccion.get(norm(address));
  if (exacta) return ALIAS[norm(exacta)] ?? byNorm.get(norm(exacta)) ?? exacta;
  const m = address.match(/([^,]+),\s*Regi[oó]n Metropolitana/i);
  if (m) {
    const seg = norm(m[1].replace(/^\s*\d{7}\s*/, "").replace(/^\d+\s+/, ""));
    if (byNorm.has(seg)) return byNorm.get(seg)!;
    if (ALIAS[seg]) return ALIAS[seg];
    // "8330649 Santiago" u otros restos numéricos delante del nombre
    for (const [k, v] of byNorm) if (seg.endsWith(" " + k) || seg === k) return v;
  }
  // Sin región: un nombre del roster como palabra completa (el último que aparezca);
  // "Santiago" solo si no hay otra comuna nombrada (en las direcciones completas es la región).
  const a = norm(address);
  let mejor: { c: string; pos: number } | null = null;
  for (const [k, v] of byNorm) {
    const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
    const mm = re.exec(a);
    if (mm && (v !== "Santiago" || !mejor) && (!mejor || mm.index > mejor.pos || mejor.c === "Santiago")) mejor = { c: v, pos: mm.index };
  }
  return mejor?.c ?? null;
}

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // direcciones de análisis persistidos → comuna (fallback exacto)
  const porDireccion = new Map<string, string>();
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from("analisis").select("comuna, input_data->direccion").eq("tipo_analisis", "short-term").order("id").range(from, from + 499);
    if (error) throw error;
    for (const r of data ?? []) { const dir = (r as { direccion?: string }).direccion; if (typeof dir === "string" && r.comuna) porDireccion.set(norm(dir), r.comuna as string); }
    if (!data || data.length < 500) break;
  }
  type Fila = { address: string; bedrooms: number; created_at: string; occ: number; adr: number };
  const filas: Fila[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from("airbnb_estimates").select("address, bedrooms, created_at, raw_response->percentiles").order("id").range(from, from + 499);
    if (error) throw error;
    for (const r of data ?? []) {
      const p = (r as { percentiles?: { occupancy?: { p50?: number }; average_daily_rate?: { p50?: number } } }).percentiles;
      const occ = p?.occupancy?.p50, adr = p?.average_daily_rate?.p50;
      if (typeof occ === "number" && typeof adr === "number" && occ > 0 && occ <= 1 && adr > 0) filas.push({ address: r.address, bedrooms: r.bedrooms, created_at: r.created_at, occ, adr });
    }
    if (!data || data.length < 500) break;
  }
  // una por (dirección, dormitorios): la más reciente
  const ultima = new Map<string, Fila>();
  for (const f of filas) { const k = `${norm(f.address)}#${f.bedrooms}`; const prev = ultima.get(k); if (!prev || f.created_at > prev.created_at) ultima.set(k, f); }
  const porComuna = new Map<string, Fila[]>();
  let sinComuna = 0;
  for (const f of ultima.values()) {
    const c = comunaDeDireccion(f.address, porDireccion);
    if (!c) { sinComuna++; continue; }
    if (!porComuna.has(c)) porComuna.set(c, []);
    porComuna.get(c)!.push(f);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const entradas: string[] = [];
  const excluidas: string[] = [];
  for (const [c, fs] of [...porComuna.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (fs.length < MIN_N) { excluidas.push(`${c} (n=${fs.length})`); continue; }
    const fecha = fs.map((f) => f.created_at).sort().at(-1)!.slice(0, 10);
    entradas.push(`  ${JSON.stringify(c)}: { ocupacion: { valor: ${(Math.round(med(fs.map((f) => f.occ)) * 1000) / 1000).toFixed(3)}, n: ${fs.length}, fecha: "${fecha}" }, adr: { valor: ${Math.round(med(fs.map((f) => f.adr)))}, n: ${fs.length}, fecha: "${fecha}" } },`);
  }
  const contenido = `// GENERADO — no editar a mano. Regenerar con:
//   node --env-file=.env.local --import tsx scripts/data/generar-str-universo.ts
// Universo STR por comuna (V2 · ${hoy}): mediana del p50 de ocupación y de tarifa por noche
// que la estimación de mercado devuelve por dirección, sobre ${ultima.size} direcciones
// distintas guardadas (${filas.length} respuestas; ${sinComuna} sin comuna reconocible quedaron
// fuera). Solo comunas con n ≥ ${MIN_N} direcciones; el resto es "sin datos suficientes":
// ${excluidas.join(" · ") || "ninguna"}.
// El copy visible dice "datos de mercado"; el proveedor no se nombra al usuario.

export interface DatoComunaSTR { valor: number; n: number; fecha: string }
export interface UniversoComunaSTR { ocupacion: DatoComunaSTR; adr: DatoComunaSTR }

export const STR_UNIVERSO_V2_META = { generado: "${hoy}", minN: ${MIN_N}, direcciones: ${ultima.size}, respuestas: ${filas.length}, fuente: "datos de mercado (respuestas guardadas por dirección)" } as const;

export const STR_UNIVERSO_V2: Record<string, UniversoComunaSTR> = {
${entradas.join("\n")}
};
`;
  const out = join(process.cwd(), "src/lib/engines/str-universo-santiago.gen.ts");
  writeFileSync(out, contenido, "utf-8");
  console.log(`escrito ${out} · ${entradas.length} comunas con n ≥ ${MIN_N} · excluidas: ${excluidas.join(", ") || "ninguna"} · sin comuna: ${sinComuna} de ${ultima.size}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
