// of-ambas-calib-generate — FASE 3. Genera la banda media IN-MEMORY (cero writes, cero AirROI,
// sin prosa) y ensambla el entregable of-ambas-calibracion.md (reales + sintéticos).
// Método (a) aprobado: propiedades reales de ventaja moderada, barrido modoGestion × ocupación,
// reusando airbnbRaw persistido. Uso: node --env-file=.env.local --import tsx scripts/of-ambas-calib-generate.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { calcShortTerm } from "../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../src/lib/engines/short-term-score";
import { buildAirbnbData } from "../src/lib/api-helpers/analisis-pipeline";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function buildInputs(d: any, air: any, uf: number, over: Partial<any> = {}) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: d.comuna, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100, plazoCredito: d.plazoCredito,
    airbnbData: air, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador, tipoEdificio: d.tipoEdificio,
    habilitacion: d.habilitacion, adminPro: d.adminPro === true, adrOverride: null, occOverride: null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf, ...over,
  };
}

function veredictoComparativo(sobrePct: number, tier: string | undefined): string {
  if (tier === "baja") return "LTR_PREFERIDO";
  if (sobrePct < 0.05) return "LTR_PREFERIDO";
  if (sobrePct >= 0.15) return "STR_VENTAJA_CLARA";
  return "INDIFERENTE";
}
const near = (x: number, cut: number) => Math.abs(x - cut) <= 0.02;
const short = (label: string) => label.replace("LTR_PREFERIDO", "·LTR").replace("STR_VENTAJA_CLARA", "·STR").replace("INDIFERENTE", "·INDIF");

