// ─────────────────────────────────────────────────────────────────────────────
// LA ORDEN DE VISITA Y ACOMPAÑAMIENTO (etapa 1 de Invierte con Franco, 18-nov-2026). El texto VIGENTE —versión 1, borrador
// sin revisión de abogado, el del encargo de Fabrizio del 18-nov-2026— y cómo se llena con el nombre, el RUT y el depto.
//   · SI EL TEXTO CAMBIA, SUBE `VERSION_ORDEN`. El tier INVIERTE-V2 fija la huella de la plantilla de cada versión: cambiar
//     una coma sin subir la versión lo deja en rojo. Una orden por cuenta y por versión (índice de la base): quien firmó la
//     versión vigente no firma de nuevo; si la versión sube, firma la nueva.
//   · Lo que se guarda en `inv_ordenes.texto` es el texto LLENO, tal como se firmó; `texto_sha256` es su huella
//     (orden-servidor.ts). El PDF es un dibujo de ese texto.
//   · La razón social y el RUT de quien recibe el encargo: constantes, POR CONFIRMAR por Fabrizio antes del push.
// Puro e isomorfo: lo dibujan la firma (navegador), el PDF y el correo, y lo prueba el tier.
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION_ORDEN = 1;

/** POR CONFIRMAR (Fabrizio, antes del push): quien recibe el encargo. Hoy, el emisor de las boletas. */
export const RAZON_SOCIAL_FRANCO = "Yape Digital SpA";
export const RUT_FRANCO = "78.410.649-7";
export const RAZON_SOCIAL_POR_CONFIRMAR = true;

export interface Clausula {
  n: number;
  titulo: string;
  texto: string;
}

export interface OrdenLlena {
  version: number;
  titulo: string;
  encabezado: string;
  clausulas: Clausula[];
  pie: string;
}

/** Los datos con que se llena la orden. Vacíos, la firma muestra los marcadores mientras la persona escribe. */
export interface DatosOrden {
  nombre: string;
  /** Con puntos y guion («16.482.317-5»). */
  rut: string;
  /** «Ñuñoa · 2D2B · 58 m²» (sin la condición). */
  depto: string;
}

export const MARCADOR_NOMBRE = "[Tu nombre]";
export const MARCADOR_RUT = "[tu RUT]";

/** La orden de la versión 1, llena. */
export function ordenV1(d: DatosOrden): OrdenLlena {
  const nombre = d.nombre.trim() || MARCADOR_NOMBRE;
  const rut = d.rut.trim() || MARCADOR_RUT;
  return {
    version: 1,
    titulo: "Orden de visita y acompañamiento",
    encabezado: `${nombre}, RUT ${rut}, encarga a ${RAZON_SOCIAL_FRANCO}, RUT ${RUT_FRANCO}, presentarle departamentos para invertir y acompañarle en su compra.`,
    clausulas: [
      { n: 1, titulo: "Alcance", texto: `Esta orden cubre el depto de ${d.depto} y todos los departamentos que Franco te presente desde hoy, por correo, WhatsApp o en refranco.ai.` },
      { n: 2, titulo: "Comisión en deptos usados", texto: "Si compras alguno de esos departamentos, pagas a Franco el 2 % + IVA del precio de compra (comisión estándar de corretaje por el lado del comprador), al firmar la escritura de compraventa. Si no compras, no pagas nada." },
      { n: 3, titulo: "Deptos nuevos", texto: "Si compras un depto nuevo a una inmobiliaria, no pagas nada a Franco: la comisión la paga la inmobiliaria." },
      { n: 4, titulo: "Cómo trabajamos", texto: "Las visitas, ofertas y conversaciones con el vendedor o su corredor se coordinan a través de Franco." },
      { n: 5, titulo: "Vigencia", texto: "Doce meses desde la firma. La comisión se mantiene si compras, hasta doce meses después de terminada la orden, un depto que Franco te presentó mientras estuvo vigente." },
      { n: 6, titulo: "Tus datos", texto: "Franco usa tus datos solo para esta gestión y no los comparte con el vendedor ni su corredor sin tu acuerdo. Esta orden y el registro de las gestiones se conservan por seis años como respaldo. Tus documentos financieros se eliminan si cierras tu cuenta." },
    ],
    pie: "Firma electrónica simple (Ley 19.799). Te llega una copia por correo.",
  };
}

/** La orden vigente. */
export const ordenVigente = ordenV1;

/** El texto plano de una orden llena: lo que se guarda en la fila y se firma con su huella. */
export function textoPlano(o: OrdenLlena): string {
  return [o.titulo, o.encabezado, ...o.clausulas.map((c) => `${c.n}. ${c.titulo}. ${c.texto}`), o.pie].join("\n\n");
}

/** La plantilla de la versión vigente (con marcadores fijos): su huella la fija el tier, para que el texto no cambie sin subir la versión. */
export function plantillaVigente(): string {
  return textoPlano(ordenVigente({ nombre: "{NOMBRE}", rut: "{RUT}", depto: "{DEPTO}" }));
}

/** «Ñuñoa · 2D2B · 58 m² · Usado» → «Ñuñoa · 2D2B · 58 m²». */
export function deptoDeLinea(linea: string): string {
  return linea.replace(/ · (Usado|Nuevo)$/, "").trim();
}

// ── EL TEXTO GUARDADO, EN PARTES (18-nov-2026) ───────────────────────────────
// Lo que se firmó vive en `inv_ordenes.texto` como texto plano (`textoPlano`). El PDF y la ventana «Ver mi orden» lo dibujan
// desde ahí —nunca desde la plantilla vigente—: el primer párrafo es el título; los que empiezan con «N. Título.», cláusulas.
export interface ParrafoOrden {
  n: string | null;
  titulo: string | null;
  texto: string;
}

export function partesDeTexto(texto: string): { titulo: string; parrafos: ParrafoOrden[] } {
  const [titulo = "", ...cuerpo] = texto.split(/\n\n+/);
  return {
    titulo,
    parrafos: cuerpo.map((p) => {
      const m = /^(\d+)\. ([^.]+)\. ([\s\S]*)$/.exec(p);
      return m ? { n: m[1], titulo: m[2], texto: m[3] } : { n: null, titulo: null, texto: p };
    }),
  };
}

/** «18 de noviembre de 2026, 08:04», en hora de Chile (la ventana de la orden). */
export function fechaFirmaLarga(iso: string): string {
  const partes = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("day")} de ${v("month")} de ${v("year")}, ${v("hour")}:${v("minute")}`;
}
