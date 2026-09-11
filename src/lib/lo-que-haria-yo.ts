// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE HARÍA YO» — el bloque deja de ser prosa (10-sep-2026)
//
// El motor ya calcula las cuatro vías, el salto de dos bandas y el mix; hasta hoy
// el bloque no leía nada de eso y mostraba un párrafo. Esta pieza lo convierte en
// datos: quién pone cada palanca, cuánto pide y adónde llega.
//
// LA DISTINCIÓN QUE EL BLOQUE EXISTE PARA HACER no es cuánto cuesta cada palanca:
// es DE QUIÉN DEPENDE. El precio lo pone el vendedor, el arriendo lo pone el
// mercado, y el pie y el plazo los pones tú. Por eso el chip va al lado del nombre
// y no al final: es lo primero que hay que saber de cada fila.
//
// Función PURA y sin JSX a propósito: la forma se testea con un catch-test
// determinista (0 tokens, sin base) y el componente solo la dibuja.
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto, HallazgoSensibilidad, PalancaDistancia, Veredicto } from "./types";
import { etiquetaVeredicto } from "./veredicto-etiqueta";

/** Quién tiene que mover la palanca. Es el eje del bloque, no un adorno. */
export type QuienLaPone = "vendedor" | "mercado" | "tuyo";

export interface FilaLoQueHariaYo {
  titulo: string;
  quien: QuienLaPone;
  /** La magnitud, a la derecha ("−24,1%" · "8% → 22%" · "30 años"). */
  cifra: string;
  /** El valor objetivo, bajo la cifra ("UF 4.175"). null cuando la cifra ya lo dice. */
  objetivo: string | null;
  /**
   * Rótulo de UNA palabra para la columna fija de la ecuación (contrato §5). El
   * `titulo` es una frase —«Cuánto aguanta el veredicto»— y en una columna de 96 px se
   * parte en tres líneas. Solo lo llevan las filas de COMPRAR, que son las únicas que
   * se dibujan como ecuación sin mix. `null` ⇒ se usa el `titulo`.
   */
  rotuloCorto?: string | null;
}

export interface MixLoQueHariaYo {
  titulo: string;
  /** null en la dimensión que no se mueve — nunca «plazo 30 → 30 años». */
  movimiento: { pie: { de: number; a: number } | null; plazo: { de: number; a: number } | null };
  /** El tachado. null cuando el solo-precio NO cruza: no hay contra qué contrastar. */
  contraste: { de: string; a: string } | null;
  /** Plata propia extra el día uno. null cuando el mix no mueve el pie. */
  costo: string | null;
  /** El descuento que el mix sí pide, ya formateado. null si no pide ninguno. */
  descuento: string | null;
  /**
   * Qué se dice DONDE IRÍA EL DESCUENTO cuando el mix no pide ninguno. Hoy ahí no se
   * dibujaba nada, y un hueco no distingue «no pide» de «no se calculó» — que es
   * justamente la mitad que importa del hallazgo: la salida no cuesta negociación,
   * cuesta capital. null cuando sí hay descuento y la cifra ocupa ese lugar.
   */
  sinDescuento: string | null;
  /**
   * ADÓNDE DEJA el mix, como veredicto. Es EXACTAMENTE el mismo valor del que ya sale
   * `titulo` (`m.destino ?? dv.veredictoObjetivo`): no se calcula nada nuevo, se expone
   * lo que el título ya decía en palabras para que la fila «Resultado» del contrato §5
   * pueda dibujar la transición sin adivinarla. Si un día el destino deja de ser
   * COMPRAR, la fila lo dice en vez de mentir.
   */
  destino: Veredicto;
}

export interface BloqueLoQueHariaYo {
  rotulo: string;
  /**
   * La cifra IMPOSIBLE, en una línea chica y sobre el mix. No es una fila y no debe
   * dibujarse como tal: es CONTEXTO —«esto no se arregla negociando»—, mientras que el
   * mix de abajo es la ACCIÓN. Con el mismo peso visual el lector no sabe cuál mirar, y
   * la que manda es la que puede ejecutar. null cuando no hay número fuera de rango.
   */
  contexto: string | null;
  filas: FilaLoQueHariaYo[];
  mix: MixLoQueHariaYo | null;
  /** Las que no alcanzan, en UNA línea. null en COMPRAR. */
  descarte: string | null;
}

