// ─────────────────────────────────────────────────────────────────────────────
// EL DASHBOARD (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html, decisión de Fabrizio): el copy. El orden es
// «Hola, [nombre]» con la píldora del saldo; la oferta roja de una fila mientras el ticket viva; la franja «Invita a
// alguien»; «Tu selección de esta semana» con la línea del perfil y cuándo se renueva; el mapa de la selección; las
// tarjetas; y, plegados, «Tu perfil de búsqueda» e «Informes realizados». Las reglas puras viven en lib/casa/reglas.ts;
// lo que dice cada pieza, acá. El tier PUERTA-B-DASHBOARD fija cada frase.
// ─────────────────────────────────────────────────────────────────────────────
import { SINGLE_PRICE, fmtCLP } from "@/lib/pricing";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import { TRES_COPY, TRES_PRECIO_CLP } from "@/lib/tres-analisis";
import { PACK_PRECIO_CLP } from "@/lib/lo-que-sigue/oferta-pack";
import { FRECUENCIA_COPY } from "@/lib/guia/inmediato";
import { lista, RANGOS_UF, TIPOLOGIAS_DEPTOS } from "@/lib/deptos/respuesta";

const SUELTO = fmtCLP(SINGLE_PRICE);

export const CASA = {
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  /** La píldora del saldo, arriba a la derecha (lib/casa/reglas.ts › pildoraSaldo): sin análisis lleva «Ver planes». */
  verPlanes: "Ver planes",
  /** El botón de la página (25-oct-2026): el header lo dejó como enlace. */
  nuevoAnalisis: "Nuevo análisis",
  /** LA OFERTA ROJA (una fila), mientras el ticket viva, con o sin saldo. */
  oferta: {
    kicker: (vence: string) => `Solo para cuentas nuevas · vence ${vence}`,
    titulo: `3 análisis por ${fmtCLP(PACK_PRECIO_CLP)}`,
    boton: "Aprovechar",
  },
  /** LA FRANJA NEGRA «Invita a alguien». */
  invita: {
    titulo: "Invita a alguien",
    bajada: "Si entra con tu enlace, los dos reciben un análisis.",
    boton: "Compartir",
    copiado: "Enlace copiado",
  },
  /** «TU SELECCIÓN DE ESTA SEMANA»: la línea del perfil y cuándo se renueva (lib/casa/reglas.ts › lineaRenueva). */
  seleccion: {
    titulo: "Tu selección de esta semana",
    renuevaDiaria: FRECUENCIA_COPY.renuevaDiaria,
    /** Sin selección todavía (la cola del día revisa fichas): la primera selección pregunta sola. */
    verMas: (n: number) => (n === 1 ? "Ver el que falta" : `Ver los ${n} que faltan`),
    analizar: "Analizar este",
    analizarRegalo: "Analizar este · usa tu regalo",
    yaAnalizado: "Ya lo analizaste",
    verInforme: "Ver informe",
  },
  sin: {
    titulo: (informes: number) => (informes === 0 ? "Todavía no tienes análisis." : informes === 1 ? "Tu primer informe ya está en tu cuenta." : `Tus ${informes} informes están en tu cuenta.`),
    bajada: `Para analizar otros: 3 análisis por ${fmtCLP(TRES_PRECIO_CLP)}, sin caducidad.`,
    boton: TRES_COPY.boton,
    suelto: `O uno solo · ${SUELTO}`,
    planes: "Ver planes",
    plano: "No te quedan análisis.",
  },
  // El regalo (16-oct-2026): el de registrarse, el de reactivación o el viejo de los 14 días.
  regalo: {
    titulo: "Tienes un análisis de regalo.",
    boton: "Analizar otro depto",
    botonPrimero: "Analizar un depto",
  },
  con: {
    titulo: (n: number) => (n === 1 ? "Te queda 1 análisis" : `Te quedan ${n} análisis`),
    noVencen: "No vencen.",
    boton: "Analizar otro depto",
  },
  plan: {
    titulo: "Tu plan Ilimitado está activo.",
    bajada: "Analizar no descuenta de tu saldo.",
    boton: "Analizar otro depto",
  },
  guiaTitulo: "Te recomendamos empezar por estos",
  /** «TU PERFIL DE BÚSQUEDA», plegado y abierto (mockup 3b). */
  perfil: {
    titulo: "Tu perfil de búsqueda",
    queBuscas: "¿Qué buscas?",
    editar: "Editar",
    /** Las dos preguntas pendientes (solo a quien entró por /deptos o por invitación). */
    pendientes: "Dos preguntas pendientes",
    pendiente: "Una pregunta pendiente",
    como: "¿Cómo lo arriendas?",
    modalidad: { ltr: "Arriendo tradicional", str: "Renta corta" } as Record<"ltr" | "str", string>,
    cuando: "¿Cuándo piensas comprar?",
    // Renombrado el 16-oct-2026 (decisión de Fabrizio): «Ya» desaparece, va «Quiero comprar ya»; el valor guardado sigue siendo 'ya'.
    horizonte: { ya: "Quiero comprar ya", meses: "En los próximos meses", mirando: "Solo estoy mirando" } as Record<"ya" | "meses" | "mirando", string>,
    /** La regla que acompaña al copy (24-oct-2026): con «Quiero comprar ya», una selección diaria. */
    nota: FRECUENCIA_COPY.nota,
    guardar: "Guardar",
    guardando: "Guardando…",
    guardado: "Guardado.",
    proxima: "Tu próxima selección se arma con esto.",
    agregarComuna: "+ agregar otra comuna",
    pieEtiqueta: "Pie",
    plazoEtiqueta: "Plazo",
    tope: (uf: string) => `Hasta UF ${uf}`,
    rango: (min: string, max: string) => `UF ${min} a ${max}`,
    sinTope: "Precio tope",
    varias: (dorms: number[]) => `${dorms.map((d) => (d === 0 ? "Studio" : String(d))).join(", ").replace(/, ([^,]*)$/, " y $1")} dormitorios`,
    sinTipologia: "Tipología",
    pie: (p: string) => `Pie ${p} %`,
    plazo: (a: number) => `${a} años`,
    dormitorios: (d: number) => (d === 0 ? "Studio" : d === 1 ? "1 dormitorio" : `${d} dormitorios`),
    error: "No pudimos guardarlo. Intenta de nuevo.",
  },
  /** «INFORMES REALIZADOS», plegado, al final. */
  informes: "Informes realizados",
} as const;

