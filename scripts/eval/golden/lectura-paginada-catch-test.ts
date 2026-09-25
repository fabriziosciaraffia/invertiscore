// ============================================================================
// GOLDEN · NINGUNA LECTURA DE AVISOS SE CORTA EN MIL — catch-test (25-sep-2026)
// ============================================================================
// PostgREST capa cada respuesta en 1.000 filas sin aviso, también la de una RPC, y `.limit(2000)`
// devuelve 1.000 igual. El mismo error vivía en cuatro lugares a la vez: el «N comparables
// cerca» del mapa (la RPC `properties_within_radius` sin paginar, clavado en 1.000 a 2 km del
// centro), el rango de arriendo del zone-insight (`.limit(2000)`), y dos paginaciones sin orden
// (comunas-seo y el pase de unidades de TocToc), donde una fila puede salir dos veces o ninguna.
// Antes, `market_stats` calculó medianas sobre 1.000 de 55.466 filas durante meses.
//
// Este tier caza el PATRÓN, no los casos. Para cada llamada `.from("scraped_properties")` y
// `.rpc("properties_within_radius")` en `src/` y `scripts/` lee la CADENA entera —desde la
// llamada hasta el fin de la sentencia, o hasta el paréntesis que la cierra si va como argumento—
// y exige que sea una de estas:
//   · ESCRITURA — `.upsert(` `.update(` `.insert(` `.delete(`.
//   · CONTEO — `head: true`.
//   · PAGINADA — `.range(<offset variable>, …)` + `.order("id"…)` (un orden total: el id desempata).
//   · LOTE ACOTADO — `.order(` + `.limit(n)` con n literal ≤ 1.000 (o `Math.min(x, n)`).
// Además, el nombre de la tabla o de la función no puede aparecer como literal en ningún otro
// lugar que no sea el argumento de esa llamada (salvo el rótulo de observabilidad `tabla:`/`rpc:`):
// guardarlo en una constante sería la forma de esconderle la lectura al tier.
//
// Verificado EN ROJO con 13 mutaciones (ACTAS al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/lectura-paginada-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { archivosTrackeados } from "./archivos-trackeados";

const RAIZ = join(__dirname, "..", "..", "..");
const TOPE = 1000;

