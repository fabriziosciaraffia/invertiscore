// ─────────────────────────────────────────────────────────────────────────────
// El copy de «Lo que sigue» (28-sep-2026, mockup v3; copy nuevo del 30-sep-2026). Voz de Franco:
// directo, en tuteo, sin urgencia inventada, sin «desde», sin «guarda tu informe». Lo que cambia con
// el veredicto es la frase que presenta cada oferta, no la oferta. Todo el texto de las ofertas, del
// «Estás dentro», del después de pagar y del correo vive acá: el tier vigila el tuteo en este módulo.
// ─────────────────────────────────────────────────────────────────────────────

export type VeredictoLqs = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

export function veredictoLqs(v: string | null | undefined): VeredictoLqs {
  return v === "COMPRAR" || v === "BUSCAR OTRA" ? v : "AJUSTA SUPUESTOS";
}

/** «UF 4.175»: el precio del motor como lo lee el ticket. */
export const ufTexto = (uf: number) => `UF ${Math.round(uf).toLocaleString("es-CL")}`;

// ── 1 · El banner del registro ───────────────────────────────────────────────
export const FRASE_REGISTRO: Record<VeredictoLqs, string> = {
  "BUSCAR OTRA": "Este depto no conviene. Franco ya tiene los que sí.",
  "AJUSTA SUPUESTOS": "Este depto conviene si lo negocias. Franco tiene los que convienen tal como están.",
  COMPRAR: "Este depto conviene. Y Franco tiene más oportunidades como esta.",
};

export const OFERTA_REGISTRO = {
  ojo: "Lo que sigue",
  cuerpo: "Franco tiene un portafolio de deptos para invertir, y todos pasaron por este mismo análisis. Estamos abriendo el acceso: quien entra ahora, lo recibe antes.",
  paraTi: "Para ti:",
  boton: "Quiero acceso",
  bajoBoton: "Gratis. Solo tu correo.",
  // 2 · La barra fija
  barraTitulo: "Las oportunidades que otros no ven.",
  barraSub: "Solo para usuarios de Franco.",
  barraBoton: "Quiero acceso",
} as const;

export const REGISTRO_UN_PASO = {
  ojo: "Quiero acceso",
  titular: "Un correo y listo.",
  plumon: "Sin contraseña.",
  placeholder: "tu@correo.cl",
  placeholderCodigo: "Código",
  mandarCodigo: "Mandar el código",
  entrar: "Entrar",
  o: "o",
  google: "Seguir con Google",
  pie: "Te mandamos un código para entrar. Este informe queda en tu cuenta.",
  enviadoTitular: "Revisa tu correo.",
  enviadoPlumon: "El código ya salió.",
  enviadoCuerpo: (correo: string) => `Lo mandamos a ${correo}. Escríbelo acá y este informe queda en tu cuenta, sin salir de la página.`,
  enlaceAlternativa: "El correo también trae un enlace: si lo abres, vuelves a este mismo informe con tu cuenta.",
  seguir: "Seguir leyendo",
  errorCorreo: "Ese correo no se entiende. Revísalo.",
  errorEnvio: "No pudimos mandar el código. Intenta de nuevo.",
  errorCodigo: "El código son 6 dígitos.",
  errorCodigoMal: "Ese código no sirve o venció. Pide otro.",
} as const;

// ── 3 · Después del código, en el mismo lugar ────────────────────────────────
export type HorizonteCompra = "ya" | "meses" | "mirando";
export const ESTAS_DENTRO = {
  titular: "Estás dentro.",
  cuerpo: "Te escribimos apenas tengamos una oportunidad que calce con lo que buscas:",
  tocaCambiar: "toca para cambiar",
  aprende: "Cada depto que analices le enseña a Franco qué buscarte.",
  cuando: "¿Cuándo piensas comprar?",
  horizontes: [
    { id: "ya", texto: "Ya" },
    { id: "meses", texto: "En los próximos meses" },
    { id: "mirando", texto: "Solo estoy mirando" },
  ] as ReadonlyArray<{ id: HorizonteCompra; texto: string }>,
  modalidad: { ltr: "Renta larga", str: "Renta corta" } as Record<"ltr" | "str", string>,
  errorGuardar: "No pudimos anotarlo. Intenta de nuevo.",
} as const;

// ── 4 · El ticket del pack ───────────────────────────────────────────────────
/** La primera línea del ticket: con el precio al que CIERRA este depto, del motor, en UF. Sin él, la
 *  misma frase sin la cifra (nunca se inventa un número). `unitario` es «$5.000». */