async function main() {
  // Propiedades reales de ventaja MODERADA (sweep gentil hacia la banda). Distintas direcciones/AirROI.
  const seleccion = ["2e2c9e29", "8f4493ed", "cf3ae20f", "a3141ba5", "dd7b0a08", "1ab38470", "c925e85a", "89e68f96"];
  const { data } = await sb.from("analisis").select("id, comuna, direccion, input_data, results").eq("tipo_analisis", "short-term");
  const rows = (data as any[]).filter((r) => seleccion.some((p) => r.id.startsWith(p)));

  // Grilla: modo × ocupación. Rango operativo sensato (bandas del motor 0.45–0.74).
  const occGrid = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, null];
  const grid: any[] = [];
  for (const r of rows) {
    const d = r.input_data, uf = d.precioCompra / d.precioCompraUF, air = buildAirbnbData(r.results.airbnbRaw, uf);
    for (const modo of ["auto", "administrador"] as const) {
      for (const occ of occGrid) {
        const over: any = { modoGestion: modo, adminPro: modo === "administrador", comisionAdministrador: 0.20 };
        if (occ != null) over.occOverride = occ;
        let res: any; try { res = calcShortTerm(buildInputs(d, air, uf, over) as any); } catch { continue; }
        const sobre = res.comparativa?.sobreRentaPct;
        if (!Number.isFinite(sobre)) continue;
        const lat = typeof d.lat === "number" ? d.lat : -33.4378, lng = typeof d.lng === "number" ? d.lng : -70.6504;
        const score = calcFrancoScoreSTR({ results: res, precioCompra: d.precioCompra, dormitorios: d.dormitorios, superficie: d.superficieUtil,
          regulacionEdificio: d.edificioPermiteAirbnb || "no_seguro", lat, lng, revenueP50: air.percentiles?.revenue?.p50 ?? 0, monthlyRevenue: air.monthly_revenue ?? [] } as any);
        grid.push({ id: r.id.slice(0, 8), comuna: r.comuna, direccion: (r.direccion ?? "").slice(0, 26),
          modo: modo === "auto" ? "auto" : "admin", occ: occ ?? "real", sobre, tier: res.zonaSTR?.tierZona,
          reco: veredictoComparativo(sobre, res.zonaSTR?.tierZona), strVer: score.veredicto });
      }
    }
  }

  // Selección: poblar la banda media [5%,15%] y clavar los FILOS de 5% y 15%, más un par de
  // puntos de contexto justo bajo 5%. Targets emparejados a un modo preferido: admin alcanza la
  // parte baja (5–11%), auto la parte alta (11–17%). Un combo por (propiedad,modo).
  const targetsMode: Array<{ t: number; modo: string }> = [
    { t: -0.03, modo: "admin" }, { t: 0.02, modo: "admin" },
    { t: 0.05, modo: "admin" }, { t: 0.07, modo: "admin" },   // filo 5% + banda
    { t: 0.09, modo: "auto" },  { t: 0.11, modo: "admin" },   // centro banda
    { t: 0.12, modo: "auto" },  { t: 0.14, modo: "auto" },    // filo 15% (por abajo)
    { t: 0.15, modo: "auto" },  { t: 0.16, modo: "auto" },    // filo 15% (por arriba)
    { t: 0.18, modo: "auto" },
  ];
  const pool = grid.filter((g) => g.sobre >= -0.06 && g.sobre <= 0.20);
  const picks: any[] = [];
  const usedKey = new Set<string>(); // evita repetir misma propiedad+modo
  for (const { t, modo } of targetsMode) {
    let cand = pool.filter((g) => g.modo === modo && !usedKey.has(`${g.id}|${g.modo}`))
      .sort((a, b) => Math.abs(a.sobre - t) - Math.abs(b.sobre - t));
    if (!cand.length || Math.abs(cand[0].sobre - t) > 0.03) {
      // si el modo preferido no llega, permitir el otro modo
      cand = pool.filter((g) => !usedKey.has(`${g.id}|${g.modo}`)).sort((a, b) => Math.abs(a.sobre - t) - Math.abs(b.sobre - t));
    }
    if (cand.length && Math.abs(cand[0].sobre - t) <= 0.03) { const c = cand[0]; picks.push(c); usedKey.add(`${c.id}|${c.modo}`); }
  }
  picks.sort((a, b) => a.sobre - b.sobre);

  // ── Cargar los 23 reales del recompute previo ──
  const reales = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "scripts/output/of-ambas-calib-recompute.json"), "utf8"));

  // ── Ensamblar tabla combinada (reales + sintéticos), ordenada por sobreRentaPct ──
  type Fila = { origen: string; comuna: string; prop: string; modo: string; sobre: number | null; ltrVer: string; strVer: string; reco: string; filo: boolean };
  const filas: Fila[] = [];
  for (const o of reales) filas.push({ origen: "real", comuna: o.comuna, prop: o.direccion.slice(0, 26), modo: o.modoGestion === "administrador" ? "admin" + (o.adminPro ? "+pro" : "") : "auto",
    sobre: o.sobrePct != null ? o.sobrePct / 100 : null, ltrVer: o.ltrVer, strVer: o.strVer, reco: o.recoUmbral, filo: !!o.filo });
  for (const p of picks) filas.push({ origen: "SINTÉTICO", comuna: p.comuna, prop: p.direccion, modo: p.modo + (p.occ !== "real" ? ` occ${Math.round((p.occ as number) * 100)}` : ""),
    sobre: p.sobre, ltrVer: "—", strVer: p.strVer, reco: p.reco, filo: near(p.sobre, 0.05) || near(p.sobre, 0.15) });
  filas.sort((a, b) => (a.sobre ?? -9e9) - (b.sobre ?? -9e9));

  // distribución combinada
  const dist: Record<string, number> = { LTR_PREFERIDO: 0, INDIFERENTE: 0, STR_VENTAJA_CLARA: 0 };
  for (const f of filas) if (f.sobre != null) dist[f.reco]++;
  const distSint: Record<string, number> = { LTR_PREFERIDO: 0, INDIFERENTE: 0, STR_VENTAJA_CLARA: 0 };
  for (const p of picks) distSint[p.reco]++;

  // ── escribir md ──
  const L: string[] = [];
  L.push(`# AMBAS · calibración — ENTREGABLE (reales + banda media sintética) · ⛔#2\n`);
  L.push(`## DECISIONES RATIFICADAS (Fabrizio · 2026-07-15)\n`);
  L.push(`> Salieron de esta tabla. Registro untracked; su implementación (motor + pirámide) es rama aparte.\n`);
  L.push(`1. **Veredicto comparativo de DOBLE CONDICIÓN.** \`STR_VENTAJA_CLARA\` exige **sobreRenta ≥ 15% Y`);
  L.push(`   break-even ≤ 90% del mercado**. Break-even **90–110%** degrada a **INDIFERENTE con advertencia de`);
  L.push(`   fragilidad** (aunque el sobreRenta% supere 15%). Cierra el falso-positivo detectado acá: varios ·STR`);
  L.push(`   con +26–47% tenían break-even 100–131% (necesitaban facturar el mercado entero para empatar).`);
  L.push(`2. **Gestión como escenario.** El toggle auto↔admin es un escenario, no un input fijo; cuando **cambia el`);
  L.push(`   veredicto** (ej. Moneda +26,6% auto → -8,7% admin) eso es un **hallazgo diferencial** explícito.`);
  L.push(`3. **Break-even % del mercado entra a la pirámide diferencial.** Discrimina mejor que el sobreRenta% solo`);
  L.push(`   (76% robusto vs 131% frágil) → hallazgo tipado en el comparativo AMBAS.\n`);
  L.push(`---\n`);
  L.push(`> Untracked \`of-*\`. Rama **calibration-pairs-data**. **Cero writes a la DB** — los sintéticos se`);
  L.push(`> computan en memoria (reusando \`airbnbRaw\` + \`input_data\` reales, re-parametrizando modoGestion/`);
  L.push(`> ocupación) y se vuelcan acá. Motor nuevo post-Rama-0. Eje = \`sobreRentaPct\` (lo que maneja el`);
  L.push(`> umbral). Δ patrimonio Y10 **omitido** a pedido (contaminado por plusvalía/UF no homologadas — ver`);
  L.push(`> \`of-ambas-calibracion-fase1.md\` §4). Fecha: 2026-07-15.\n`);
  L.push(`## Distribución combinada por bandas (umbral <5% / 5–15% / ≥15%)\n`);
  L.push(`| Banda | Reales | Sintéticos | Total |`);
  L.push(`|---|---|---|---|`);
  L.push(`| **LTR_PREFERIDO** (\`<5%\`) | ${12} | ${distSint.LTR_PREFERIDO} | ${dist.LTR_PREFERIDO} |`);
  L.push(`| **INDIFERENTE** (\`5–15%\`) | ${2} | ${distSint.INDIFERENTE} | ${dist.INDIFERENTE} |`);
  L.push(`| **STR_VENTAJA_CLARA** (\`≥15%\`) | ${9} | ${distSint.STR_VENTAJA_CLARA} | ${dist.STR_VENTAJA_CLARA} |`);
  L.push(`\nSintéticos generados: **${picks.length}** (auto: ${picks.filter((p) => p.modo === "auto").length} · admin: ${picks.filter((p) => p.modo === "admin").length}). Cubren -10% → +15%, poblando la banda media antes vacía.\n`);
  L.push(`## Tabla — TODOS los pares (ordenada por sobre-renta STR vs LTR)\n`);
  L.push(`| Origen | Comuna | Propiedad | Modo gestión | Veredicto LTR | Veredicto STR | sobreRenta% | Comparativo (umbral) | ¿al filo? |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const f of filas) {
    L.push(`| ${f.origen} | ${f.comuna} | ${f.prop.replace(/\|/g, "/")} | ${f.modo} | ${f.ltrVer} | ${f.strVer} | ${f.sobre == null ? "—" : (f.sobre * 100).toFixed(1) + "%"} | **${short(f.reco)}** | ${f.filo ? "⚑ filo" : ""} |`);
  }
  L.push(`\n⚑ = a ±2 pp de un corte (5% o 15%). Antes de sembrar: **0** casos al filo. Ahora: **${filas.filter((f) => f.filo).length}**.\n`);
  L.push(`Los sintéticos usan \`occOverride\` para posicionar el punto (fixture de calibración, no outcome de`);
  L.push(`mercado) y el arriendo largo real de cada propiedad. \`modoGestion\` es la palanca principal.\n`);
  // Casos narrados (números fieles del motor — ver scripts/of-calib-poc.ts y recompute).
  L.push(`## Casos narrados (léelos como inversionista)\n`);
  L.push(`- **Santiago 2D 50 m² (Moneda), arriendo largo $425.000** — en auto la renta corta rinde **+26,6%** sobre`);
  L.push(`  el arriendo largo (·STR gana), pero pasar a **administración 20% lo voltea a -8,7%** (·LTR). El mismo depto`);
  L.push(`  cambia de veredicto según quién opere. Break-even STR **131% del mercado**: ventaja frágil pese al % positivo.`);
  L.push(`- **Providencia 1D 35 m² (Av. Providencia 1234), arriendo $560.000** — filo puro: **+20,4% en auto** (·STR) →`);
  L.push(`  **-7,0% en administración** (·LTR). Break-even **100% del mercado**. La decisión depende de si el dueño opera.`);
  L.push(`- **Las Condes 1D 40 m² (Cerro Colorado), arriendo $659.000** — zona fuerte: aun con **administración 20%**`);
  L.push(`  mantiene **+47%** (·STR), y en auto vuela a **+88%**. Break-even **76%**. El corto gana robusto: la zona aguanta.`);
  L.push(`- **Providencia 2D 55 m² (Av. Providencia 2500), arriendo largo $1.000.000** — el LTR ya es competitivo: STR`);
  L.push(`  pierde **-15,5%** aun en auto (·LTR), break-even **96%**. Cuando el LTR rinde bien, el corto no compensa.\n`);
  L.push(`## Qué destraba esta tabla (decisiones de Fabrizio)\n`);
  L.push(`1. **Umbral "gana claramente"** — resuelto con la doble condición (ver DECISIONES RATIFICADAS §1).`);
  L.push(`2. **Peso de la gestión** — el toggle auto↔admin mueve el veredicto en casi todo par moderado → \`modoGestion\``);
  L.push(`   es la variable más decisiva de AMBAS y justifica el desbloqueo con FrancoMensual incluido.`);
  L.push(`3. **Hallazgos diferenciales** — el break-even % del mercado (76% robusto vs 131% frágil) discrimina mejor`);
  L.push(`   que el sobreRenta% solo. Entra a la pirámide diferencial.\n`);
  L.push(`**Nota de motor (fuera de esta rama):** 3 degenerados con sobreRenta% ininterpretable (-3483%, +321%, +632%)`);
  L.push(`por NOI-LTR ≈0 o \`occOverride\` mal-etiquetado; el veredicto cae bien igual pero el número mostrado sería`);
  L.push(`basura → clamp de display. El Δ patrimonio Y10 no es comparable LTR/STR (plusvalía + UF no homologadas).`);
  L.push(`Ambos son fixes de motor → rama aparte (golden no se toca). Detalle en \`of-ambas-calibracion-fase1.md\`.\n`);

  fs.writeFileSync(path.resolve(process.cwd(), "of-ambas-calibracion.md"), L.join("\n"));
  fs.writeFileSync(path.resolve(process.cwd(), "scripts/output/of-ambas-calib-sinteticos.json"), JSON.stringify(picks, null, 2));
  console.log(`Sintéticos: ${picks.length} (auto ${picks.filter(p=>p.modo==="auto").length} / admin ${picks.filter(p=>p.modo==="admin").length})`);
  console.log(`Dist sintéticos:`, JSON.stringify(distSint));
  console.table(picks.map((p) => ({ id: p.id, comuna: p.comuna, modo: p.modo, occ: p.occ, sobre: +(p.sobre * 100).toFixed(1), reco: short(p.reco), strVer: p.strVer })));
  console.log(`\n→ of-ambas-calibracion.md`);
}
main().catch((e) => { console.error(e); process.exit(1); });
