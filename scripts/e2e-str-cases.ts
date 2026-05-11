/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * E2E STR — caso Andes vs caso baseline.
 *
 * Inserta 2 análisis sintéticos via service role (sin pasar por el endpoint
 * para evitar deps de auth y de AirROI), corre el motor real, y luego cURL
 * las páginas de resultados para verificar que `EjesAplicadosSTR` renderiza
 * con los valores correctos.
 *
 * Cero AirROI calls.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { calcShortTerm, type AirbnbData, type ShortTermInputs } from "../src/lib/engines/short-term-engine";

config({ path: path.resolve(process.cwd(), ".env.local") });

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// AirbnbData estable para los 2 casos (sin AirROI live)
const mockAirbnb: AirbnbData = {
  estimated_adr: 50000,
  estimated_occupancy: 0.45,
  estimated_annual_revenue: 8200000,
  percentiles: {
    revenue: { p25: 6000000, p50: 8200000, p75: 10500000, p90: 13000000, avg: 9000000 },
    occupancy: { p25: 0.35, p50: 0.45, p75: 0.55, p90: 0.65, avg: 0.48 },
    average_daily_rate: { p25: 42000, p50: 50000, p75: 60000, p90: 72000, avg: 53000 },
  },
  monthly_revenue: Array(12).fill(1 / 12),
  currency: "CLP",
};

function commonInputs(): Omit<ShortTermInputs, "tipoEdificio" | "habilitacion" | "adminPro" | "adrOverride" | "occOverride"> {
  return {
    precioCompra: 150_000_000,
    superficie: 60,
    dormitorios: 2,
    banos: 1,
    piePercent: 0.20,
    tasaCredito: 0.045,
    plazoCredito: 25,
    airbnbData: mockAirbnb,
    modoGestion: "auto",
    comisionAdministrador: 0.20,
    costoElectricidad: 55000,
    costoAgua: 12000,
    costoWifi: 22000,
    costoInsumos: 22000,
    gastosComunes: 80000,
    mantencion: 20000,
    contribuciones: 240000,
    costoAmoblamiento: 5000000,
    arriendoLargoMensual: 600000,
    valorUF: 38800,
  };
}

async function runCase(
  label: string,
  comuna: string,
  ejes: {
    tipoEdificio: any;
    habilitacion: any;
    adminPro: boolean;
    adrOverride?: number | null;
    occOverride?: number | null;
  },
) {
  const inputs: ShortTermInputs = { ...commonInputs(), ...ejes };
  const result = calcShortTerm(inputs);

  // Buscar admin user_id (fabriziosciaraffia@gmail.com)
  const { data: users } = await supa.auth.admin.listUsers();
  const admin = users?.users.find((u: any) => u.email === "fabriziosciaraffia@gmail.com");
  if (!admin) throw new Error("Admin user not found");

  const { data: row, error } = await supa
    .from("analisis")
    .insert({
      user_id: admin.id,
      nombre: `[E2E TEST] ${label}`,
      comuna,
      ciudad: "Santiago",
      direccion: "TEST — borrar después",
      tipo: "Departamento",
      dormitorios: inputs.dormitorios,
      banos: inputs.banos,
      superficie: inputs.superficie,
      antiguedad: 5,
      precio: Math.round(inputs.precioCompra / inputs.valorUF),
      arriendo: inputs.arriendoLargoMensual,
      gastos: inputs.gastosComunes,
      contribuciones: inputs.contribuciones,
      score: 70,
      desglose: { rentabilidad: 70, sostenibilidad: 70, ventajaSTR: 70, factibilidad: 70 },
      resumen: result.veredicto,
      results: { ...result, tipoAnalisis: "short-term", veredicto: result.veredicto },
      input_data: { ...inputs, tipoAnalisis: "short-term" },
      creator_name: "E2E TEST",
      is_premium: true,
    })
    .select()
    .single();

  if (error) throw error;

  const ea = result.ejesAplicados!;
  const hayOverride = ea.adrOverride !== null || ea.occOverride !== null;

  console.log(`\n────── Case: ${label} ──────`);
  console.log(`  ID: ${row.id}`);
  console.log(`  Ejes aplicados:`);
  console.log(`    factor ADR total      = ${ea.factorADRTotal.toFixed(2)}`);
  console.log(`    banda                 = ${ea.banda}`);
  console.log(`    occ estabilizada (m7+)= ${ea.ocupacionTarget}`);
  console.log(`    ADR ajustado (derivado) = ${ea.adrAjustado.toLocaleString("es-CL")}`);
  if (hayOverride) {
    console.log(`  ★ Override manual activo:`);
    if (ea.adrOverride !== null) console.log(`    adrOverride           = ${ea.adrOverride.toLocaleString("es-CL")} (vs derivado ${ea.adrAjustado.toLocaleString("es-CL")})`);
    if (ea.occOverride !== null) console.log(`    occOverride           = ${(ea.occOverride * 100).toFixed(0)}% (vs derivado ${(ea.ocupacionTarget * 100).toFixed(0)}%)`);
    console.log(`    adrFinal              = ${ea.adrFinal.toLocaleString("es-CL")}`);
    console.log(`    ocupacionFinal        = ${(ea.ocupacionFinal * 100).toFixed(0)}%`);
  }
  console.log(`  Base scenario:`);
  console.log(`    Revenue/año     = ${result.escenarios.base.revenueAnual.toLocaleString("es-CL")}`);
  console.log(`    NOI mensual     = ${result.escenarios.base.noiMensual.toLocaleString("es-CL")}`);
  console.log(`    Pérdida ramp-up = ${result.perdidaRampUp.toLocaleString("es-CL")} (5 meses parciales)`);
  console.log(`    Veredicto       = ${result.veredicto}`);

  // cURL la página. React SSR inserta <!-- --> entre text-nodes adyacentes,
  // strip antes de buscar.
  const url = `http://localhost:3000/analisis/renta-corta/${row.id}`;
  const res = await fetch(url);
  const rawHtml = await res.text();
  const html = rawHtml.replace(/<!-- -->/g, "");
  console.log(`  HTTP ${res.status} (${rawHtml.length} bytes raw, ${html.length} bytes stripped)`);

  const adrFinalFmt = ea.adrFinal.toLocaleString("es-CL");
  const occFinalPct = (ea.ocupacionFinal * 100).toFixed(0);

  const checks: Array<[string, boolean]> = [
    ["¿Cómo llegamos a este número?", html.includes("¿Cómo llegamos a este número")],
    ["Edificio:", html.includes("Edificio:")],
    ["Habilitación:", html.includes("Habilitación:")],
    ["Gestión:", html.includes("Gestión:")],
    ["Revenue mensual estimado", html.includes("Revenue mensual estimado")],
    [`ADR final "${adrFinalFmt}" en HTML`, html.includes(adrFinalFmt)],
    [`Occ final ${occFinalPct}% en HTML`, html.includes(`${occFinalPct}%`)],
  ];
  if (hayOverride) {
    checks.push([`Badge "Ajustado manualmente" visible`, html.includes("Ajustado manualmente")]);
  }
  console.log(`  Checks HTML:`);
  for (const [name, ok] of checks) {
    console.log(`    ${ok ? "✓" : "✗"} ${name}`);
  }

  return { id: row.id, allOk: checks.every(([, ok]) => ok) };
}

