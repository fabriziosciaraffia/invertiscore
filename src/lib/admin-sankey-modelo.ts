// ─────────────────────────────────────────────────────────────────────────────
// Geometría del Sankey de dos caminos del panel admin.
//
// Módulo PURO: recibe números y devuelve rectángulos y curvas. No conoce React
// ni tokens de color — eso lo pone el componente. Así el layout se puede
// verificar con un test o a mano, sin montar el árbol.
//
// ── Decisión de escala: PISO MÍNIMO, NO escala no lineal ──
// Los volúmenes del embudo caen un orden de magnitud entre la primera y la
// última columna (462 visitas → 18 cuentas → pagos). A grosor estrictamente
// proporcional, los flujos finales quedan en 1-2 px: invisibles justo donde
// más importa. Una escala no lineal (raíz, log) los haría visibles pero MIENTE
// sobre la magnitud, y la nota que lo explica no la lee nadie.
//
// El piso mínimo distorsiona solo los flujos ya pequeños, se entiende sin
// explicación, y se aplica UNIFORME (mismo piso para todos, no caso a caso).
// Complemento obligatorio: todo nodo y todo flujo llevan su número visible en
// el render, así el volumen real nunca depende de leer el grosor.
// ─────────────────────────────────────────────────────────────────────────────

/** Piso de grosor. Debajo de esto un flujo deja de ser legible y etiquetable. */
export const PISO_FLUJO_PX = 6;
/** Piso de alto de nodo. Un nodo tiene que poder contener su número. */
export const PISO_NODO_PX = 26;

/** Alto del área de flujos (sin headers ni leyenda). */
export const ALTO_FLUJOS = 470;
/** Separación vertical entre nodos de una misma columna. */
const GAP_NODOS = 18;

export const ANCHO_VIEWBOX = 1000;
export const ALTO_VIEWBOX = 560;
/** x del borde izquierdo de cada columna. */
export const COLUMNAS_X = [40, 300, 560, 810] as const;
export const ANCHO_NODO = 116;
/** y donde arranca el área de flujos (debajo de los headers de columna). */
const Y_TOPE = 52;

/** Los dos caminos y el abandono. El componente traduce esto a color. */
export type Camino = "anonimo" | "cuenta" | "abandono";

