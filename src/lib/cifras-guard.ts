import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
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

/**
 * COMUNAS QUE LA PROSA NOMBRA Y EL MOTOR NO DIO (§3, Ángulo 2 · bump 23).
 *
 * Misma regla que `cifrasFueraDeInput`, aplicada a los nombres de comuna: lo que el
 * modelo escribe tiene que salir del caso, no de su memoria.
 *
 * POR QUÉ EXISTE, con el número. Hasta el bump 22 el Ángulo 2 le daba al modelo una
 * lista fija de doce comunas agrupadas por perfil —medios, premium, en alza,
 * establecidos— y ningún dato de ninguna. Medido sobre el parque: de las 105 filas
 * donde la prosa nombraba una comuna Y la card mostraba la del motor, coincidieron
 * CERO. No es mala suerte: los dos universos son disjuntos por construcción, porque
 * la lista eran comunas de perfil medio y premium y el motor, que filtra por el
 * presupuesto del comprador, nombra las baratas — Puente Alto, Conchalí, Cerrillos,
 * Quilicura, ninguna de las cuales estaba en la lista.
 *
 * QUÉ MIRA: la comuna PROPIA nunca cuenta —la prosa la nombra todo el tiempo y es
 * correcta—, y las permitidas salen del bloque «comunasAlternativas» del user prompt,
 * que es la única fuente. Con el bloque vacío, cualquier comuna del roster que
 * aparezca es una invención.
 *
 * DEVUELVE las violaciones con su path, igual que las cifras, para que el correctivo
 * pueda nombrarlas.
 */
export function comunasFueraDeAlternativa(userPrompt: string, ai: unknown): string[] {
  // Las permitidas, del bloque que arma el motor. Sin bloque no se audita nada: es
  // una prosa vieja o un caller que no lo pasa, y este guard no inventa la regla.
  const m = userPrompt.match(/- comunasAlternativas:\s*(.*)/);
  if (!m) return [];
  const crudo = m[1].trim();
  const permitidas = crudo === "(ninguna)" || crudo === ""
    ? []
    : crudo.split(",").map((x) => x.trim()).filter(Boolean);

  // La comuna del propio depto: viaja en «ubicacion: <comuna>, <ciudad>».
  const propia = userPrompt.match(/- ubicacion:\s*([^,\n]+)/)?.[1]?.trim() ?? "";

  // LOS ALIAS CUENTAN. El prompt viejo le enseñó al modelo a escribir «Santiago
  // centro», que es la MISMA comuna que «Santiago»: sin esto, una fila de Ñuñoa que
  // mande a «Santiago centro» esquiva el guard, y una de Santiago que diga su propio
  // nombre alternativo se marca como violación cuando no lo es. Medido: de seis filas
  // reales del parque el guard cazaba cinco y se le escapaba justo ésa.
  const ALIAS: Record<string, string> = { "Santiago centro": "Santiago", "Santiago Centro": "Santiago" };
  const objetivo = (txtComuna: string) => ALIAS[txtComuna] ?? txtComuna;

  const strings: { path: string; value: string }[] = [];
  collectStrings(ai, "", strings);
  const out: string[] = [];
  for (const { path, value } of strings) {
    for (const c of [...COMUNAS_DISPONIBLES, ...Object.keys(ALIAS)]) {
      const canon = objetivo(c);
      if (canon === objetivo(propia) || permitidas.some((p) => objetivo(p) === canon)) continue;
      // Límite de palabra a los dos lados: «Santiago» no debe dispararse dentro de
      // «Santiago centro» ni de «Gran Santiago», que son otras cosas.
      const re = new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^$()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u");
      // Se reporta el nombre CANÓNICO: dos alias de la misma comuna son una sola
      // violación, no dos.
      if (re.test(value) && !out.includes(`${path}="${canon}"`)) out.push(`${path}="${canon}"`);
    }
  }
  return out;
}

/**
 * LAS FRASES CON QUE LA PROSA CIERRA LA PUERTA (A8 · bump 24).
 *
 * Calibradas LEYENDO el parque, no imaginadas: son las que aparecen en las 104 filas
 * donde la prosa niega una salida que el motor tiene. El conteo por familia, medido:
 * «ningún ajuste» 78 · «estructural» 68 · «fuera de rango» 3 · «no se arregla» 3 ·
 * «no alcanza/basta» 1 · «ni negociando» 1.
 */
