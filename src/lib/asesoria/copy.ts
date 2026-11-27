// ─────────────────────────────────────────────────────────────────────────────
// LOS TEXTOS DE LA ASESORÍA (27-nov-2026). Salen de las láminas P0–P7 (artifact «La asesoría en el mapa»); los que faltaban los
// propuso el plan y los aprobó Fabrizio (el de boletas, con su redacción del 27-nov). Toda reacción es una plantilla con cifras
// del motor o de la capacidad: nada inventado. Tuteo chileno, sin voseo.
// ─────────────────────────────────────────────────────────────────────────────
import type { Experiencia, ObjetivoAsesoria, TipoPerfil } from "./capacidad";

export const miles = (n: number): string => Math.round(n).toLocaleString("es-CL");
export const pesos = (n: number): string => `$${miles(n)}`;
export const uf = (n: number): string => `UF ${miles(n)}`;
const pct1 = (x: number): string => (Math.round(x * 10) / 10).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ASESORIA_COPY = {
  franco: "Franco",
  // El encabezado del panel (27-nov-2026, Fabrizio): «Franco · tu perfil de inversión». Ni «con IA» (la entrega 1 es con chips) ni
  // «asesoría de inversión» (término en revisión del abogado): ninguno de los dos aparece en un texto visible.
  encabezado: "tu perfil de inversión",
  cerrar: "Cerrar",
  retomar: "Retomar",
  segmentos: ["Qué buscas", "Hasta dónde llegas", "Dónde"] as const,
  convienen: "convienen",
  // LA CUENTA SOBRE EL MAPA (F19, 27-nov-2026): «3.624 de los 4.512 que convienen te calzan».
  calzanDe: (n: number, convienen: number) => `${miles(n)} de los ${miles(convienen)} que convienen te calzan`,
  burbuja: {
    // La lámina «Con punch, sin abusar» (G24, 27-nov-2026): parte con el número.
    numero: (comprar: number, total: number) => ({ n: miles(comprar), de: `de ${miles(total)} convienen` }),
    revisados: "Revisados anoche, uno por uno",
    titulo: "¿Cuáles te alcanzan a ti?",
    cuerpo: "En 2 minutos te digo hasta cuánto puedes comprar y filtro el mapa para ti.",
    boton: "Partir",
  },
  // P0 · el gancho: parte con la pregunta (tercera vuelta, 27-nov-2026; el universo ya lo mostró la burbuja).
  gancho: {
    pregunta: "Para partir: ¿es tu primera inversión?",
  },
  experiencia: [
    { id: "primera", texto: "Primera vez" },
    { id: "uno", texto: "Ya tengo uno" },
    { id: "varios", texto: "Tengo varios" },
  ] as const satisfies ReadonlyArray<{ id: Experiencia; texto: string }>,
  // P1 · la experiencia
  reaccionExperiencia: {
    primera: "Bien. Al que parte, lo que más le importa es no quedar apretado el primer año. Eso lo voy a cuidar en cada número.",
    uno: "Ya sabes cómo es. Ahora el foco es que este sume sin apretarte.",
    varios: "Ya sabes cómo es. Ahora el foco es que este sume sin apretarte.",
  } satisfies Record<Experiencia, string>,
  primerDepto: { titulo: "Lo que pide un primer depto", pie: "20 %", pieK: "de pie", gastos: "Gastos", gastosK: "de compra", colchon: "Colchón", colchonK: "si no se arrienda" },
  preguntaObjetivo: "¿Qué quieres que haga este depto por ti?",
  objetivo: [
    { id: "arriendo", texto: "Que se pague solo" },
    { id: "plusvalia", texto: "Que gane valor" },
    { id: "ambas", texto: "Las dos" },
    { id: "no_se", texto: "No sé" },
  ] as const satisfies ReadonlyArray<{ id: ObjetivoAsesoria; texto: string }>,
  // P2 · el objetivo
  reaccionObjetivo: {
    arriendo: "Entonces manda el arriendo: cuánto rinde cada UF que pones. Eso se llama cap rate.",
    plusvalia: "Entonces lo que más pesa es la zona. Igual cuido que no te pida mucho al mes.",
    ambas: "Se pueden buscar las dos cosas. Partimos por lo que se puede medir: cuánto rinde cada UF.",
    no_se: "Partimos por lo que se puede medir: cuánto rinde cada UF que pones. Eso se llama cap rate.",
  } satisfies Record<ObjetivoAsesoria, string>,
  // La fila gris (27-nov-2026): la mediana de todo Santiago, como referencia.
  capRate: { nombre: "Cap rate", arriendo: "arriendo del año", precio: "precio", bajada: "Lo que rinde un depto típico de los que convienen", santiago: "Todo Santiago" },
  antesDeNumeros: "Ahora tus números, con rangos. No guardo nada hasta que crees tu cuenta.",
  llenarNumeros: "Llenar tus números",
  // P3 · tus números
  numeros: {
    titulo: "Tus números",
    renta: "Renta líquida al mes",
    tipoRenta: "Cómo recibes tu renta",
    edad: "Edad",
    pie: "Pie ahorrado",
    deudas: "Deudas al mes, con dividendos",
    preaprobacion: "Preaprobación del banco",
    listo: "Listo",
    faltan: (n: number) => `${6 - n} de 6`,
  },
  boletas: "Con boletas, los bancos suelen contar solo una parte de tu renta. Uso el 70 % para no prometerte de más.",
  // P3 · la fórmula
  formula: {
    titulo: "Así lo calculo",
    porRenta: (p: { renta: number; computable: number; pctComputable: number; plazo: number; tasa: string }) => p.pctComputable === 100
      ? `Por tu renta: el dividendo, hasta 25 % de ${pesos(p.renta)}, paga un crédito a ${p.plazo} años al ${p.tasa} %`
      : `Por tu renta: el dividendo, hasta 25 % de ${pesos(p.computable)} (el ${p.pctComputable} % de ${pesos(p.renta)}), paga un crédito a ${p.plazo} años al ${p.tasa} %`,
    // CON LOS GASTOS DE LA COMPRA (27-nov-2026): el crédito más el pie paga el precio y el 4,4 % de gastos.
    porRentaCifra: (credito: number, pie: number | null, total: number) => (pie == null ? `${uf(credito)} ÷ 80 % = ${uf(total)}` : `(${uf(credito)} + tu pie) ÷ 1,044 = ${uf(total)}`),
    porPie: "Por tu pie: el banco presta hasta 80 %. Tu pie paga el 20 % y los gastos de la compra (4,4 %)",
    porPieCifra: (pie: number, total: number) => `${uf(pie)} ÷ 24,4 % = ${uf(total)}`,
    sinPie: "Por tu pie: con menos de UF 300, calculo solo por tu renta",
    // Justo en el máximo no dice «bajo» (paseo del 27-nov-2026: «35 % de tu renta, bajo el 35 %»).
    deudas: (carga: number, max: number) => (carga >= max ? `Tus deudas más el dividendo: ${carga} % de tu renta, justo el ${max} % que mira el banco` : `Tus deudas más el dividendo: ${carga} % de tu renta, bajo el ${max} % que mira el banco`),
    pasa: "Pasa ✓",
    sinCuota: (max: number) => `Tus deudas ya ocupan el ${max} % de tu renta que mira el banco`,
    noPasa: "No queda espacio para un dividendo",
    rangos: "Uso lo más bajo de cada rango, y lo más alto en deudas.",
    verCuenta: "Ver la cuenta",
    ocultarCuenta: "Ocultar la cuenta",
    // LA TARJETA DEL TOPE (G24): la cifra grande y, debajo, los dos límites dibujados como barras.
    puedes: "Puedes comprar hasta aprox.",
    barraRenta: { renta: "Por tu renta", deudas: "Por tu renta y tus deudas" },
    barraPie: (pie: number) => `Con tu pie de ${uf(pie)}, contando gastos`,
    sinPieTope: (tope: number, pie: number) => `Por tu renta llegas hasta aprox. ${uf(tope)}. Para eso necesitas un pie de ${uf(pie)}.`,
    // Solo cuando limita el pie (lámina 3): cuánto llega con UF 100 más.
    frenaPie: (tope: number) => `Lo que te frena es el pie, no la renta. Con UF 100 más llegas a ${uf(tope)}.`,
    sujeto: "Sujeto a evaluación del banco",
    // El plazo corto (punto 5 de Fabrizio, 27-nov-2026): por qué ve menos deptos.
    plazoCorto: (plazo: number, x: number, y: number) => `Con tu plazo de ${plazo} años, convienen ${miles(x)} de los ${miles(y)}.`,
    plazoPorQue: "Con menos años el dividendo sube, y menos deptos se pagan con su arriendo.",
    // Con 0 deptos que le alcanzan (Fabrizio, 27-nov-2026): la palanca ahí mismo, con dos salidas.
    ceroDeptos: "Con estos números, hoy no te alcanza ningún usado de los que convienen.",
    ajustar: "Ajustar mis números",
    seguirIgual: "Seguir igual",
    // La cifra es de usados, y lo dice (ajuste de Fabrizio, 27-nov-2026).
    filtre: (alcanzan: number) => `De los usados que convienen, hoy te alcanzan ${miles(alcanzan)}.`,
    cero: "Con estos números, hoy el banco no te prestaría. Bajar tus deudas es lo primero; mientras, sigues mirando el mapa.",
    seguir: "Seguir",
  },
  // LOS NUEVOS (ajuste de Fabrizio, 27-nov-2026): una salida, no una pregunta. Solo se guarda; no se manda ningún correo todavía.
  nuevos: {
    oferta: "En deptos nuevos el pie se paga en cuotas. Pronto los sumo: ¿te aviso?",
    boton: "Avísame",
    listo: "Listo: te aviso cuando sume los deptos nuevos.",
  },
  // P5 · al mes
  alMes: {
    // LA BUENA NOTICIA (C7 y lámina 4, 27-nov-2026): si con 0 al mes calzan al menos 8 de cada 10 de los que le alcanzan.
    solos: (k: number) => ({ grande: `${k} de cada 10`, chico: "se pagan solos con el arriendo" }),
    solosLinea: (n: number, m: number) => `${miles(n)} de los ${miles(m)} que te alcanzan te dejan plata cada mes, después del dividendo y los gastos.`,
    noPones: "No tienes que poner plata cada mes.",
    puedoPoner: "Puedo poner algo al mes",
    // Sin la buena noticia, el slider con un texto que no promete de más.
    pregunta: "¿Hasta cuánto pondrías al mes sin que te apriete? Mira cómo cambia el mapa.",
    titulo: "Hasta cuánto pongo al mes",
    izq: "Nada",
    der: "$300.000+",
    calzan: "Calzan",
    usados: (n: number) => `${miles(n)} usados`,
    cero: "Nada",
    soloSolos: (n: number) => `Solo los que se pagan solos. Hoy son ${miles(n)} en todo Santiago.`,
    hasta: (a: number) => (a === 0 ? "Nada" : `Hasta ${pesos(a)}`),
    seguir: "Seguir",
    tope: "Esperemos un momento: probaste muchos valores seguidos. Intenta de nuevo en unos minutos.",
  },
  // P6 · dónde
  donde: {
    pregunta: "¿Dónde te gustaría? Toca las comunas en el mapa, o dime qué te importa y las elijo yo.",
    metro: "Cerca del metro",
    rinde: "Donde más rinde",
    elegidas: (n: number) => (n === 1 ? "1 comuna" : `${n} comunas`),
    listo: "Listo",
    rindeElegidas: (cs: string[]) => `Las que más rinden con tus números: ${cs.join(", ")}.`,
  },
  // P7 · la lupa
  lupa: {
    pregunta: "Última: ¿hay algo que el banco miraría con lupa? Una deuda atrasada, boletas hace poco… Queda en tu perfil, para orientarte mejor.",
    no: "No, nada",
    si: "Sí, algo",
    prefiero: "Prefiero no decir",
    reaccionSi: "Le pasa a más gente de la que crees, y tiene arreglo.",
    pasosTitulo: "Antes de pedir el crédito",
    pasos: [
      "Si tienes una deuda atrasada, ponte al día o repacta. Si emites boletas hace poco, junta al menos 12 meses antes de pedir el crédito.",
      "Saca tu informe de deudas de la CMF. Es gratis con ClaveÚnica.",
    ],
    ver: "Ver lo que encontré",
  },
  // El cierre: la cuenta. El título y la bajada van en la hoja de registro (F21: explorar/abierto.ts); el chat de atrás no los repite.
  cierre: {
    // Nunca promete 3 si calzan menos (paseo del 27-nov-2026).
    titulo: (n: number) => (n >= 3 ? "Tu perfil y tus 3 deptos están listos." : n === 0 ? "Tu perfil está listo." : `Tu perfil y ${n === 1 ? "tu depto están listos." : `tus ${n} deptos están listos.`}`),
    cuerpo: (n: number) => (n === 0 ? "Crea tu cuenta gratis y te lo muestro. Trae un crédito de regalo." : `Crea tu cuenta gratis y te ${n === 1 ? "lo" : "los"} muestro. Trae un crédito de regalo.`),
  },
  // El perfil
  perfil: {
    titulo: "Tu perfil",
    tipo: { primer_paso: "Primer paso", rentista: "Rentista", patrimonial: "Patrimonial", equilibrado: "Equilibrado" } satisfies Record<TipoPerfil, string>,
    lineaTipo: {
      primer_paso: "Partes, y lo primero es no quedar apretado.",
      rentista: "Ya tienes y quieres que este se pague solo.",
      patrimonial: "Ya tienes y buscas que gane valor.",
      equilibrado: "Buscas las dos cosas.",
    } satisfies Record<TipoPerfil, string>,
    capacidad: "Puedes comprar hasta aprox.",
    aporte: (a: number) => (a === 0 ? "Sin poner plata al mes" : `Hasta ${pesos(a)} al mes`),
    plazo: (p: number) => `Crédito a ${p} años`,
    // LA PREAPROBACIÓN (C12, 27-nov-2026): una línea según lo que contestó.
    preaprobacion: {
      tengo: "Con preaprobación ya puedes ofertar.",
      tramite: "Con la preaprobación en trámite, apenas salga puedes ofertar.",
      no: "Sin preaprobación, es lo primero que te pediría el banco.",
    },
    encabezadoDeptos: (tope: number, n: number) => `Hasta ${uf(tope)} · ${n === 0 ? "sin deptos todavía" : n === 1 ? "1 depto para ti" : `${n} deptos para ti`}`,
    avisos: {
      boletas: "Con boletas, los bancos piden 2 años de actividad y tus 2 últimas declaraciones de renta.",
      segunda: "Algunos bancos piden 30 % de pie en la segunda vivienda.",
    },
    // Con menos de 3, no dice «3» (paseo del 27-nov-2026).
    tresTitulo: (n: number) => (n >= 3 ? "Tus 3 deptos" : "Tus deptos"),
    // LAS DOS ETIQUETAS (decisión de Fabrizio, 27-nov-2026), solo cuando son verdad (tarjetas.ts).
    masBarato: "El más barato",
    metro: (nombre: string, m: number) => `A ${miles(Math.round(m / 10) * 10)} m del metro ${nombre}`,
    comprar: "Comprar",
    // La prueba de tasa de cada depto (C8): reemplaza a «Si algo se mueve».
    aguanta: "Aguanta si la tasa sube 1 punto",
    conPunto: (x: number) => `Con un punto más de tasa, pones ${pesos(x)} al mes`,
    // Con un solo depto, en singular (paseo del 27-nov-2026).
    seguirDeptos: (n: number) => (n === 1 ? "Seguir con este depto" : "Seguir con estos deptos"),
    menos: (n: number) => `Con todo lo que me dijiste, encontré ${n}.`,
    ninguno: "Con todo lo que me dijiste, hoy no encontré ninguno.",
    sinPalanca: "Si abres las zonas, aparecen más.",
    // Menos de 3 (punto 5): no se rellena; la palanca que más mueve, con la cifra.
    palancaAporte: (a: number, n: number) => `Si pones hasta ${pesos(a)} al mes, aparecen ${miles(n)}.`,
    palancaPie: (p: number, n: number) => `Con un pie de ${uf(p)}, aparecen ${miles(n)}.`,
    flujo: (f: number) => (f >= 0 ? { fuerte: `Te deja ${pesos(f)}`, resto: " al mes" } : { fuerte: `Pones ${pesos(-f)}`, resto: " al mes" }),
    cap: (c: number) => `Cap rate ${pct1(c * 100)} %`,
    ver: "Ver en el mapa",
    lupa: "Los pasos antes de pedir el crédito",
    cargando: "Armando tu perfil…",
    error: "No pudimos armar tu perfil. Intenta de nuevo.",
    reintentar: "Intentar de nuevo",
  },
} as const;

/** «1 de cada 4» con la fracción redondeada a un entero simple. */
export function fraccion(comprar: number, total: number): string {
  if (total <= 0 || comprar <= 0) return "una parte";
  const k = Math.max(1, Math.round(total / comprar));
  return `1 de cada ${k}`;
}
