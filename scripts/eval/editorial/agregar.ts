// ============================================================================
// AGREGADOR DEL CENSO — Fase 2 (distribuciones + dump compacto para familias)
// ============================================================================
// Lee out-censo/_censo.json y produce:
//   1. Tablas de distribución: dimensión × severidad, y cortes por tipo,
//      veredicto y antigüedad de prosa (pv3 vs anteriores).
//   2. Lista de informes 100% limpios (línea base).
//   3. Dump compacto de TODAS las fallas (una línea c/u) → out-censo/_fallas.txt
//      — insumo para el agrupamiento en familias (análisis con juicio, no acá).
// Determinístico, cero llamadas a API.
//
// Uso: node --env-file=.env.local --import tsx scripts/eval/editorial/agregar.ts
import { readFileSync, writeFileSync } from "fs";
import path from "path";

interface Falla { dimension: number; severidad: string; pieza: string; cita: string; explicacion: string; confirmada?: boolean }
interface Resumen {
  id8: string; tipo: string; veredicto: string; pv: number | null; comuna: string;
  altasConfirmadas: number; altasDebiles: number; medias: number; bajas: number;
  fallas: Falla[]; error?: string;
}

const outDir = path.join(__dirname, "out-censo");
const censo = JSON.parse(readFileSync(path.join(outDir, "_censo.json"), "utf-8")) as {
  corrida: { informes: number; frenado: boolean; usd: number; minutos: number };
  resumenes: Resumen[];
};

const rs = censo.resumenes.filter((r) => !r.error);
const errores = censo.resumenes.filter((r) => r.error);
const esVieja = (r: Resumen) => (r.pv ?? 0) < 3;

const sevRank = (f: Falla) => (f.severidad === "alta" ? (f.confirmada === true ? "ALTA✓" : "ALTA?") : f.severidad.toUpperCase());

// ── 1. Distribución dimensión × severidad ───────────────────────────────────
function tabla(filtro: (r: Resumen) => boolean, titulo: string) {
  const grupo = rs.filter(filtro);
  if (grupo.length === 0) return;
  const m: Record<number, Record<string, number>> = {};
  for (const r of grupo) for (const f of r.fallas) {
    const d = f.dimension ?? 0;
    m[d] = m[d] || {};
    const s = sevRank(f);
    m[d][s] = (m[d][s] || 0) + 1;
  }
  console.log(`\n── ${titulo} (${grupo.length} informes) ──`);
  console.log("dim   ALTA✓ ALTA?  MEDIA  BAJA");
  for (const d of Object.keys(m).map(Number).sort()) {
    const row = m[d];
    console.log(`${String(d).padEnd(5)} ${String(row["ALTA✓"] ?? 0).padStart(5)} ${String(row["ALTA?"] ?? 0).padStart(5)} ${String(row["MEDIA"] ?? 0).padStart(6)} ${String(row["BAJA"] ?? 0).padStart(5)}`);
  }
}

console.log(`CENSO: ${rs.length} informes ok · ${errores.length} errores · USD ${censo.corrida.usd.toFixed(2)} · ${censo.corrida.minutos.toFixed(1)} min${censo.corrida.frenado ? " · ⚠ FRENADO" : ""}`);
errores.forEach((r) => console.log(`  ✗ ${r.id8}: ${r.error}`));

tabla(() => true, "TOTAL");
tabla((r) => r.tipo === "LTR", "LTR");
tabla((r) => r.tipo === "STR", "STR");
tabla((r) => !esVieja(r), "prosa pv3 (regenerada)");
tabla((r) => esVieja(r), "prosa vieja (pv<3 / null)");
for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]) tabla((r) => r.veredicto === v, `veredicto ${v}`);

// ── 2. Limpios y casi-limpios ───────────────────────────────────────────────
const limpios = rs.filter((r) => r.fallas.length === 0);
const sinAltas = rs.filter((r) => r.fallas.length > 0 && r.altasConfirmadas === 0 && r.altasDebiles === 0);
console.log(`\n── LIMPIOS (0 fallas): ${limpios.length} ──`);
limpios.forEach((r) => console.log(`  ${r.id8} ${r.tipo} ${r.veredicto} pv=${r.pv ?? "-"} ${r.comuna}`));
console.log(`\n── SIN ALTAS (solo medias/bajas): ${sinAltas.length} ──`);
sinAltas.forEach((r) => console.log(`  ${r.id8} ${r.tipo} ${r.veredicto.padEnd(16)} pv=${r.pv ?? "-"} M${r.medias} B${r.bajas}`));

// ── 3. Dump compacto para familias ──────────────────────────────────────────
const lineas: string[] = [];
for (const r of rs) for (const f of r.fallas) {
  lineas.push(`${r.id8}|${r.tipo}|pv${r.pv ?? "-"}|${r.veredicto}|d${f.dimension}|${sevRank(f)}|${f.pieza}|${(f.explicacion ?? "").replace(/\s+/g, " ").slice(0, 160)}|«${(f.cita ?? "").replace(/\s+/g, " ").slice(0, 80)}»`);
}
writeFileSync(path.join(outDir, "_fallas.txt"), lineas.join("\n"), "utf-8");
console.log(`\nDump: ${lineas.length} fallas → out-censo/_fallas.txt`);

// Ranking rápido de informes por carga de ALTAs confirmadas
const peores = [...rs].sort((a, b) => b.altasConfirmadas - a.altasConfirmadas || b.altasDebiles - a.altasDebiles).slice(0, 12);
console.log(`\n── PEORES por ALTAs confirmadas ──`);
peores.forEach((r) => console.log(`  ${r.id8} ${r.tipo} ${r.veredicto.padEnd(16)} pv=${r.pv ?? "-"} A✓${r.altasConfirmadas} A?${r.altasDebiles} M${r.medias}`));
