// ============================================================================
// GOLDEN · «LO QUE HARÍA YO» — catch-test del bloque determinista (10-sep-2026).
// ============================================================================
// El bloque deja de ser prosa y pasa a dibujar lo que el motor calcula. Este tier
// fija la FORMA por veredicto y los tres bordes del mix, que es donde el render se
// equivoca en silencio: dibujar un mix redundante, o inventar una fila cuando no
// hay ninguna palanca que cruce.
//
// Fija SEIS cosas:
//
//   1. EL RÓTULO NOMBRA EL DESTINO, SIEMPRE — también cuando el número es cero.
//      «…· dos llevan a Comprar» · «…· ninguna llega a Comprar» · «…· dos suben a
//      Ajustar» · «…· ninguna llega a Ajustar». Un rótulo que dice «Franco probó
//      las palancas» a secas no dice hacia dónde mueve, que es lo único que
//      importa.
//
//   2. EL CHIP DICE QUIÉN LA PONE. precio ⇒ el vendedor · arriendo ⇒ el mercado ·
//      pie y plazo ⇒ tú. Es la distinción que el bloque existe para hacer: no
//      cuánto cuesta cada palanca, sino de quién depende.
//
//   3. LOS 179 — ninguna palanca sola cruza y el mix sí. El mix pasa a ser el
//      CUERPO: título «La única salida» cuando no pide descuento, «La salida,
//      combinando» cuando sí, y SIN contraste tachado (no hay solo-precio contra
//      qué contrastar). El descarte lista las cuatro.
//
//   4. BORDE · MIX REDUNDANTE ⇒ NO SE DIBUJA. Si el mix repite una palanca que ya
//      está en las filas, dibujarlo es decir dos veces lo mismo con otro nombre.
//      La pieza lo marca (`redundanteConPalancaSola`) y el render obedece.
//
//   5. BORDE · SIN MIX ⇒ sin bloque de mix, y el descarte sigue.
//      BORDE · MIX DE UNA PALANCA (plazo en el máximo) ⇒ el movimiento nombra solo
//      la que se mueve, nunca «plazo 30 → 30 años».
//
//   6. COMPRAR — sin mix y sin descarte. Dos filas: el margen que aguanta (lo pone
//      el mercado) y el arriendo a verificar (lo pones tú).
//
// Corre dentro del QUICK (tier "lo-que-haria-yo") y standalone:
//   node --import tsx scripts/eval/golden/lo-que-haria-yo-catch-test.ts
// ============================================================================
import { construirLoQueHariaYo } from "../../../src/lib/lo-que-haria-yo";
import { buildHallazgoDistanciaVeredicto } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { HallazgoSensibilidad, Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
type Patch = { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number };

function distancia(o: { veredictoBase: Veredicto; piePct?: number; plazoCredito?: number; regla: (p: Patch) => Veredicto }) {
  return buildHallazgoDistanciaVeredicto({
    veredictoBase: o.veredictoBase,
    arriendo: 500_000,
    precioUF: 3_000,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    veredictoAtPatch: o.regla,
    brazosGate1Activos: [],
    modalidad: "ltr",
  });
}

function bloque(o: { veredicto: Veredicto; dist?: ReturnType<typeof distancia>; sens?: HallazgoSensibilidad | null }) {
  return construirLoQueHariaYo({
    veredicto: o.veredicto,
    distancia: o.dist ?? null,
    sensibilidad: o.sens ?? null,
    arriendoDeclaradoCLP: 500_000,
    currency: "CLP",
    valorUF: 39_000,
  });
}

const sensibilidad = (marginPct: number): HallazgoSensibilidad => ({
  id: "sensibilidad",
  tipo: "robustez_veredicto",
  valor: {
    marginPct, firme: marginPct >= 50, veredictoBase: "COMPRAR", veredictoNuevo: "AJUSTA SUPUESTOS",
    corteAdverso: 7, corteFavorable: 15, banda: 25, modalidad: "ltr",
  },
  titular: "", fraseCanonica: "", direccion: "favorable", decisividad: 0,
  procedencia: { base: "", confianza: "alta" },
} as unknown as HallazgoSensibilidad);

// ── 1 · el rótulo nombra el destino, también cuando es cero ─────────────────
{
  // AJUSTA con dos palancas que cruzan a COMPRAR.
  const conDos = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (p) => (p.precio != null && p.precio <= 2_800 ? "COMPRAR" : p.arriendo != null && p.arriendo >= 560_000 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
    }),
  });
  if (!conDos) F("1 · el bloque no se construyó para AJUSTA con palancas");
  else if (!/dos llevan a Comprar$/i.test(conDos.rotulo)) F(`1 · rótulo AJUSTA con dos: «${conDos.rotulo}»`);
  else if (!/^Franco probó cada palanca sola · /.test(conDos.rotulo)) F(`1 · se perdió el prefijo de la familia: «${conDos.rotulo}»`);

  // AJUSTA sin ninguna palanca sola (los 179) — el rótulo igual nombra el destino.
  const sinNinguna = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
    }),
  });
  if (!sinNinguna) F("1 · el bloque no se construyó para los 179");
  else if (!/ninguna llega a Comprar$/i.test(sinNinguna.rotulo)) F(`1 · rótulo de los 179 (AJUSTA): «${sinNinguna.rotulo}»`);

  // BUSCAR sin ninguna palanca sola.
  const buscarSinNinguna = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
    }),
  });
  if (!buscarSinNinguna) F("1 · el bloque no se construyó para los 179 en BUSCAR");
  else if (!/ninguna llega a Ajustar$/i.test(buscarSinNinguna.rotulo)) F(`1 · rótulo de los 179 (BUSCAR): «${buscarSinNinguna.rotulo}»`);
}

