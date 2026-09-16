/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · UN PATCH QUE EMPEORA NO SE PRUEBA — catch-test (16-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// LA REGLA, que es más grande que este caso:
//
//   Un patch que EMPEORA el caso no puede cruzar hacia un veredicto mejor. Todas las
//   dimensiones del Franco Score son monótonas crecientes en el NOI, así que bajar el
//   ingreso neto solo puede dejar el veredicto igual o peor. Cualquier rama que contemple
//   ese cruce es código muerto, y cualquier frase que reporte ese intento como una vía
//   explorada está reportando un empeoramiento como prueba.
//
// Van TRES ramas muertas de esta familia, todas en la gestión:
//   1. `difAutoAdmin > 0 ? "más" : "menos"` en el prompt STR — la rama «menos» nunca corre;
//   2. `flipGestion.recomendacionAdmin` mejor que `recomendacionAuto` — 0 de 252;
//   3. la palanca `gestion` hacia administrador — 0 de 253, y la que este tier fija.
//
// Y `gestion` es la ÚNICA palanca BIDIRECCIONAL del repo: precio solo baja, tarifa y arriendo
// solo suben, plazo y pie solo suben, y el builder LTR no tiene palanca de gestión. Por eso es
// la única donde este modo de falla existe — y por eso el día que alguien agregue otra palanca
// bidireccional, esto es lo que hay que mirar.
//
// Fija TRES cosas, todas sobre COMPORTAMIENTO:
//
//   1. CON EL CASO EN AUTO, EL BUILDER NUNCA SONDA `modoGestion: "administrador"`. No es que
//      la pruebe y falle: no la prueba. Se verifica con una sonda MENTIROSA que devuelve
//      COMPRAR a todo — si el builder preguntara, la palanca cruzaría; como no pregunta, no.
//   2. CON EL CASO EN ADMINISTRADOR, SÍ SONDA `modoGestion: "auto"`. Ahí el patch SACA un
//      costo que el usuario hoy paga, y esa prueba es real.
//   3. EL TRAMO DE GESTIÓN ENTRA A LA FRASE ESTRUCTURAL SOLO SI EL CASO NO ESTÁ EN AUTO.
//      Con el caso en auto decía «ni con administrador cambia» — cierto y vacío: que agregarle
//      una comisión del 20% no mejore el veredicto no es una vía descartada. Medido: de las
//      104 filas estructurales que lo llevaban, 100 (96,2%) eran ese lado.
//
// Corre standalone:
//   node --import tsx scripts/eval/golden/patch-que-empeora-catch-test.ts
// ============================================================================
import { buildHallazgoDistanciaVeredictoStr } from "../../../src/lib/distancia-veredicto-str-hallazgo";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

/** Arma el hallazgo con una sonda que REGISTRA todos los patches que recibe. */
function construir(modo: "auto" | "administrador", veredictoDeLaSonda: any) {
  const patches: any[] = [];
  const h = buildHallazgoDistanciaVeredictoStr({
    veredictoBase: "BUSCAR OTRA",
    score: 42,
    precioUF: 4000,
    precioCLP: 160_000_000,
    adrActual: 60_000,
    modoGestionActual: modo,
    comisionAutoDec: 0.03,
    comisionAdminDec: 0.2,
    plazoCredito: 25,
    piePct: 20,
    sondaAtPatch: (patch: any) => {
      patches.push(patch);
      return { veredicto: veredictoDeLaSonda, retornoPct: 0 } as any;
    },
    motivosGate: [],
  } as any);
  return { h, patches };
}

// ── 1 · con el caso en AUTO no se sonda la dirección que empeora ────────────
// LA SONDA MIENTE A PROPÓSITO: devuelve COMPRAR a cualquier patch. Si el builder preguntara
// por «administrador», la palanca cruzaría. Que no cruce prueba que NO PREGUNTA — que es otra
// cosa que «preguntó y le dijeron que no».
{
  const { h, patches } = construir("auto", "COMPRAR");
  const sondoAdmin = patches.some((p) => p?.modoGestion === "administrador");
  if (sondoAdmin) F("1 · con el caso en AUTO el builder sondeó `modoGestion: \"administrador\"`, que no puede cruzar");

  const via = (h?.valor?.vias ?? []).find((v: any) => v.palanca === "gestion");
  if (!via) F("1 · la vía de gestión desapareció: tiene que seguir emitiéndose (el contrato es de CINCO vías)");
  else if (via.estado === "cruza") F("1 · la palanca cruzó hacia administrador con una sonda mentirosa: el corto-circuito no está");

  const pal = (h?.valor?.palancas ?? []).find((p: any) => p.palanca === "gestion");
  if (pal) F("1 · con el caso en AUTO entró una palanca de gestión a `palancas`");
}

// ── 2 · con el caso en ADMINISTRADOR sí se prueba sacar el costo ────────────
{
  const { h, patches } = construir("administrador", "COMPRAR");
  if (!patches.some((p) => p?.modoGestion === "auto")) {
    F("2 · con el caso en ADMINISTRADOR el builder NO sondeó la autogestión: ahí el patch saca un costo real");
  }
  const pal = (h?.valor?.palancas ?? []).find((p: any) => p.palanca === "gestion");
  if (!pal) F("2 · con la sonda diciendo COMPRAR, la palanca de gestión tenía que cruzar y no cruzó");
  else if (pal.modoGestionObjetivo !== "auto") F(`2 · la palanca apunta a «${pal.modoGestionObjetivo}» y solo puede apuntar a «auto»`);
}

// ── 3 · el tramo de gestión en la frase estructural ─────────────────────────
// Con la sonda diciendo siempre BUSCAR OTRA no cruza NADA: el caso es estructural y la frase
// enumera lo que se probó sin éxito.
{
  const enAuto = construir("auto", "BUSCAR OTRA").h;
  const enAdmin = construir("administrador", "BUSCAR OTRA").h;

  if (!enAuto?.valor?.esEstructural) F("3 · el fixture en AUTO no salió estructural: la aserción de abajo no mediría nada");
  if (!enAdmin?.valor?.esEstructural) F("3 · el fixture en ADMINISTRADOR no salió estructural");

  const fAuto = String(enAuto?.fraseCanonica ?? "");
  const fAdmin = String(enAdmin?.fraseCanonica ?? "");

  if (/ni con administrador|con administrador cambia/i.test(fAuto)) {
    F(`3 · con el caso en AUTO la frase reporta «con administrador» como vía probada: ${fAuto.slice(0, 160)}`);
  }
  if (!/autogestionando/i.test(fAdmin)) {
    F(`3 · con el caso en ADMINISTRADOR se perdió el tramo real («ni autogestionando cambia»): ${fAdmin.slice(0, 160)}`);
  }
}

// ── PISO DE COBERTURA ───────────────────────────────────────────────────────
// Sin esto, un builder que devolviera `null` a todo dejaría las tres aserciones en verde:
// «no sondeó administrador» y «la frase no dice con administrador» se cumplen trivialmente
// cuando NO HAY HALLAZGO. Es el cero de medición que no distingue «no corrió».
{
  const casos = [
    ["auto/COMPRAR", construir("auto", "COMPRAR")],
    ["admin/COMPRAR", construir("administrador", "COMPRAR")],
    ["auto/BUSCAR", construir("auto", "BUSCAR OTRA")],
    ["admin/BUSCAR", construir("administrador", "BUSCAR OTRA")],
  ] as const;
  for (const [k, { h, patches }] of casos) {
    if (!h) F(`PISO · el fixture ${k} devolvió null: el builder no corrió`);
    if (!patches.length) F(`PISO · el fixture ${k} no sondeó NADA: el builder no exploró ninguna palanca`);
    if (h && !(h.valor?.vias ?? []).length) F(`PISO · el fixture ${k} no emitió ninguna vía`);
  }
}

export function runPatchQueEmpeoraTier(): { hard: number } {
  console.log("\n─── TIER PATCH-QUE-EMPEORA (la dirección que empeora no se prueba · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — con el caso en auto el builder no sonda «administrador» ni con una sonda mentirosa, con el caso en administrador sí sonda la autogestión, y el tramo de gestión entra a la frase estructural solo del lado que probó sacar un costo real");
  } else {
    for (const m of fallas) console.log(`  ✗ ${m}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPatchQueEmpeoraTier();
  process.exit(hard ? 1 : 0);
}
