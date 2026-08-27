// Job del estimado de plusvalía (F2) → tabla plusvalia_estimado.
//
//   node --env-file=.env.local --import tsx scripts/data/calcular-plusvalia-estimado.ts
//   (agregar --dry para ver el cálculo sin escribir)
//
// Escribe SOLO anio=2025 (decisión 26-ago-2026: 2026 no se publica por comuna
// hasta tener al menos un trimestre observado por comuna de ese año).
//
// Método aprobado:
//   est2025(comuna) = GFK_Q1_2025(comuna) × (promedio de los 4 trimestres
//   INCOIN 2025 de la comuna / INCOIN 2025-Q1 de la comuna)
// El deflactor es RELATIVO e intra-fuente: nunca se mezclan niveles entre
// fuentes (no empalmables). El factor promedio-anual/Q1 sale medido de la
// propia serie trimestral, sin supuesto de forma.
//
// Banda: ± max(|Δincoin Q1→Q4 de la comuna − ΔGS GfK Q1→Q4|, 2 pp) sobre el
// estimado. Guardas que DEGRADAN a sin-estimado (no se escribe fila):
//   · |Δincoin Q1→Q4| > 8%  (delta implausible, típicamente mix de zona)
//   · estimado fuera de ±10% del anual GFK 2024 de la comuna
// Cero relleno con promedio GS.
//
// Versionado: si ya existe una versión vigente con el MISMO valor, no escribe.
// Si el valor cambia (fuente nueva/corrección), inserta version+1 vigente y
// apaga la anterior — nunca UPDATE de cifras.

import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const ANIO = 2025;
const VIGENTE_DESDE = "2026-08-26"; // fecha de la decisión de método (determinístico, no Date.now)
const GS = "PROMEDIO GS";
const PISO_BANDA_PP = 2;      // piso de la banda, en puntos porcentuales
const MAX_DELTA_PCT = 8;      // guarda: |Δincoin Q1→Q4| sobre esto degrada
const MAX_DESVIO_2024_PCT = 10; // guarda: estimado vs anual GFK 2024

// ─────────────────────────────────────────────────────────────────────────────
// LAS DOS GUARDAS RECHAZAN POR MOTIVOS DISTINTOS — no las confundas.
//
// MAX_DELTA_PCT mira el TERMÓMETRO: un delta intra-año implausible viene de una
// zona INCOIN que mezcla casas y departamentos. Ese es el caso de Peñalolén
// (Δ +18% en zona oriente) y ahí sí tiene sentido preguntarse por otro
// deflactor.
//
// MAX_DESVIO_2024_PCT mira el ANCLA, y ahí un termómetro nuevo NO ARREGLA NADA:
// si el 1T-2025 de GfK ya llega descuadrado contra el anual 2024 de la propia
// GfK, cualquier factor cercano a 1 deja el resultado fuera de rango. Medido el
// 27-ago-2026, el salto 2024 → 1T-2025 DENTRO de GfK (misma fuente, misma
// canasta) para las tres que rechazan por esta guarda:
//     Pudahuel       64,9 → 76,9   +18,5%
//     Padre Hurtado  51,3 → 45,4   −11,5%
//     Quilicura      57,9 → 51,8   −10,5%
// contra una mediana de 0% (rango −8,4% a +6,1%) en las otras 24 comunas. Eso
// es cambio de canasta de GfK —entró o salió obra nueva de otro segmento—, no
// ruido de INCOIN.
//
// CONCLUSIÓN OPERATIVA (evaluación cerrada el 27-ago-2026, decisión de
// Fabrizio): NO buscar más termómetros para estas tres. Se evaluaron la base
// propia (imposible: scraped_properties no tiene filas anteriores a 2026), el
// promedio GS de GfK y los deltas de otras zonas INCOIN; las tres siguen
// reprobando con todos, porque el problema no es el que se estaba buscando.
// Se quedan con su último dato observado (2024) hasta que GfK publique más
// trimestres por comuna. Peñalolén y Maipú sí pasarían con un deflactor
// genérico, pero se descartó rescatarlas: su cierre sería un solo trimestre
// propio más un ajuste del agregado, de naturaleza distinta al de las otras 25
// bajo el mismo rótulo de página.
// ─────────────────────────────────────────────────────────────────────────────

