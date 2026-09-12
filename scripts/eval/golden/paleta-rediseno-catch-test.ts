// ============================================================================
// GOLDEN · LA PALETA DEL REDISEÑO — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §1.
// Tres superficies —page, card, sunk— más las líneas, en los dos temas.
//
// Este tier mide la ESCALA, no la lista de hexes. Un test que compare los valores
// contra una copia de la tabla del contrato solo prueba que alguien copió bien: se
// rompe cuando el contrato cambia y no dice nada sobre si la escala funciona. Lo que
// hay que fijar es la propiedad — que cada superficie se distinga de la siguiente y
// que las líneas se vean sobre la superficie que les toca.
//
// Fija CINCO cosas:
//
//   1. LA ESCALA ESTÁ COMPLETA en los dos temas: page, card, sunk, line, line2 y
//      line-sunk, sin huecos.
//
//   2. CADA PAR ADYACENTE DE SUPERFICIE SE DISTINGUE, medido en ΔL* (claridad
//      perceptual, que es uniforme; el ratio de contraste no lo es en los extremos).
//      Piso 2,0 — bajo 1,0 un borde de área grande es invisible.
//
//   3. CADA LÍNEA SE VE SOBRE LA SUPERFICIE QUE LE TOCA. Es la razón de existir de
//      `--line-sunk`: `--line` contra `--sunk` da ΔL* 0,70 en claro y 0,04 en oscuro
//      —un punto del canal azul— y el separador desaparece. Si alguien vuelve a apuntar
//      esas reglas a `--line`, esto lo caza.
//
//   4. LA DIRECCIÓN DE LA LÍNEA SIGUE AL TEMA: sobre una superficie, la línea es más
//      oscura en claro y más clara en oscuro. Al revés se lee como una ranura.
//
//   5. EL SEMÁFORO DEL DATO NO SE REAPUNTA A LA TRÍADA. `--doc-good`, `--doc-warn` y
//      `--doc-neutral` miden un dato contra un umbral; la tríada nombra un veredicto.
//      Confundirlos fue el error que el goal de la tríada vino a arreglar, y el
//      rediseño no lo re-litiga.
//
// Corre dentro del QUICK (tier "paleta-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/paleta-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const CSS = (() => {
  try { return readFileSync(join(RAIZ, "src/components/analysis/portada/PortadaInforme.tsx"), "utf8"); } catch { return ""; }
})();

const leerArchivo = (p: string) => {
  try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; }
};
const RUTA_LTR = leerArchivo("src/app/analisis/[id]/page.tsx");
const HALLAZGOS = leerArchivo("src/components/analysis/PrincipalesHallazgos.tsx");
const RUTA_STR = leerArchivo("src/app/analisis/renta-corta/[id]/results-client.tsx");

const PISO = 2.0;
const TOKENS = ["page", "card", "sunk", "line", "line2", "line-sunk"] as const;
type Tok = (typeof TOKENS)[number];

/** Los valores del bloque del rediseño, por tema. El claro vive tras el selector
 *  `[data-theme="light"] .doc-dictamen`; lo anterior es el oscuro. */
function paleta(): { oscuro: Record<string, string>; claro: Record<string, string> } {
  const ini = CSS.indexOf("REDISEÑO · PALETA");
  const corte = CSS.indexOf('[data-theme="light"] .doc-dictamen', ini);
  const fin = CSS.indexOf("REDISEÑO · TIPOGRAFÍA", ini);
  const sacar = (txt: string) => {
    const out: Record<string, string> = {};
    for (const m of txt.matchAll(/--(page|card|sunk|line2|line-sunk|line|up)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
      if (!out[m[1]]) out[m[1]] = m[2].toUpperCase();
    }
    return out;
  };
  if (ini === -1 || corte === -1) return { oscuro: {}, claro: {} };
  return { oscuro: sacar(CSS.slice(ini, corte)), claro: sacar(CSS.slice(corte, fin === -1 ? undefined : fin)) };
}

const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
function Lstar(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

const P = paleta();

// ── 1 · la escala está completa ────────────────────────────────────────────
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  for (const t of TOKENS) {
    if (!toks[t]) F(`1 · falta --${t} en ${tema}: la escala tiene un hueco`);
  }
}

// ── 2 · las superficies se distinguen entre sí ─────────────────────────────
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  const esc: Tok[] = ["page", "card", "sunk"];
  for (let i = 0; i < esc.length - 1; i++) {
    const a = toks[esc[i]], b = toks[esc[i + 1]];
    if (!a || !b) continue;
    const d = Math.abs(Lstar(b) - Lstar(a));
    if (d < PISO) F(`2 · ${tema}: ${esc[i]}→${esc[i + 1]} da ΔL*=${d.toFixed(2)}, bajo el piso de ${PISO}`);
  }
}

