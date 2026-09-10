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

/** Quién tiene que mover la palanca. Es el eje del bloque, no un adorno. */
export type QuienLaPone = "vendedor" | "mercado" | "tuyo";

export interface FilaLoQueHariaYo {
  titulo: string;
  quien: QuienLaPone;
  /** La magnitud, a la derecha ("−24,1%" · "8% → 22%" · "30 años"). */
  cifra: string;
  /** El valor objetivo, bajo la cifra ("UF 4.175"). null cuando la cifra ya lo dice. */
  objetivo: string | null;
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
}

export interface BloqueLoQueHariaYo {
  rotulo: string;
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

/** El destino del bloque, SIEMPRE. Ver «EL DESTINO ES COMPRAR» más abajo. */
const DESTINO = "Comprar";

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
        quien: "mercado",
        cifra: s.firme ? "−50% o más" : `−${pct1(s.marginPct)}%`,
        objetivo: null,
      });
    }
    if (p.arriendoDeclaradoCLP > 0) {
      filas.push({
        titulo: "Verifica el arriendo",
        quien: "tuyo",
        cifra: plata(p.arriendoDeclaradoCLP),
        objetivo: "lo declaraste tú",
      });
    }
    if (filas.length === 0) return null;
    return { rotulo: "Antes de firmar", filas, mix: null, descarte: null };
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
  const rotulo =
    n === 0
      ? `Franco probó cada palanca sola · ninguna llega a ${DESTINO}`
      : `Franco probó cada palanca sola · ${cantidad} ${n === 1 ? "lleva a" : "llevan a"} ${DESTINO}`;

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

  // ── LA FILA DEL DELTA FUERA DE RANGO — el caso DOMINANTE de BUSCAR OTRA ───
  // 574 de las 592 filas de BUSCAR OTRA que tienen un número hacia COMPRAR no cruzan
  // dentro del tope: su ÚNICO dato es cuánto haría falta. Sin esta fila el 97% del
  // veredicto se queda con un rótulo que dice «ninguna llega» y nada más — y ese es el
  // caso normal, no un borde.
  //
  // Va DESPUÉS del rótulo a propósito: no entra en la cuenta de las que cruzan, porque
  // no cruza. El «fuera de rango» debajo de la cifra es la mitad que la hace honesta.
  const fueraDeRango = esBuscar ? dv.deltaMinimoComprarFueraDeTope : null;
  if (fueraDeRango) {
    filas.push({
      titulo: fueraDeRango.palanca === "precio" ? "Haría falta en precio" : "Haría falta en arriendo",
      quien: QUIEN[fueraDeRango.palanca],
      cifra: `${signo(fueraDeRango.deltaPct)}${pct1(Math.abs(fueraDeRango.deltaPct))}%`,
      objetivo: "fuera de rango",
    });
  }

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
        // Cuenta `cruzan`, NO `filas`: la fila del delta fuera de rango no es una palanca
        // que se pueda mover, así que su presencia no convierte al mix en un «además».
        titulo:
          cruzan.length > 0
            ? "Si además mueves lo tuyo"
            : m.sinDescuento
              ? "La única salida"
              : "La salida, combinando",
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

  return { rotulo, filas, mix, descarte };
}