const QUIEN: Record<PalancaDistancia["palanca"], QuienLaPone> = {
  precio: "vendedor",
  arriendo: "mercado",
  adr: "mercado",
  pie: "tuyo",
  plazo: "tuyo",
  gestion: "tuyo",
};

const NOMBRE_SUBIR: Record<string, string> = {
  precio: "Bajar el precio",
  arriendo: "Subir el arriendo",
  adr: "Subir la tarifa",
  pie: "Subir el pie",
  plazo: "Estirar el plazo",
  gestion: "Cambiar la gestión",
};

const NOMBRE_LLANO: Record<string, string> = {
  precio: "precio", arriendo: "arriendo", adr: "tarifa", pie: "pie", plazo: "plazo", gestion: "gestión",
};

const pct1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
const signo = (n: number) => (n < 0 ? "−" : "+");
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** El destino del bloque, SIEMPRE. Ver «EL DESTINO ES COMPRAR» más abajo.
 *  Sale de la fuente única y no de un literal: la etiqueta que lee el usuario vive
 *  en `veredicto-etiqueta.ts` y en ningún otro lado (goal 10a). */
const DESTINO = etiquetaVeredicto("COMPRAR", "frase");

/** Une con comas y una "y" final: «Precio, arriendo, plazo y pie». */
function enumerar(xs: string[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

export function construirLoQueHariaYo(p: {
  veredicto: Veredicto;
  distancia: HallazgoDistanciaVeredicto | null;
  sensibilidad: HallazgoSensibilidad | null;
  arriendoDeclaradoCLP: number;
  currency: "CLP" | "UF";
  valorUF: number;
}): BloqueLoQueHariaYo | null {
  const plata = (clp: number) =>
    p.currency === "UF" ? `UF ${miles(clp / (p.valorUF || 1))}` : `$${miles(clp)}`;
  const enUF = (uf: number) => (p.currency === "UF" ? `UF ${miles(uf)}` : `$${miles(uf * (p.valorUF || 1))}`);

  // ── COMPRAR ───────────────────────────────────────────────────────────────
  // Sin mix y sin descarte: no hay palanca que subir. Dos filas — cuánto aguanta
  // antes de bajar (lo pone el mercado) y qué verificar antes de firmar (lo pones
  // tú, porque el arriendo lo declaraste tú).
  if (p.veredicto === "COMPRAR") {
    const filas: FilaLoQueHariaYo[] = [];
    const s = p.sensibilidad?.valor;
    if (s) {
      filas.push({
        titulo: "Cuánto aguanta el veredicto",
        rotuloCorto: "Aguanta",
        quien: "mercado",
        cifra: s.firme ? "−50% o más" : `−${pct1(s.marginPct)}%`,
        objetivo: null,
      });
    }
    if (p.arriendoDeclaradoCLP > 0) {
      filas.push({
        titulo: "Verifica el arriendo",
        rotuloCorto: "Verifica",
        quien: "tuyo",
        cifra: plata(p.arriendoDeclaradoCLP),
        objetivo: "lo declaraste tú",
      });
    }
    if (filas.length === 0) return null;
    return { rotulo: "Antes de firmar", contexto: null, filas, mix: null, descarte: null };
  }

  const dv = p.distancia?.valor;
  if (!dv) return null;

  // ── EL DESTINO ES COMPRAR, EN LOS DOS VEREDICTOS ──────────────────────────
  // En AJUSTA SUPUESTOS el destino es el veredicto inmediatamente superior y no hay
  // nada que decidir. En BUSCAR OTRA sí lo había, y la decisión está tomada
  // (10-sep-2026): el bloque muestra lo que lleva a COMPRAR, aunque sea inviable, y NO
  // el escalón intermedio a Ajustar. El motivo es de producto, no de código: nadie
  // compra para quedar en Ajusta Supuestos. Por qué se escribe: una primera versión
  // derivaba el destino de `veredictoObjetivo`, que en BUSCAR OTRA es AJUSTA, y el
  // escalón se reintroducía solo. La razón por la que una palanca no alcanza vive en el
  // pop-up, que es donde se puede explicar.
  const esBuscar = dv.veredictoBase === "BUSCAR OTRA";

  // ⚠ AUSENTE ≠ VACÍO. En una fila persistida antes del salto de dos bandas,
  // `palancasHastaComprar` es `undefined`: nadie midió la vía a COMPRAR. Leerla como
  // lista vacía haría que el rótulo publicara «ninguna llega a Comprar», o sea una
  // medición que no existe. Ahí el bloque no se dibuja y la prosa —que en BUSCAR OTRA
  // sobrevive al bloque— queda sola, que es exactamente lo que hacía antes de todo esto.
  if (esBuscar && !Array.isArray(dv.palancasHastaComprar)) return null;

  // ── EL RÓTULO — nombra el DESTINO, también cuando el número es cero ────────
  // «Franco probó las palancas» a secas no dice hacia dónde mueve, que es lo único
  // que el lector necesita. Y la familia se lee en serie a lo largo del informe, así
  // que el prefijo no cambia: lo que cambia es la segunda mitad.
  const cruzan = (esBuscar ? dv.palancasHastaComprar : dv.palancas) ?? [];
  const n = cruzan.length;
  const cantidad = n === 1 ? "una" : n === 2 ? "dos" : n === 3 ? "tres" : "cuatro";
  // «Cada palanca sola» era idioma NUESTRO en la línea más ruidosa del informe. El
  // lector no dice palanca: dice cambio, y dice por separado. Misma regla que se aplicó
  // a las ocho superficies del pop-up y la card (10-sep-2026).
  const rotulo =
    n === 0
      ? `Franco probó cada cambio por separado · ninguno llega a ${DESTINO}`
      : `Franco probó cada cambio por separado · ${cantidad} ${n === 1 ? "lleva a" : "llevan a"} ${DESTINO}`;

  // ── LAS FILAS — solo las que cruzan, en el orden del motor ────────────────
  const filas: FilaLoQueHariaYo[] = cruzan.map((l) => {
    const quien = QUIEN[l.palanca] ?? "tuyo";
    const titulo = NOMBRE_SUBIR[l.palanca] ?? l.palanca;
    // El PIE va en puntos, no en cambio relativo (0% → 26% no tiene relativo), así que
    // su cifra es el recorrido y no lleva objetivo debajo. El plazo, ídem: son años.
    if (l.palanca === "pie") return { titulo, quien, cifra: `${pct1(l.actual)}% → ${pct1(l.objetivo)}%`, objetivo: null };
    if (l.palanca === "plazo") return { titulo, quien, cifra: `${l.objetivo} años`, objetivo: null };
    const cifra = `${signo(l.deltaPct)}${pct1(Math.abs(l.deltaPct))}%`;
    const objetivo = l.palanca === "precio" ? enUF(l.objetivo) : plata(l.objetivo);
    return { titulo, quien, cifra, objetivo };
  });

  // ── EL CONTEXTO — la cifra IMPOSIBLE, chica y arriba ─────────────────────
  // 574 de las 592 filas de BUSCAR OTRA que tienen un número hacia COMPRAR no cruzan
  // dentro del tope: su único dato es cuánto haría falta. Ese es el caso normal, no un
  // borde, así que callarlo dejaría al 97% del veredicto con un rótulo que dice «ninguna
  // llega» y nada más.
  //
  // Pero NO es una fila. Nació como fila —misma tipografía, misma cifra mono de 15px que
  // las palancas accionables— y con el mismo peso visual el lector no tenía cómo saber
  // cuál de los dos números mirar. Son cosas distintas: ésta es CONTEXTO («esto no se
  // arregla negociando») y el mix de abajo es la ACCIÓN. La jerarquía lo dice sola:
  // chica y arriba, para que la que se puede ejecutar mande.
  const fueraDeRango = esBuscar ? dv.deltaMinimoComprarFueraDeTope : null;
  const contexto = fueraDeRango
    ? `Llegar a ${DESTINO} pediría un ${pct1(Math.abs(fueraDeRango.deltaPct))}% ${
        fueraDeRango.palanca === "precio" ? "menos de precio" : "más de arriendo"
      }, fuera de todo rango.`
    : null;

  // ── EL MIX ────────────────────────────────────────────────────────────────
  // Tres razones para NO dibujarlo, y las tres vienen marcadas del motor:
  //   · null            — ninguna combinación cruza;
  //   · fuera de alcance— cruza pero pide más capital del que es una salida;
  //   · REDUNDANTE      — repite una palanca que ya está arriba como fila. Dibujarlo
  //                       sería decir dos veces lo mismo con otro nombre.
  const m = dv.mixPalancas;
  const dibujarMix = !!m && m.dentroDelAlcance && !m.redundanteConPalancaSola;
  const mix: MixLoQueHariaYo | null = dibujarMix && m
    ? {
        // Cuando NO hay ninguna palanca sola, el mix deja de ser un apéndice y pasa a
        // ser el cuerpo: el título lo dice, y dice además si pide descuento o no.
        // EL TÍTULO SALE DEL DESTINO QUE EL MOTOR DECLARA, no del veredicto base.
        //
        // Cuando el mix llega al MISMO lugar que las filas —o sea a COMPRAR— sigue siendo
        // el «además» de siempre, y con cero palancas solas es la única vía. Pero cuando
        // deja en un veredicto MENOR que el del bloque, nombrarlo con el vocabulario del
        // informe («sale de Buscar otro») le pide al lector que piense en nuestras
        // etiquetas. Nadie piensa así. Piensa «que deje de ser un no», y eso es
        // exactamente lo que el mix hace: llegar a AJUSTA SUPUESTOS no es un sí, es la
        // desaparición del no. «Para que valga la pena» prometería el sí que el mix no
        // entrega.
        //
        // AUSENTE: en una fila persistida antes del campo, `veredictoObjetivo` es el
        // valor con que ese mismo mix se calculó — el fallback no supone nada.
        // EL MISMO valor que decide el título, expuesto para la fila «Resultado» de §5.
        destino: (m.destino ?? dv.veredictoObjetivo) as Veredicto,
        titulo:
          (m.destino ?? dv.veredictoObjetivo) !== "COMPRAR"
            ? "Para que deje de ser un no"
            : cruzan.length > 0
              ? `Si además mueves lo tuyo, llegas a ${DESTINO}`
              : `La única vía para llegar a ${DESTINO}`,
        movimiento: {
          pie: m.piePctDelta !== 0 ? { de: dv.piePctActual ?? 0, a: m.piePct } : null,
          plazo: m.plazoAniosDelta !== 0 ? { de: m.plazoAnios - m.plazoAniosDelta, a: m.plazoAnios } : null,
        },
        // El tachado necesita DOS números. Sin solo-precio que cruce no hay contra qué
        // contrastar, y dibujar una flecha desde la nada sería inventar el punto de partida.
        contraste:
          m.descuentoSoloPrecioPct !== null
            ? { de: `−${pct1(m.descuentoSoloPrecioPct)}%`, a: m.sinDescuento ? "sin descuento" : `−${pct1(m.descuentoPct)}%` }
            : null,
        costo: m.costoDiaUnoUF > 0 ? `${enUF(m.costoDiaUnoUF)} más el día uno` : null,
        descuento: m.sinDescuento ? null : `−${pct1(m.descuentoPct)}%`,
        sinDescuento: m.sinDescuento ? "sin pedirle un peso al vendedor" : null,
      }
    : null;

  // ── EL DESCARTE — las que no alcanzan, en UNA línea ───────────────────────
  // Con cero palancas que cruzan lista las cuatro; con algunas, solo las que faltan.
  // SOLO las que se probaron y no cruzaron. Las `noAplica` quedan fuera: decir que el
  // plazo «no alcanza» cuando ya está en 30 años —o que el pie no alcanza cuando lo cubre
  // un bono— es afirmar que se probó algo que no se probó. Su razón vive en el pop-up.
  // Y se lee del MISMO destino que las filas: en BUSCAR OTRA, de las vías hasta COMPRAR.
  // Mezclarlas —filas hacia Comprar, descarte hacia Ajustar— sería decir «el precio no
  // alcanza» sobre una medición distinta de la que está arriba.
  const noAlcanzan = ((esBuscar ? dv.viasHastaComprar : dv.vias) ?? [])
    .filter((v) => v.estado === "noCruza")
    .map((v) => NOMBRE_LLANO[v.palanca] ?? v.palanca);
  const descarte =
    noAlcanzan.length === 0
      ? null
      : `${enumerar(noAlcanzan).replace(/^./, (c) => c.toUpperCase())}, por separado, no ${noAlcanzan.length === 1 ? "alcanza" : "alcanzan"}.`;

  return { rotulo, contexto, filas, mix, descarte };
}
