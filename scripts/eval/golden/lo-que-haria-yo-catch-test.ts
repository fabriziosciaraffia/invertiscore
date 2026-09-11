// ============================================================================
// GOLDEN · «LO QUE HARÍA YO» — catch-test del bloque determinista (10-sep-2026).
// ============================================================================
// El bloque deja de ser prosa y pasa a dibujar lo que el motor calcula. Este tier
// fija la FORMA por veredicto y los tres bordes del mix, que es donde el render se
// equivoca en silencio: dibujar un mix redundante, o inventar una fila cuando no
// hay ninguna palanca que cruce.
//
// Fija SIETE cosas:
//
//   1. EL RÓTULO NOMBRA EL DESTINO, SIEMPRE — también cuando el número es cero, y
//      ese destino es COMPRAR en los DOS veredictos. «…· dos llevan a Comprar» ·
//      «…· ninguno llega a Comprar». En BUSCAR OTRA el escalón intermedio a
//      Ajustar NO se nombra: nadie compra para quedar en Ajusta Supuestos. La
//      palabra «Ajustar» dentro del bloque es una falla dura, no un matiz — una
//      primera versión derivaba el destino de `veredictoObjetivo` y el escalón se
//      reintroducía solo.
//
//   2. EL CHIP DICE QUIÉN LA PONE. precio ⇒ el vendedor · arriendo ⇒ el mercado ·
//      pie y plazo ⇒ tú. Es la distinción que el bloque existe para hacer: no
//      cuánto cuesta cada palanca, sino de quién depende.
//
//   3. LOS 179 — ninguna palanca sola cruza y el mix sí. El mix pasa a ser el
//      CUERPO, y su título dice ADÓNDE DEJA, leído del `destino` que el motor
//      declara: «Para que deje de ser un no» cuando deja en un veredicto menor
//      que el del bloque, «La única vía para llegar a Comprar» cuando llega al
//      mismo. Sin contraste tachado (no hay solo-precio contra qué contrastar), y
//      cuando no pide descuento lo DICE —«sin pedirle un peso al vendedor»— en vez
//      de dejar el hueco, que no distingue «no pide» de «no se calculó».
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
//   7. EL DELTA FUERA DE RANGO ES EL CASO DOMINANTE de BUSCAR OTRA (574 de 592),
//      no un borde: se dice SIEMPRE, y NO como fila. Es `contexto` —una línea, con
//      su destino nombrado y su «fuera de todo rango»— porque es contexto y no
//      acción; dibujarlo con el peso de una palanca accionable deja al lector sin
//      saber cuál de los dos números mirar. Y su gemelo: una fila persistida SIN
//      la vía a COMPRAR medida (`palancasHastaComprar` ausente) no dibuja bloque —
//      decir «ninguna llega a Comprar» ahí sería publicar una medición que no
//      existe.
//
// Corre dentro del QUICK (tier "lo-que-haria-yo") y standalone:
//   node --import tsx scripts/eval/golden/lo-que-haria-yo-catch-test.ts
// ============================================================================
import { lineaNoDependeDeTi, construirLoQueHariaYo } from "../../../src/lib/lo-que-haria-yo";
import { buildHallazgoDistanciaVeredicto } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { HallazgoDistanciaVeredicto, HallazgoSensibilidad, Veredicto } from "../../../src/lib/types";

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