async function cleanup(ids: string[]) {
  console.log(`\nCleanup: borrando ${ids.length} análisis sintéticos.`);
  await supa.from("analisis").delete().in("id", ids);
}

(async () => {
  const ids: string[] = [];
  try {
    const andes = await runCase("Andes (dedicado + adminPro + premium)", "Providencia", {
      tipoEdificio: "dedicado",
      habilitacion: "premium",
      adminPro: true,
    });
    ids.push(andes.id);

    const baseline = await runCase("Baseline (residencial + auto + básico)", "Providencia", {
      tipoEdificio: "residencial_puro",
      habilitacion: "basico",
      adminPro: false,
    });
    ids.push(baseline.id);

    // Iter 2026-05-10: casos override.
    // ADR override: forzar ADR=80000 sobre baseline (que daría 50000 derivado).
    // El motor debe usar 80000 en lugar del derivado y reportarlo en ejesAplicados.adrFinal.
    const adrOver = await runCase("Override ADR manual (residencial → ADR=80000)", "Providencia", {
      tipoEdificio: "residencial_puro",
      habilitacion: "basico",
      adminPro: false,
      adrOverride: 80000,
    });
    ids.push(adrOver.id);

    // Occ override: forzar occ=0.80 sobre baseline (que daría 0.55 derivado).
    const occOver = await runCase("Override Occ manual (residencial → Occ=80%)", "Providencia", {
      tipoEdificio: "residencial_puro",
      habilitacion: "basico",
      adminPro: false,
      occOverride: 0.80,
    });
    ids.push(occOver.id);

    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`Andes        : ${andes.allOk ? "✓ OK" : "✗ FAIL"}`);
    console.log(`Baseline     : ${baseline.allOk ? "✓ OK" : "✗ FAIL"}`);
    console.log(`Override ADR : ${adrOver.allOk ? "✓ OK" : "✗ FAIL"}`);
    console.log(`Override Occ : ${occOver.allOk ? "✓ OK" : "✗ FAIL"}`);
    console.log("══════════════════════════════════════════════════════════════");
  } finally {
    // SKIP cleanup para inspección manual del HTML.
    if (process.argv.includes("--cleanup") && ids.length > 0) await cleanup(ids);
    else console.log(`\nIDs (sin cleanup): ${ids.join(", ")}`);
  }
})();