export interface NodoSankey {
  id: string;
  columna: number;
  /** Volumen real, el que se pinta como número. */
  valor: number;
  etiqueta: string;
  camino: Camino;
  /** Los nodos de abandono se dibujan punteados y sin relleno. */
  esAbandono: boolean;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface FlujoSankey {
  id: string;
  desde: string;
  hacia: string;
  valor: number;
  camino: Camino;
  /** Etiqueta sobre la curva ("5 reclaman"). Vacía = sin etiqueta. */
  etiqueta: string;
  /** Path SVG de la banda (cerrada, para rellenar). */
  d: string;
  /** Punto medio de la banda, para colgar la etiqueta. */
  labelX: number;
  labelY: number;
  grosor: number;
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

export interface ModeloSankey {
  nodos: NodoSankey[];
  flujos: FlujoSankey[];
  /** Texto plano del flujo, para el <desc> accesible del SVG. */
  descripcion: string;
}

/** Banda de Sankey: dos cúbicas espejadas, cerrada. */
function bandaPath(x0: number, y0: number, x1: number, y1: number, grosor: number): string {
  const cx = (x0 + x1) / 2;
  return [
    `M ${x0} ${y0}`,
    `C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`,
    `L ${x1} ${y1 + grosor}`,
    `C ${cx} ${y1 + grosor}, ${cx} ${y0 + grosor}, ${x0} ${y0 + grosor}`,
    "Z",
  ].join(" ");
}

/**
 * Arma nodos y flujos. La escala se calcula sobre el total de la PRIMERA
 * columna: el Sankey se lee como fracción de todo lo que entró.
 */
export function construirSankey(e: EntradaSankey): ModeloSankey {
  const totalEntrada = Math.max(e.visitasPagada + e.visitasOrganico, 1);

  // Se reserva el espacio de los gaps de la columna más poblada (3 nodos) para
  // que ninguna columna se salga del área.
  const escala = (ALTO_FLUJOS - GAP_NODOS * 2) / totalEntrada;
  const alto = (v: number) => Math.max(v * escala, PISO_NODO_PX);
  const grosor = (v: number) => (v <= 0 ? 0 : Math.max(v * escala, PISO_FLUJO_PX));

  // ── Definición de las 4 columnas ──
  const seVan = Math.max(totalEntrada - e.abrenWizard, 0);
  const abandonanWizard = Math.max(e.abrenWizard - e.gratisAnonimos - e.gratisConCuenta, 0);
  const sinCuenta = Math.max(e.gratisAnonimos - e.cuentasClaim, 0);
  const cuentasTotal = e.cuentasClaim + e.cuentasDirecto;

  const spec: Array<Omit<NodoSankey, "x" | "y" | "ancho" | "alto">> = [
    { id: "pagada", columna: 0, valor: e.visitasPagada, etiqueta: "campaña pagada", camino: "anonimo", esAbandono: false },
    { id: "organico", columna: 0, valor: e.visitasOrganico, etiqueta: "orgánico", camino: "cuenta", esAbandono: false },
    { id: "abren", columna: 1, valor: e.abrenWizard, etiqueta: "abren wizard", camino: "anonimo", esAbandono: false },
    { id: "sevan", columna: 1, valor: seVan, etiqueta: "se van", camino: "abandono", esAbandono: true },
    { id: "anonimos", columna: 2, valor: e.gratisAnonimos, etiqueta: "anónimos", camino: "anonimo", esAbandono: false },
    { id: "concuenta", columna: 2, valor: e.gratisConCuenta, etiqueta: "con cuenta", camino: "cuenta", esAbandono: false },
    { id: "abandonan", columna: 2, valor: abandonanWizard, etiqueta: "abandonan", camino: "abandono", esAbandono: true },
    { id: "cuentas", columna: 3, valor: cuentasTotal, etiqueta: cuentasTotal === 1 ? "cuenta" : "cuentas", camino: "cuenta", esAbandono: false },
    { id: "pagos", columna: 3, valor: e.pagos, etiqueta: e.pagos === 1 ? "pago" : "pagos", camino: "cuenta", esAbandono: false },
    { id: "sincuenta", columna: 3, valor: sinCuenta, etiqueta: "sin cuenta", camino: "abandono", esAbandono: true },
  ];

  // ── Apilado por columna ──
  // Los nodos de abandono van SIEMPRE al fondo de su columna: el ojo lee la
  // banda superior como "el flujo que sigue" y la inferior como "lo que se
  // pierde", sin necesidad de leyenda.
  const nodos: NodoSankey[] = [];
  for (let col = 0; col < COLUMNAS_X.length; col++) {
    const enCol = spec
      .filter((n) => n.columna === col)
      .sort((a, b) => Number(a.esAbandono) - Number(b.esAbandono));
    const altos = enCol.map((n) => alto(n.valor));
    const totalAlto = altos.reduce((s, h) => s + h, 0) + GAP_NODOS * (enCol.length - 1);
    let y = Y_TOPE + Math.max((ALTO_FLUJOS - totalAlto) / 2, 0);
    enCol.forEach((n, i) => {
      nodos.push({ ...n, x: COLUMNAS_X[col], y, ancho: ANCHO_NODO, alto: altos[i] });
      y += altos[i] + GAP_NODOS;
    });
  }
  const porId = new Map(nodos.map((n) => [n.id, n]));

  // ── Flujos ──
  // Cursores por nodo: cada flujo se engancha debajo del anterior, así las
  // bandas no se pisan dentro del mismo borde.
  const salida = new Map<string, number>();
  const entrada = new Map<string, number>();
  const flujos: FlujoSankey[] = [];

  const conectar = (desde: string, hacia: string, valor: number, camino: Camino, etiqueta = "") => {
    if (valor <= 0) return;
    const a = porId.get(desde);
    const b = porId.get(hacia);
    if (!a || !b) return;
    const g = grosor(valor);
    const y0 = a.y + (salida.get(desde) ?? 0);
    const y1 = b.y + (entrada.get(hacia) ?? 0);
    salida.set(desde, (salida.get(desde) ?? 0) + g);
    entrada.set(hacia, (entrada.get(hacia) ?? 0) + g);
    const x0 = a.x + a.ancho;
    const x1 = b.x;
    flujos.push({
      id: `${desde}->${hacia}`,
      desde,
      hacia,
      valor,
      camino,
      etiqueta,
      grosor: g,
      d: bandaPath(x0, y0, x1, y1, g),
      labelX: (x0 + x1) / 2,
      labelY: (y0 + y1) / 2 + g / 2,
    });
  };

  // Origen → wizard. El reparto de "se van" es PROPORCIONAL al peso de cada
  // origen: no hay dato de abandono por origen, y repartirlo entero a uno solo
  // sería inventar. Se documenta en el <desc>.
  const pesoPagada = e.visitasPagada / totalEntrada;
  const abrenPagada = Math.round(e.abrenWizard * pesoPagada);
  const abrenOrganico = Math.max(e.abrenWizard - abrenPagada, 0);
  conectar("pagada", "abren", abrenPagada, "anonimo");
  conectar("organico", "abren", abrenOrganico, "cuenta");
  conectar("pagada", "sevan", Math.max(e.visitasPagada - abrenPagada, 0), "abandono");
  conectar("organico", "sevan", Math.max(e.visitasOrganico - abrenOrganico, 0), "abandono");

  // Wizard → análisis gratis.
  conectar("abren", "anonimos", e.gratisAnonimos, "anonimo");
  conectar("abren", "concuenta", e.gratisConCuenta, "cuenta");
  conectar("abren", "abandonan", abandonanWizard, "abandono");

  // Análisis gratis → cuenta y pago.
  conectar("anonimos", "cuentas", e.cuentasClaim, "anonimo", `${e.cuentasClaim} reclaman`);
  conectar("anonimos", "sincuenta", sinCuenta, "abandono");
  conectar("abren", "cuentas", e.cuentasDirecto, "cuenta", `${e.cuentasDirecto} se registran directo`);
  conectar("cuentas", "pagos", e.pagos, "cuenta");

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const descripcion =
    `Flujo de ${totalEntrada} visitas: ${e.visitasPagada} de campaña pagada y ${e.visitasOrganico} orgánicas. ` +
    `${e.abrenWizard} abren el wizard (${pct(e.abrenWizard, totalEntrada)}%) y ${seVan} se van sin abrirlo. ` +
    `Se crean ${e.gratisAnonimos + e.gratisConCuenta} análisis gratis: ${e.gratisAnonimos} anónimos y ` +
    `${e.gratisConCuenta} de cuentas que ya existían; ${abandonanWizard} abandonan el wizard sin generar. ` +
    `Se crean ${cuentasTotal} cuentas: ${e.cuentasClaim} reclamando un análisis anónimo y ${e.cuentasDirecto} ` +
    `registrándose directo; ${sinCuenta} probaron anónimo y no reclamaron. ${e.pagos} llegan a pago. ` +
    `El grosor de cada banda es proporcional al volumen, con un piso mínimo para que los flujos chicos sigan siendo visibles.`;

  return { nodos, flujos, descripcion };
}