// ── 2 · el chip dice quién la pone ──────────────────────────────────────────
{
  const b = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (p) =>
        p.precio != null && p.precio <= 2_800 ? "COMPRAR"
        : p.arriendo != null && p.arriendo >= 560_000 ? "COMPRAR"
        : (p.piePct ?? 20) >= 25 ? "COMPRAR"
        : "AJUSTA SUPUESTOS",
    }),
  });
  const quien = (t: RegExp) => b?.filas.find((f) => t.test(f.titulo))?.quien;
  if (quien(/precio/i) !== "vendedor") F(`2 · el precio lo pone el vendedor, dio «${quien(/precio/i)}»`);
  if (quien(/arriendo/i) !== "mercado") F(`2 · el arriendo lo pone el mercado, dio «${quien(/arriendo/i)}»`);
  if (quien(/pie/i) !== "tuyo") F(`2 · el pie lo pones tú, dio «${quien(/pie/i)}»`);
}

// ── 3 · LOS 179 · el mix es el cuerpo ───────────────────────────────────────
{
  // (a) sin descuento ⇒ «La única salida», sin contraste.
  const sinDesc = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
    }),
  });
  if (!sinDesc?.mix) F("3a · los 179 sin descuento: el mix tiene que dibujarse, es el cuerpo");
  else {
    if (sinDesc.mix.titulo !== "La única salida") F(`3a · sin descuento el título es «La única salida», dio «${sinDesc.mix.titulo}»`);
    if (sinDesc.mix.contraste !== null) F("3a · sin solo-precio que cruce NO hay contraste tachado que dibujar");
    if (sinDesc.filas.length !== 0) F(`3a · ninguna palanca sola cruza: no puede haber filas, hay ${sinDesc.filas.length}`);
    if (!sinDesc.descarte || !/precio/i.test(sinDesc.descarte)) F(`3a · el descarte tiene que listar las cuatro: «${sinDesc.descarte}»`);
  }
  // (b) con descuento ⇒ «La salida, combinando».
  const conDesc = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => {
        const pie = p.piePct ?? 20, plazo = p.plazoCredito ?? 25;
        const desc = p.precio != null ? (1 - p.precio / 3_000) * 100 : 0;
        return pie >= 30 && plazo >= 30 && desc >= 5 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      },
    }),
  });
  if (!conDesc?.mix) F("3b · con descuento el mix tiene que dibujarse");
  else if (conDesc.mix.titulo !== "La salida, combinando") F(`3b · con descuento el título es «La salida, combinando», dio «${conDesc.mix.titulo}»`);
}

