// ─────────────────────────────────────────────────────────────────────────────
// Geometría del Sankey de dos caminos del panel admin.
//
// Módulo PURO: recibe números y devuelve rectángulos, curvas y posiciones de
// etiqueta. No conoce React ni colores — eso lo pone el componente. Así el
// layout se puede verificar sin montar el árbol.
//
// ── Decisión de escala: PISO MÍNIMO, NO escala no lineal ──
// Los volúmenes caen un orden de magnitud entre la primera etapa y la última
// (462 visitas → 18 cuentas → 0 pagos). A grosor estrictamente proporcional los
// flujos finales quedan en 1-2 px: invisibles justo donde más importa. Una
// escala no lineal los haría visibles pero MIENTE sobre la magnitud, y la nota
// que lo explica no la lee nadie.
//
// El piso distorsiona solo lo ya pequeño, se entiende sin explicación y se
// aplica UNIFORME. Complemento obligatorio: todo nodo y todo flujo llevan su
// número visible, así el volumen real nunca depende de leer el grosor.
//
// ── Orientación ──
// El diagrama se arma en dos ejes abstractos: AVANCE (de etapa a etapa) y
// REPARTO (dentro de una etapa). En horizontal, avance = x y reparto = y; en
// vertical se invierten. Todo el layout se calcula una vez y se proyecta al
// final, así las dos orientaciones no se desincronizan.
// ─────────────────────────────────────────────────────────────────────────────

/** Piso de grosor. Debajo de esto un flujo deja de ser legible y etiquetable. */
export const PISO_FLUJO_PX = 7;
/** Piso de la dimensión de reparto de un nodo (alto en horizontal, ancho en vertical). */
export const PISO_NODO_PX = 34;

export type Orientacion = "horizontal" | "vertical";
/**
 * Cuánto aire tiene el diagrama entre etapas.
 *
 *  · "comoda"   — la que se venía usando. Cada etapa a 300px. Se lee sola pero
 *                 mide ~1370px de alto: en desktop obliga a scrollear el panel
 *                 entero para ver un diagrama, que es lo contrario de un
 *                 resumen. Sigue siendo la correcta en mobile, donde la página
 *                 se scrollea igual y el ancho es el recurso escaso.
 *  · "compacta" — desktop. Etapas a 108px, y las etiquetas de flujo salen a una
 *                 COLUMNA LATERAL fija en vez de flotar sobre las bandas: a esta
 *                 altura el corredor entre etapas no da para texto encima, y la
 *                 salida no puede ser achicar la fuente.
 */
export type Densidad = "comoda" | "compacta";
export type Camino = "entrada" | "anonimo" | "cuenta" | "abandono";

export interface NodoSankey {
  id: string;
  etapa: number;
  valor: number;
  etiqueta: string;
  camino: Camino;
  esAbandono: boolean;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Dónde colgar la etiqueta de texto, ya resuelta para no pisar nada. */
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
  /** % sobre el total que entró al embudo. */
  pctEntrada: number;
  /** % sobre lo que SIGUE vivo en la etapa anterior (sin contar su abandono). */
  pctEtapaPrevia: number;
}

export interface FlujoSankey {
  id: string;
  valor: number;
  camino: Camino;
  etiqueta: string;
  d: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
  grosor: number;
  /** Nodos que une, para el tooltip. */
  desde: string;
  hacia: string;
  /** % sobre el nodo del que sale. */
  pctOrigen: number;
  /** % sobre el total que entró al embudo. */
  pctEntrada: number;
  /** Conector punteado hacia la etiqueta lateral. Vacío si la etiqueta flota. */
  guia: string;
}

export interface EntradaSankey {
  visitasPagada: number;
  visitasOrganico: number;
  abrenWizard: number;
  gratisAnonimos: number;
  gratisConCuenta: number;
  cuentasClaim: number;
  cuentasDirecto: number;
  pagos: number;
}

