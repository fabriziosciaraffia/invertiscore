// ============================================================================
// GOLDEN · titular final nunca vacío — catch-test (goal #8 · 07-sep-2026). 0 tokens.
// ============================================================================
// Ejercita src/lib/titular-final.ts con lo que el pipeline no puede provocar a
// voluntad: un titular de 25 palabras cuyo retry no convergió. Antes de este goal la
// portada quedaba sin titular (A9 rojo, informe roto). Ahora el resolvedor devuelve
// un `string` por construcción y este test fija el orden de la cadena:
//   ia (válido) → reescrito (≤15 o 16-20) → escalón del original (16-20) → motor.
// Cada salida tiene que ser renderizable para el A9 (evaluarTitular ≠ invalido).
//
// Corre dentro del QUICK del runner (tier "titular") y standalone:
//   node --import tsx scripts/eval/golden/titular-final-catch-test.ts
// ============================================================================
import { resolverTitular, titularMotor, lineaFijaStr, direccionPreferidaTitular } from "../../../src/lib/titular-final";
import { evaluarTitular, stripMarcas } from "../../../src/lib/prosa-marcas";
import type { Hallazgo } from "../../../src/lib/types";

const palabras = (s: string): number => (stripMarcas(s).trim().match(/\S+/g) || []).length;
const pares = (s: string): number => (s.match(/\*\*/g) || []).length / 2;

/** Hallazgos mínimos con lo que usa ordenarHallazgosUnico (decisividad, magnitud,
 *  dirección, id) y el titular corto del motor. Espejo de 7710a017 y 17b4e10d. */
const hallazgo = (id: string, titular: string, decisividad: number, direccion: "adverso" | "favorable"): Hallazgo =>
  ({ id, titular, fraseCanonica: "", decisividad, magnitudContinua: 1, direccion }) as unknown as Hallazgo;

const FLUJO = hallazgo("flujo_mensual", "Pones algo de tu bolsillo cada mes.", 0.9, "adverso");
const SOBREPRECIO = hallazgo("sobreprecio", "Entras barato: el metro está bajo la mediana comunal.", 1, "favorable");
const CON_MONTO = hallazgo("cap_rate", "Te faltan $283.194 al mes.", 1, "adverso");
const RESPUESTA_AJUSTA = "Todavía no: tienes que ajustar los supuestos.";
// STR: ids reales de la pirámide (rentabilidad_str, ocupacion_vs_estimacion, ventaja_vs_ltr, flujo_str).
const STR_RENTABILIDAD_ADVERSA = hallazgo("rentabilidad_str", "La rentabilidad operativa se queda corta.", 1, "adverso");
const STR_RENTABILIDAD_FAVORABLE = hallazgo("rentabilidad_str", "El metro cuadrado rinde de sobra en corto.", 1, "favorable");
const STR_OCUPACION_ADVERSA = hallazgo("ocupacion_vs_estimacion", "Supusiste más ocupación que la que estima el mercado.", 1, "adverso");
const STR_VS_LTR = hallazgo("ventaja_vs_ltr", "El corto le saca ventaja clara al arriendo largo.", 0.68, "favorable");
const STR_FLUJO = hallazgo("flujo_str", "Pones plata de tu bolsillo todos los meses.", 0.28, "adverso");

const VEINTICINCO =
  "Buen depto pero **el arriendo no cubre la cuota** y además la comuna viene cara, el pie es corto y la tasa no ayuda nada.";
const DIECISIETE = "Buen depto pero **el arriendo no cubre la cuota** ni con tasa cero y el pie corto no ayuda.";
const DIECIOCHO = "El arriendo **no cubre la cuota** ni con tasa cero y además el pie corto no ayuda en nada.";
const VALIDO = "Buen depto, pero **el arriendo no cubre la cuota**: ajusta los supuestos.";

interface Caso { nombre: string; check: () => string | null }

