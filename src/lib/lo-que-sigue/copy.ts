// ─────────────────────────────────────────────────────────────────────────────
// El copy de «Lo que sigue» (28-sep-2026, mockup v3; copy nuevo del 30-sep-2026). Voz de Franco:
// directo, en tuteo, sin urgencia inventada, sin «desde», sin «guarda tu informe». Desde el 08-oct-2026
// el banner y el ticket dicen qué es cada uno y ya no cambian con el veredicto. Todo el texto de las
// ofertas, del «Estás dentro», del después de pagar y del correo vive acá: el tier vigila el tuteo.
// ─────────────────────────────────────────────────────────────────────────────

export type VeredictoLqs = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

export function veredictoLqs(v: string | null | undefined): VeredictoLqs {
  return v === "COMPRAR" || v === "BUSCAR OTRA" ? v : "AJUSTA SUPUESTOS";
}


// ── 1 · El banner del registro ───────────────────────────────────────────────
// 08-oct-2026: que se entienda qué es. Una cinta en la página (la barra fija salió) con lo que recibe
// quien se registra: la selección semanal. Ya no cambia con el veredicto.
// Segunda pasada (mismo día): a la mitad de alto. La línea de arriba con «Accede gratis» en negrita; el
// titular, una línea con la urgencia; debajo, en negrita, lo que recibe; la bajada en gris.
export const OFERTA_REGISTRO = {
  ojoFuerte: "Accede gratis",
  ojoResto: " · solo con tu correo",
  titular: "Los deptos que convienen como inversión se van rápido.",
  registro: "Regístrate y Franco te manda cada semana una selección según tu perfil.",
  bajada: "Deptos publicados que dan Comprar con tu pie y tu plazo, chequeados ese mismo día.",
  paraTi: "Para ti:",
  boton: "Quiero recibirlos",
} as const;

export const REGISTRO_UN_PASO = {
  ojo: "Quiero recibirlos",
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
  // 08-oct-2026, segunda pasada: lo elegido se ve elegido, y se dice que quedó anotado.
  anotado: "Anotado · toca para cambiar",
  avisoYa: "Te avisamos el mismo día que aparezca uno",
} as const;

/** Lo que va a la derecha del «¿Cuándo piensas comprar?»: nada antes de elegir; con «Ya», el aviso. */
export function notaCuando(h: HorizonteCompra | null): string | null {
  if (!h) return null;
  return h === "ya" ? ESTAS_DENTRO.avisoYa : ESTAS_DENTRO.anotado;
}

/** Lo que va junto a los chips del perfil: «toca para cambiar», y «Anotado…» después de cambiar uno. */
export function notaChips(cambiados: boolean): string {
  return cambiados ? ESTAS_DENTRO.anotado : ESTAS_DENTRO.tocaCambiar;
}

// ── 4 · El ticket del pack ───────────────────────────────────────────────────
// 08-oct-2026: que se entienda qué es. La primera línea dice el pack y el precio (el de referencia,
// tachado); después qué es, que comprar registra, el botón y hasta cuándo. El veredicto ya no cambia
// el ticket. La oferta persiste en el informe (mismo navegador o con sesión): por eso «guarda el enlace».
export const TICKET_PACK = {
  /** El titular, en una línea: «Pack · 3 análisis por $14.990». Debajo, más chico, la referencia tachada
   *  + « $4.997 cada uno» (`cadaUno`). Tercera pasada, 08-oct-2026. */
  linea: (precio: string) => `Pack · 3 análisis por ${precio}`,
  cadaUno: (unitario: string) => ` ${unitario} cada uno`,
  cuerpo: "El mismo informe que acabas de leer, para tres deptos más.",
  /** El cuerpo son tres líneas en un solo tamaño: `cuerpo` normal, y `cuerpoFuerte` y `negrita` enteras en
   *  negrita (corrección de Fabrizio, 08-oct-2026). */
  cuerpoFuerte: "La mitad del precio, solo para usuarios nuevos.",
  negrita: "Al comprar quedas registrado y además recibes cada semana oportunidades que puedes evaluar con tu pack.",
  boton: (precio: string) => `Comprar por ${precio}`,
  vencimiento: (cuando: string) => `Solo para usuarios nuevos, en este informe · hasta ${cuando} · si te vas, guarda el enlace`,
  placeholderCorreo: "tu@correo.cl",
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
// 30-sep-2026: el copy nuevo, con la guía de búsqueda debajo. La frase de Buscar otro nombra la guía
// («Abajo, deptos parecidos…»): donde no hay guía (renta corta) va la de antes.
// 02-oct-2026: el titular dice el SALDO REAL de la cuenta (no «3» fijo); `null` = no se pudo leer.
export const DESPUES_DE_PAGAR = {
  titular: (n: number | null): string => (n == null ? "Tus análisis ya están en tu cuenta." : n <= 0 ? "Ya usaste tus análisis." : `Tienes ${n} análisis.`),
  cuerpo: "El próximo es más fácil: tus números del primer informe ya están cargados.",
  boton: "Analizar el próximo",
  fraseVeredicto: {
    "BUSCAR OTRA": "Mismo pie, mismo plazo. Abajo, deptos parecidos ya revisados con tus números.",
    "AJUSTA SUPUESTOS": "Compara y mira si alguno conviene sin negociar, y así tienes con qué presionar.",
    COMPRAR: "Compara y mira si este sigue siendo el mejor.",
  } as Record<VeredictoLqs, string>,
  buscarSinGuia: "Mismo pie, mismo plazo. Solo falta el próximo depto.",
} as const;

// 02-oct-2026: sin sesión y sin la firma del pago, la pantalla NO sabe si el pago pasó: no dice «Pago
// recibido» ni «Tus 3 análisis». Pide entrar. `paraEntrar` es la línea de después de pagar sin sesión,
// cuando el pago sí se verificó con la firma.
export const RETORNO_SIN_SESION = {
  titulo: "Entra para ver tu pago.",
  cuerpo: "Pide tu código con el mismo correo con que pagaste y lo verás en tu cuenta.",
  boton: "Entrar con mi correo",
  paraEntrar: "Para entrar, pide tu código con el mismo correo del pago.",
} as const;

/** El enlace de pago abierto con la sesión de OTRA cuenta (02-oct-2026): antes quedaba cargando. */
export const PAGO_OTRA_CUENTA = {
  titulo: "Este pago es de otra cuenta.",
  cuerpo: "Entra con el correo con que pagaste.",
  boton: "Entrar con otro correo",
} as const;

/** El pago del pack que no pasó, visto sin sesión con la firma: lo dice y vuelve al informe. */
export const PAGO_PACK_NO_PASO = {
  titulo: "El pago no pasó.",
  cuerpo: "Flow lo rechazó o se canceló. No se hizo ningún cargo.",
  volver: "Volver a mi informe",
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