export function leadTicket(v: VeredictoLqs, precioCierreUF: number | null, unitario: string): string {
  if (v === "BUSCAR OTRA") {
    const cola = `Equivocarte con un depto cuesta millones. Saberlo antes, ${unitario}.`;
    return precioCierreUF ? `Para que este conviniera, tendría que costar ${ufTexto(precioCierreUF)}. ${cola}` : `Este no conviene. ${cola}`;
  }
  if (v === "AJUSTA SUPUESTOS") {
    const cola = "Mientras negocias, compáralo con otros de la zona: si hay uno que conviene sin negociar, tienes con qué presionar.";
    return precioCierreUF ? `Este conviene si te lo dejan en ${ufTexto(precioCierreUF)}. ${cola}` : `Este conviene si lo negocias. ${cola}`;
  }
  return "Este conviene. Antes de firmar, compáralo con dos parecidos. Si es el mejor, firmas tranquilo.";
}

export const TICKET_PACK = {
  ojo: "Lo que sigue",
  titulo: (precio: string) => `3 análisis por ${precio}`,
  ahorro: (unitario: string, referencia: string) => `${unitario} cada uno en vez de ${referencia}.`,
  vence: (dia: "hoy" | "mañana" | "otro", hora: string) => (dia === "otro" ? `Vence a las ${hora}` : `Vence ${dia} a las ${hora}`),
  boton: "Quiero los 3 análisis",
  placeholderCorreo: "tu@correo.cl",
  piePago: "Con tu correo queda tu cuenta, sin contraseña, y este informe adentro. Boleta al mismo correo.",
  pestana: (precio: string, hora: string) => `3 análisis por ${precio} · hasta las ${hora}`,
  errorCorreo: "Ese correo no se entiende. Revísalo.",
  errorPago: "No pudimos abrir el pago. Intenta de nuevo.",
  vencido: "Ese precio venció y no vuelve.",
  seguir: "Seguir leyendo",
  despedida: (hora: string) => `Vence a las ${hora} y no vuelve.`,
  despedidaAhorro: (ahorro: string) => `Son ${ahorro} menos en tus próximos tres análisis. ¿La dejas pasar?`,
  comprar: "Quiero los 3 análisis",
  siSeguir: "Sí, seguir leyendo",
  cerrar: "Cerrar",
} as const;

// ── 5 · Después de pagar ─────────────────────────────────────────────────────
export const DESPUES_DE_PAGAR = {
  titular: "Tienes 3 análisis.",
  cuerpo: "El próximo toma un minuto: tus números ya están cargados.",
  boton: "Analizar el próximo",
  fraseVeredicto: {
    "BUSCAR OTRA": "Mismo pie, mismo plazo. Solo falta el próximo depto.",
    "AJUSTA SUPUESTOS": "Pon uno de la zona y compáralo con este.",
    COMPRAR: "Pon los dos parecidos y mira si este sigue siendo el mejor.",
  } as Record<VeredictoLqs, string>,
} as const;

export const RETORNO_SIN_SESION = {
  titulo: "Pago recibido.",
  cuerpo: "Tus 3 análisis ya están en tu cuenta. Para entrar, pide tu código con el mismo correo del pago.",
  boton: "Entrar con mi correo",
} as const;

export const CHECKOUT_PACK = {
  titulo: "Franco — 3 análisis",
  subtitulo: "3 análisis, sin caducidad",
  vence: (dia: "hoy" | "mañana" | "otro", hora: string) => (dia === "otro" ? `Vence a las ${hora}.` : `Vence ${dia} a las ${hora}.`),
  vencido: "Ese precio venció y no vuelve. Un análisis cuesta $9.990, y los planes siguen en su precio.",
} as const;

// ── 6 · Comparar ─────────────────────────────────────────────────────────────
export const COMPARAR = {
  titulo: "Compara tus análisis",
  bajada: "Lado a lado, con el motor de hoy. Elige dos o más.",
  boton: "Comparar",
  filas: { veredicto: "Veredicto", precio: "Precio", flujo: "Flujo mensual", resultado: "Resultado a 10 años" },
  notaPesos: "Montos a 10 años en pesos de hoy.",
  minimo: "Elige al menos dos análisis.",
} as const;

// ── 7 · El correo si no usa los análisis ─────────────────────────────────────
export const CORREO_RECORDATORIO = {
  asunto: "Te quedan 3 análisis, con tus números ya cargados.",
  cuerpo: "El próximo toma un minuto: tu pie, tu tasa y tu plazo ya están puestos. Solo falta el depto.",
  boton: "Analizar el próximo",
  pie: "Tus 3 análisis no vencen. Te escribimos esta vez y no volvemos a insistir.",
} as const;