/** Nombrar la salida absuelve: con esto en el texto, no hay dos respuestas opuestas. */
const NOMBRA_LA_SALIDA =
  /(salida|soluci[óo]n|combinaci[óo]n|v[íi]a)\s+(combinad|conjunt|mixt)|combinando|(subir|subiendo|mover|moviendo)\s+el\s+pie[^.]{0,60}(plazo|a la vez)|pie[^.]{0,30}(m[áa]s|y)\s+(el\s+)?plazo/i;

/** «por separado» / «por sí sola»: dicen lo MISMO que el motor, no lo contrario. */
const POR_SEPARADO =
  /\b(por separado|por s[íi] (sol[oa]|mism[oa])|aislad[oa]s?|individualmente|de manera aislada|una sola|cada una por)\b/gi;

const CIERRAN_LA_PUERTA: [string, RegExp][] = [
  ["estructural", /estructural/i],
  ["no hay forma", /no hay (ninguna |ning[úu]n )?(forma|manera|modo|salida)/i],
  ["ningún ajuste", /ning[úu]n[a]? (ajuste|cambio|descuento|movimiento|palanca|v[íi]a)/i],
  ["no alcanza", /(no alcanza|no basta|no cierra) (por|con) (m[áa]s|ning)/i],
  ["ni negociando", /ni (negociando|bajando|subiendo|estirando|con)\b[^.]{0,60}(alcanza|cierra|basta|mueve)/i],
  ["no se arregla", /no se (arregla|resuelve|soluciona)/i],
  ["fuera de rango", /fuera de (todo )?rango/i],
];

/**
 * ¿LA PROSA NIEGA UNA SALIDA QUE EL MOTOR ENCONTRÓ? (A8 · bump 24)
 *
 * El motor encuentra salida combinando pie y plazo en filas donde NINGÚN cambio por
 * separado alcanza, y la card la dibuja. Hasta el bump 24 el modelo no recibía ese
 * dato y el prompt le mandaba cerrar la puerta: medido sobre las 674 filas con prosa,
 * 136 tienen salida por mix y **104 la niegan por escrito** — el 76,5% —, al lado de
 * una card que la muestra. Una decía «ningún descuento negociable, ni la tasa actual,
 * ni extender el plazo alcanza» mientras el motor cruzaba moviendo pie Y plazo.
 *
 * QUÉ MIRA: solo dispara con `hayMixACOMPRAR: sí` en el user prompt. Sin ese bloque
 * —prosa vieja, o un caller que no lo pasa— no audita nada: el guard no inventa la
 * regla donde el dato no llegó.
 *
 * ES UN MATCHER DE FRASES, NO DE SENTIDO, y por eso las siete familias salieron de
 * leer el parque. Puede tener falsos negativos (una forma de negar que no está en la
 * lista); no puede tener falsos positivos caros, porque el reintento que dispara solo
 * se acepta si MEJORA el conteo.
 */
export function niegaSalidaConMix(userPrompt: string, ai: unknown): string[] {
  if (!/- hayMixACOMPRAR:\s*s[íi]/i.test(userPrompt)) return [];
  const strings: { path: string; value: string }[] = [];
  collectStrings(ai, "", strings);
  const out: string[] = [];
  for (const { path, value } of strings) {
    // NOMBRAR LA SALIDA ABSUELVE, y es la mitad que importa. «Ninguna palanca por
    // separado alcanza» es VERDAD —es exactamente lo que dice el motor— y va seguida
    // de «hay una salida combinada»: ahí el lector no ve dos respuestas opuestas, ve
    // una sola bien contada. La primera versión de este guard marcaba esa prosa como
    // violación y el reintento no podía mejorarla porque no había nada que arreglar.
    if (NOMBRA_LA_SALIDA.test(value)) continue;
    // Y el calificador de separación desarma la frase aunque no se nombre la salida:
    // «por separado», «por sí sola» dicen justo lo que el motor dice.
    const sinCalificador = value.replace(POR_SEPARADO, " ");
    for (const [nombre, re] of CIERRAN_LA_PUERTA) {
      if (re.test(sinCalificador)) {
        const m = sinCalificador.match(re);
        out.push(`${path}[${nombre}]="${(m?.[0] ?? "").slice(0, 40)}"`);
        break; // una violación por campo: la familia alcanza para el correctivo
      }
    }
  }
  return out;
}