// ── 4 · BORDE · mix REDUNDANTE ⇒ no se dibuja ──────────────────────────────
{
  // El plazo cruza SOLO, así que el mix «plazo 25→30» repite esa misma fila.
  const b = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => ((p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
    }),
  });
  if (!b) F("4 · el bloque no se construyó");
  else {
    if (b.filas.length === 0) F("4 · el plazo cruza solo: tiene que estar como fila");
    if (b.mix !== null) F("4 · el mix repite la palanca de plazo que ya está arriba: NO se dibuja");
  }
}

// ── 5 · BORDES · sin mix, y mix de UNA palanca ─────────────────────────────
{
  // (a) Nada cruza, ni combinando ⇒ sin mix, y el descarte sigue.
  const nada = bloque({ veredicto: "BUSCAR OTRA", dist: distancia({ veredictoBase: "BUSCAR OTRA", regla: () => "BUSCAR OTRA" }) });
  if (!nada) F("5a · el bloque no se construyó");
  else {
    if (nada.mix !== null) F("5a · ninguna combinación cruza: el mix debe ser null");
    if (!nada.descarte) F("5a · sin mix el descarte igual va: es lo único que queda por decir");
  }
  // (b) Plazo en el máximo ⇒ el movimiento nombra solo el pie.
  const unaPalanca = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      plazoCredito: 30,
      piePct: 8,
      // El pie NO cruza solo (haría falta 30); combinando con el precio, sí.
      regla: (p) => {
        const pie = p.piePct ?? 8;
        const desc = p.precio != null ? (1 - p.precio / 3_000) * 100 : 0;
        return pie >= 18 && desc >= 5 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      },
    }),
  });
  if (unaPalanca?.mix) {
    if (unaPalanca.mix.movimiento.plazo !== null) F("5b · el plazo ya está en el máximo: no puede aparecer en el movimiento");
    if (unaPalanca.mix.movimiento.pie === null) F("5b · el pie sí se mueve: tiene que aparecer");
  }
}

// ── 5c · el descarte NO nombra las que no se probaron ──────────────────────
{
  // Plazo en 30 ⇒ su vía es `noAplica`, no `noCruza`. Decir «el plazo, por separado, no
  // alcanza» sobre algo que no se probó es afirmar una medición que no existe.
  const b = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      plazoCredito: 30,
      regla: (p) => (p.precio != null && p.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
    }),
  });
  if (b?.descarte && /plazo/i.test(b.descarte)) {
    F(`5c · el plazo ya está en el máximo (noAplica): no puede aparecer en el descarte — «${b.descarte}»`);
  }
}

// ── 6 · COMPRAR — sin mix y sin descarte ───────────────────────────────────
{
  const b = bloque({ veredicto: "COMPRAR", dist: null, sens: sensibilidad(7.5) });
  if (!b) F("6 · COMPRAR también dibuja el bloque");
  else {
    if (b.mix !== null) F("6 · en COMPRAR no hay mix");
    if (b.descarte !== null) F("6 · en COMPRAR no hay descarte: no hay palanca que subir");
    if (b.filas.length !== 2) F(`6 · COMPRAR tiene dos filas (margen y arriendo), tiene ${b.filas.length}`);
    const arr = b.filas.find((f) => /arriendo/i.test(f.titulo));
    if (arr && arr.quien !== "tuyo") F(`6 · el arriendo a verificar lo pusiste tú, dio «${arr.quien}»`);
    const margen = b.filas.find((f) => /aguanta/i.test(f.titulo));
    if (margen && margen.quien !== "mercado") F(`6 · el margen lo pone el mercado, dio «${margen.quien}»`);
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runLoQueHariaYoTier(): { hard: number } {
  console.log("\n─── TIER LO-QUE-HARÍA-YO (el bloque determinista · lo-que-haria-yo.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el rótulo nombra el destino, el chip dice quién la pone, el mix es cuerpo en los 179, y los tres bordes");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLoQueHariaYoTier();
  process.exit(hard ? 1 : 0);
}