// ── 3 · cada línea se ve sobre la superficie que le toca ───────────────────
// `--line` sirve sobre page y card. Sobre sunk va `--line-sunk`, y por eso existe.
const PARES: [Tok, Tok][] = [["line", "page"], ["line", "card"], ["line-sunk", "sunk"], ["line2", "card"]];
for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
  for (const [linea, fondo] of PARES) {
    const a = toks[linea], b = toks[fondo];
    if (!a || !b) continue;
    const d = Math.abs(Lstar(a) - Lstar(b));
    if (d < PISO) F(`3 · ${tema}: --${linea} sobre --${fondo} da ΔL*=${d.toFixed(2)} — un separador que no se ve no es un separador`);
  }
  // Y el caso que motivó el token: `--line` sobre `--sunk` NO se usa, pero si alguien
  // lo hace tiene que quedar claro que no sirve.
  const l = toks["line"], s = toks["sunk"];
  if (l && s && Math.abs(Lstar(l) - Lstar(s)) >= PISO) {
    F(`3 · ${tema}: --line ya se distingue de --sunk (ΔL*=${Math.abs(Lstar(l) - Lstar(s)).toFixed(2)}). Si eso es a propósito, --line-sunk sobra y hay que retirarlo con acta.`);
  }
}

// ── 4 · la dirección de la línea sigue al tema ─────────────────────────────
{
  const c = P.claro, o = P.oscuro;
  if (c["line-sunk"] && c["sunk"] && Lstar(c["line-sunk"]) >= Lstar(c["sunk"])) {
    F("4 · claro: --line-sunk tiene que ser MÁS OSCURA que --sunk; más clara se lee como una ranura");
  }
  if (o["line-sunk"] && o["sunk"] && Lstar(o["line-sunk"]) <= Lstar(o["sunk"])) {
    F("4 · oscuro: --line-sunk tiene que ser MÁS CLARA que --sunk; más oscura se lee como una ranura");
  }
}

// ── 5 · el semáforo del dato no se reapunta a la tríada ────────────────────
{
  const bloque = CSS.slice(CSS.indexOf("REDISEÑO · PALETA"), CSS.indexOf("REDISEÑO · TIPOGRAFÍA"));
  for (const t of ["--doc-good", "--doc-warn", "--doc-neutral"]) {
    if (new RegExp(`${t}\\s*:`).test(bloque)) {
      F(`5 · ${t} se reapunta en el bloque del rediseño. El semáforo del dato mide un dato contra un umbral y la tríada nombra un veredicto: son sistemas distintos y confundirlos fue el error que el goal de la tríada arregló.`);
    }
  }
  if (/--verdict\s*:/.test(bloque)) {
    F("5 · la tríada del veredicto se redefine en el bloque de la paleta. §0 del contrato: la tríada Tinta no cambia.");
  }
}

