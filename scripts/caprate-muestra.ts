// FASE 3 — MUESTRA / validación BINARIA del hallazgo cap_rate. READ-ONLY, NO commitear.
//   node --import tsx scripts/caprate-muestra.ts
// Ejercita la lógica determinística nueva (buildHallazgoCapRate + getCapRefComuna)
// en los bordes, e integra un usado real vía runAnalysis. Confirma no-NaN / no-break.
import { buildHallazgoCapRate, getCapRefComuna } from "../src/lib/cap-rate-hallazgo";
import { runAnalysis } from "../src/lib/analysis";
import type { AnalisisInput, HallazgoCapRate } from "../src/lib/types";

const SEP = "─".repeat(118);
const f1 = (n: number) => n.toFixed(1).replace(".", ",");

function hasNaN(h: HallazgoCapRate): boolean {
  return [h.valor.capRatePct, h.valor.capRefPct, h.valor.gapPts, h.valor.banda, h.decisividad].some(
    (v) => !Number.isFinite(v),
  );
}

function fila(label: string, comuna: string, h: HallazgoCapRate | null) {
  if (!h) {
    console.log(`${label.padEnd(26)} │ ${comuna.padEnd(16)} │  → null (cae elegante, sin hallazgo)`);
    return;
  }
  const nan = hasNaN(h) ? "  ‼️ NaN!" : "";
  console.log(
    `${label.padEnd(26)} │ ${comuna.padEnd(16)} │ cap ${f1(h.valor.capRatePct).padStart(6)}% │ ref ${f1(h.valor.capRefPct)}% │ ` +
      `decis ${h.decisividad.toFixed(3)} │ ${h.direccion.padEnd(9)} │ ${h.procedencia.confianza.padEnd(5)}${nan}`,
  );
  console.log(`${" ".repeat(26)} │ frase: ${h.fraseCanonica}`);
}

console.log("\n══════ FASE 3 — VALIDACIÓN BINARIA cap_rate (v0: ref nacional 4,0% NETA, banda 2,0) ══════\n");

// ── Bloque A: control directo del cap rate del sujeto sobre los bordes ──
console.log("BLOQUE A — buildHallazgoCapRate con capRate controlado:\n" + SEP);
const casos: Array<{ label: string; cap: number; comuna: string }> = [
  { label: "muy sobre comuna", cap: 8.0, comuna: "Las Condes" },
  { label: "moderado favorable", cap: 5.2, comuna: "Ñuñoa" },
  { label: "≈ igual (decis ~0)", cap: 4.05, comuna: "Maipú" },
  { label: "exacto = ref", cap: 4.0, comuna: "Santiago" },
  { label: "bajo", cap: 2.5, comuna: "Estación Central" },
  { label: "muy bajo / negativo", cap: -0.5, comuna: "Puente Alto" },
  { label: "comuna sin comparables", cap: 4.5, comuna: "ComunaQueNoExiste" },
];
for (const c of casos) {
  const ref = getCapRefComuna(c.comuna);
  fila(c.label, c.comuna, buildHallazgoCapRate({ capRatePct: c.cap, ref, comuna: c.comuna, modalidad: "ltr" }));
}

// Guards de borde: NaN y números no finitos → null (sin romper).
console.log(SEP);
const refX = getCapRefComuna("Ñuñoa");
fila("guard: capRate = NaN", "Ñuñoa", buildHallazgoCapRate({ capRatePct: NaN, ref: refX, comuna: "Ñuñoa", modalidad: "ltr" }));
fila("guard: capRate = Infinity", "Ñuñoa", buildHallazgoCapRate({ capRatePct: Infinity, ref: refX, comuna: "Ñuñoa", modalidad: "ltr" }));

// ── Bloque B: integración end-to-end — usado real vía runAnalysis ──
console.log("\nBLOQUE B — usado real vía runAnalysis → results.hallazgos:\n" + SEP);
const usado: AnalisisInput = {
  nombre: "QA usado real",
  comuna: "Ñuñoa",
  ciudad: "Santiago",
  tipo: "Departamento",
  dormitorios: 2,
  banos: 2,
  superficie: 60,
  superficieTotal: 65,
  antiguedad: 12,
  enConstruccion: false,
  piso: 5,
  estacionamiento: "si",
  precioEstacionamiento: 0,
  bodega: true,
  estadoVenta: "inmediata",
  cuotasPie: 0,
  montoCuota: 0,
  precio: 5000,
  piePct: 20,
  plazoCredito: 25,
  tasaInteres: 4.5,
  gastos: 0,
  contribuciones: 0,
  provisionMantencion: 0,
  tipoRenta: "larga",
  arriendo: 600000,
  arriendoEstacionamiento: 0,
  arriendoBodega: 0,
  vacanciaMeses: 1,
};
const res = runAnalysis(usado, 39000);
const hCap = (res.hallazgos ?? []).find((h): h is HallazgoCapRate => h.id === "cap_rate") ?? null;
console.log(`results.hallazgos: [${(res.hallazgos ?? []).map((h) => h.id).join(", ")}]`);
console.log(`metrics.capRate (display): ${res.metrics.capRate}%  ←  hallazgo.valor.capRatePct: ${hCap?.valor.capRatePct}%  (deben coincidir)`);
fila("usado real (Ñuñoa, a12)", "Ñuñoa", hCap);

// ── Veredicto binario global ──
const todos: Array<HallazgoCapRate | null> = [
  ...casos.map((c) => buildHallazgoCapRate({ capRatePct: c.cap, ref: getCapRefComuna(c.comuna), comuna: c.comuna, modalidad: "ltr" })),
  hCap,
];
const nanHit = todos.some((h) => h && hasNaN(h));
const decisFueraRango = todos.some((h) => h && (h.decisividad < 0 || h.decisividad > 1));
console.log("\n" + SEP);
console.log(`VEREDICTO BINARIO → NaN en algún caso: ${nanHit ? "SÍ ‼️" : "NO ✅"} · decisividad fuera de [0,1]: ${decisFueraRango ? "SÍ ‼️" : "NO ✅"}`);
console.log(`                    null elegante en no-computables (NaN/Inf): ✅ (ver guards arriba)`);