export interface EtapaSankey {
  titulo: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

export interface ModeloSankey {
  nodos: NodoSankey[];
  flujos: FlujoSankey[];
  etapas: EtapaSankey[];
  ancho: number;
  alto: number;
  descripcion: string;
}

/**
 * Cinco etapas, no cuatro. "cuenta y pago" empezó siendo una sola, y con cero
 * pagos parecía funcionar; apenas hubo un pago se vio el problema: el flujo
 * cuentas → pagos nacía y moría en la MISMA etapa, o sea una banda de largo
 * cero, y los pagos aparecían de la nada sin nada que los conectara. Un Sankey
 * no puede dibujar un flujo dentro de una etapa — eso es una fila de la grilla,
 * no una transición.
 *
 * Separarlas además destapa el abandono que faltaba: los que crean cuenta y no
 * pagan. Con cuatro etapas ese grupo no existía en ningún lado.
 */
const TITULOS_ETAPA = ["origen", "wizard", "análisis gratis", "cuenta", "pago"];
const ETAPAS = TITULOS_ETAPA.length;

// ── Medidas por orientación ──
// Horizontal: el ANCHO es la restricción (el panel da 680-900 px útiles), así
// que hay poco espacio entre etapas para etiquetas de flujo.
// Vertical: el alto es libre — se puede scrollear —, así que cada etapa respira
// y las etiquetas caben al costado sin competir.
const H = {
  ancho: 1244,
  alto: 560,
  avanceInicio: 40,
  pasoAvance: 246,
  grosorNodo: 112,
  repartoInicio: 58,
  repartoLargo: 470,
  gap: 20,
  lateralX: 0,
};
// El ancho del viewBox vertical NO es decorativo: un SVG con viewBox escala su
// texto junto al contenedor, así que si el viewBox es más ancho que el espacio
// real el texto de 11px se dibuja más chico. A 900px de viewport el panel deja
// ~820 útiles (p-6 de página + p-4 de card), así que el viewBox mide 820 y a esa
// resolución el render es 1:1. Más ancho escala hacia arriba, que no molesta.
const V = {
  ancho: 820,
  alto: 1370,
  avanceInicio: 74,
  pasoAvance: 300,
  grosorNodo: 54,
  repartoInicio: 140,
  repartoLargo: 650,
  gap: 22,
  /** x donde arranca la columna lateral de etiquetas. 0 = las etiquetas flotan. */
  lateralX: 0,
};

// Desktop. Objetivo declarado: que el diagrama entero entre en pantalla junto al
// encabezado, o sea ~560px de alto para cinco etapas. Se comprime el ESPACIADO
// (pasoAvance 300 → 108, grosorNodo 54 → 34), nunca el texto: el piso de 11px
// sigue firme y por eso las etiquetas de flujo se mudan a la columna lateral —
// a 108px de paso, el corredor entre etapas ya no da para texto encima.
const V_COMPACTA = {
  ancho: 1000,
  alto: 566,
  avanceInicio: 46,
  pasoAvance: 108,
  grosorNodo: 34,
  repartoInicio: 116,
  repartoLargo: 620,
  gap: 14,
  lateralX: 772,
};
/** Banda entre dos bordes. `vertical` cambia el eje sobre el que curva. */
function bandaPath(
  a0: number,
  b0: number,
  a1: number,
  b1: number,
  grosor: number,
  vertical: boolean,
): string {
  const medio = (a0 + a1) / 2;
  if (!vertical) {
    return [
      `M ${a0} ${b0}`,
      `C ${medio} ${b0}, ${medio} ${b1}, ${a1} ${b1}`,
      `L ${a1} ${b1 + grosor}`,
      `C ${medio} ${b1 + grosor}, ${medio} ${b0 + grosor}, ${a0} ${b0 + grosor}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${b0} ${a0}`,
    `C ${b0} ${medio}, ${b1} ${medio}, ${b1} ${a1}`,
    `L ${b1 + grosor} ${a1}`,
    `C ${b1 + grosor} ${medio}, ${b0 + grosor} ${medio}, ${b0 + grosor} ${a0}`,
    "Z",
  ].join(" ");
}

/**
 * Separa etiquetas que competirían por el mismo espacio.
 *
 * El requisito es duro: nada de texto encimado en ninguna resolución, y NO se
 * arregla achicando la fuente. Así que cuando dos etiquetas quedan a menos de
 * `minimo` en el eje de reparto, se empujan — el texto se mueve, nunca se
 * encoge. Empuja desde el centro hacia afuera para no desbordar el lienzo.
 */
function separar<T extends { pos: number }>(items: T[], minimo: number): T[] {
  if (items.length < 2) return items;
  const orden = [...items].sort((a, b) => a.pos - b.pos);
  for (let i = 1; i < orden.length; i++) {
    const previo = orden[i - 1].pos;
    if (orden[i].pos - previo < minimo) orden[i].pos = previo + minimo;
  }
  return orden;
}

export function construirSankey(
  e: EntradaSankey,
  orientacion: Orientacion = "vertical",
  densidad: Densidad = "comoda",
): ModeloSankey {
  const vertical = orientacion === "vertical";
  const M = vertical ? (densidad === "compacta" ? V_COMPACTA : V) : H;
  const lateral = vertical && M.lateralX > 0;
  const totalEntrada = Math.max(e.visitasPagada + e.visitasOrganico, 1);

  const escala = (M.repartoLargo - M.gap * 2) / totalEntrada;
  const reparto = (v: number) => Math.max(v * escala, PISO_NODO_PX);
  const grosor = (v: number) => (v <= 0 ? 0 : Math.max(v * escala, PISO_FLUJO_PX));

  const seVan = Math.max(totalEntrada - e.abrenWizard, 0);
  const abandonanWizard = Math.max(e.abrenWizard - e.gratisAnonimos - e.gratisConCuenta, 0);
  const sinCuenta = Math.max(e.gratisAnonimos - e.cuentasClaim, 0);
  const cuentasTotal = e.cuentasClaim + e.cuentasDirecto;
  const noPagan = Math.max(cuentasTotal - e.pagos, 0);

  const spec = [
    { id: "pagada", etapa: 0, valor: e.visitasPagada, etiqueta: "campaña pagada", camino: "entrada" as Camino, esAbandono: false },
    { id: "organico", etapa: 0, valor: e.visitasOrganico, etiqueta: "orgánico", camino: "entrada" as Camino, esAbandono: false },
    { id: "abren", etapa: 1, valor: e.abrenWizard, etiqueta: "abren wizard", camino: "entrada" as Camino, esAbandono: false },
    { id: "sevan", etapa: 1, valor: seVan, etiqueta: "se van", camino: "abandono" as Camino, esAbandono: true },
    { id: "anonimos", etapa: 2, valor: e.gratisAnonimos, etiqueta: "anónimos", camino: "anonimo" as Camino, esAbandono: false },
    { id: "concuenta", etapa: 2, valor: e.gratisConCuenta, etiqueta: "con cuenta", camino: "cuenta" as Camino, esAbandono: false },
    { id: "abandonan", etapa: 2, valor: abandonanWizard, etiqueta: "abandonan", camino: "abandono" as Camino, esAbandono: true },
    { id: "cuentas", etapa: 3, valor: cuentasTotal, etiqueta: cuentasTotal === 1 ? "cuenta" : "cuentas", camino: "cuenta" as Camino, esAbandono: false },
    { id: "sincuenta", etapa: 3, valor: sinCuenta, etiqueta: "sin cuenta", camino: "abandono" as Camino, esAbandono: true },
    { id: "pagos", etapa: 4, valor: e.pagos, etiqueta: e.pagos === 1 ? "pago" : "pagos", camino: "cuenta" as Camino, esAbandono: false },
    { id: "nopagan", etapa: 4, valor: noPagan, etiqueta: "no pagan", camino: "abandono" as Camino, esAbandono: true },
  ];

  // ── Apilado por etapa ──
  // El abandono va SIEMPRE al final de su etapa: el ojo lee la banda de
  // adelante como "lo que sigue" y la de atrás como "lo que se pierde".
  // Denominador de "% respecto a la etapa anterior": lo que sigue VIVO en esa
  // etapa, sin su abandono. Medir contra el total de la etapa daría 43/462 para
  // los anónimos —comparándolos con gente que nunca abrió el wizard— en vez del
  // 43/429 que responde la pregunta real.
  const vivosPorEtapa = new Map<number, number>();
  for (const n of spec) {
    if (n.esAbandono) continue;
    vivosPorEtapa.set(n.etapa, (vivosPorEtapa.get(n.etapa) ?? 0) + n.valor);
  }
  const pctDe = (v: number, base: number) => (base > 0 ? Math.round((v / base) * 1000) / 10 : 0);

  const nodos: NodoSankey[] = [];
  for (let et = 0; et < ETAPAS; et++) {
    const enEtapa = spec
      .filter((n) => n.etapa === et)
      .sort((a, b) => Number(a.esAbandono) - Number(b.esAbandono));
    const largos = enEtapa.map((n) => reparto(n.valor));
    const total = largos.reduce((s, l) => s + l, 0) + M.gap * (enEtapa.length - 1);
    let pos = M.repartoInicio + Math.max((M.repartoLargo - total) / 2, 0);
    const avance = M.avanceInicio + et * M.pasoAvance;
    // Etiquetas de nodos vecinos: dos nodos chicos y contiguos ("43 anónimos" y
    // "7 con cuenta") tienen etiquetas más anchas que ellos mismos, así que se
    // tocarían. Cuando eso pasa la etiqueta BAJA una línea en vez de encogerse
    // o correrse lejos de su nodo — sigue debajo del nodo que nombra.
    let finEtiquetaPrevia = -Infinity;
    let escalonPrevio = false;

    enEtapa.forEach((n, i) => {
      const x = vertical ? pos : avance;
      const y = vertical ? avance : pos;
      const ancho = vertical ? largos[i] : M.grosorNodo;
      const alto = vertical ? M.grosorNodo : largos[i];
      // En vertical la etiqueta va DEBAJO del nodo, centrada; en horizontal al
      // costado derecho, que es donde queda aire.
      const centro = x + ancho / 2;
      // Mono de 11px mide ~6.2px por carácter. Alcanza para detectar el choque
      // sin medir texto de verdad (que en el server no se puede).
      const mitadTexto = (n.etiqueta.length * 6.2) / 2;
      const choca = vertical && centro - mitadTexto < finEtiquetaPrevia + 6;
      const escalon = choca && !escalonPrevio;
      if (vertical) {
        finEtiquetaPrevia = escalon ? finEtiquetaPrevia : centro + mitadTexto;
        escalonPrevio = escalon;
      }
      nodos.push({
        ...n,
        pctEntrada: pctDe(n.valor, totalEntrada),
        pctEtapaPrevia: pctDe(n.valor, vivosPorEtapa.get(et - 1) ?? totalEntrada),
        x,
        y,
        ancho,
        alto,
        labelX: vertical ? centro : x + ancho + 8,
        labelY: vertical ? y + alto + 15 + (escalon ? 15 : 0) : y + alto / 2 + 4,
        labelAnchor: vertical ? "middle" : "start",
      });
      pos += largos[i] + M.gap;
    });
  }
  const porId = new Map(nodos.map((n) => [n.id, n]));

  // ── Flujos ──
  const cursorSalida = new Map<string, number>();
  const cursorEntrada = new Map<string, number>();
  const crudos: Array<Omit<FlujoSankey, "labelX" | "labelY" | "labelAnchor"> & {
    avanceMedio: number;
    repartoMedio: number;
  }> = [];

  const conectar = (desde: string, hacia: string, valor: number, camino: Camino, etiqueta = "") => {
    if (valor <= 0) return;
    const a = porId.get(desde);
    const b = porId.get(hacia);
    if (!a || !b) return;
    const g = grosor(valor);
    // a0/a1 = avance (donde empieza y termina); b0/b1 = reparto (posición
    // dentro de cada borde, corrida por el cursor para que no se pisen).
    const a0 = vertical ? a.y + a.alto : a.x + a.ancho;
    const a1 = vertical ? b.y : b.x;
    const b0 = (vertical ? a.x : a.y) + (cursorSalida.get(desde) ?? 0);
    const b1 = (vertical ? b.x : b.y) + (cursorEntrada.get(hacia) ?? 0);
    cursorSalida.set(desde, (cursorSalida.get(desde) ?? 0) + g);
    cursorEntrada.set(hacia, (cursorEntrada.get(hacia) ?? 0) + g);
    // Un flujo que SALTA una etapa (wizard → cuentas, sin pasar por análisis
    // gratis) tiene su punto medio DENTRO de la etapa intermedia, o sea encima
    // de un nodo ajeno: ahí es donde "13 se registran directo" se montaba sobre
    // el nodo "abandonan". Para esos, la etiqueta va pegada al destino, en el
    // corredor libre que precede al nodo de llegada.
    const salta = Math.abs(b.etapa - a.etapa) > 1;
    crudos.push({
      id: `${desde}->${hacia}`,
      desde,
      hacia,
      pctOrigen: pctDe(valor, a.valor),
      pctEntrada: pctDe(valor, totalEntrada),
      guia: "",
      valor,
      camino,
      etiqueta,
      grosor: g,
      d: bandaPath(a0, b0, a1, b1, g, vertical),
      avanceMedio: salta ? a1 - 22 : (a0 + a1) / 2,
      repartoMedio: (salta ? b1 : (b0 + b1) / 2) + g / 2,
    });
  };

  // Origen → wizard. El reparto de "se van" entre pagado y orgánico es
  // PROPORCIONAL al peso de cada origen: no hay dato de abandono por origen, y
  // cargárselo entero a uno sería inventar. Se dice en el <desc> y en la nota.
  const abrenPagada = Math.round(e.abrenWizard * (e.visitasPagada / totalEntrada));
  const abrenOrganico = Math.max(e.abrenWizard - abrenPagada, 0);
  conectar("pagada", "abren", abrenPagada, "entrada");
  conectar("organico", "abren", abrenOrganico, "entrada");
  conectar("pagada", "sevan", Math.max(e.visitasPagada - abrenPagada, 0), "abandono");
  conectar("organico", "sevan", Math.max(e.visitasOrganico - abrenOrganico, 0), "abandono");

  conectar("abren", "anonimos", e.gratisAnonimos, "anonimo");
  conectar("abren", "concuenta", e.gratisConCuenta, "cuenta");
  conectar("abren", "abandonan", abandonanWizard, "abandono");

  conectar("anonimos", "cuentas", e.cuentasClaim, "cuenta", `${e.cuentasClaim} reclaman`);
  conectar("anonimos", "sincuenta", sinCuenta, "abandono");
  conectar("abren", "cuentas", e.cuentasDirecto, "cuenta", `${e.cuentasDirecto} se registran directo`);
  // Etapa 5. Con "pago" dentro de la etapa de "cuenta" esta banda medía cero de
  // largo y los pagos aparecían sin nada que los conectara.
  conectar("cuentas", "pagos", e.pagos, "cuenta", e.pagos > 0 ? `${e.pagos} pagan` : "");
  conectar("cuentas", "nopagan", noPagan, "abandono");

  // ── Etiquetas de flujo, separadas para que no se pisen ──
  // Solo las etiquetadas compiten por espacio; el resto no lleva texto.
  //
  // Se separan SOLO entre las que además están cerca en el eje de avance: dos
  // etiquetas a distinta altura no compiten por nada, y empujarlas igual manda
  // una lejos de la banda que nombra —que es peor que el choque que evita—.
  const BANDA_AVANCE = 60;
  const posPorId = new Map<string, number>();
  const grupos = new Map<number, typeof crudos>();
  for (const f of crudos.filter((x) => x.etiqueta)) {
    const banda = Math.round(f.avanceMedio / BANDA_AVANCE);
    if (!grupos.has(banda)) grupos.set(banda, []);
    grupos.get(banda)!.push(f);
  }
  grupos.forEach((grupo) => {
    for (const s of separar(
      grupo.map((f) => ({ id: f.id, pos: f.repartoMedio })),
      vertical ? 190 : 22,
    )) {
      posPorId.set(s.id, s.pos);
    }
  });

  // En compacta las etiquetas NO flotan: van a una columna lateral fija, con un
  // conector punteado desde el punto medio de su banda. Con etapas a 108px no
  // hay corredor donde poner texto encima, y encogerlo está prohibido.
  const lateralOrdenadas = lateral
    ? separar(
        crudos
          .filter((f) => f.etiqueta)
          .map((f) => ({ id: f.id, pos: f.avanceMedio }))
          .sort((a, b) => a.pos - b.pos),
        17,
      )
    : [];
  const lateralY = new Map(lateralOrdenadas.map((l) => [l.id, l.pos]));

  const flujos: FlujoSankey[] = crudos.map((f) => {
    const pos = posPorId.get(f.id) ?? f.repartoMedio;
    const yLat = lateralY.get(f.id);
    return {
      id: f.id,
      desde: f.desde,
      hacia: f.hacia,
      pctOrigen: f.pctOrigen,
      pctEntrada: f.pctEntrada,
      guia:
        lateral && yLat != null && f.etiqueta
          ? `M ${f.repartoMedio} ${f.avanceMedio} L ${M.lateralX - 8} ${yLat - 4}`
          : "",
      valor: f.valor,
      camino: f.camino,
      etiqueta: f.etiqueta,
      d: f.d,
      grosor: f.grosor,
      // Compacta: columna lateral, ancladas a la izquierda para que arranquen
      // todas en la misma x. Cómoda: en la franja entre etapas, que ahí es
      // ancha y está vacía. Horizontal: el corredor entre columnas.
      labelX: lateral && yLat != null ? M.lateralX : vertical ? pos : f.avanceMedio,
      labelY: lateral && yLat != null ? yLat : vertical ? f.avanceMedio : pos - 7,
      labelAnchor: lateral && yLat != null ? ("start" as const) : ("middle" as const),
    };
  });

  const etapas: EtapaSankey[] = TITULOS_ETAPA.map((titulo, i) => {
    const avance = M.avanceInicio + i * M.pasoAvance;
    return vertical
      ? { titulo, x: 16, y: avance + M.grosorNodo / 2 + 4, anchor: "start" as const }
      : { titulo, x: avance + M.grosorNodo / 2, y: 26, anchor: "middle" as const };
  });

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const descripcion =
    `Flujo de ${totalEntrada} visitas: ${e.visitasPagada} de campaña pagada y ${e.visitasOrganico} orgánicas. ` +
    `${e.abrenWizard} abren el wizard (${pct(e.abrenWizard, totalEntrada)}%) y ${seVan} se van sin abrirlo. ` +
    `Se crean ${e.gratisAnonimos + e.gratisConCuenta} análisis gratis: ${e.gratisAnonimos} anónimos y ` +
    `${e.gratisConCuenta} de cuentas que ya existían; ${abandonanWizard} abandonan el wizard sin generar. ` +
    `Se crean ${cuentasTotal} cuentas: ${e.cuentasClaim} reclamando un análisis anónimo y ${e.cuentasDirecto} ` +
    `registrándose directo; ${sinCuenta} probaron anónimo y no reclamaron. ` +
    `De esas cuentas, ${e.pagos} pagan y ${noPagan} no. ` +
    `El reparto de quienes se van entre pagado y orgánico es proporcional al peso de cada origen. ` +
    `El grosor de cada banda es proporcional al volumen, con un piso mínimo para que los flujos chicos sigan siendo visibles.`;

  return { nodos, flujos, etapas, ancho: M.ancho, alto: M.alto, descripcion };
}
