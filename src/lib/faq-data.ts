import { PROPERTIES_COUNT } from "@/lib/stats";

export interface FAQItem {
  id: string;
  q: string;
  a: string;
}

export interface FAQSection {
  title: string;
  items: FAQItem[];
}

/**
 * Fuente única de FAQ. Antes coexistían dos arrays: el completo en
 * `faq/page.tsx` y un teaser de 4 ítems en `pricing/page.tsx` (drift de copy
 * en "¿Necesitas factura?"). Ahora ambas páginas leen de acá.
 *
 * `pricing/page.tsx` arma su teaser con `getFAQItemsByIds()` y los ids
 * estables ("caducan", "cambiar-plan", "cancelar", "factura"). El resto de
 * los ids son slugs estables para futuras referencias cruzadas.
 */
export const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Sobre Franco",
    items: [
      {
        id: "que-es-franco",
        q: "¿Qué es Franco?",
        a: "Franco es una plataforma que analiza departamentos como inversión en Chile. Te dice si un depto es buen negocio, a qué precio conviene y qué retorno puedes esperar — con datos reales, no con la opinión de un corredor.",
      },
      {
        id: "que-es-franco-score",
        q: "¿Qué es el Franco Score?",
        a: "Es un puntaje de 1 a 100 que evalúa qué tan buena inversión es un departamento, considerando rentabilidad, flujo de caja, plusvalía esperada, riesgo y eficiencia del capital. A mayor score, mejor inversión.",
      },
      {
        id: "veredictos",
        q: "¿Qué significan los veredictos?",
        a: "COMPRAR significa que los números cierran bien. AJUSTA SUPUESTOS significa que hay potencial pero algún supuesto (precio, ocupación, estructura) hace que la operación quede justa — revisa antes de avanzar. BUSCAR OTRA significa que los números no cierran y probablemente hay mejores opciones.",
      },
      {
        id: "datos",
        q: "¿De dónde salen los datos?",
        a: `Analizamos información de mercado de ${PROPERTIES_COUNT} propiedades en 24 comunas de Santiago. Los datos incluyen precios de venta, arriendos y condiciones actuales del mercado.`,
      },
      {
        id: "confiabilidad",
        q: "¿Qué tan confiable es el análisis?",
        a: "Franco usa los mismos modelos financieros que usan los inversionistas profesionales: TIR, cash-on-cash, rentabilidad neta, proyecciones de flujo. La diferencia es que lo automatizamos y lo hacemos accesible. Dicho esto, ningún modelo predice el futuro con certeza — Franco te da la mejor foto posible con los datos disponibles.",
      },
      {
        id: "reemplaza-corredor",
        q: "¿Franco reemplaza a un corredor?",
        a: "No. Franco complementa tu proceso de decisión. Un corredor te muestra propiedades y gestiona la transacción; Franco te dice si esa propiedad es buen negocio como inversión, con datos.",
      },
      {
        id: "saber-finanzas",
        q: "¿Necesito saber de finanzas para entender el análisis?",
        a: "No. Franco traduce los números a un veredicto claro —COMPRAR, AJUSTA SUPUESTOS o BUSCAR OTRA— con recomendaciones concretas. Si quieres entrar al detalle de los cálculos, están todos disponibles; pero no necesitas hacerlo para decidir.",
      },
      {
        id: "datos-previos",
        q: "¿Necesito juntar la tasa de mi crédito, los precios de arriendo, los gastos comunes y todo eso antes de analizar?",
        a: "No. Con la dirección de la propiedad basta para partir. El resto lo completamos con parámetros de mercado, y tú los ajustas si tienes datos más precisos.",
      },
    ],
  },
  {
    title: "Sobre el pago",
    items: [
      {
        id: "que-incluye",
        q: "¿Qué incluye el análisis?",
        a: "Un análisis con IA personalizado: veredicto y precio sugerido, proyecciones de patrimonio y flujo a 20 años, escenarios de salida (venta y refinanciamiento), panel para ajustar variables de financiamiento, y análisis de sensibilidad con 3 escenarios. Es un solo análisis que entrega toda la información, en la modalidad que elijas: arriendo largo plazo, Airbnb o ambas comparadas.",
      },
      {
        id: "analizar-varios",
        q: "¿Puedo analizar varios departamentos?",
        a: "Sí. Puedes analizar cuantos quieras — cada departamento es un análisis. El primero es gratis; para seguir, compras análisis o te suscribes a un plan mensual con varios incluidos.",
      },
      {
        id: "comparar-analisis",
        q: "¿Puedo comparar mis análisis?",
        a: "Sí. Desde tu dashboard puedes seleccionar hasta 3 departamentos que ya analizaste y verlos lado a lado: score, rentabilidad, flujo y proyección a 10 años, con un veredicto automático de cuál es la mejor inversión y por qué.",
      },
      {
        id: "caro-complejo",
        q: "Me parece caro y complejo.",
        a: "En 30 segundos obtienes un análisis de inversión equivalente al de un equipo de finanzas corporativo, por el precio de dos cafés. Y el primero es gratis, te lo regalamos.",
      },
      {
        id: "factura",
        q: "¿Necesitas factura?",
        a: "Cada compra genera una boleta, y junto a ella te llega un correo con los pasos para convertirla en factura. El trámite es simple y lo haces tú mismo.",
      },
    ],
  },
  {
    title: "Sobre planes y suscripción",
    items: [
      {
        id: "caducan",
        q: "¿Los análisis caducan?",
        a: "1 análisis: no caduca. Suscripciones: acumulables hasta 1 año, luego se resetea.",
      },
      {
        id: "cambiar-plan",
        q: "¿Puedo cambiar de plan?",
        a: "Sí, en cualquier momento. Ajustes aplican al siguiente ciclo.",
      },
      {
        id: "cancelar",
        q: "¿Qué pasa si cancelo?",
        a: "Mantienes acceso hasta el fin del ciclo pagado.",
      },
    ],
  },
  {
    title: "Sobre inversión inmobiliaria",
    items: [
      {
        id: "flujo-negativo",
        q: "¿Por qué el 95% de los deptos tiene flujo negativo?",
        a: "Con las tasas hipotecarias actuales en Chile (~4-5%), es matemáticamente casi imposible que el arriendo cubra el dividendo más gastos. Eso no significa que sea mala inversión — significa que la rentabilidad viene de la plusvalía y la amortización del crédito, no del flujo mensual.",
      },
      {
        id: "conviene-invertir",
        q: "¿Entonces conviene invertir o no?",
        a: "Depende de cada caso. Un depto con flujo negativo de $50.000/mes puede ser excelente inversión si la plusvalía y amortización generan un retorno de 3-4x en 10 años. Franco te ayuda a ver ese panorama completo.",
      },
    ],
  },
  {
    title: "Legal",
    items: [
      {
        id: "asesor-financiero",
        q: "¿Franco es asesor financiero?",
        a: "No. Franco es una herramienta informativa que analiza datos de mercado. No constituye asesoría financiera, tributaria ni recomendación de inversión. Las decisiones de inversión son responsabilidad exclusiva del usuario.",
      },
      {
        id: "datos-seguros",
        q: "¿Mis datos están seguros?",
        a: "Sí. Usamos encriptación SSL, autenticación segura con Supabase y no compartimos tus datos personales con terceros. Los pagos se procesan de forma segura a través de Flow.cl.",
      },
    ],
  },
];

/**
 * Aplana todas las secciones y devuelve los items en el ORDEN de los ids
 * pasados. Ignora ids inexistentes.
 */
export function getFAQItemsByIds(ids: string[]): FAQItem[] {
  const byId = new Map(
    FAQ_SECTIONS.flatMap((section) => section.items).map((item) => [item.id, item]),
  );
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is FAQItem => item !== undefined);
}