// ── 1 · el rótulo nombra el destino, y el destino es COMPRAR ────────────────
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
  else if (!/^Franco probó cada cambio por separado · /.test(conDos.rotulo)) F(`1 · se perdió el prefijo de la familia: «${conDos.rotulo}»`);

  // AJUSTA sin ninguna palanca sola (los 179) — el rótulo igual nombra el destino.
  const sinNinguna = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
    }),
  });
  if (!sinNinguna) F("1 · el bloque no se construyó para los 179");
  else if (!/ninguno llega a Comprar$/i.test(sinNinguna.rotulo)) F(`1 · rótulo de los 179 (AJUSTA): «${sinNinguna.rotulo}»`);

  // BUSCAR sin ninguna palanca sola — el destino es Comprar, NO el escalón a Ajustar.
  const buscarSinNinguna = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"),
    }),
  });
  if (!buscarSinNinguna) F("1 · el bloque no se construyó para los 179 en BUSCAR");
  else if (!/ninguno llega a Comprar$/i.test(buscarSinNinguna.rotulo)) F(`1 · rótulo de los 179 (BUSCAR): «${buscarSinNinguna.rotulo}»`);

  // BUSCAR con una palanca que llega a COMPRAR dentro del tope: la fila sale de la vía
  // hasta COMPRAR, y el verbo es «lleva a» —no «sube a», que era del escalón—.
  const buscarConUna = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => (p.precio != null && p.precio <= 2_850 ? "COMPRAR" : "BUSCAR OTRA"),
    }),
  });
  if (!buscarConUna) F("1 · el bloque no se construyó para BUSCAR con palanca hasta COMPRAR");
  else {
    if (!/una lleva a Comprar$/i.test(buscarConUna.rotulo)) F(`1 · rótulo BUSCAR con una hasta COMPRAR: «${buscarConUna.rotulo}»`);
    if (!buscarConUna.filas.some((f) => /precio/i.test(f.titulo))) F("1 · la palanca que llega a COMPRAR tiene que estar como fila");
  }
}

