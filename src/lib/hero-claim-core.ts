// ============================================================================
// [HERO-CLAIM] · núcleo compartido LTR / STR (04-sep-2026)
// ============================================================================
// Cada "doble / mitad / triple / N veces" que escribe el modelo es una RAZÓN: sujeto ÷
// comparador, nombrados en la misma oración. El guard busca el múltiplo, resuelve el
// comparador (el objeto del múltiplo, el más cercano DESPUÉS; si no hay, antes) y el
// sujeto (el más cercano ANTES, sin pisar el comparador, saltando los pares que no
// forman razón), le pide al motor esa razón y compara contra el rango del múltiplo.
// Sin sujeto, sin comparador o sin razón del motor ⇒ sin licencia ⇒ violación.
//
// Vivía entero en ai-generation.ts (LTR, v20). Se extrajo para que STR use el MISMO
// bucle con sus propias tablas de sujetos, comparadores y razones (str-guards.ts):
// el vocabulario de la renta corta es otro (tarifa, ocupación, banda, arriendo largo),
// la contabilidad es la misma.

export type ClaimHero = {
  re: RegExp;
  regla: string;
  min?: number;
  max?: number;
  /** Para "N veces": el rango sale del número que la oración nombra. */
  rangoDe?: (m: RegExpMatchArray) => { min?: number; max?: number };
};

/** "la única vía / salida / forma…": con cero o dos vías que cruzan es falso. */
export const RE_HERO_UNICA =
  /\b(?:la |una )?(?:única|sola) (?:vía|forma|manera|palanca|salida|opción|ajuste|camino)\b|\buna sola vía\b|\bel único (?:ajuste|camino|movimiento)\b/i;

/** Orden: los más específicos primero (el primero que calza manda). Razón = sujeto ÷ comparador. */
export const CLAIMS_HERO: ClaimHero[] = [
  { re: /\bmás del triple\b/i, regla: "triple", min: 3 },
  { re: /\b(?:el triple|triplica|tres veces)\b/i, regla: "triple", min: 2.9 },
  { re: /\bun tercio\b/i, regla: "tercio", min: 0.3, max: 0.37 },
  { re: /\bmás del doble\b/i, regla: "doble", min: 2 },
  { re: /\bcasi el doble\b/i, regla: "doble", min: 1.8 },
  { re: /\b(?:el doble|del doble|duplica|dos veces)\b/i, regla: "doble", min: 1.9 },
  { re: /\b(?:más de la mitad|poco más de la mitad|apenas (?:más de )?la mitad)\b/i, regla: "mitad", min: 0.5 },
  { re: /\bmenos de la mitad\b/i, regla: "mitad", max: 0.5 },
  { re: /\b(?:la mitad|a la mitad)\b/i, regla: "mitad", min: 0.45, max: 0.55 },
];

const NUM_PALABRA: Record<string, number> = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100,
};
const numeroDe = (s: string): number => {
  const k = s.toLowerCase().trim();
  if (NUM_PALABRA[k] !== undefined) return NUM_PALABRA[k];
  return Number(k.replace(/\./g, "").replace(",", ".")) || 0;
};
const N_RE = String.raw`(\d+(?:[.,]\d+)?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte|treinta|cuarenta|cincuenta|cien)`;

/** "N veces" con N nombrado (STR los estrena; LTR no los pasa): "más de N" ⇒ ≥ N; "casi N"
 *  ⇒ ≥ 0,9·N; "N veces" ⇒ ≥ 0,95·N. Mismo criterio que "dos veces" ⇒ 1,9 en la tabla base. */
export const CLAIMS_VECES: ClaimHero[] = [
  { re: new RegExp(String.raw`\bmás de ${N_RE} veces\b`, "i"), regla: "veces", rangoDe: (m) => ({ min: numeroDe(m[1]) }) },
  { re: new RegExp(String.raw`\bcasi ${N_RE} veces\b`, "i"), regla: "veces", rangoDe: (m) => ({ min: numeroDe(m[1]) * 0.9 }) },
  { re: new RegExp(String.raw`\b${N_RE} veces\b`, "i"), regla: "veces", rangoDe: (m) => ({ min: numeroDe(m[1]) * 0.95 }) },
];

export interface ClaimsCfg<S extends string, C extends string> {
  claims: ClaimHero[];
  sujetos: { re: RegExp; s: S }[];
  comparadores: { re: RegExp; c: C }[];
  /** La razón del motor para el par, o null si el par no forma razón. `valor` null =
   *  el comparador existe pero no tiene dato. */
  razon: (s: S, c: C, oracion: string) => { nombre: string; valor: number | null } | null;
  /** Vías que cruzan (dato del motor) para la regla "única vía"; undefined = no evaluar. */
  viasCruzan?: string[];
}

