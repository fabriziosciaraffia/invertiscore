// ── Guard de CIFRAS — la prosa no recalcula números del motor ─────────────────
// Compartido LTR + STR (nació como STR-CIFRA en ai-generation-str; extraído acá al
// portarlo a LTR). La capa primaria es la regla del system prompt (STR §1.quater /
// LTR §17); esto es la red que mide si se cumplió.
//
// Principio del match: el user prompt CONTIENE todas las cifras tipadas que el modelo
// recibió, así que el conjunto permitido se extrae del propio prompt. Eso cubre por
// construcción campos que aún no existen — un umbral nuevo llega al prompt tipado y
// queda permitido solo — y evita mantener una lista de campos.
//
// Anti-falso-positivo (dos guards sobre-gatillados previos en este repo):
// · solo se auditan cifras CON unidad ($, UF, %, mil/millones) — enteros pelados
//   (años, dormitorios, m², "P50") quedan fuera del alcance;
// · tolerancia relativa en montos (el redondeo "$176 millones" calza con $176.2M) y
//   absoluta+relativa en porcentajes (8% calza con 8,4%; 64% NO calza con 67%);
// · los montos también calzan contra el set UF y viceversa (un error de unidad no es
//   recalculo — lo mide otra dimensión del censo, no este guard);
// · 0 y 100 se toleran siempre (retóricos: "financia el 100%");
// · con `ufClp` (LTR), la CONVERSIÓN entre monedas con la tasa del input también calza:
//   es la única aritmética que el prompt LTR sanciona (§12 exige variantes _uf
//   convertidas). Convertir es copiar en otra moneda, no producir.

interface CifraDetectada { n: number; unidad: "monto" | "uf" | "pct"; raw: string }

// Convive el formato chileno (punto de miles, coma decimal) con cifras que el motor
// inyecta en formato US ("descuento 53.4%"): sin coma y con 1-2 dígitos tras el ÚLTIMO
// punto, ese punto es decimal; cualquier otro punto es de miles. Sin esto, "53.4%" se
// leía como "4%" y el conjunto permitido quedaba mutilado (FP masivo en calibración LTR).
const parseNumCL = (raw: string): number => {
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
  const m = raw.match(/^(\d[\d.]*)\.(\d{1,2})$/);
  if (m) return Number(m[1].replace(/\./g, "") + "." + m[2]);
  return Number(raw.replace(/\./g, ""));
};

function extraerCifras(texto: string): CifraDetectada[] {
  const out: CifraDetectada[] = [];
  // Montos CLP con sufijo opcional: $176 millones · $3,5M · $513K · $301.772 · $127,7 MM
  const reClp = /\$\s?([\d.]+(?:,\d+)?)\s?(MM|M(?![A-Za-z])|K(?![A-Za-z])|mill[oó]n(?:es)?|mil(?![a-z]))?/g;
  let m: RegExpExecArray | null;
  while ((m = reClp.exec(texto)) !== null) {
    let n = parseNumCL(m[1]);
    const suf = (m[2] ?? "").toLowerCase();
    if (suf === "k" || suf === "mil") n *= 1e3;
    else if (suf) n *= 1e6; // M / MM / millones
    if (Number.isFinite(n) && n > 0) out.push({ n, unidad: "monto", raw: m[0].trim() });
  }
  // Signo tolerado y descartado: el prompt escribe "UF -1,4" / "−$54.186" para flujos
  // negativos y la prosa los cita en valor absoluto ("los UF 1,4 de aporte"). Sin esto,
  // TODOS los UF negativos del prompt quedaban fuera del conjunto permitido — FP masivo
  // detectado en la calibración LTR (92% de disparo, caso 01d52540).
  const reUf = /UF\s?[-−]?\s?([\d.]+(?:,\d+)?)/g;
  while ((m = reUf.exec(texto)) !== null) {
    const n = parseNumCL(m[1]);
    if (Number.isFinite(n) && n > 0) out.push({ n, unidad: "uf", raw: m[0] });
  }
  const rePct = /(\d+(?:[.,]\d+)*)\s?%/g;
  while ((m = rePct.exec(texto)) !== null) {
    const n = parseNumCL(m[1]);
    if (Number.isFinite(n)) out.push({ n, unidad: "pct", raw: m[0] });
  }
  return out;
}

const calzaMonto = (a: number, b: number): boolean => Math.abs(a - b) / Math.max(a, b) <= 0.025;
const calzaPct = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 0.55 || Math.abs(a - b) / Math.max(a, b) <= 0.025;

function collectStrings(node: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof node === "string") { out.push({ path, value: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, `${path}[${i}]`, out)); return; }
  if (node && typeof node === "object") {
    Object.entries(node as Record<string, unknown>).forEach(([k, v]) => collectStrings(v, path ? `${path}.${k}` : k, out));
  }
}

/**
 * Cifras de la prosa que NO vienen del input (= no aparecen en el user prompt).
 * Devuelve `path="raw"` por violación. Detección — el que llama decide si loguea,
 * reintenta o revierte. `ufClp` habilita la tolerancia de conversión CLP↔UF (LTR).
 */
export function cifrasFueraDeInput(userPrompt: string, ai: unknown, opts?: { ufClp?: number }): string[] {
  const permitidas = extraerCifras(userPrompt);
  const montosOk = permitidas.filter((c) => c.unidad !== "pct").map((c) => c.n);
  const pctsOk = permitidas.filter((c) => c.unidad === "pct").map((c) => c.n);
  const uf = opts?.ufClp;
  const strings: { path: string; value: string }[] = [];
  collectStrings(ai, "", strings);
  const out: string[] = [];
  for (const { path, value } of strings) {
    for (const c of extraerCifras(value)) {
      if (c.unidad === "pct") {
        if (c.n === 0 || c.n === 100) continue;
        if (pctsOk.some((p) => calzaPct(p, c.n))) continue;
        // un % que coincide con un monto/UF del input no es invento ("un 25%" citando
        // el pie 25): se tolera para no sobre-gatillar.
        if (montosOk.some((p) => calzaPct(p, c.n))) continue;
      } else {
        if (montosOk.some((p) => calzaMonto(p, c.n))) continue;
        // cruce de unidad tolerado (monto que cita una cifra UF del input o viceversa)
        if (pctsOk.some((p) => calzaMonto(p, c.n))) continue;
        // conversión sancionada por la tasa del input (§12 LTR): monto ≈ permitido×UF
        // o permitido/UF, en cualquier dirección.
        if (uf && uf > 0 && montosOk.some((p) => calzaMonto(p * uf, c.n) || calzaMonto(p / uf, c.n))) continue;
      }
      out.push(`${path}="${c.raw}"`);
    }
  }
  return out;
}