// ── 6 · el par direccional: --signal-red baja, --up sube ──────────────────
{
  // «--up» es el unico token DIRECCIONAL que el contrato (§1) pide y el codigo no
  // tenia. Se publica con la escala para que nadie lo escriba a mano el dia que lo
  // monte: las flechas de hallazgo (§3) y las pildoras de zona (§8) lo van a pedir.
  const SIGNAL = "#C8323C"; // de marca, un solo valor para los dos temas (globals.css)
  const PISO_AA = 4.5;
  const PISO_PAR = 2.0;
  const Y = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [Y(a), Y(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  for (const [tema, toks] of [["oscuro", P.oscuro], ["claro", P.claro]] as const) {
    const up = toks["up"];
    if (!up) { F(`6 · falta --up en ${tema}: el contrato §1 lo pide para las flechas de hallazgo y las píldoras de zona`); continue; }
    // Pinta texto y píldoras, así que tiene que leerse sobre las dos superficies.
    for (const sup of ["page", "card"] as const) {
      const fondo = toks[sup];
      if (!fondo) continue;
      const r = contraste(up, fondo);
      if (r < PISO_AA) F(`6 · ${tema}: --up sobre --${sup} da ${r.toFixed(2)}:1, bajo el piso AA de ${PISO_AA}`);
    }
    // Lo ÚNICO que hace direccional a un color es distinguirse del otro sentido.
    const d = Math.abs(Lstar(up) - Lstar(SIGNAL));
    if (d < PISO_PAR) {
      F(`6 · ${tema}: --up y --signal-red quedan a ΔL*=${d.toFixed(2)} — si las dos direcciones se leen igual, la dirección la tiene que decir otra cosa`);
    }
  }
  // Y NO SE ESCRIBE A MANO. Un hex direccional suelto en una regla es el token que no
  // se usó; el dia que cambie el valor, esa pieza se queda con el viejo en silencio.
  // SIN COMENTARIOS: un hex citado en la tabla de medición del bloque no pinta nada.
  const bloqueR2 = CSS.slice(CSS.indexOf("REDISEÑO · PALETA")).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const hex of ["#2B558F", "#6C9BE0"]) {
    const fuera = [...bloqueR2.matchAll(new RegExp(hex, "gi"))].length;
    const declarado = [...bloqueR2.matchAll(new RegExp(`--up\s*:\s*${hex}`, "gi"))].length;
    if (fuera > declarado) {
      F(`6 · ${hex} aparece ${fuera - declarado} vez(ces) fuera de la declaración de --up: el color direccional va por token, no hardcodeado`);
    }
  }
  // ACTA · EL GUARD DE «SÍMBOLO, NO COLOR» SE RETIRA Y SE INVIERTE (11-sep-2026).
  //
  // Hasta hoy este invariante PROHIBÍA colorear «.hz-fl»: fijaba la decisión del
  // 09-sep, que sacó el color del bloque de hallazgos porque estaba en todos lados
  // —cifras, textos y flechas— y un bloque donde todo grita no jerarquiza nada.
  //
  // El contrato §4 la reemplaza, y no la revierte: el color vuelve SOLO a las flechas,
  // a 20 px, «↓» en «--signal-red» y «↑» en «--up». Las cifras y los textos siguen en
  // tinta, con la única excepción de siempre —el monto negativo—. Lo que se conserva de
  // la decisión vieja es lo que la motivaba: el color no se reparte.
  //
  // Así que el guard no se borra: se da vuelta. Antes fijaba la ausencia; ahora fija la
  // presencia, que es más difícil de perder sin querer.
  {
    const bloqueFl = CSS.slice(CSS.indexOf(".doc-dictamen .hz-fl{"), CSS.indexOf(".doc-dictamen .hz-fl{") + 400);
    if (!CSS.includes(".doc-dictamen .hz-fl{")) {
      F("6 · desapareció la regla de las flechas de hallazgo del rediseño (§4): sin ella vuelven a los 14 px y a una sola tinta");
    } else {
      if (!/font-size:\s*20px/.test(bloqueFl)) F("6 · las flechas de hallazgo dejaron de medir 20 px (§4)");
      const PAR: [string, string][] = [["adverso", "--signal-red"], ["favorable", "--up"]];
      for (const [dir, tok] of PAR) {
        const re = new RegExp(`\\.hz-fl\\[data-dir="${dir}"\\]\\{color:var\\(${tok}\\)\\}`);
        if (!re.test(bloqueFl)) {
          F(`6 · la flecha «${dir === "adverso" ? "↓" : "↑"}» dejó de ir en «${tok}» (§4). El par direccional es lo único que distingue una dirección de la otra: con las dos en la misma tinta, el color deja de decir nada y sobra.`);
        }
      }
      // Y el gancho lo emite el componente: sin «data-dir» la regla no matchea nada y el
      // tier seguiría verde mirando un CSS que no se aplica.
      if (!/<span className="hz-fl" data-dir=\{h\.direccion\}/.test(HALLAZGOS)) {
        F("6 · `PrincipalesHallazgos` dejó de emitir `data-dir` en la flecha: la regla de §4 existe pero no matchea nada, y el bloque vuelve a una sola tinta sin que el CSS lo diga.");
      }
    }
    // Y el color NO se reparte: las cifras y los textos de la fila siguen en tinta.
    for (const sel of [".hz-lin p{", ".hz-n{"]) {
      const linea = CSS.split("\n").find((l) => l.includes(sel)) ?? "";
      if (linea && /var\(--up\)|var\(--signal-red\)/.test(linea)) {
        F(`6 · «${sel.replace("{", "")}» tomó color direccional. §4 le devuelve el color a las FLECHAS y a nada más: repartirlo por la fila es exactamente lo que «SÍMBOLO, NO COLOR» vino a arreglar en septiembre.`);
      }
    }
  }
}

// ── 7 · el selector lleva la forma PEGADA ────────────────────────────────
{
  // LA PEGADA LLEGÓ A PRODUCCIÓN ANTES DE ENCONTRARSE (11-sep-2026, con el interruptor:
  // «class="doc-dictamen doc-r2"»). Los repuntes «--doc-*» quedaban en un selector (0,1,0)
  // que en tema CLARO perdía contra «[data-theme=light] .doc-dictamen» (0,1,1), la paleta
  // cálida vieja que sigue arriba para «.doc-tokens» fuera del marco, así que los NUEVE
  // tokens se quedaban en ella. Con el andamio retirado (12-sep-2026) la forma pegada es
  // «.doc-dictamen.doc-dictamen», (0,2,0) a propósito: renombrada en su sitio, no quitada.
  const FORMAS = [".doc-dictamen", ".doc-dictamen.doc-dictamen", ".doc-dictamen .doc-tokens"];
  const bloque = CSS.slice(CSS.indexOf("REDISEÑO · PALETA"), CSS.indexOf("REDISEÑO · TIPOGRAFÍA"));
  // CADA TEMA EN SU PROPIO SUB-BLOQUE. Buscando el substring en todo el bloque, la forma
  // del tema CLARO —«[data-theme=light] .doc-dictamen.doc-dictamen»— contiene a la del
  // oscuro —«.doc-dictamen.doc-dictamen»— y la satisface: borrada del oscuro, el guard
  // seguía verde.
  const corte = bloque.indexOf('[data-theme="light"] .doc-dictamen');
  const SUB = { oscuro: corte === -1 ? bloque : bloque.slice(0, corte), claro: corte === -1 ? "" : bloque.slice(corte) };
  for (const tema of ["oscuro", "claro"] as const) {
    const pref = tema === "claro" ? '[data-theme="light"] ' : "";
    const donde = SUB[tema];
    for (const f of FORMAS) {
      if (!donde.includes(pref + f + ",") && !donde.includes(pref + f + "{")) {
        F(`7 · falta «${pref}${f}» en el bloque de la paleta (${tema}). Sin la forma PEGADA los tokens --doc-* se quedan en la paleta vieja en tema claro, que es lo que llegó a producción.`);
      }
    }
  }
  // Y los repuntes siguen ahí: si se van, la forma no sirve de nada.
  for (const t of ["--doc-paper", "--doc-line", "--doc-tx"]) {
    if (!bloque.replace(/\s/g, "").includes(`${t}:var(`)) {
      F(`7 · el repunte de «${t}» desapareció del bloque de la paleta`);
    }
  }
}

// ── 8 · el lienzo de la página (contrato §2) ─────────────────────────────
{
  // Retirado el marco, lo que queda detrás del informe es el gris de la app. §2 pide la
  // página entera del color del papel, así que el wrapper de la ruta LTR pinta «--page».
  //
  // Medido en el DOM, wrapper y body:
  //   claro   #FFFFFF   ·   --card del informe #F4F4F6   → contraste 1,098 · ΔL* 3,76
  //   oscuro  #0C0C0E   ·   --card del informe #1A1A1E   → contraste 1,126 · ΔL* 6,05

  // 8a · la clase está en la ruta LTR, sin condición (12-sep-2026: el interruptor se retiró).
  if (!/min-h-screen bg-\[var\(--franco-bg\)\] doc-lienzo/.test(RUTA_LTR)) {
    F("8 · la ruta del análisis LTR dejó de pintar su lienzo. Con el marco ya retirado, sin esto el informe queda sobre el gris de la app (§2).");
  }
  // 8b · y en STR, sin condición (12-sep-2026: el interruptor se retiró). Sin el lienzo,
  // medido en el DOM: wrapper y body #F6F6F7 contra tarjetas #F4F4F6.
  if (!/min-h-screen bg-\[var\(--franco-bg\)\] doc-lienzo/.test(RUTA_STR)) {
    F("8 · la ruta de STR no pinta el lienzo: con el marco retirado el informe queda sobre el gris de la app (§2).");
  }
  // 8c · NO lleva «doc-dictamen». Esa clase trae los doce tokens del informe, y «--card» es
  // TAMBIÉN un token de shadcn: puesta en el wrapper le cambiaba el valor a todo el
  // chrome de la página —de «40 20% 98%» en HSL a un hex— y «bg-card» pasaba a resolver
  // «hsl(#F4F4F6)», que es inválido. Se midió en el DOM antes de corregirlo.
  const wrapper = RUTA_LTR.match(/<div className="min-h-screen[^"]*">/)?.[0] ?? "";
  if (!wrapper) F("8 · no se encontró el wrapper de la ruta LTR");
  else if (/doc-dictamen|doc-tokens|doc-r2/.test(wrapper)) {
    F(`8 · el wrapper de la ruta LTR volvió a llevar la clase de los tokens: «${wrapper.slice(0, 90)}». Esa clase trae los doce tokens del informe, y «--card» es también de shadcn: le cambia el valor a TODO el chrome de la página y «bg-card» resuelve «hsl(#F4F4F6)», que es inválido.`);
  }
  // 8d · la regla pinta con el token, y el «body» va con ella: el wrapper es su
  // descendiente y no puede pintarlo. Hoy el wrapper cubre el documento entero, así que
  // el gris del body solo asoma en el rebote del scroll — pero asomar sigue siendo asomar.
  const regla = CSS.match(/\.doc-lienzo,\s*body:has\(\.doc-lienzo\)\{([^}]*)\}/)?.[1] ?? "";
  if (!regla) {
    F("8 · falta la regla del lienzo, o el «body:has(.doc-lienzo)» que la acompaña: sin el body, el gris de la app vuelve en el rebote del scroll");
  } else if (!/background:\s*var\(--page\)/.test(regla)) {
    F("8 · el lienzo dejó de pintarse con «--page»: el fondo de la página tiene que ser el MISMO token que el papel del informe, no un hex suelto que se desincroniza");
  }
  // 8e · y los dos valores que declara son los MISMOS del bloque de paleta. El lienzo no
  // puede reusar «.doc-dictamen» (8c), así que repite el hex: este chequeo es lo único que
  // impide que los dos se separen sin que nadie lo vea.
  const iL = CSS.indexOf(".doc-lienzo,");
  const trozoLienzo = iL === -1 ? "" : CSS.slice(iL, iL + 400);
  // Se ancla al BLOQUE por su nombre y no al selector: «.doc-dictamen,» sola aparece
  // varias veces en el archivo, y la primera no es la paleta.
  const iP = CSS.indexOf("REDISEÑO · PALETA");
  const trozoPaleta = iP === -1 ? "" : CSS.slice(iP, iP + 8000);
  for (const [tema, hex] of [["oscuro", "#0C0C0E"], ["claro", "#FFFFFF"]] as const) {
    if (!trozoLienzo.includes(`--page:${hex}`)) {
      F(`8 · el «--page» ${tema} del lienzo dejó de ser ${hex}. El lienzo repite el valor porque no puede reusar «.doc-dictamen» —le daría «--card» al chrome de la app—: si se separa del bloque de paleta, la página y el papel dejan de ser el mismo color.`);
    }
    if (!trozoPaleta.includes(`--page:${hex}`)) {
      F(`8 · el «--page» ${tema} del BLOQUE DE PALETA dejó de ser ${hex}: el lienzo lo repite, así que ahora los dos dicen cosas distintas y la página no es del color del papel.`);
    }
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPaletaRedisenoTier(): { hard: number } {
  console.log("\n─── TIER PALETA-REDISEÑO (contrato §1 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — escala completa en los dos temas, superficies distinguibles, cada línea se ve sobre la suya, la dirección sigue al tema, el par direccional --signal-red/--up se distingue y pasa AA, el semáforo del dato queda intacto, las flechas de hallazgo con el par direccional a 20 px y el color sin repartirse, el selector lleva las CUATRO formas, y el lienzo de la página LTR pinta --page sin llevarse la paleta del informe al chrome");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPaletaRedisenoTier();
  process.exit(hard ? 1 : 0);
}
