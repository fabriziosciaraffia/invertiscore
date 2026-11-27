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
  calzanContigo: "calzan contigo",
  burbuja: {
    titulo: "¿Cuáles de estos te alcanzan?",
    cuerpo: "En 2 minutos te digo hasta cuánto puedes comprar y filtro el mapa para ti.",
    boton: "Partir",
  },
  // P0 · el gancho
  gancho: {
    revise: (n: number, frac: string) => `Revisé todos los deptos usados que hay a la venta en Santiago. Solo ${frac} conviene como inversión.`,
    tarjeta: (n: number) => `${miles(n)} deptos usados revisados`,
    clases: { comprar: "Comprar", ajustar: "Ajustar", no: "No conviene" },
    pregunta: "En 2 minutos te muestro cuáles te convienen a ti. Para partir: ¿es tu primera inversión?",
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
  capRate: { nombre: "Cap rate", arriendo: "arriendo del año", precio: "precio", bajada: "Lo que rinden hoy los que convienen" },
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
    porRentaCifra: (credito: number, pie: number | null, total: number) => (pie == null ? `${uf(credito)} ÷ 80 % = ${uf(total)}` : `${uf(credito)} + tu pie = ${uf(total)}`),
    porPie: "Por tu pie: el banco presta hasta 80 %, así que tu pie es el 20 %",
    porPieCifra: (pie: number, total: number) => `${uf(pie)} ÷ 20 % = ${uf(total)}`,
    sinPie: "Por tu pie: con menos de UF 300, calculo solo por tu renta",
    deudas: (carga: number, max: number) => `Tus deudas más el dividendo: ${carga} % de tu renta, bajo el ${max} % que mira el banco`,
    pasa: "Pasa ✓",
    sinCuota: (max: number) => `Tus deudas ya ocupan el ${max} % de tu renta que mira el banco`,
    noPasa: "No queda espacio para un dividendo",
    rangos: "Uso lo más bajo de cada rango, y lo más alto en deudas.",
    manda: { pie: "Manda el menor, tu pie. Puedes comprar hasta aprox.", renta: "Manda el menor, tu renta. Puedes comprar hasta aprox.", deudas: "Mandan tus deudas. Puedes comprar hasta aprox." },
    sinPieTope: (tope: number, pie: number) => `Por tu renta llegas hasta aprox. ${uf(tope)}. Para eso necesitas un pie de ${uf(pie)}.`,
    sujeto: "Sujeto a evaluación del banco",
    // El plazo corto (punto 5 de Fabrizio, 27-nov-2026): por qué ve menos deptos.
    plazoCorto: (plazo: number, x: number, y: number) => `Con tu plazo de ${plazo} años, convienen ${miles(x)} de los ${miles(y)}.`,
    plazoPorQue: "Con menos años el dividendo sube, y menos deptos se pagan con su arriendo.",
    filtre: (convienen: number, alcanzan: number) => `Ya filtré el mapa: de los ${miles(convienen)} que convienen, ${miles(alcanzan)} te alcanzan.`,
    cero: "Con estos números, hoy el banco no te prestaría. Bajar tus deudas es lo primero; mientras, sigues mirando el mapa.",
    seguir: "Seguir",
  },
  // P5 · al mes
  alMes: {
    pregunta: "Al principio, casi todo depto pide poner algo al mes. ¿Hasta cuánto pondrías sin que te apriete? Mira cómo cambia el mapa.",
    titulo: "Hasta cuánto pongo al mes",
    izq: "Me sobra plata",
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
    pega: "Cerca de mi pega",
    tocaPega: "Toca en el mapa dónde trabajas. Busco a 3 km a la redonda.",
    elegidas: (n: number) => (n === 1 ? "1 comuna" : `${n} comunas`),
    listo: "Listo",
    rindeElegidas: (cs: string[]) => `Las que más rinden con tus números: ${cs.join(", ")}.`,
  },
  // P7 · la lupa
  lupa: {
    pregunta: "Última: ¿hay algo que el banco miraría con lupa? Una deuda atrasada, boletas hace poco… Esto no lo ve nadie más.",
    no: "No, nada",
    si: "Sí, algo",
    prefiero: "Prefiero no decir",
    reaccionSi: "Le pasa a más gente de la que crees, y tiene arreglo.",
    pasosTitulo: "Antes de pedir el crédito",
    pasos: [
      "Ponte al día o repacta. El banco mira cómo vas pagando.",
      "Saca tu informe de deudas de la CMF. Es gratis con ClaveÚnica.",
      "Mientras, sigues mirando deptos. Los pasos quedan en tu perfil.",
    ],
    ver: "Ver lo que encontré",
  },
  // El cierre: la cuenta
  cierre: {
    titulo: "Tu perfil y tus 3 deptos están listos.",
    cuerpo: "Crea tu cuenta gratis para verlos. Tu cuenta nueva trae un crédito de regalo.",
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
    estresTitulo: "Si algo se mueve",
    subeTasa: (x: number) => `Si la tasa sube 1 punto, tu dividendo sube ${pesos(x)} al mes.`,
    mesVacio: (y: number) => `Con un mes sin arrendatario al año, pondrías ${pesos(y)} al mes.`,
    avisos: {
      boletas: "Con boletas, los bancos piden 2 años de actividad y tus 2 últimas declaraciones de renta.",
      segunda: "Algunos bancos piden 30 % de pie en la segunda vivienda.",
      estimacion: "Estimación, sujeta a evaluación del banco.",
    },
    tresTitulo: "Tus 3 deptos",
    porQue: { rinde: "El que mejor rinde", pide_menos: "El que pide menos al mes", distinto: "Uno distinto", otro: "Otro que te calza" },
    menos: (n: number) => `Con todo lo que me dijiste, encontré ${n}.`,
    ninguno: "Con todo lo que me dijiste, hoy no encontré ninguno.",
    sinPalanca: "Si abres las zonas, aparecen más.",
    // Menos de 3 (punto 5): no se rellena; la palanca que más mueve, con la cifra.
    palancaAporte: (a: number, n: number) => `Si pones hasta ${pesos(a)} al mes, aparecen ${miles(n)}.`,
    palancaPie: (p: number, n: number) => `Con un pie de ${uf(p)}, aparecen ${miles(n)}.`,
    flujo: (f: number, plazo: number) => (f >= 0 ? `Te sobran ${pesos(f)} al mes a ${plazo} años` : `Pones ${pesos(-f)} al mes a ${plazo} años`),
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