/** El saldo en una línea, para el dashboard vacío (14-oct-2026: el saldo o el plan, visible arriba para cualquier
 *  cuenta). Sin saldo no hay línea: ahí manda el botón al primer análisis. */
export function lineaSaldo(e: EstadoSaldo): string | null {
  return e.tipo === "con" ? CASA.con.titulo(e.n) : e.tipo === "plan" ? CASA.plan.titulo : e.tipo === "regalo" ? CASA.regalo.titulo : null;
}

/** «Providencia · 2 dormitorios · UF 3.000 a 4.000 · Pie 20 % · 30 años»: la frase del perfil abierto. */
export function frasePerfil(p: { linea: string; piePct: number | null; plazoAnios: number | null }): string {
  const pct = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
  return [p.linea, p.piePct != null ? CASA.perfil.pie(pct(p.piePct)) : null, p.plazoAnios != null ? CASA.perfil.plazo(p.plazoAnios) : null].filter(Boolean).join(" · ");
}

/** «Providencia · 2D · UF 3.000 a 4.000 · 20 % · 30 años»: la línea corta de la fila plegada. */
export function lineaCorta(p: { comunas: string[]; dormitorios: number[]; rango: string | null; piePct: number | null; plazoAnios: number | null }): string {
  const dorms = p.dormitorios.length === 0 ? null : `${[...p.dormitorios].sort((a, b) => a - b).map((d) => (d === 0 ? "S" : String(d))).join("+")}D`;
  const pie = p.piePct != null ? `${String(Math.round(p.piePct * 10) / 10).replace(".", ",")} %` : null;
  const plazo = p.plazoAnios != null ? `${p.plazoAnios} años` : null;
  return [p.comunas.join(", "), dorms, p.rango, pie, plazo].filter(Boolean).join(" · ");
}

/** «Providencia · 2 dormitorios · UF 3.000 a 4.000»: la búsqueda en una línea, para «Tu selección de esta semana» (sin pie
 *  ni plazo). Lo que no es una opción de /deptos se dice como es («1 y 2 dormitorios», «Hasta UF 4.500»). */
export function lineaBusqueda(p: { comunas: string[]; dormitorios: number[]; precioMinUf: number | null; precioMaxUf: number | null }): string {
  const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
  const dorms = [...p.dormitorios].sort((a, b) => a - b);
  const t = TIPOLOGIAS_DEPTOS.find((x) => x.dorms.length === dorms.length && x.dorms.every((d, i) => d === dorms[i]));
  const tipologia = t ? t.nombre : dorms.length === 0 ? null : CASA.perfil.varias(dorms);
  const r = p.precioMaxUf != null ? RANGOS_UF.find((x) => x.max === p.precioMaxUf && (x.min ?? null) === (p.precioMinUf ?? null)) : undefined;
  const rango = r ? r.chip : p.precioMaxUf == null ? null : p.precioMinUf != null ? CASA.perfil.rango(miles(p.precioMinUf), miles(p.precioMaxUf)) : CASA.perfil.tope(miles(p.precioMaxUf));
  return [lista(p.comunas), tipologia, rango].filter(Boolean).join(" · ");
}