export function violacionesClaims<S extends string, C extends string>(texto: string, cfg: ClaimsCfg<S, C>): string[] {
  const out: string[] = [];
  for (const o of texto.split(/(?<=[.!?])\s+/)) {
    if (cfg.viasCruzan) {
      const vias = cfg.viasCruzan;
      const m1 = o.match(RE_HERO_UNICA);
      // Con CERO vías, "la única salida / opción / camino es vender / buscar otra" no habla de
      // una palanca: es la conclusión estructural, y es verdadera. "La única vía / palanca /
      // ajuste" sí afirma una palanca y con cero vías sigue siendo falsa.
      const salidaEstructural = vias.length === 0 && m1 !== null && /(?:salida|opci[oó]n|camino|forma|manera)\b/i.test(m1[0]);
      if (m1 && vias.length !== 1 && !salidaEstructural) out.push(`unica-via: dice "${m1[0]}" y cruzan ${vias.length} vía(s)${vias.length ? ` (${vias.join(", ")})` : ""}`);
    }
    let claim: { def: ClaimHero; txt: string; pos: number; min?: number; max?: number } | null = null;
    for (const def of cfg.claims) {
      const m = o.match(def.re);
      if (m && m.index !== undefined) {
        const rango = def.rangoDe ? def.rangoDe(m) : { min: def.min, max: def.max };
        claim = { def, txt: m[0], pos: m.index, ...rango };
        break;
      }
    }
    if (!claim) continue;
    const c = claim;
    type Hit<T> = { v: T; ini: number; fin: number; d: number; antes: boolean };
    const hits = <T,>(defs: { re: RegExp; v: T }[], excluir?: { ini: number; fin: number }): Hit<T>[] => {
      const out2: Hit<T>[] = [];
      for (const def of defs) {
        def.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = def.re.exec(o))) {
          const ini = m.index; const fin = m.index + m[0].length;
          if (!def.re.global) { def.re.lastIndex = 0; }
          if (excluir && ini < excluir.fin && fin > excluir.ini) { if (!def.re.global) break; continue; }
          out2.push({ v: def.v, ini, fin, d: Math.abs(ini - c.pos), antes: ini < c.pos });
          if (!def.re.global) break;
        }
      }
      return out2.sort((a, b) => a.d - b.d);
    };
    const compHits = hits(cfg.comparadores.map((x) => ({ re: x.re, v: x.c })));
    const comp = compHits.find((h) => !h.antes) ?? compHits[0] ?? null;
    if (!comp) { out.push(`${c.def.regla}: dice "${c.txt}" sin nombrar contra qué (sin comparador, sin licencia)`); continue; }
    const sujHits = hits(cfg.sujetos.map((x) => ({ re: x.re, v: x.s })), { ini: comp.ini, fin: comp.fin });
    const ordenados = [...sujHits.filter((h) => h.antes), ...sujHits.filter((h) => !h.antes)];
    if (!ordenados.length) { out.push(`${c.def.regla}: dice "${c.txt}" contra ${comp.v} sin sujeto claro (sin licencia)`); continue; }
    let z: { nombre: string; valor: number | null } | null = null;
    let sujElegido: S = ordenados[0].v;
    for (const h of ordenados) { const zz = cfg.razon(h.v, comp.v, o); if (zz) { z = zz; sujElegido = h.v; break; } }
    if (!z) { out.push(`${c.def.regla}: dice "${c.txt}" con sujeto ${sujElegido} y comparador ${comp.v}: no hay razón del motor para ese par (sin licencia)`); continue; }
    if (z.valor === null) { out.push(`${c.def.regla}: dice "${c.txt}" contra ${z.nombre}, que no tiene dato`); continue; }
    const { min, max } = c;
    const ok = (min === undefined || z.valor >= min) && (max === undefined || z.valor <= max);
    if (!ok) out.push(`${c.def.regla}: dice "${c.txt}" con ${z.nombre} = ${z.valor.toFixed(2)}× (se exige ${min !== undefined ? `≥ ${min}` : ""}${min !== undefined && max !== undefined ? " y " : ""}${max !== undefined ? `≤ ${max}` : ""})`);
  }
  return out.filter((v, i, arr) => arr.indexOf(v) === i);
}