const CASOS: Caso[] = [
  {
    nombre: "25 palabras + retry sin converger → titular del motor, portada no vacía",
    check: () => {
      if (palabras(VEINTICINCO) < 21) return `el fixture tiene ${palabras(VEINTICINCO)} palabras, no >20`;
      const r = resolverTitular({ original: VEINTICINCO, reescrito: null, veredicto: "AJUSTA SUPUESTOS", hallazgos: [SOBREPRECIO, FLUJO], respuestaFija: RESPUESTA_AJUSTA });
      if (r.via !== "motor") return `via ${r.via}, esperaba motor`;
      if (r.titular !== "**Ajustar.** Pones algo de tu bolsillo cada mes.") return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "25 palabras + reescrito de 17 → reescrito como largo renderizable",
    check: () => {
      const r = resolverTitular({ original: VEINTICINCO, reescrito: DIECISIETE, veredicto: "AJUSTA SUPUESTOS", hallazgos: [FLUJO], respuestaFija: RESPUESTA_AJUSTA });
      if (r.via !== "reescrito" || r.nivel !== "largo_renderizable") return `via ${r.via} / nivel ${r.nivel}`;
      if (r.titular !== DIECISIETE) return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "25 palabras + reescrito inválido (25 otra vez) → motor, no el reescrito",
    check: () => {
      const r = resolverTitular({ original: VEINTICINCO, reescrito: VEINTICINCO, veredicto: "BUSCAR OTRA", hallazgos: [FLUJO], respuestaFija: "No conviene." });
      if (r.via !== "motor") return `via ${r.via}`;
      if (r.titular !== "**Buscar otro.** Pones algo de tu bolsillo cada mes.") return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "18 palabras sin retry → escalón del original (largo renderizable)",
    check: () => {
      const r = resolverTitular({ original: DIECIOCHO, reescrito: null, veredicto: "AJUSTA SUPUESTOS", hallazgos: [FLUJO], respuestaFija: RESPUESTA_AJUSTA });
      if (r.via !== "escalon" || r.nivel !== "largo_renderizable") return `via ${r.via} / nivel ${r.nivel}`;
      return null;
    },
  },
  {
    nombre: "original válido → tal cual, via ia",
    check: () => {
      const r = resolverTitular({ original: VALIDO, reescrito: null, veredicto: "AJUSTA SUPUESTOS", hallazgos: [FLUJO], respuestaFija: RESPUESTA_AJUSTA });
      return r.via === "ia" && r.titular === VALIDO ? null : `via ${r.via} «${r.titular}»`;
    },
  },
  {
    nombre: "original con monto → motor; el hallazgo top con monto se salta al siguiente",
    check: () => {
      const r = resolverTitular({ original: "Te faltan **$283.194 al mes** para cerrar.", reescrito: null, veredicto: "COMPRAR", hallazgos: [CON_MONTO, SOBREPRECIO], respuestaFija: "Conviene." });
      if (r.via !== "motor") return `via ${r.via}`;
      if (r.titular !== "**Comprar.** Entras barato: el metro está bajo la mediana comunal.") return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "sin hallazgos → etiqueta + respuesta fija del motor",
    check: () => {
      const t = titularMotor({ veredicto: "AJUSTA SUPUESTOS", hallazgos: [], respuestaFija: RESPUESTA_AJUSTA });
      return t === "**Ajustar.** Todavía no: tienes que ajustar los supuestos." ? null : `«${t}»`;
    },
  },
  {
    nombre: "los tres veredictos sin hallazgos ni respuesta → nunca vacío",
    check: () => {
      for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]) {
        const r = resolverTitular({ original: null, reescrito: null, veredicto: v, hallazgos: null, respuestaFija: "" });
        if (!r.titular.trim()) return `${v}: vacío`;
      }
      return null;
    },
  },
  {
    nombre: "toda salida es renderizable para el A9 (≠ invalido) y con un solo plumón",
    check: () => {
      const salidas = [
        resolverTitular({ original: VEINTICINCO, reescrito: null, veredicto: "AJUSTA SUPUESTOS", hallazgos: [FLUJO], respuestaFija: RESPUESTA_AJUSTA }),
        resolverTitular({ original: VEINTICINCO, reescrito: DIECISIETE, veredicto: "AJUSTA SUPUESTOS", hallazgos: [FLUJO], respuestaFija: RESPUESTA_AJUSTA }),
        resolverTitular({ original: DIECIOCHO, reescrito: null, veredicto: "COMPRAR", hallazgos: [SOBREPRECIO], respuestaFija: "Conviene." }),
        resolverTitular({ original: "", reescrito: "", veredicto: "BUSCAR OTRA", hallazgos: [], respuestaFija: "No conviene." }),
      ];
      for (const r of salidas) {
        // Enforcement de tipo: `titular` es string, no string | null.
        const t: string = r.titular;
        if (evaluarTitular(t).nivel === "invalido") return `inválido: «${t}»`;
        if (r.via === "motor" && pares(t) !== 1) return `plumón: ${pares(t)} pares en «${t}»`;
        if (r.via === "motor" && palabras(t) > 15) return `${palabras(t)} palabras en «${t}»`;
      }
      return null;
    },
  },
  // ── STR (goal #8b · 07-sep-2026): misma cadena, orden de la pirámide STR, hallazgo en la
  // dirección del veredicto y línea fija STR como último recurso (espejo de efe52b6a y
  // eb7b3a66; los hallazgos STR reales llevan ids y direcciones como estos). ──
  {
    nombre: "STR · 25 palabras + retry sin converger → titular del motor, portada no vacía",
    check: () => {
      const r = resolverTitular({
        original: VEINTICINCO, reescrito: null, veredicto: "AJUSTA SUPUESTOS",
        hallazgos: [STR_RENTABILIDAD_ADVERSA, STR_VS_LTR, STR_FLUJO],
        respuestaFija: lineaFijaStr("AJUSTA SUPUESTOS"), orden: "str", direccionPreferida: direccionPreferidaTitular("AJUSTA SUPUESTOS"),
      });
      if (r.via !== "motor") return `via ${r.via}`;
      if (r.titular !== "**Ajustar.** La rentabilidad operativa se queda corta.") return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "STR · COMPRAR con 01 adverso → el titular toma el primer favorable",
    check: () => {
      const r = resolverTitular({
        original: VEINTICINCO, reescrito: null, veredicto: "COMPRAR",
        hallazgos: [STR_OCUPACION_ADVERSA, STR_RENTABILIDAD_FAVORABLE, STR_VS_LTR],
        respuestaFija: lineaFijaStr("COMPRAR"), orden: "str", direccionPreferida: direccionPreferidaTitular("COMPRAR"),
      });
      if (r.via !== "motor") return `via ${r.via}`;
      if (r.titular !== "**Comprar.** El metro cuadrado rinde de sobra en corto.") return `titular «${r.titular}»`;
      return null;
    },
  },
  {
    nombre: "STR · BUSCAR OTRA toma el adverso aunque un favorable ordene antes",
    check: () => {
      const r = resolverTitular({
        original: "", reescrito: null, veredicto: "BUSCAR OTRA",
        hallazgos: [STR_VS_LTR, STR_RENTABILIDAD_ADVERSA],
        respuestaFija: lineaFijaStr("BUSCAR OTRA"), orden: "str", direccionPreferida: direccionPreferidaTitular("BUSCAR OTRA"),
      });
      return r.titular === "**Buscar otro.** La rentabilidad operativa se queda corta." ? null : `titular «${r.titular}»`;
    },
  },
  {
    nombre: "STR · sin hallazgos → etiqueta + línea fija STR, los tres veredictos",
    check: () => {
      const esperado: Record<string, string> = {
        COMPRAR: "**Comprar.** En renta corta se sostiene solo.",
        "AJUSTA SUPUESTOS": "**Ajustar.** En renta corta cierra con un ajuste.",
        "BUSCAR OTRA": "**Buscar otro.** En renta corta no cierra.",
      };
      for (const [v, e] of Object.entries(esperado)) {
        const r = resolverTitular({ original: VEINTICINCO, reescrito: null, veredicto: v, hallazgos: [], respuestaFija: lineaFijaStr(v), orden: "str", direccionPreferida: direccionPreferidaTitular(v) });
        if (r.titular !== e) return `${v}: «${r.titular}»`;
        if (evaluarTitular(r.titular).nivel === "invalido" || pares(r.titular) !== 1) return `${v}: no renderizable «${r.titular}»`;
      }
      return null;
    },
  },
];

/** Tier para el runner: cada caso roto es una falla dura. */
export function runTitularFinalTier(): { hard: number } {
  console.log("\n─── TIER TITULAR (titular final nunca vacío · titular-final.ts, 0 tokens) ───");
  let hard = 0;
  for (const c of CASOS) {
    let err: string | null;
    try { err = c.check(); } catch (e) { err = `lanzó: ${(e as Error).message}`; }
    if (err) { hard += 1; console.log(`  ✗ ${c.nombre} — ${err}`); }
  }
  if (!hard) console.log(`  ✓ VERDE — ${CASOS.length} casos: la portada nunca queda sin titular`);
  return { hard };
}

if (require.main === module) {
  process.exit(runTitularFinalTier().hard ? 1 : 0);
}