/**
 * ¿El candidato introduce cifras fuera del input que la base no tenía?
 *
 * Para retries QUIRÚRGICOS (Goal D): cuando un retry reescribe un solo campo de
 * una prosa que el guard de cifras ya validó, el candidato completo se re-verifica
 * acá — misma regla, mismo módulo (una regla, un módulo, N consumidores: LTR hoy,
 * STR cuando adopte el patrón). Se compara por CONTEO contra la base vigente y no
 * contra cero: una prosa aceptada con violaciones residuales (el guard upstream es
 * best-effort) no debe bloquear un retry que no las empeora.
 */
export function empeoraCifras(
  userPrompt: string,
  base: unknown,
  candidato: unknown,
  opts?: { ufClp?: number },
): boolean {
  return cifrasFueraDeInput(userPrompt, candidato, opts).length > cifrasFueraDeInput(userPrompt, base, opts).length;
}

/**
 * Regla contable de UNIDAD (goal "tres reglas contables", 03-sep-2026): una cifra que
 * va con "por metro / por m² / el metro" tiene que ser un valor POR m² — la diferencia
 * contra la mediana (sobreprecioUfM2), el precio/m² del sujeto o la mediana —, nunca el
 * total. El juez cazó "UF 700 más por metro" con +35 UF/m² (GS-4: el total sobre 20 m²) y
 * "UF 146 de más por cada metro" con +32,8 (GS-7). Devuelve `path="UF 700"` por violación.
 */
export function cifrasPorMetroFueraDeUnidad(
  ai: unknown,
  ref: { sobreprecioUfM2: number | null; sujetoUfM2: number | null; medianaUfM2: number | null; ufClp?: number },
): string[] {
  const validasUF = [ref.sobreprecioUfM2, ref.sujetoUfM2, ref.medianaUfM2]
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v !== 0)
    .map((v) => Math.abs(v));
  if (!validasUF.length) return [];
  const validasCLP = ref.ufClp && ref.ufClp > 0 ? validasUF.map((v) => v * (ref.ufClp as number)) : [];
  const calza = (n: number, set: number[]) => set.some((v) => Math.abs(n - v) / Math.max(n, v) <= 0.03 || Math.abs(n - v) <= 0.6);
  const MARCA = String.raw`(?:por (?:cada )?metro(?: cuadrado)?|por m[²2]|el metro|cada metro|al metro|\/\s?m[²2])`;
  const CIFRA = String.raw`(UF\s?[-−]?\s?[\d.]+(?:,\d+)?|\$\s?[\d.]+(?:,\d+)?)`;
  // La cifra va PEGADA a la marca, con a lo sumo el conector del sobreprecio en medio:
  // "UF 700 más por metro", "UF 146 de más por cada metro", "UF 110 el metro", "UF 45/m²".
  // Una ventana libre capturaba el "UF 45" anterior de la misma oración (y perdía el
  // "UF 700"), o ataba "UF 1.256,2 de tu bolsillo y un precio por m²" a la marca.
  const CONECTOR = String.raw`(?:\s+(?:m[aá]s|de m[aá]s|menos|de menos|extra|adicionales?|de diferencia))?(?:\s+(?:por encima|por debajo|sobre|bajo)(?:\s+de)?(?:\s+la mediana(?:\s+comunal)?)?)?`;
  const reAntes = new RegExp(CIFRA + CONECTOR + String.raw`\s*` + MARCA, "gi");
  // DESPUÉS solo con conector directo: "el metro a UF 110", "por m² de UF 45".
  const reDespues = new RegExp(MARCA + String.raw`\s+(?:a|de|en|:)\s*` + CIFRA, "gi");
  const strings: { path: string; value: string }[] = [];
  collectStrings(ai, "", strings);
  const out: string[] = [];
  for (const { path, value } of strings) {
    for (const re of [reAntes, reDespues]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        const raw = m[1].trim();
        const esUF = /^UF/i.test(raw);
        const n = parseNumCL(raw.replace(/^UF\s?[-−]?\s?|^\$\s?/i, ""));
        if (!Number.isFinite(n) || n <= 0) continue;
        if (esUF ? calza(n, validasUF) : calza(n, validasCLP)) continue;
        // "UF 5/m²" ya viene con la unidad pegada al número (precio/m² del sujeto o mediana): se cubre arriba
        out.push(`${path}="${raw}"`);
      }
    }
  }
  return out.filter((v, i, arr) => arr.indexOf(v) === i);
}