// ── 1b · GUARDA · la palabra «Ajustar» no vive dentro del bloque ────────────
{
  // El escalón intermedio va al pop-up, que es donde se puede explicar. Si vuelve a
  // colarse acá —por el rótulo, por el descarte o por el mix— es una falla dura.
  const casos = [
    bloque({
      veredicto: "BUSCAR OTRA",
      dist: distancia({ veredictoBase: "BUSCAR OTRA", regla: (p) => ((p.piePct ?? 20) >= 30 && (p.plazoCredito ?? 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") }),
    }),
    bloque({
      veredicto: "BUSCAR OTRA",
      dist: distancia({ veredictoBase: "BUSCAR OTRA", regla: (p) => (p.precio != null && p.precio <= 2_850 ? "COMPRAR" : "BUSCAR OTRA") }),
    }),
  ];
  for (const b of casos) {
    if (!b) continue;
    const texto = [b.rotulo, b.descarte ?? "", b.mix?.titulo ?? "", ...b.filas.map((f) => `${f.titulo} ${f.objetivo ?? ""}`)].join(" · ");
    if (/ajustar|ajusta supuestos/i.test(texto)) F(`1b · el escalón a Ajustar volvió al bloque: «${texto}»`);
  }
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
  // §5 revisado: la card ya no dibuja el chip por fila; la oración «Alternativamente: +X%
  // de arriendo o −Y% de precio» necesita el nombre llano, y «Pero eso no depende de ti:
  // lo pone …» sale de una sola función.
  const nombre = (t: RegExp) => b?.filas.find((f) => t.test(f.titulo))?.nombre;
  if (nombre(/precio/i) !== "precio") F(`2 · la fila del precio no lleva nombre llano «precio», dio «${nombre(/precio/i)}»`);
  if (nombre(/arriendo/i) !== "arriendo") F(`2 · la fila del arriendo no lleva nombre llano «arriendo», dio «${nombre(/arriendo/i)}»`);
  if (lineaNoDependeDeTi(["mercado", "vendedor"]) !== "Pero eso no depende de ti: lo pone el mercado o el vendedor.") F("2 · la línea con las dos palancas ajenas no dice «lo pone el mercado o el vendedor»");
  if (lineaNoDependeDeTi(["vendedor"]) !== "Pero eso no depende de ti: lo pone el vendedor.") F("2 · la línea con solo el precio no dice «lo pone el vendedor»");
  if (lineaNoDependeDeTi(["mercado"]) !== "Pero eso no depende de ti: lo pone el mercado.") F("2 · la línea con solo el arriendo no dice «lo pone el mercado»");
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
    if (sinDesc.mix.titulo !== "Para que deje de ser un no") F(`3a · desde BUSCAR el mix deja en un veredicto menor: «Para que deje de ser un no», dio «${sinDesc.mix.titulo}»`);
    if (sinDesc.mix.sinDescuento !== "Sin pedirle un peso al vendedor") F(`3a · sin descuento hay que DECIRLO donde iría la cifra, dio «${sinDesc.mix.sinDescuento}»`);
    if (sinDesc.mix.descuento !== null) F("3a · sin descuento no hay cifra de descuento que dibujar");
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
  else {
    if (conDesc.mix.titulo !== "Para que deje de ser un no") F(`3b · el título lo fija el DESTINO, no el descuento: dio «${conDesc.mix.titulo}»`);
    if (conDesc.mix.sinDescuento !== null) F("3b · con descuento manda la cifra, no la frase de «no pide»");
  }

  // (c) el MISMO mix, pero llegando a COMPRAR: el título cambia porque cambia el
  // destino que el motor declara, no porque cambie el veredicto base.
  const aComprar = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (x) => ((x.piePct ?? 20) >= 30 && (x.plazoCredito ?? 25) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
    }),
  });
  if (!aComprar?.mix) F("3c · el mix hacia COMPRAR tiene que dibujarse");
  else if (aComprar.mix.titulo !== "La única vía para llegar a Comprar") F(`3c · llegando al MISMO destino que el bloque el título lo nombra: dio «${aComprar.mix.titulo}»`);

  // (d) con palancas solas y el mismo destino, sigue siendo el «además» de siempre.
  const ademas = bloque({
    veredicto: "AJUSTA SUPUESTOS",
    dist: distancia({
      veredictoBase: "AJUSTA SUPUESTOS",
      regla: (x) => {
        const pie = x.piePct ?? 20, plazo = x.plazoCredito ?? 25;
        const desc = x.precio != null ? (1 - x.precio / 3_000) * 100 : 0;
        return desc >= 20 || (pie >= 30 && plazo >= 30 && desc >= 5) ? "COMPRAR" : "AJUSTA SUPUESTOS";
      },
    }),
  });
  if (ademas?.mix && ademas.filas.length > 0 && ademas.mix.titulo !== "Si además mueves lo tuyo, llegas a Comprar") {
    F(`3d · con palancas solas al mismo destino el mix es el «además»: dio «${ademas.mix.titulo}»`);
  }
}

// ── 3e · AUSENTE · el mix sin `destino` cae al veredicto objetivo ─────────
{
  // Fila persistida entre `fcfcbd98` y el goal del destino: el mix existe pero no dice
  // adónde deja. `veredictoObjetivo` ES el valor con que ese mismo mix se calculó, así
  // que el fallback no supone nada.
  //
  // El caso se toma desde AJUSTA a propósito: ahí el destino ES COMPRAR, y sin fallback
  // `undefined !== "COMPRAR"` da true y el título sale «Para que deje de ser un no» —o
  // sea, la fila más vieja del parque publicaría que el mix la deja en un veredicto
  // menor cuando la deja en el mayor. Desde BUSCAR este mismo test pasa con y sin
  // fallback, así que no probaría nada.
  const dist = distancia({
    veredictoBase: "AJUSTA SUPUESTOS",
    regla: (x) => ((x.piePct ?? 20) >= 30 && (x.plazoCredito ?? 25) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
  }) as HallazgoDistanciaVeredicto;
  const vieja = JSON.parse(JSON.stringify(dist)) as HallazgoDistanciaVeredicto;
  if (!vieja.valor.mixPalancas) F("3e · el caso necesita un mix para poder borrarle el destino");
  else delete vieja.valor.mixPalancas.destino;
  const b = bloque({ veredicto: "AJUSTA SUPUESTOS", dist: vieja });
  if (!b?.mix) F("3e · el mix sin `destino` igual se dibuja");
  else if (b.mix.titulo !== "La única vía para llegar a Comprar") F(`3e · sin destino manda el veredicto objetivo, que acá es COMPRAR: dio «${b.mix.titulo}»`);
}

// ── 4 · BORDE · mix REDUNDANTE ⇒ no se dibuja ──────────────────────────────
{
  // El plazo cruza SOLO hasta COMPRAR, así que el mix «plazo 25→30» repite esa misma fila.
  const b = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => ((p.plazoCredito ?? 25) >= 30 ? "COMPRAR" : "BUSCAR OTRA"),
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

// ── 7 · el delta FUERA DE RANGO — el caso dominante de BUSCAR OTRA ─────────
{
  // Ninguna palanca llega a COMPRAR dentro del tope de 15, pero el rango extendido sí
  // encuentra el número (−40% de precio). Son 574 de las 592: sin esta fila el 97% del
  // veredicto se queda con un rótulo que dice «ninguna llega» y nada más.
  const b = bloque({
    veredicto: "BUSCAR OTRA",
    dist: distancia({
      veredictoBase: "BUSCAR OTRA",
      regla: (p) => (p.precio != null && p.precio <= 1_800 ? "COMPRAR" : "BUSCAR OTRA"),
    }),
  });
  if (!b) F("7 · el bloque no se construyó para el delta fuera de rango");
  else {
    if (!b.contexto) F("7 · falta la línea de contexto con el delta fuera de rango");
    else {
      if (!/Comprar/.test(b.contexto)) F(`7 · el contexto nombra su destino: «${b.contexto}»`);
      if (!/fuera de todo rango/i.test(b.contexto)) F(`7 · el contexto dice que está fuera de todo rango: «${b.contexto}»`);
      if (!/menos de precio/i.test(b.contexto)) F(`7 · el contexto nombra la palanca y su dirección: «${b.contexto}»`);
      if (!/\d/.test(b.contexto)) F(`7 · el contexto lleva la cifra, no el umbral: «${b.contexto}»`);
    }
    // NO es una fila: con el mismo peso que una palanca accionable el lector no sabe
    // cuál mirar. Es contexto, y el mix de abajo es la acción.
    if (b.filas.length !== 0) F(`7 · el delta va como contexto, NO como fila: hay ${b.filas.length} fila(s)`);
    if (!/ninguno llega a Comprar$/i.test(b.rotulo)) F(`7 · el delta fuera de rango no cruza: el rótulo no puede contarlo — «${b.rotulo}»`);
  }
}

// ── 7b · fila VIEJA sin la vía a COMPRAR medida ⇒ no hay bloque ────────────
{
  // AUSENTE ≠ vacío. Si `palancasHastaComprar` es `undefined` nadie midió la vía a
  // COMPRAR, y publicar «ninguna llega a Comprar» sería afirmar una medición que no
  // existe. El bloque se calla y la prosa —que en BUSCAR OTRA sobrevive— queda sola.
  const dist = distancia({
    veredictoBase: "BUSCAR OTRA",
    regla: (p) => (p.precio != null && p.precio <= 2_850 ? "COMPRAR" : "BUSCAR OTRA"),
  }) as HallazgoDistanciaVeredicto;
  const vieja = JSON.parse(JSON.stringify(dist)) as HallazgoDistanciaVeredicto;
  delete vieja.valor.palancasHastaComprar;
  delete vieja.valor.viasHastaComprar;
  delete vieja.valor.deltaMinimoComprarFueraDeTope;
  const b = bloque({ veredicto: "BUSCAR OTRA", dist: vieja });
  if (b !== null) F(`7b · sin la vía a COMPRAR medida el bloque no se dibuja, dio «${b.rotulo}»`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runLoQueHariaYoTier(): { hard: number } {
  console.log("\n─── TIER LO-QUE-HARÍA-YO (el bloque determinista · lo-que-haria-yo.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el destino es Comprar en los dos veredictos, el mix dice adónde deja, la cifra imposible va de contexto y no de fila, y la fila vieja se calla");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runLoQueHariaYoTier();
  process.exit(hard ? 1 : 0);
}
