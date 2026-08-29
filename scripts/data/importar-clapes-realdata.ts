// Importador del Índice Inmobiliario CLAPES UC – Real Data → plusvalia_indices_raw.
//
//   node --env-file=.env.local --import tsx scripts/data/importar-clapes-realdata.ts
//
// Requiere la migración supabase/migrations/20260829_plusvalia_indices_raw.sql
// aplicada. Determinístico e idempotente: batch_id = hash del contenido de los
// dos CSV, y el escritor es un upsert sobre la UNIQUE
// (fuente, ambito, tipologia, periodo). Correrlo dos veces deja la tabla idéntica.
//
// Sigue el patrón de importar-plusvalia-fuentes.ts: rechazos acumulados y salida
// sin escribir NADA si hay uno.
//
// Los CSV vienen convertidos desde los xlsx de la página de CLAPES: UTF-8 con
// BOM, CRLF, separador ';', valores ENTEROS sin separador decimal (verificado).
// El parser tolera coma decimal por si una reconversión futura la introduce.
//
// GUARDA DE VALIDACIÓN CRUZADA: el xlsx publica la serie REDONDEADA A ENTERO y
// llega solo hasta 2023q4, mientras el CSV de referencia (informe 2T2025) trae
// un decimal y llega a 2025q2. Por eso la guarda compara Math.round(referencia)
// contra el xlsx sobre los trimestres que sí se solapan, y exige que sean
// exactamente los 15 esperados: si el solapamiento cambia (archivo distinto,
// serie extendida), revienta en vez de validar menos de lo que cree.

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const DIR = __dirname;
const CSV_DEPTOS = join(DIR, "index_deptos_255_252b3ce5fc.csv");
const CSV_CASAS = join(DIR, "index_casas_255_2ffe46eae4.csv");
const CSV_REF = join(DIR, "ref-clapesuc-realdata.csv");

const BASE = "2007q1=100";
const METODOLOGIA =
  "Índice Inmobiliario CLAPES UC – Real Data: transacciones del CBR en UF (variación real) con modelos hedónicos; trimestral; casas y deptos separados; RM + 4 zonas";

// Columna del CSV → ámbito canónico de la tabla.
const AMBITO_POR_COLUMNA: Record<string, string> = {
  "Oriente": "Oriente",
  "Centro-Norte": "Centro-Norte",
  "Sur-Poniente": "Sur-Poniente",
  "Sur-Oriente": "Sur-Oriente",
  "Region Metropolitana": "RM",
};

type Fila = {
  fuente: string;
  ambito: string;
  tipologia: string;
  periodo: string;
  valor_indice: number;
  base: string;
  metodologia: string;
  nota: string | null;
  batch_id: string;
};