function metodoTexto(zonaIncoin: string): string {
  return (
    `Cierre ${ANIO} estimado, compuesto de datos observados del propio año: ` +
    `ancla de nivel GfK/NielsenIQ 1T-${ANIO} (precio de oferta, deptos nuevos) ` +
    `ajustada por la trayectoria intra-año de INCOIN (Tinsa) — factor = promedio ` +
    `de los 4 trimestres ${ANIO} de la comuna dividido por su 1T, medido sobre la ` +
    `misma fuente (nunca se mezclan niveles entre fuentes). Banda: ± el mayor ` +
    `entre la divergencia con la trayectoria GfK del Gran Santiago y ${PISO_BANDA_PP} puntos ` +
    `porcentuales. Guardas: se descarta el estimado si el delta intra-año supera ` +
    `${MAX_DELTA_PCT}% o si el resultado se aleja más de ${MAX_DESVIO_2024_PCT}% del anual GfK 2024. ` +
    (zonaIncoin === "centro"
      ? `La zona INCOIN de esta comuna (centro) es 100% departamentos. `
      : `La zona INCOIN de esta comuna (${zonaIncoin}) mezcla casas y departamentos; el factor se usa igual porque es relativo, pero se declara. `) +
    `Los precios de lista de deptos nuevos ${ANIO}-2026 pueden estar afectados por cambios ` +
    `tributarios (beneficios/IVA a la vivienda); el estimado refleja precios publicados, sin ajuste por ese efecto. ` +
    `Es un estimado de año terminado, no una proyección.`
  );
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: raw, error } = await supabase
    .from("plusvalia_fuentes_raw")
    .select("fuente, comuna, periodo, uf_m2, zona_incoin")
    .or(`periodo.eq.${ANIO}-Q1,periodo.eq.${ANIO}-Q2,periodo.eq.${ANIO}-Q3,periodo.eq.${ANIO}-Q4,periodo.eq.2024`);
  if (error || !raw) throw new Error(`Lectura de la cruda falló: ${error?.message}`);

  const gfkQ1 = new Map<string, number>();
  const gfk2024 = new Map<string, number>();
  const incoin = new Map<string, { zona: string; tri: Map<string, number> }>();
  for (const r of raw) {
    const uf = Number(r.uf_m2);
    if (r.fuente === "gfk" && r.periodo === `${ANIO}-Q1`) gfkQ1.set(r.comuna, uf);
    if (r.fuente === "gfk" && r.periodo === "2024") gfk2024.set(r.comuna, uf);
    if (r.fuente === "incoin") {
      if (!incoin.has(r.comuna)) incoin.set(r.comuna, { zona: r.zona_incoin ?? "", tri: new Map() });
      incoin.get(r.comuna)!.tri.set(r.periodo, uf);
    }
  }

  // ΔGS GfK Q1→Q4 (para la banda). Si falta un extremo, la divergencia no se
  // puede medir y manda el piso de 2 pp.
  const { data: gsRows } = await supabase
    .from("plusvalia_fuentes_raw")
    .select("periodo, uf_m2")
    .eq("fuente", "gfk").eq("comuna", GS).in("periodo", [`${ANIO}-Q1`, `${ANIO}-Q4`]);
  const gsQ1 = gsRows?.find((r) => r.periodo === `${ANIO}-Q1`)?.uf_m2;
  const gsQ4 = gsRows?.find((r) => r.periodo === `${ANIO}-Q4`)?.uf_m2;
  const deltaGsPct = gsQ1 && gsQ4 ? (Number(gsQ4) / Number(gsQ1) - 1) * 100 : null;

  type Fila = { comuna: string; uf_m2: number; banda_min: number; banda_max: number; fuentes: string[]; metodo: string };
  const filas: Fila[] = [];
  const degradadas: string[] = [];

  for (const [comuna, ancla] of [...gfkQ1.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    if (comuna === GS) continue; // el sentinel no entra al estimado por comuna
    const inc = incoin.get(comuna);
    const q = ["Q1", "Q2", "Q3", "Q4"].map((t) => inc?.tri.get(`${ANIO}-${t}`));
    if (!inc || q.some((v) => v == null)) { degradadas.push(`${comuna}: sin serie INCOIN completa`); continue; }
    const [q1, q2, q3, q4] = q as number[];
    const deltaPct = (q4 / q1 - 1) * 100;
    if (Math.abs(deltaPct) > MAX_DELTA_PCT) {
      degradadas.push(
        `${comuna}: TERMÓMETRO — Δincoin intra-año ${deltaPct.toFixed(1)}% supera ${MAX_DELTA_PCT}%` +
          (inc.zona && inc.zona !== "centro" ? ` (zona ${inc.zona}: mezcla casas y deptos)` : ""),
      );
      continue;
    }
    const factor = (q1 + q2 + q3 + q4) / 4 / q1; // promedio anual / Q1, medido
    const est = ancla * factor;
    const base2024 = gfk2024.get(comuna);
    if (base2024 != null && Math.abs(est / base2024 - 1) * 100 > MAX_DESVIO_2024_PCT) {
      // El motivo del rechazo se nombra según DÓNDE está el descuadre, porque
      // determina si vale la pena buscar otro termómetro o no. Si el ancla
      // (1T-2025 de GfK) ya no cuadra con el anual 2024 de la PROPIA GfK, el
      // deflactor es inocente: multiplica un valor que ya salió de rango, y
      // ningún factor cercano a 1 lo devuelve adentro. Verificado el
      // 27-ago-2026 sobre Pudahuel, Padre Hurtado y Quilicura. Maipú cae del
      // otro lado por poco —ancla a −9,97%, dentro de la guarda por 0,03
      // puntos— y por eso se reporta como DEFLACTOR: ahí el termómetro sí es
      // el que empuja el resultado afuera.
      const saltoAncla = (ancla / base2024 - 1) * 100;
      degradadas.push(
        Math.abs(saltoAncla) > MAX_DESVIO_2024_PCT
          ? `${comuna}: ANCLA — el 1T-${ANIO} de GfK (${ancla}) ya está ${saltoAncla > 0 ? "+" : ""}${saltoAncla.toFixed(1)}% respecto del anual 2024 de la propia GfK (${base2024}); ningún deflactor lo corrige (cambio de canasta, no ruido del termómetro)`
          : `${comuna}: DEFLACTOR — el estimado ${est.toFixed(1)} se aleja ${((est / base2024 - 1) * 100).toFixed(1)}% del 2024 (${base2024}) pese a que el ancla (${ancla}) sí cuadra`,
      );
      continue;
    }
    const bandaPct = Math.max(deltaGsPct != null ? Math.abs(deltaPct - deltaGsPct) : 0, PISO_BANDA_PP);
    filas.push({
      comuna,
      uf_m2: Math.round(est * 10) / 10,
      banda_min: Math.round(est * (1 - bandaPct / 100) * 10) / 10,
      banda_max: Math.round(est * (1 + bandaPct / 100) * 10) / 10,
      fuentes: ["gfk", "incoin"],
      metodo: metodoTexto(inc.zona),
    });
  }

  console.log(`Estimado ${ANIO}: ${filas.length} comunas · ${degradadas.length} degradadas`);
  for (const d of degradadas) console.log("  DEGRADA " + d);
  for (const f of filas) console.log(`  ${f.comuna.padEnd(20)} UF ${f.uf_m2}/m² [${f.banda_min} – ${f.banda_max}]`);
  if (DRY) { console.log("(dry-run: no se escribió nada)"); return; }

  // Escritura versionada: comparar contra la vigente; solo escribir lo que cambió.
  const { data: vigentes, error: eV } = await supabase
    .from("plusvalia_estimado")
    .select("comuna, uf_m2, banda_min, banda_max, version")
    .eq("anio", ANIO).eq("vigente", true);
  if (eV) throw new Error(`Lectura de vigentes falló: ${eV.message}`);
  const vigentePor = new Map((vigentes ?? []).map((v) => [v.comuna, v]));

  let escritas = 0, iguales = 0;
  for (const f of filas) {
    const v = vigentePor.get(f.comuna);
    if (v && Number(v.uf_m2) === f.uf_m2 && Number(v.banda_min) === f.banda_min && Number(v.banda_max) === f.banda_max) { iguales++; continue; }
    const nuevaVersion = (v?.version ?? 0) + 1;
    if (v) {
      const { error: eOff } = await supabase
        .from("plusvalia_estimado")
        .update({ vigente: false })
        .eq("comuna", f.comuna).eq("anio", ANIO).eq("vigente", true);
      if (eOff) throw new Error(`Apagar vigente de ${f.comuna} falló: ${eOff.message}`);
    }
    const { error: eIns } = await supabase.from("plusvalia_estimado").insert({
      comuna: f.comuna, anio: ANIO, uf_m2: f.uf_m2, banda_min: f.banda_min, banda_max: f.banda_max,
      fuentes: f.fuentes, metodo: f.metodo, version: nuevaVersion, vigente_desde: VIGENTE_DESDE, vigente: true,
    });
    if (eIns) throw new Error(`Insert de ${f.comuna} falló: ${eIns.message}`);
    escritas++;
  }
  console.log(`OK: ${escritas} filas escritas · ${iguales} sin cambio (misma cifra vigente)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
