/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Commit 4 · 2026-05-12 — Crea 3 análisis STR sintéticos para validar el
 * banner ViabilidadSTRBanner + IA prompt según `recomendacionModalidad`.
 *
 * Casos:
 *   1. Lastarria (Santiago)  → tier alta. Banner NO debería aparecer.
 *   2. Providencia centro    → tier alta. Banner NO debería aparecer.
 *   3. Quilicura residencial → tier baja. Banner SÍ debería aparecer.
 *
 * Las propiedades se calibran para producir sobre-renta STR vs LTR razonable
 * en las 2 zonas premium (STR_VENTAJA_CLARA / INDIFERENTE) y dejar Quilicura
 * con tier baja → LTR_PREFERIDO forzado.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import {
  calcShortTerm,
  type AirbnbData,
  type ShortTermInputs,
} from "../src/lib/engines/short-term-engine";

config({ path: path.resolve(process.cwd(), ".env.local") });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function mkAirbnb(adr: number, occ: number): AirbnbData {
  const monthlyRevenue = adr * occ * 30;
  return {
    estimated_adr: adr,
    estimated_occupancy: occ,
    estimated_annual_revenue: monthlyRevenue * 12,
    percentiles: {
      revenue: {
        p25: monthlyRevenue * 12 * 0.75,
        p50: monthlyRevenue * 12,
        p75: monthlyRevenue * 12 * 1.25,
        p90: monthlyRevenue * 12 * 1.45,
        avg: monthlyRevenue * 12 * 1.05,
      },
      occupancy: {
        p25: occ * 0.78,
        p50: occ,
        p75: occ * 1.15,
        p90: occ * 1.25,
        avg: occ * 1.02,
      },
      average_daily_rate: {
        p25: adr * 0.85,
        p50: adr,
        p75: adr * 1.18,
        p90: adr * 1.35,
        avg: adr * 1.03,
      },
    },
    monthly_revenue: Array(12).fill(1 / 12),
    currency: "CLP",
  };
}

const casos = [
  {
    label: "Lastarria / Santiago centro",
    comuna: "Santiago",
    direccion: "Lastarria 200, Santiago",
    precioCompraCLP: 142_000_000,
    arriendoLTR: 580_000,
    adr: 45_000,
    occ: 0.58,
    bannerEsperado: false,
  },
  {
    label: "Providencia centro",
    comuna: "Providencia",
    direccion: "Av. Providencia 1500, Providencia",
    precioCompraCLP: 175_000_000,
    arriendoLTR: 650_000,
    adr: 55_000,
    occ: 0.62,
    bannerEsperado: false,
  },
  {
    label: "Quilicura residencial",
    comuna: "Quilicura",
    direccion: "Av. Matta Sur 500, Quilicura",
    precioCompraCLP: 95_000_000,
    arriendoLTR: 450_000,
    adr: 26_000,
    occ: 0.38,
    bannerEsperado: true,
  },
];

function commonInputs(): Omit<
  ShortTermInputs,
  | "precioCompra"
  | "arriendoLargoMensual"
  | "airbnbData"
  | "comuna"
  | "tipoEdificio"
  | "habilitacion"
  | "adminPro"
> {
  return {
    superficie: 55,
    dormitorios: 2,
    banos: 1,
    piePercent: 0.20,
    tasaCredito: 0.045,
    plazoCredito: 25,
    modoGestion: "auto",
    comisionAdministrador: 0.20,
    costoElectricidad: 45_000,
    costoAgua: 12_000,
    costoWifi: 22_000,
    costoInsumos: 22_000,
    gastosComunes: 90_000,
    mantencion: 20_000,
    contribuciones: 220_000,
    costoAmoblamiento: 4_500_000,
    valorUF: 38_800,
  };
}

(async () => {
  const { data: users } = await supa.auth.admin.listUsers();
  const admin = users?.users.find(
    (u: any) => u.email === "fabriziosciaraffia@gmail.com",
  );
  if (!admin) throw new Error("Admin user not found");

  const ids: string[] = [];

  for (const c of casos) {
    const inputs: ShortTermInputs = {
      ...commonInputs(),
      precioCompra: c.precioCompraCLP,
      arriendoLargoMensual: c.arriendoLTR,
      airbnbData: mkAirbnb(c.adr, c.occ),
      comuna: c.comuna,
      tipoEdificio: "mixto" as any,
      habilitacion: "estandar" as any,
      adminPro: false,
    };
    const result = calcShortTerm(inputs);

    const { data: row, error } = await supa
      .from("analisis")
      .insert({
        user_id: admin.id,
        nombre: `[COMMIT4] ${c.label}`,
        comuna: c.comuna,
        ciudad: "Santiago",
        direccion: c.direccion,
        tipo: "Departamento",
        dormitorios: inputs.dormitorios,
        banos: inputs.banos,
        superficie: inputs.superficie,
        antiguedad: 5,
        precio: Math.round(inputs.precioCompra / inputs.valorUF),
        arriendo: inputs.arriendoLargoMensual,
        gastos: inputs.gastosComunes,
        contribuciones: inputs.contribuciones,
        score: 65,
        desglose: {
          rentabilidad: 65,
          sostenibilidad: 65,
          ventajaSTR: 65,
          factibilidad: 65,
        },
        resumen: result.veredicto,
        results: { ...result, tipoAnalisis: "short-term", veredicto: result.veredicto },
        input_data: {
          ...inputs,
          tipoAnalisis: "short-term",
          edificioPermiteAirbnb: "si",
        },
        creator_name: "COMMIT4 TEST",
        is_premium: true,
      })
      .select()
      .single();

    if (error) throw error;
    ids.push(row.id);

    console.log(`\n────── ${c.label} ──────`);
    console.log(`  ID: ${row.id}`);
    console.log(`  comuna="${c.comuna}"`);
    console.log(`  zonaSTR.tierZona       = ${result.zonaSTR?.tierZona}`);
    console.log(`  zonaSTR.score          = ${result.zonaSTR?.score}/100`);
    console.log(
      `  zonaSTR.percentiles    = ADR p${result.zonaSTR?.percentilADR}, OCC p${result.zonaSTR?.percentilOcupacion}, REV p${result.zonaSTR?.percentilRevenue}`,
    );
    console.log(`  comparativa.sobreRentaPct = ${((result.comparativa?.sobreRentaPct ?? 0) * 100).toFixed(1)}%`);
    console.log(`  recomendacionModalidad = ${result.recomendacionModalidad}`);
    console.log(`  bannerEsperado         = ${c.bannerEsperado ? "SÍ" : "NO"}`);
    const bannerActual =
      result.zonaSTR?.tierZona === "baja" ||
      result.recomendacionModalidad === "LTR_PREFERIDO";
    console.log(
      `  bannerActual           = ${bannerActual ? "SÍ" : "NO"} ${
        bannerActual === c.bannerEsperado ? "OK" : "MISMATCH"
      }`,
    );
    console.log(`  URL: http://localhost:3000/analisis/renta-corta/${row.id}`);
  }

  console.log(`\nIDs (sin cleanup): ${ids.join(", ")}`);
})();