// Quita el BOM que dejó la conversión desde Excel y normaliza fin de línea.
function leer(path: string): string {
  return readFileSync(path, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

// '2007q1' → '2007-Q1'. Devuelve null si no calza — el rechazo lo reporta el caller.
function normalizarPeriodo(crudo: string): string | null {
  const m = crudo.trim().toLowerCase().match(/^(\d{4})q([1-4])$/);
  return m ? `${m[1]}-Q${m[2]}` : null;
}

// Acepta '214' y '213,9' (por si una reconversión desde Excel escribe coma
// decimal). Rechaza cualquier otra cosa en vez de dejar que Number() adivine.
function parseNumero(crudo: string): number | null {
  const t = crudo.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Serie = Map<string, Map<string, number>>; // periodo → ámbito → valor

function parsearIndice(
  path: string,
  tipologia: string,
  batchId: string,
  filas: Fila[],
  rechazos: string[],
): Serie {
  const etiqueta = `${tipologia}(${path.split(/[\\/]/).pop()})`;
  const lineas = leer(path).trim().split("\n");
  const header = lineas.shift();
  const cols = (header ?? "").split(";").map((c) => c.trim());
  if (cols[0] !== "Trimestre") {
    throw new Error(`${etiqueta}: header inesperado: ${header}`);
  }
  const desconocidas = cols.slice(1).filter((c) => !AMBITO_POR_COLUMNA[c]);
  if (desconocidas.length > 0) {
    throw new Error(`${etiqueta}: columnas de ámbito desconocidas: ${desconocidas.join(", ")}`);
  }
  const ambitos = cols.slice(1).map((c) => AMBITO_POR_COLUMNA[c]);

  const serie: Serie = new Map();
  for (const [i, linea] of lineas.entries()) {
    const nLinea = i + 2; // 1-based + header
    if (!linea.trim()) continue;
    const campos = linea.split(";").map((c) => c.trim());
    if (campos.length !== cols.length) {
      rechazos.push(
        `${etiqueta} L${nLinea}: ${campos.length} campos (esperados ${cols.length}): ${linea}`,
      );
      continue;
    }
    const periodo = normalizarPeriodo(campos[0]);
    if (!periodo) {
      rechazos.push(`${etiqueta} L${nLinea}: periodo no normaliza: '${campos[0]}'`);
      continue;
    }
    if (serie.has(periodo)) {
      throw new Error(`${etiqueta}: periodo duplicado en el archivo: ${periodo}`);
    }
    const porAmbito = new Map<string, number>();
    for (const [j, ambito] of ambitos.entries()) {
      const crudo = campos[j + 1];
      // Hueco en la serie: NO se inventa, se rechaza y se reporta.
      if (crudo === "") {
        rechazos.push(`${etiqueta} L${nLinea}: celda vacía en ámbito '${ambito}' (${periodo})`);
        continue;
      }
      const valor = parseNumero(crudo);
      if (valor === null) {
        rechazos.push(`${etiqueta} L${nLinea}: valor inválido en '${ambito}' (${periodo}): '${crudo}'`);
        continue;
      }
      porAmbito.set(ambito, valor);
      filas.push({
        fuente: "clapes_realdata",
        ambito,
        tipologia,
        periodo,
        valor_indice: valor,
        base: BASE,
        metodologia: METODOLOGIA,
        nota: null,
        batch_id: batchId,
      });
    }
    serie.set(periodo, porAmbito);
  }
  return serie;
}

// ── Guarda de validación cruzada ────────────────────────────────────────────
// Referencia: filas 'indice,RM deptos,<trimestre>,<valor>' del CSV del informe.
function referenciaRmDeptos(): Map<string, number> {
  const ref = new Map<string, number>();
  for (const [i, linea] of leer(CSV_REF).trim().split("\n").entries()) {
    const campos = linea.split(",");
    if (campos[0] !== "indice" || campos[1] !== "RM deptos") continue;
    const periodo = normalizarPeriodo(campos[2]);
    const valor = parseNumero(campos[3]);
    if (!periodo || valor === null) {
      throw new Error(`ref L${i + 1}: fila 'indice' no parsea: ${linea}`);
    }
    ref.set(periodo, valor);
  }
  if (ref.size === 0) throw new Error("ref: no se encontró ninguna fila 'indice,RM deptos'.");
  return ref;
}

// El xlsx publica enteros; el informe, un decimal. Se compara redondeando la
// referencia, sobre el solapamiento, y se exige que el solapamiento sea el
// esperado — si cambia, es que uno de los dos archivos ya no es el que se validó.
const SOLAPAMIENTO_ESPERADO = 15; // 2020-Q2 … 2023-Q4

function validarCruzado(serieDeptos: Serie) {
  const ref = referenciaRmDeptos();
  const solapan: string[] = [];
  const divergencias: string[] = [];
  for (const [periodo, esperadoRef] of [...ref.entries()].sort()) {
    const leido = serieDeptos.get(periodo)?.get("RM");
    if (leido === undefined) continue; // fuera de la serie del xlsx — se reporta abajo
    solapan.push(periodo);
    const esperado = Math.round(esperadoRef);
    if (leido !== esperado) {
      divergencias.push(
        `${periodo}: xlsx=${leido} · informe=${esperadoRef} (redondeado ${esperado}) · diferencia ${(leido - esperadoRef).toFixed(1)}`,
      );
    }
  }
  const fuera = [...ref.keys()].filter((p) => !solapan.includes(p)).sort();
  console.log(
    `Guarda cruzada RM-deptos: ${solapan.length}/${ref.size} trimestres de la referencia solapan con el xlsx` +
      (fuera.length ? ` · fuera de la serie del xlsx: ${fuera.join(", ")}` : ""),
  );
  if (divergencias.length > 0) {
    throw new Error(
      "GUARDA CRUZADA FALLÓ — el xlsx no calza con el informe:\n  " + divergencias.join("\n  "),
    );
  }
  if (solapan.length !== SOLAPAMIENTO_ESPERADO) {
    throw new Error(
      `GUARDA CRUZADA DEGRADADA: se validaron ${solapan.length} trimestres, se esperaban ${SOLAPAMIENTO_ESPERADO}. ` +
        "Alguno de los dos archivos cambió — revisa el rango antes de bajar el listón.",
    );
  }
  console.log(`Guarda cruzada OK: ${solapan.length} trimestres calzan (xlsx entero = informe redondeado).`);
}

function main() {
  const crudoDeptos = leer(CSV_DEPTOS);
  const crudoCasas = leer(CSV_CASAS);
  const batchId =
    "clapes-" +
    createHash("sha256").update(crudoDeptos).update(crudoCasas).digest("hex").slice(0, 12);

  const filas: Fila[] = [];
  const rechazos: string[] = [];
  const serieDeptos = parsearIndice(CSV_DEPTOS, "deptos", batchId, filas, rechazos);
  const serieCasas = parsearIndice(CSV_CASAS, "casas", batchId, filas, rechazos);

  console.log(
    `deptos: ${serieDeptos.size} trimestres · casas: ${serieCasas.size} trimestres · ` +
      `${filas.length} filas a escribir · ${rechazos.length} rechazos · batch ${batchId}`,
  );
  if (rechazos.length > 0) {
    console.error("RECHAZOS — no se escribe nada:");
    for (const r of rechazos) console.error("  " + r);
    process.exit(1);
  }

  // Duplicados sobre la UNIQUE dentro de los propios archivos (el upsert taparía
  // el primero en silencio).
  const vistas = new Set<string>();
  for (const f of filas) {
    const k = `${f.fuente}|${f.ambito}|${f.tipologia}|${f.periodo}`;
    if (vistas.has(k)) throw new Error(`Duplicado sobre la UNIQUE: ${k}`);
    vistas.add(k);
  }

  validarCruzado(serieDeptos);
  return { filas };
}

async function escribir(filas: Fila[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const LOTE = 200;
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await supabase
      .from("plusvalia_indices_raw")
      .upsert(filas.slice(i, i + LOTE), { onConflict: "fuente,ambito,tipologia,periodo" });
    if (error) throw new Error(`Upsert falló en lote ${i / LOTE}: ${error.message}`);
  }
  const { count, error } = await supabase
    .from("plusvalia_indices_raw")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Conteo de verificación falló: ${error.message}`);
  console.log(`OK: ${filas.length} filas upserteadas · total en tabla: ${count}`);
}

const { filas } = main();
escribir(filas).catch((e) => {
  console.error(e);
  process.exit(1);
});