/** Quita comentarios sin tocar los strings: recorre el texto carácter a carácter. */
export function sinComentarios(s: string): string {
  let out = "";
  let i = 0;
  let str: string | null = null;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (str) {
      out += c;
      if (c === "\\") { out += d ?? ""; i += 2; continue; }
      if (c === str) str = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; out += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      const f = s.indexOf("*/", i + 2);
      const fin = f < 0 ? s.length : f + 2;
      out += s.slice(i, fin).replace(/[^\n]/g, ""); // conserva los saltos: las líneas del reporte no se corren
      i = fin;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * La cadena que arranca en `desde`, hasta el `;` o la `,` a profundidad 0. Si la llamada va como argumento
 * —`envolver(sb.from(…))…`— el `)` que la contiene NO la corta: lo que sigue a ese paréntesis
 * (`.order().range()`) es la misma lectura. Un `}` o `]` que la contiene sí la corta: ahí termina
 * el bloque, y seguir leyendo sería juntar sentencias ajenas.
 */
export function cadena(src: string, desde: number): string {
  let prof = 0;
  let str: string | null = null;
  for (let i = desde; i < src.length; i++) {
    const c = src[i];
    if (str) { if (c === "\\") i++; else if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === "`") { str = c; continue; }
    if (c === "(" || c === "[" || c === "{") prof++;
    else if (c === ")") { prof--; if (prof < 0) prof = 0; }
    else if (c === "]" || c === "}") { prof--; if (prof < 0) return src.slice(desde, i); }
    // La coma a profundidad 0 separa argumentos o elementos: en `Promise.all([a, b])` la cadena de
    // `a` no puede leer la de `b`, o una lectura cruda se esconde detrás de una paginada.
    else if ((c === ";" || c === ",") && prof === 0) return src.slice(desde, i);
  }
  return src.slice(desde);
}

export type Clase = "escritura" | "conteo" | "paginada" | "lote" | "FALLA";

export function clasificar(ch: string): { clase: Clase; porque?: string } {
  if (/\.(upsert|update|insert|delete)\s*\(/.test(ch)) return { clase: "escritura" };
  if (/head\s*:\s*true/.test(ch)) return { clase: "conteo" };
  const ordenId = /\.order\(\s*["'`]id["'`]/.test(ch);
  const rango = ch.match(/\.range\(\s*([^,\s)]+)/);
  if (rango) {
    if (/^\d/.test(rango[1])) return { clase: "FALLA", porque: `.range(${rango[1]}, …) con offset fijo: una sola página, se corta en ${TOPE}` };
    if (!ordenId) return { clase: "FALLA", porque: `pagina sin .order("id"): sin orden total una fila sale dos veces o ninguna entre páginas` };
    return { clase: "paginada" };
  }
  const lim = ch.match(/\.limit\(\s*(?:Math\.min\([^,]+,\s*)?(\d+)\s*\)?\s*\)/);
  if (lim && Number(lim[1]) <= TOPE && /\.order\(/.test(ch)) return { clase: "lote" };
  if (/\.limit\(/.test(ch)) return { clase: "FALLA", porque: `.limit sin paginar${lim ? ` (${lim[1]})` : ""}: sobre ${TOPE} PostgREST devuelve ${TOPE} igual, sin aviso` };
  return { clase: "FALLA", porque: `lectura sin paginar: PostgREST la corta en ${TOPE} filas sin aviso` };
}

const NOMBRES = ["scraped_properties", "properties_within_radius"];
const LLAMADA = /\.(from|rpc)\(\s*(["'`])(scraped_properties|properties_within_radius)\2/g;

const EXT = /\.(ts|tsx|mjs|js)$/;

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "node_modules") out.push(...archivos(p)); }
    else if (EXT.test(n)) out.push(p);
  }
  return out;
}

/** `src/` se lee del disco; `scripts/`, solo lo que git trackea (ver archivos-trackeados.ts). */
function archivosDe(dir: "src" | "scripts"): string[] {
  if (dir === "src") return archivos(join(RAIZ, "src"));
  return archivosTrackeados(RAIZ, "scripts").filter((a) => EXT.test(a) && !/[\\/]_archivo[\\/]/.test(a));
}

export function auditar(rel: string, crudo: string): { fallas: string[]; clases: Clase[] } {
  const src = sinComentarios(crudo.replace(/\r\n/g, "\n"));
  const fallas: string[] = [];
  const clases: Clase[] = [];
  const linea = (i: number) => src.slice(0, i).split("\n").length;
  const legitimos = new Set<number>();
  for (const m of src.matchAll(LLAMADA)) {
    const idx = m.index!;
    legitimos.add(idx + m[0].indexOf(m[3]));
    const { clase, porque } = clasificar(cadena(src, idx));
    clases.push(clase);
    if (clase === "FALLA") fallas.push(`${rel}:~${linea(idx)} · .${m[1]}("${m[3]}") · ${porque}`);
  }
  // Rótulos de observabilidad: `tabla: "scraped_properties"`, `rpc: "properties_within_radius"`.
  const rotulo = /\b(?:tabla|rpc)\s*:\s*(["'`])(?:scraped_properties|properties_within_radius)\1/g;
  for (const m of src.matchAll(rotulo)) legitimos.add(m.index! + m[0].indexOf(m[1]) + 1);
  for (const nombre of NOMBRES) {
    const lit = new RegExp(`(["'\`])${nombre}\\1`, "g");
    for (const m of src.matchAll(lit)) {
      if (!legitimos.has(m.index! + 1)) fallas.push(`${rel}:~${linea(m.index!)} · el nombre «${nombre}» aparece fuera de la llamada: una lectura por constante no la ve ningún control`);
    }
  }
  return { fallas, clases };
}

export function runLecturaPaginadaTier(): { hard: number } {
  console.log("\n─── TIER LECTURA-PAGINADA (ninguna lectura de avisos se corta en mil · 0 tokens) ───");
  const fallas: string[] = [];
  const cuenta: Record<Clase, number> = { escritura: 0, conteo: 0, paginada: 0, lote: 0, FALLA: 0 };
  let conLlamada = 0;
  const vistos = new Set<string>();
  for (const dir of ["src", "scripts"] as const) {
    for (const abs of archivosDe(dir)) {
      const rel = relative(RAIZ, abs).replace(/\\/g, "/");
      if (rel === "scripts/eval/golden/lectura-paginada-catch-test.ts") continue;
      const crudo = readFileSync(abs, "utf8");
      if (!NOMBRES.some((n) => crudo.includes(n))) continue;
      const r = auditar(rel, crudo);
      fallas.push(...r.fallas);
      for (const c of r.clases) cuenta[c]++;
      if (r.clases.length) { conLlamada++; vistos.add(basename(rel)); }
    }
  }

  // Piso de cobertura: un barrido que no encuentra nada no es un verde.
  const deben = ["market-suggestions.ts", "zone-insight-core.ts", "comuna-stats.ts", "comunas-seo.ts", "toctoc-unidades.ts", "capref-comuna-query.ts", "strref-zona-query.ts"];
  for (const b of deben) if (!vistos.has(b)) F0(`0 · el barrido no vio ninguna llamada en ${b}: no está leyendo el repo`);
  if (cuenta.paginada < 10) F0(`0 · solo ${cuenta.paginada} lecturas paginadas: el extractor no está encontrando las cadenas`);
  function F0(m: string) { fallas.push(m); }

  if (fallas.length) {
    console.log(`  ✗ LECTURA-PAGINADA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${conLlamada} archivos: ${cuenta.paginada} paginadas con orden total · ${cuenta.lote} lotes acotados · ${cuenta.conteo} conteos · ${cuenta.escritura} escrituras · ninguna lectura cortada en ${TOPE}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLecturaPaginadaTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (25-sep-2026) — cada una aplicada sobre el árbol, corrida contra este tier y
// restaurada. Las trece salieron en ROJO; con el árbol restaurado, VERDE.
//    1 · zone-insight vuelve a `.limit(2000)`                        → «.limit sin paginar (2000)»
//    2 · comunas-seo pagina sin `.order("id")`                        → «pagina sin .order("id")»
//    3 · el pase de unidades de TocToc sin `.order("id")`             → «pagina sin .order("id")»
//    4 · una de las cuatro llamadas vuelve a la RPC cruda             → «lectura sin paginar»
//    5 · `leerRadio` ordena solo por distancia, sin desempate por id  → «pagina sin .order("id")»
//    6 · `leerRadio` con `.range(0, 4999)`                            → «offset fijo»
//    7 · el nombre de la tabla guardado en una constante              → «aparece fuera de la llamada»
//    8 · un script con comillas simples, sin orden                    → «pagina sin .order("id")»
//    9 · el lote del geocoder sin `Math.min(…, 1000)`                 → «.limit sin paginar»
//   10 · una lectura cruda dentro de un `Promise.all` junto a una acotada → «lectura sin paginar»
//        (sin el corte en la coma, la cadena de la primera leía la `.limit(1)` de la segunda)
//   11 · `.limit(2000)` con un comentario que dice `.order("id") .range(off…)` → sigue ROJO
//   12 · backfill-toctoc, envuelta en `aplicarFiltrosUniverso(…)`, sin orden → «pagina sin .order»
//   13 · `.limit(2000)` CON `.order("id")`: ordenar no quita el corte   → «.limit sin paginar»
