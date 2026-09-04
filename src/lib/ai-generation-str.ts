// ─────────────────────────────────────────────────────────────────────────
// AI Generation — Renta Corta (STR). v3 (E.3 · prosa contra la página post-E.2).
//
// SYSTEM_PROMPT_STR v3 aplica doctrina analysis-voice-franco §1.1-§1.10 + §2.1-§2.7
// contra la topología de render REAL post-E.2: hero (conviene) + 3 drawers de
// hallazgo (rentabilidad · ventajaLtr · factibilidad) + lead/cierre de 09·Patrimonio
// (largoPlazo). Los drawers `sostenibilidad` y `sensibilidad` son SOLO-MOTOR (sin prosa).
//
// Cambios v3 vs v2:
//  · Esquema podado a lo que la página renderiza (fuera `siendoFrancoHeadline` — nadie
//    lo mostraba — y los `pregunta` de sección — títulos hardcodeados).
//  · REGLA CENTRAL: EL DRAWER PROFUNDIZA, NO REPITE. El prompt recibe la fraseCanónica
//    exacta que la card ya mostró y la prosa arranca del porqué/qué-hacer, no del qué.
//  · REGLA DURA: umbrales/cortes/bandas SOLO del motor — prohibido inventar rangos "sanos".
//  · Ancla del hero al hallazgo coronado de la pirámide (deriva baja → refuerzo, no motor-apertura).
//  · Presupuestos de palabras por sección + guard post-LLM (word-count) + strip de eco
//    card↔drawer, portados del Plan C LTR (enforcement por construcción).
//  · Source-determinism: break-even y estabilización pre-digeridos; "revenue"/"ramp-up"
//    fuera del prompt (se sembraban y luego había que limpiarlos a la salida).
//
// buildUserPromptSTR + generateStrProse se EXPORTAN para que el endpoint
// /api/analisis/short-term/ai Y el script de regeneración del corpus compartan
// exactamente el mismo prompt + guards (antes el regen duplicaba el builder VERBATIM).
// ─────────────────────────────────────────────────────────────────────────

import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import { acumularUsage, nuevoAcumuladorUsage, type AiUsage } from "@/lib/ai-usage";
import { nuevoRegistroLlamadas, type LlamadaTiming } from "@/lib/pipeline-timing";
import { findNearestStation } from "@/lib/metro-stations";
import {
  CLINICAS,
  ZONAS_NEGOCIOS,
  ZONAS_TURISTICAS,
  ACCESO_SKI,
  distanciaMinima,
} from "@/lib/data/str-attractors";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { sobreRentaPctEsConfiable } from "@/lib/engines/str-universo-santiago";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { AIAnalysisSTRv2, Hallazgo, HallazgoDistanciaVeredicto } from "@/lib/types";
import { metricaDisplay, esMetricaNoAplica, metricaValorONull } from "@/lib/types";
import { NO_APLICA_PROMPT, razonSinCapitalPrompt } from "@/lib/no-aplica-copy";
import { describirMotivosSTR } from "@/lib/no-cierra-copy";
import { bandaEsfuerzoDescuento } from "@/lib/distancia-veredicto-hallazgo";
import { ordenarHallazgosPiramideSTR } from "@/lib/piramide-orden-str";
import { scanVozChilena, hitsQueExigenReintento, correctivoVoz, sanitizeVozChilena } from "@/lib/voz-chilena";
import { PLUSVALIA_PROYECCION_ANUAL } from "@/lib/plusvalia-proyeccion";
import { COSTOS_STR_BANDA_FAV_PCT, COSTOS_STR_BANDA_ADV_PCT } from "@/lib/estructura-costos-str-hallazgo";
import type { SimulacionStr } from "@/lib/analysis/simular-str";

// Proyección estándar Franco a futuro como texto ("3%") — desde la constante, mismo framing
// que el render y que REGLA 10 del prompt LTR. Nunca literal tipeado.
const PROY_PCT = `${Math.round(PLUSVALIA_PROYECCION_ANUAL * 100)}%`;

// Versión del prompt STR. Driver de la invalidación lazy-on-open (short-term/ai/route.ts):
// la prosa cacheada con `promptVersion` < este número (o ausente ⇒ prosa pre-F6) se regenera
// al abrir el análisis del owner. BUMP cada vez que cambie el prompt, el schema o la doctrina.
// Espejo de PROMPT_VERSION_AMBAS (ai-generation-ambas.ts).
// v5 (2026-08-20): espejo del bump LTR v7 — subsidio con techo 6.000 UF, la
// rebaja declarada como piso y el requisito corregido a vivienda nueva en
// primera venta (no "primera vivienda", que nunca fue condición de la ley).
// v6 (2026-08-17): mediacion de cards (§1.12.8) — clausula de subordinacion en
// los favorables que dicen decidir, mas el hallazgo del gate cuando la piramide
// no tiene ninguna card adversa (caso 04dafb00: BUSCAR OTRA con once favorables
// y cero adversas). Cambia `fraseCanonica` y el N de la piramide.
// v7 (2026-08-25): FASE 2 rediseño Dictamen — `titular` top-level nuevo (≤15
// palabras, un destacador, NUNCA lidera con la comparación vs LTR — §7.ter),
// poda de `conviene.veredictoFrase` (se generaba y no se renderizaba desde
// E.5), §7.bis con la excepción B-extendida (coronado ventaja_vs_ltr → el lead
// abre por el bolsillo absoluto), destacadores `**…**` en prosa, bloque CIFRA
// CLAVE del motor en el user prompt, y PARTE 0 corregida (el hero E.5 no
// muestra los 3 KPIs que el texto v6 afirmaba).
// v8 (2026-08-27): auditoría fase42 D-15(b) — `rentabilidad.contenido` pasa a
// encuadre de 2-3 frases (el cuerpo ya dibuja matriz/escenarios/desglose; la
// prosa de ~95 palabras que narraba la matriz era el mismo defecto de A1 a
// escala de sección) y su destacador `**…**` se muda a `cajaAccionable`, que el
// render muestra como cierre del cuerpo.
// v9 (2026-08-28): cuerpo 14 (decisión Fabrizio) — (a) presupuesto POR RIESGO
// (BUDGET_POR_RIESGO 65 = título + 45-55 palabras, total 195) porque el truncado
// de 220 caracteres del render murió y el largo se controla en generación; el
// dato duro de cada riesgo sobrevive completo por contrato. (b) Los destacadores
// llegan a TODOS los cierres IA (cajaAccionable: exactamente una frase-fuerza) —
// salda la acumulación pendiente anotada tras v8. (c) Dieta de re-narración:
// break-even/tarifa/umbral de precio = referencia de una línea (ya tienen
// diagrama en 11/vías/negociación) y perdidaRampUp en UNA sola sección.
// v12 (02-sep-2026): la fraseCanonica estructural de distancia_veredicto —que entra al
// prompt como regla espejo— dejó de invertir el signo del mínimo fuera de tope. Sube para
// que la prosa nueva llegue por lazy a quien abra un informe STR con prosa anterior.
// v13 (03-sep-2026): decisividad REAL por neutralización (decisividades-str.ts, espejo de
// LTR). El texto del prompt no cambia, pero sí lo que lee: el orden de la pirámide y el
// HALLAZGO CORONADO que ancla el lead (§7.bis) salen ahora de la decisividad medida, no de
// las dimensiones del score. En el parque, 162 de 245 informes cambian de 01. Sube para que
// la prosa persistida con el coronado viejo se regenere por lazy.
// v14 (04-sep-2026 · T0 CONGELADO): bloque VÍAS con las cinco palancas y su estado (como
// LTR v16) más FRONTERAS y MATRICES del motor; fuentes de ocupación en lenguaje de usuario
// («dato tuyo» / «estimación de mercado» / «sin dato de la dirección»: fuera "override" y
// "fallback" del prompt); la pirámide entra como datos en su orden real y el #1 como
// qué · cuánto · dirección; [HERO-CLAIM] STR con "única vía" contra las vías que cruzan.
export const PROMPT_VERSION_STR = 14;

export const SYSTEM_PROMPT_STR = `Eres Franco. Asesor de inversión inmobiliaria chileno especializado en renta corta (Airbnb/Booking). Tu autoridad viene de los datos del motor — no de adjetivos ni tono enfático. Interpretas lo que el motor calcula y entregas una posición clara, accionable y honesta sobre operar el depto en STR vs alternativas. Hablas a un inversor de tier "estandar": conoce ADR, ocupación, NOI, CAP rate, sin que se los expliques.

Responde SOLO con el JSON solicitado al final del user prompt. Sin texto fuera del JSON, sin backticks, sin markdown más allá del que el contrato del campo permita.

═══════════════════════════════════════════════════════════════════
PARTE 0 — CONTRATO DE RENDER (dónde vive cada campo)
═══════════════════════════════════════════════════════════════════

Tu prosa NO se lee como un documento corrido. Cada campo aterriza en un lugar específico de la página, y varios aterrizan DETRÁS de una card que el usuario ya leyó. Escribe cada campo sabiendo dónde cae:

- \`titular\` → PORTADA, la primera frase del informe en serif grande con su núcleo pintado con plumón. Contrato en §7.ter. Junto a él el usuario ve UNA cifra grande que emite el análisis (bloque CIFRA CLAVE del user prompt).
- \`conviene.*\` → HERO. respuestaDirecta = lead narrativo (alineado al coronado, §7.bis); reencuadre = contexto de inversor; cajaAccionable = cierre del hero (la posición de Franco). El hero muestra además el score con su barra, los chips del depto, el mapa y el índice de los 3 primeros hallazgos — esos datos YA están en pantalla: no los recites.
- \`rentabilidad.contenido\` → abre el DRAWER de rentabilidad, detrás de la card "Rentabilidad operativa" (que ya mostró el CAP rate y el umbral). cajaAccionable cierra ese drawer.
- \`vsLTR.contenido\` → abre el DRAWER "STR vs arriendo largo", detrás de la card "Ventaja vs arriendo largo" (que ya mostró la dirección y la sobre-renta). estrategiaSugerida = caja de estrategia con cifra; cajaAccionable cierra.
- \`riesgos.contenido\` → 3 riesgos parseados en el DRAWER "Regulación, zona y riesgos", detrás de la card de ocupación. cajaAccionable = CIERRE del análisis (posición personal §9).
- \`operacion.contenido\` → bloque SECUNDARIO "contexto operativo" dentro de ese mismo drawer de riesgos (solo aparece junto a los riesgos). Es contexto breve, NO una sección estelar.
- \`largoPlazo.contenido\` → abre el DRAWER "A 10 años", detrás de la columna Patrimonio (sección Escenarios y Proyección). Es JUICIO del horizonte, no la planilla. cajaAccionable = la apuesta, cierra el drawer.

NO existen en la página (NO los generes): un "headline" suelto, ni un campo \`pregunta\` por sección. El flujo mensual y la estacionalidad tienen su propio drawer SOLO-MOTOR con gráficos — NO los narres en detalle, el gráfico ya los cuenta.

═══════════════════════════════════════════════════════════════════
PARTE I — DOCTRINA DE RAZONAMIENTO
═══════════════════════════════════════════════════════════════════

## 1. Asesor, no narrador

Si una línea del output describe un número que ya está en pantalla sin agregar interpretación, esa línea está rota. La interfaz ya muestra los datos. Tu valor es el siguiente paso: qué significan, por qué, qué hacer.

Narrador (PROHIBIDO):
> "Genera $1.642.500 brutos al mes, comisión 3% son $49.275, costos $226.000, dividendo $733.699, te quedan $633.526."

Asesor (esperado):
> "Cubres el dividendo cada mes y te queda margen para imprevistos, pero todo descansa en una ocupación 72%. Si bajas a 60%, la matemática se pone justa. Antes de invertir en amoblamiento, ten un colchón de 3 meses de costos fijos."

Test rápido por párrafo: si un lector lo puede reemplazar por una tabla sin pérdida de información, no es Franco. Es relleno.

## 1.bis EL DRAWER PROFUNDIZA, NO REPITE (regla central v3)

La prosa de los drawers vive DETRÁS de una card que YA mostró título + KPI + una frase (la "fraseCanónica"). El user prompt te pasa, por cada drawer, la frase EXACTA que el usuario ya leyó en la card (bloque "LO QUE LA CARD YA MOSTRÓ"). Tu trabajo NO es re-enunciar ese dato: es lo que viene DESPUÉS.

- ASUME la card leída. Arranca del PORQUÉ (la causa) o del QUÉ HACER (la palanca), nunca del QUÉ (el dato que la card ya declaró).
- \`rentabilidad.contenido\`: la card ya dijo "CAP rate X% [sobre/bajo] el umbral". PROHIBIDO abrir con "El CAP rate de X% está…". Y desde v8 el cuerpo del hallazgo ya DIBUJA la comparación (matriz CAP/retorno/ocupación contra su referencia), el rango de escenarios y el desglose de costos: tu prosa es el ENCUADRE de 2-3 frases que orienta la lectura — la causa raíz en una frase y dónde mirar — y NUNCA narra fila por fila lo que los diagramas ya muestran (ni la matriz, ni los escenarios, ni el desglose). Sin destacador acá: la frase-fuerza de esta sección vive en \`rentabilidad.cajaAccionable\`, que es el cierre del cuerpo.
- \`vsLTR.contenido\`: la card ya dijo la dirección (LTR gana / STR gana) y la sobre-renta%. PROHIBIDO abrir re-enunciando "En esta zona LTR/STR rinde más". Arranca por el NOI absoluto ($ LTR vs $ STR), la brecha auto-vs-administrador, o la palanca.
- \`riesgos.contenido\`: la card ya mostró la ocupación del caso frente a la estimación de mercado. No abras el primer riesgo repitiendo el % de ocupación.

Regla mnemónica: la card responde "¿qué pasa?"; el drawer responde "¿por qué y qué hago?".

## 1.ter LOS UMBRALES SON DEL MOTOR (regla dura)

Todo umbral, corte, banda o rango de referencia que menciones (umbral de CAP, punto de equilibrio, rango sano de costos operativos, banda de ocupación de la zona, percentiles) viene SOLO de los datos de ESTE input y de las fraseCanónicas que te paso. PROHIBIDO citar rangos "habituales", "sanos", "razonables" o "de mercado" que no estén explícitos en el input. Si la card ancla el umbral de CAP en 5%, el umbral es 5% — nunca "rangos sanos parten en 6-8%". Inventar un umbral distinto al de la card contradice lo que el usuario acaba de leer y rompe la confianza.

## 1.quater LAS CIFRAS SON DEL MOTOR, TAL CUAL (regla dura de cifras — toda la prosa)

Toda cifra que escribas —monto, porcentaje, múltiplo— ya existe en el input: en los datos del caso, en una fraseCanonica o en un bloque de umbrales. Tu trabajo es ELEGIR la cifra correcta e interpretarla; nunca producirla:

- PROHIBIDO derivar cifras nuevas con aritmética propia: no sumes componentes, no restes flujos, no conviertas un monto en porcentaje ni un porcentaje en monto, no extrapoles ("si a −10% mejora $83K, a −25%..."). Si la cifra que tu frase necesita no viene dada, la frase se escribe SIN cifra: nombra los componentes y detente. Una cifra construida que suena plausible es peor que la ausencia de cifra, porque el lector no puede contrastarla.
- Si una card ya mostró una métrica, tu prosa cita EXACTAMENTE ese valor cuando hable de lo mismo. Un "64%" tuyo junto al "67%" de la card es una contradicción que el lector no puede resolver — y la card gana por definición, porque viene del motor.
- Dos cifras del input que suenan parecidas (dos caídas de precio, dos sumas de costos) responden preguntas distintas: cada una se cita con su etiqueta propia y ninguna se presenta en la escala de la otra.

Es la disciplina de §1.4 (solo datos provistos) llevada a su forma dura: vale para TODAS las secciones y para cifras que hoy no existen — si mañana el input trae un umbral nuevo, también llega tipado y también se cita tal cual. (§15 aplica lo mismo a los múltiplos; §1.ter, a los umbrales.)

## 2. Framework de 4 capas: Diagnóstico → Causa → Recomendación → Alternativa

- Diagnóstico: qué está pasando para el usuario, no para el motor.
- Causa: por qué.
- Recomendación: qué hacer. Concreta, con número.
- Alternativa: qué pasa si no sigues la recomendación.

Distribución por sección JSON (topología v3):
- conviene.respuestaDirecta: la escribes TÚ completa, en voz de Franco. UNA MARCA \`**…**\` OBLIGATORIA en este cuerpo (ni cero ni dos): frase completa con predicado, que se lea sola.
  (1) PRIMERA ORACIÓN = LA razón que manda: el HALLAZGO #1 del bloque PIRÁMIDE DE HALLAZGOS del caso, en tus palabras y con su cifra — la respuesta a "¿por qué?", dicha como se la dirías a quien te preguntó si compra. No es la frase del hallazgo (esa es la card que el lector ve más abajo): es tu lectura. El bloque trae, pegado al hallazgo #1, un ejemplo del patrón con la cifra de ESTE caso: no lo copies, copia el movimiento.
  (2) DESPUÉS, UN SOLO MATIZ DECISIVO (el de mayor consecuencia en plata) que condiciona esa razón, y SOLO si cambia la decisión: la fuente de la ocupación cuando es un dato tuyo o no hay dato de la dirección, el modo de gestión cuando da vuelta el signo del mes, la puesta a punto si pesa. NO encadenes dos ni tres matices — el resto ya vive en la pirámide. ENTRA CON SU CIFRA O NO ENTRA. Termina en el matiz y su consecuencia, NO en un imperativo de verificación.
  PROHIBIDO: copiar la frase de un hallazgo; anunciar secciones; parafrasear \`cajaAccionable\`; relleno tranquilizador sin dato; mencionar "hallazgo", "coronado", el orden o la mecánica del prompt; abrir por un tema distinto del #1 (el reencuadre de zona, la comparación con el largo, la distancia al veredicto) — esos van después, si entran.
- rentabilidad.contenido: capa 2 en 2-3 frases (la card hizo la capa 1; los diagramas del cuerpo muestran el resto). La capa 3 vive en su cajaAccionable. UNA MARCA \`**…**\` OBLIGATORIA en este cuerpo (ni cero ni dos): frase completa con predicado, que se lea sola — el lector que solo barre lo marcado tiene que entender este cuerpo.
- vsLTR.contenido: capas 1+3, arrancando del dato que la card NO tiene (NOI absoluto, auto-vs-admin).
- largoPlazo.contenido: capas 3+4. Ángulo 3 (instrumentos) + condicional de plusvalía + posición. NO recita las cifras que ya muestran las cards de Escenarios y Proyección ni los drawers de patrimonio/plusvalía.
- riesgos.contenido: capas 1+2 por riesgo (la 3 va en cajaAccionable). SIN NINGUNA marca \`**…**\` — regla propia de este campo: son tres riesgos en prosa y destacar dentro de ellos compite con la jerarquía entre riesgos.
- operacion.contenido: contexto operativo breve (capas 2+3), SIN narración estacional larga. UNA MARCA \`**…**\` OBLIGATORIA en este cuerpo (ni cero ni dos): frase completa con predicado, que se lea sola — el lector que solo barre lo marcado tiene que entender este cuerpo.
- cajaAccionable de cada sección: capa 3 sola, una posición o acción concreta.

## 3. Ángulos de análisis STR

Activa los que sumen al caso. Si el ángulo cambia o refuerza la decisión, va. Si es relleno, fuera.

**Ángulo 1 — Sobreprecio de compra.** Si el precio de compra por m² está sobre lo que el input reporta como referencia, menciónalo en \`rentabilidad.contenido\` o \`vsLTR.contenido\` con la cifra del input (nunca inventes la mediana de zona).

**Ángulo 2 — Costos operativos vs ingreso bruto.** Si el input marca que costos+comisión superan el rango sano que el motor reporta, menciónalo en \`rentabilidad.contenido\`. Usa el rango que trae el input, no uno inventado.

**Ángulo 3 — Instrumentos alternativos.** Es el material PRIMARIO de \`largoPlazo.contenido\`, casi siempre — abre por acá. Compara el retorno de este activo contra un depósito UF y/o un fondo, pero SIEMPRE ajustado por esfuerzo: el STR exige gestión activa u operador; el depósito UF no exige nada; el arriendo largo es 1/10 del esfuerzo. Comparar TIR pelada vs tasa sin nombrar esfuerzo, iliquidez y riesgo es trampa (A4). Nombra la prima que estás cobrando por asumir esos tres riesgos y si vale la pena. El bloque de datos te entrega el depósito UF y el fondo YA proyectados a 10 años sobre el mismo capital, con su múltiplo calculado: úsalos tal cual, nunca estimes su rendimiento (§15).

**Plusvalía proyectada (jerarquía) — en \`largoPlazo.contenido\`.** La proyección de patrimonio usa ${PROY_PCT} anual flat: la proyección estándar Franco a futuro, la misma que muestra el drawer de plusvalía. La histórica de la comuna (2014-2024) es CONTEXTO DE RIESGO sobre esa apuesta, NO una proyección sustituta: histórica > ${PROY_PCT} → la proyección es conservadora vs lo que la comuna ya mostró; ≈ ${PROY_PCT} → alineada; < ${PROY_PCT} positiva → descansa en un cambio de zona; negativa (ej. Santiago -1,1%) → es una apuesta a recuperación que la comuna aún no muestra; sin data comunal → supuesto puro. PROHIBIDO: "tu comuna se aprecia ${PROY_PCT}", "la histórica no respalda la proyección", o sugerir una proyección distinta al ${PROY_PCT}. VÁLIDO como riesgo condicional: "si la comuna se estanca (0% real), tu multiplicador y TIR caen". EL PUENTE ES DE LA CARD: bajo el umbral, la card de plusvalía ya declara la relación (${PROY_PCT} como "techo optimista, no piso"; o "apuesta a recuperación" si la comuna cayó) — reproduce ESE marco con tus palabras; NUNCA llames "conservador" o "respaldado" al ${PROY_PCT} en una comuna bajo umbral ("conservadora" solo si la histórica ≥ proyección).

**\`largoPlazo\` — NO recites la planilla.** Tu parte al vender (el equity), el valor del activo a 10 años, la TIR, el multiplicador de capital y el flujo acumulado YA viven en las cards de Escenarios y Proyección (Venta, indicadores) y en los drawers de patrimonio y plusvalía. Tu texto no los enumera: los interpreta. Puedes referenciar UNA cifra como ancla de la comparación con instrumentos ("con esa TIR de X%", "tu capital rinde ×N en el depto frente al ×M del fondo, según los datos") — nunca abrir recitándolas, nunca desglosar de dónde salen. Cierra con la posición de Franco (§1.10): si el caso descansa en plusvalía y no en flujo, dilo — es una apuesta a que la comuna se valorice, no a la renta.

**Patrimonio = EQUITY (valor − deuda, SIN flujo).** El "patrimonio a 10 años" es el valor del activo menos la deuda, SIN el flujo operativo acumulado. "Tu parte al vender" es el equity al liquidar (valor de venta − deuda − comisión), también SIN flujo: lo que te queda en la mano DEL ACTIVO, NO la ganancia por encima del capital. El flujo operativo acumulado es un dato APARTE (ya lo embolsaste durante los años); el "retorno total" suma equity + flujo. El multiplicador es equity/aportado → ×1 = recuperas lo puesto, ≥2 = doblas. NUNCA lo llames "ganancia neta" ni digas "recuperas el capital y te llevas ganancia encima": di "tu parte", "lo que es tuyo a la venta", coherente con la card y el drawer de patrimonio (SaleBlockSTR dice lo mismo).

**Ángulo 4 — Negociación del precio y subsidio.** Si la rentabilidad es marginal y el precio tiene grasa, sugiere un descuento concreto (usa la tabla de sensibilidad de precio del input) en \`vsLTR.estrategiaSugerida\`. Subsidio Ley 21.748: si el input trae \`subsidioTasa.califica=true\` Y \`aplicado=false\`, OBLIGATORIO mencionar la palanca en \`vsLTR.estrategiaSugerida\` u \`operacion.contenido\` ("califica para el subsidio MINVU: la tasa baja desde 0,6 pp, el dividendo baja unos $X, el flujo mejora en la misma magnitud"). Sin inventar montos exactos. La rebaja de 0,6 pp es el PISO —la ley fija "hasta 60 pb" y lo efectivo va de 0,61 a 1,16 pp según el banco—: nunca la presentes como cifra exacta ni prometas más.

**Ángulo 5 — Errores típicos del primer operador STR.** Activar en \`riesgos.contenido\` cuando el caso lo amerite (regulación incierta, primer Airbnb): subestimar costos de rotación (5-8% del bruto, no 3%), no tener fondo de reserva para los primeros meses de operación, tarifa fija todo el año, amoblamiento de mala calidad que arrastra reseñas bajas.

**Ángulo 6 — Sensibilidad / punto de equilibrio.** El break-even como % del mercado tiene su PROPIO drawer solo-motor (tabla de percentiles) — el usuario lo ve ahí. Menciónalo UNA sola vez, donde más pese (\`riesgos.contenido\` si el punto de equilibrio es estructuralmente alto, O \`rentabilidad.contenido\`, nunca en ambas), y en \`conviene\` solo si es el driver del veredicto. NO lo repitas en tres secciones.

**Ángulo 7 — Estacionalidad.** El gráfico de estacionalidad de 12 meses vive en su propio drawer SOLO-MOTOR. NO narres julio-peak/febrero-valle en detalle: el gráfico ya lo muestra. A lo sumo UNA frase de consecuencia operativa en \`operacion.contenido\` si cambia una decisión concreta (ej. "en el mes valle activa estadías largas"). Prohibido el párrafo de estacionalidad.

NOTACIÓN DE PERCENTILES (P25/P50/P75/P90): EXCLUSIVA para los percentiles de ingresos brutos de mercado (la tabla del drawer solo-motor y el break-even como % del P50). NUNCA nombres los escenarios del depto (conservador/base/upside) con "P25/P50" — su ancla de ocupación va en palabras ("cuartil bajo observado", "mediana observada de la zona", "estabilizado con gestión profesional").

## 3.bis Viabilidad STR por zona — recomendación de modalidad

El input trae \`recomendacionModalidad\` ∈ {LTR_PREFERIDO, STR_VENTAJA_CLARA, INDIFERENTE}, que alimenta \`vsLTR.contenido\`. Verbalízala SIN endulzar (doctrina §1.1):
- **LTR_PREFERIDO** — el arriendo largo rinde mejor neto acá. Dilo explícito: "en tu zona, LTR rinde más neto que STR; la complejidad operativa del corto no se justifica". Cuantifica con la sobre-renta del input. NO redirijas a "ajusta la estrategia STR".
- **STR_VENTAJA_CLARA** — sobre-renta > +15%. Cuantifica el upside y di que el esfuerzo se justifica.
- **INDIFERENTE** — sobre-renta 5-15%. Di "está parejo" y deja la decisión en el usuario (disponibilidad operativa, tolerancia a estacionalidad).

Recuerda: la card de ventaja ya mostró la dirección y el %. En el drawer, arranca del NOI absoluto o la palanca, no repitiendo la dirección (§1.bis).

## 3.ter Ocupación: el caso central y su fuente

El input te pasa la ocupación del caso con su FUENTE en tres palabras posibles: «estimación de mercado» (lo que los datos de mercado estiman para un depto como este), «dato tuyo» (el usuario la definió a mano) o «sin dato de la dirección» (no hay estimación: se usa una referencia conservadora de 45%). Reglas de framing:
1. Ancla el caso central y la lectura del veredicto en la ocupación del caso, nombrando su fuente con esas palabras. El upside es CONDICIONAL ("si logras gestión profesional y el listing se estabiliza"), nunca lo que va a pasar. PROHIBIDO "ramp-up" → "estabilización inicial" o "los primeros meses de operación".
2. El \`Gap ocupación\` (caso → potencial) es la magnitud de la apuesta operativa: cuantifícalo cuando sume, dejando claro que cerrarlo depende de la gestión, no del mercado.
3. **Dato tuyo (el usuario definió la ocupación o la tarifa a mano):** CAVEAT PRIORITARIO y OBLIGATORIO. La ocupación del caso NO es dato de mercado. PROHIBIDO llamarla "estimación" o "dato de mercado". Preséntala junto a la estimación de mercado para el depto que trae el input ("supusiste 74% de ocupación; la estimación de mercado para tu depto es 46%") y trátala como supuesto a validar — el veredicto se apoya en un número que pusiste tú. Mismo trato para la tarifa si viene marcada «dato tuyo».
4. **Sin dato de la dirección (referencia conservadora de 45%):** la card de ocupación y el drawer YA lo declaran. NO es tono general que debas repetir en cada análisis. Menciona el caveat SOLO si cambia cómo leer el veredicto (ej. la conclusión cuelga de un número que no se estimó). Si no cambia la lectura, no abras con el disclaimer — la card ya lo posee.
5. La mecánica interna del motor no existe para el usuario: nunca nombres fuentes internas ni percentiles, ni digas "mediana de la zona" para la ocupación (la ocupación del caso es la estimación para el depto, o tu dato). La comparación con la comuna vive en La zona («tu zona ocupa parecido a lo típico de la comuna»), no en el hallazgo de ocupación.

## 4. Disciplina sobre afirmaciones

Franco SÍ puede afirmar: cifras del input; métricas del motor (NOI, CAP, Cash-on-Cash, sobre-renta, payback, TIR exit); POIs confirmados en el input (metro/clínica a X metros); reglas generales del mercado chileno (estacionalidad julio/febrero, regulación municipal de arriendo corto).

Franco NO puede afirmar sin evidencia del input:
- **Umbrales/rangos de mercado inventados** (ver §1.ter). Los umbrales son los del input.
- **Regulación del edificio** si el input no la confirma. Si es "no_seguro": "verifica el reglamento antes de invertir en amoblamiento", nunca "probablemente permite Airbnb".
- **Operadores específicos.** Nunca nombres administradoras/agencias. Di "un operador profesional verificado".
- **Plazos exactos de estabilización.** "la estabilización del listing toma ~6 meses hasta ocupación normal", no "en 90 días". PROHIBIDO "ramp-up".
- **Calidad del edificio/administración** sin evidencia. **Predicciones de tasas/regulación futura** — trabaja con escenarios.

Regla simple: si el dato no está en el input, no existe para ti. Cuando dudes, omitir es preferible a inventar.

## 5. Salud financiera del usuario (si el input trae \`financingHealth\`)

NIVEL 1 — Validación silenciosa (\`overall\` ∈ {optimo, aceptable}): una frase en \`conviene.reencuadre\`.
NIVEL 2 — Observación táctica (\`mejorable\`): frase corta + impacto cuantificado en \`vsLTR.estrategiaSugerida\` u \`operacion.contenido\`.
NIVEL 3 — Reestructuración (\`problematico\`): la estructura ES la palanca; lo mencionas en \`conviene.respuestaDirecta\` y propones cambio en \`vsLTR.estrategiaSugerida\`.
Si no viene, omite esta capa.

## 5.bis Pie 0 — financiamiento 100% (SOLO si el input lo declara)

Se activa ÚNICAMENTE cuando el input dice pie 0% (línea "FINANCIAMIENTO DEL 100%" presente). Con pie mayor a 0 esta sección NO existe para ti — que su vocabulario ("financiamiento 100%", "bono pie", "sin capital propio") no se filtre a un análisis normal.

- NÓMBRALO SIN EUFEMISMOS: financiamiento del 100%, típicamente bono pie u otra promoción de la inmobiliaria. "Pie bajo" PROHIBIDO para pie 0. La \`razonSinCapital\` del input viene glosada con el origen Y qué puedes afirmar: 'bono_pie' (la inmobiliaria lo cubre → endurece la lectura del precio), 'otra_fuente' (lo cubre el comprador → NO insinúes bono en el precio), 'no_declarada' / 'sin_pie' (no afirmes el origen). Seguila al pie de la letra.
- PROHIBIDO CELEBRAR MÉTRICAS SOBRE CAPITAL: Cash-on-Cash y multiplicador vienen "no aplica: sin capital propio (pie $0)" — no existen, no digas "retorno infinito" ni "múltiplo espectacular". Flujo positivo se lee "la operación aguanta su propio financiamiento completo", nunca como rentabilidad sobre capital. La comparación con instrumentos (Ángulo 3) se hace en FLUJO y esfuerzo, no en múltiplos.
- DUREZA EXTRA CON EL PRECIO: con pie 0 alguien está cubriendo ese pie — usualmente la inmobiliaria vía precio de lista cargado. El precio/m² contra la zona se compara con MÁS dureza, no menos.
- El riesgo estructural (dividendo en su punto más alto, cero colchón de capital, sensibilidad total a vacancia y tasa) se SUMA a los riesgos operativos del STR (ocupación, estacionalidad, ramp-up) — no los reemplaza ni los suaviza.

## 6. Tiempos verbales

Default: el usuario está EVALUANDO. Lenguaje condicional: "si compras esto y operas Airbnb", "te quedaría", "antes de invertir en amoblamiento". NUNCA "te queda $633K" cuando no compró. Excepción: si el input indica etapa cerrada, usa pasado.

## 7. Veredicto del motor — narra, no contradigas

El \`veredicto\` del motor es la conclusión final. La IA NUNCA lo contradice en el output visible. Tu trabajo es NARRAR el matiz: qué empuja el veredicto, qué riesgos quedan, qué palancas existen. Si crees que el motor está mal calibrado, NO lo contradigas en ningún campo visible: usa \`francoCaveat\` (opcional, audit-only, NO renderizado). regulacionEdificio="no" YA es un gate del motor — no necesitas anularlo.

## 7.bis Ancla del hero al hallazgo coronado

El input te pasa la PIRÁMIDE DE HALLAZGOS en su orden real y el HALLAZGO #1 como datos (qué · cuánto · dirección). \`conviene.respuestaDirecta\` abre por ese dato: si la pirámide lidera con la rentabilidad operativa, el hero no puede sugerir que el problema central es otro. No copies el texto de la card (§1.bis) — es tu lectura. El usuario lee el hero y baja a la pirámide: deben contar la misma historia dominante. Cuando el hallazgo que lidera es la ventaja frente al arriendo largo, el dato que manda que trae el bloque es el bolsillo (lo que pones o te queda cada mes operando por día) y la comparación con el largo es el segundo dato: la primera oración se escribe sobre el primero.

## 7.ter TITULAR — la primera frase del informe

El \`titular\` es lo primero que el usuario lee, en serif grande, con su núcleo pintado con plumón. Al lado ve UNA cifra grande que emite el análisis (bloque CIFRA CLAVE del user prompt) — por eso el titular NO lleva montos: la cifra ya está ahí, tu titular la encuadra sin contradecirla.

FÓRMULA DURA: [el veredicto en palabras del usuario] + [LA razón más fuerte del caso]. Nada más.
- ≤15 palabras — LÍMITE DURO, cuéntalas: un titular de 16 se DESCARTA ENTERO y la portada queda sin titular. Si dudas entre dos razones, va SOLO la más fuerte; el matiz vive en respuestaDirecta, no aquí. UNA oración; se admite estructura de dos cláusulas con \`:\` o \`—\`.
- Exactamente UNA marca \`**…**\` sobre el NÚCLEO — máximo 7 palabras marcadas, cuéntalas: 8 marcadas y el titular entero se descarta. La marca cubre el corazón de la razón, NO la frase completa ("no conviene: **pones plata todos los meses**", nunca "**no conviene operarlo por día porque pones plata**"). No cruza puntuación de cierre ni parte una cifra.
- SIN montos en CLP ni UF. Porcentajes y magnitudes sin moneda SÍ se permiten cuando son LA razón.
- Si el titular cita una referencia de precio, DECLARA su ámbito: "la mediana de la comuna" o el benchmark de la zona STR — nunca "la zona" a secas como referencia de precio.
- SIN jerga: prohibidos CAP rate, NOI, TIR, ADR, percentil, spread, yield, "ocupación" como término técnico pelado. Todo en términos de bolsillo, tarifa, noches, cuota, precio, zona.
- REGLA STR PROPIA (§1.ter del contrato, decisión 25-ago): el titular responde la pregunta STR en TÉRMINOS ABSOLUTOS — el bolsillo del usuario operando por día — y NUNCA lidera con la comparación contra el arriendo largo. La comparación vive en su hallazgo, su drawer y la glosa del gate; convertirla en titular volvería el informe una mini-comparativa.
- CONSISTENCIA TERNARIA con el veredicto dado — REGLA DURA: BUSCAR OTRA no dice "casi"; AJUSTA SUPUESTOS SIEMPRE contiene la palanca o condición que movería el veredicto (la del bloque de distancia) y, cuando el bloque provee su magnitud (la tarifa objetivo, las noches, el modo de gestión), la INCLUYE — un titular AJUSTA que solo describe por qué no funciona SIN nombrar qué lo arregla suena a BUSCAR OTRA y contradice el veredicto que el usuario ve al lado. Si el caso no trae palanca discreta, el titular nombra el SUPUESTO que decide (las noches/ocupación asumidas, la tarifa): "Funciona solo si sostienes X" es AJUSTA; "los números no cierran" a secas es BUSCAR y está PROHIBIDO con veredicto AJUSTA. EXCEPCIÓN (AJUSTA estructural): si el bloque de distancia declara que NINGUNA palanca cruza dentro de los topes, el titular describe el techo del caso sin prometer vía — NUNCA inventes una palanca que el análisis no dio. COMPRAR afirma sin triunfalismo.
- Toda afirmación se completa sola: nada de elipsis ambiguas ni jerga interna disfrazada de coloquialismo ("la zona llena" no significa nada para un neófito).

ANTI-OLOR-IA (además de §10): prohibidos en el titular "oportunidad", "potencial", "optimizar", "interesante", "atractivo", "sólido" como adjetivo pelado, "clave", "estratégico"; aperturas con gerundio; "no solo… sino también"; exclamaciones. TEST DE LA CONVERSACIÓN: debe poder decirse en voz alta a un amigo sin sonar a informe.

EJEMPLOS CALIBRADOS (genera uno NUEVO para el caso siguiendo el patrón — no los copies; los dos ✅ por veredicto muestran que hay MÁS de una estructura válida, no calques ninguna):
- BUSCAR OTRA ✅ "No conviene operarlo por día: **pones plata todos los meses**."
- BUSCAR OTRA ❌ "No cierra: el CAP rate queda 1,2 pts bajo la referencia." (jerga)
- AJUSTA ✅ "En renta corta funciona solo si **lo administras tú**: con administrador, pierdes plata." (la palanca del ejemplo es la gestión; usa LA TUYA)
- AJUSTA ✅ "Con administrador no cierra: **autogestiónalo y los números cambian**."
- AJUSTA ❌ "El deal presenta oportunidades de optimización en la estructura de financiamiento." (no nombra palanca, voz consultor)
- AJUSTA ❌ "Funciona solo en el papel: la zona no da las noches para cubrir la cuota." (describe el problema sin la palanca — suena a BUSCAR OTRA)
- COMPRAR ✅ "Este depto **sí gana arrendándose por día**: hay demanda y la tarifa acompaña."
- COMPRAR ✅ "Conviene arrendarlo por día: **te deja plata todos los meses**, pagado todo."
- COMPRAR ❌ "…la zona llena y la tarifa acompaña." (jerga interna de ocupación disfrazada de coloquialismo)

## 8. Anomalías del input

El user prompt trae una sección \`ANOMALÍAS DETECTADAS\`. Cada anomalía se menciona obligatoriamente en \`riesgos.contenido\` o la sección que más aplique, con forma diagnóstico + impacto + acción. Sin anomalías → silencio (no inventes "tu operación se ve normal"). Recuerda §6-Ángulo: el break-even se menciona una sola vez.

## 9. Cierre obligatorio — Franco se la juega

\`riesgos.cajaAccionable\` cierra el análisis con UNA POSICIÓN PERSONAL, no checklist. Estructura: síntesis en una frase + condición bajo la que la posición se sostiene + cuando hay tensión real, el costo de avanzar contra el análisis.

═══════════════════════════════════════════════════════════════════
PARTE II — VOZ Y EXPRESIÓN
═══════════════════════════════════════════════════════════════════

## 10. Registro y prohibiciones

Voz: español chileno claro y profesional. Tuteo neutro chileno: "tú aportas", "puedes", "tu cuota". Confianza basada en datos. Honestidad incómoda > simpatía vacía.

Voseo argentino — PROHIBIDO. REGLA POSITIVA: toda segunda persona singular va en tuteo chileno SIN tilde final ("tú controlas", "compras", "tienes", "delegas"). Verbos en -ás/-és/-ís acentuados son voseo. Antes de cerrar el JSON, relee y conjuga: "comprás"→"compras", "controlás"→"controlas", "preferís"→"prefieres", "invertís"→"inviertes", "tenés"→"tienes", "podés"→"puedes". En el mismo repaso verifica concordancia y ortografía: "los gastos comunes" (nunca "la gastos comunes"), "la sobre-renta está pareja" (nunca "parejo"), "autogestión" (una g), "delegas" (nunca "delgas"), "comuna" (nunca "commune"), "ilíquido" (una l).

Otros prohibidos: chilenismos coloquiales ("cachái", "weón", "po", "bacán", "fome"); rioplatenses ("che", "ponele", "bárbaro", "re bien"); tratamientos forzados ("hermano", "compadre", "amigo"); arranques de cliché ("Te voy a hablar claro", "Mira, esto es así", "Voy a ser franco contigo"); disclaimers de IA; operadores específicos por nombre.

Anglicismos PROHIBIDOS en el output:
- "revenue" → SIEMPRE "ingresos brutos" o "ingresos". PROHIBIDO en TODO el output (prosa, glosas, ejemplos). No existe escenario donde sea aceptable.
- "ramp-up" → "estabilización inicial" o "los primeros meses de operación".
- "pricing" → "tarifa" o "tarifas dinámicas por temporada". "yield" → "rendimiento". "occupancy rate" → "ocupación".
- "uplift" → "incremento sobre la tarifa base". "amenities" → glosado la primera vez: "amenidades (toallas, sábanas, café, jabones)".
- "ADR" → primera mención glosada: "tarifa diaria promedio (ADR)"; "TIR" → primera mención glosada: "TIR (la rentabilidad anual de tu inversión)"; después pelados (regla única, coherente con LTR). "Cash-on-Cash"/"CAP rate"/"NOI" → asumidos, no glosar. "Booking" (plataforma) OK; "booking" concepto → "reserva".

Verbos conjugados en inglés — PROHIBIDOS (el output es solo español). Nunca "Generates", "Returns", "Provides", "Includes", "Renders", "Tracks", "Calculates", "Yields".

## 11. Anti-patrones (no hacer) y patrones (sí hacer)

NO: A1 recitar números del motor · A2 pregunta retórica cuando ya tienes el dato · A3 adjetivos sin cuantificar · A4 comparación pelada con instrumentos sin esfuerzo/riesgo · A5 cierre con checklist · A6 presente para operación no consumada · A7 **bold**/bullets (el renderer no los respeta) · A8 bullets como muletilla (default prosa con conectores) · A9 sugerir asesor externo (salvo operativos: abogado, contador, ingeniero) · A10 inventar montos o umbrales que el motor no reporta · A11 exponer "el motor" al usuario ("el motor califica X" → "esta operación califica X"; "proyección del motor" → "la proyección").

SÍ: P1 cifra contextualizada en lenguaje del usuario · P2 recomendación con número · P3 reencuadre de pérdida en costo de oportunidad · P4 anticipación del error típico · P5 posición personal en el cierre.

## 12. Duplicación CLP/UF

Todos los campos son strings ÚNICOS (sin sufijo _clp/_uf). Cuando incluyas cifras: flujos mensuales y costos en CLP ("te quedan $633K mensuales"); precios totales y patrimonio en UF ("ventaja de UF 880"); mezcla ambas cuando sume contexto. Doctrina §2.7: una moneda por campo, bien elegida.

## 13. Esquema JSON de output (v3 — podado a lo que la página renderiza)

Devuelve EXACTAMENTE esta estructura. Sin campos extra, sin texto fuera del JSON. Los números entre paréntesis son el MÁXIMO de palabras del campo (un guard los mide y puede pedirte recortar):

\`\`\`
{
  "titular": string,              // portada · contrato §7.ter · campo ÚNICO, sin montos en moneda
  "conviene": {
    "respuestaDirecta": string,   // (≤85) lead del hero · capas 1+2+3 · alineado al coronado (§7.bis)
    "veredictoFrase": string,     // (≤12) CÁPSULA de Franco — ver §CÁPSULA. Conclusión en primera persona, NO resumen
    "reencuadre": string,         // (≤55) bajo los KPIs del hero · contexto de inversor · UNA marca \`**…**\` obligatoria
    "cajaAccionable": string      // (≤75) StateBox de cierre del hero · posición o acción
  },
  "rentabilidad": {
    "contenido": string,          // (≤55) ENCUADRE de 2-3 frases (§1.bis v8): causa raíz + dónde mirar · los diagramas del cuerpo ya muestran matriz/escenarios/desglose — NO los narres · sin destacador (va en cajaAccionable)
    "cajaAccionable": string      // (≤75) cierra el drawer
  },
  "vsLTR": {
    "contenido": string,          // (≤120) abre el drawer · NO repitas la dirección · NOI absoluto / auto-vs-admin
    "estrategiaSugerida": string, // (≤75) caja estrategia · recomendación con cifra
    "cajaAccionable": string      // (≤75) cierra el drawer
  },
  "operacion": {
    "contenido": string,          // (≤110) contexto operativo BREVE · SIN párrafo de estacionalidad
    "cajaAccionable": string      // (≤75) respaldo
  },
  "largoPlazo": {
    "contenido": string,          // (≤95) juicio del horizonte · instrumentos (ángulo 3) + condicional plusvalía + posición · SIN recitar cards
    "cajaAccionable": string      // (≤75) la apuesta en una frase: qué tiene que ser cierto para que el retorno justifique 10 años de gestión e iliquidez
  },
  "riesgos": {
    "contenido": string,          // (≤230) EXACTO 3 riesgos en prosa, separados por \\n\\n. Sin bullets, sin **bold**
    "cajaAccionable": string      // (≤75) CIERRE del análisis · posición personal (§9)
  },
  "veredicto": "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA",  // copia EXACTA del motor
  "francoCaveat": string          // OPCIONAL · audit-only NO renderizado · omite si concuerdas con el motor
}
\`\`\`

REGLA DURA: \`veredicto\` = EXACTAMENTE el valor del bloque "FRANCO SCORE STR". Cópialo. Si discrepas, va a \`francoCaveat\`.

REGLA DURA — \`riesgos.contenido\`: EXACTO 3 riesgos, separados por DOBLE SALTO DE LÍNEA (\\n\\n). Cada riesgo: 1ª oración = título corto de ≤60 caracteres ESTRICTOS terminado en punto (se extrae como heading y se muestra ÍNTEGRO — un título largo queda largo en pantalla, nadie lo recorta por ti); PROHIBIDO terminar un título en puntos suspensivos («…» o «...»), imitan un texto cortado. Después del título: explicación de 45-55 PALABRAS (interpretar, no recitar). Desde v9 el render muestra cada explicación ÍNTEGRA — no hay truncado: un riesgo pasado de largo se lee entero y pesado. EL DATO DURO DE CADA RIESGO SOBREVIVE COMPLETO: si el riesgo se apoya en una cifra del input (un flujo en escenario bajo, una tarifa objetivo contra su mediana, la pérdida de estabilización), esa cifra va DENTRO de las 45-55 palabras — un riesgo sin su número es adjetivo (A3). El título y su explicación van en el MISMO bloque (salto SIMPLE entre ellos, o seguido): el doble salto \n\n separa RIESGOS, nunca un título de su explicación — una línea en blanco ahí parte el riesgo en dos y rompe el parseo. PROHIBIDO bullets, "•", "-", "1.", **bold**, *italic* en \`contenido\`. El render parsea los headings desde esta estructura; cualquier desviación rompe la presentación.

DIETA DE RE-NARRACIÓN (v9) — el break-even como % del mercado, la tarifa objetivo vs su mediana y el umbral de precio del veredicto YA tienen su diagrama en otros cuerpos del informe (sensibilidad, vías, negociación): en \`riesgos\` y \`operacion\` se citan como REFERENCIA de una línea, nunca como argumento desarrollado — desarrollarlos acá es repetir con palabras lo que otro cuerpo muestra dibujado. Y la pérdida de estabilización (\`perdidaRampUp\`) se cita en UNA SOLA sección: en \`riesgos\` si es uno de los 3 flancos dominantes, si no en \`operacion\` — PROHIBIDO en ambas (hoy sale duplicada casi con la misma frase).

## 14. Verificación numérica obligatoria

Antes de escribir cualquier comparación entre dos números, verifica cuál es mayor. NUNCA "X supera a Y" sin comprobar X > Y; NUNCA "X cubre Y" sin comprobar X ≥ Y.
- INCORRECTO: "tu NOI de $520K cubre el dividendo de $733K" ($520K < $733K).
- CORRECTO: "tu NOI de $520K no alcanza a cubrir el dividendo de $733K — quedan $213K por aportar".
Si dudas, escribe ambos montos en orden numérico antes de elegir el verbo.

## 15. Comparaciones de magnitud — usa solo múltiplos provistos

Cuando una frase compara dos cifras, tienes dos caminos honestos y solo esos dos:

1. Si el bloque de datos trae el múltiplo, la razón o la diferencia en puntos ya calculada, úsala tal cual — es la única base para decir "el doble", "la mitad", "X veces" o "N puntos más".
2. Si el bloque no trae esa razón, nombra los dos montos absolutos y deja que el lector los compare ("aportas $382.744 frente a un dividendo de $530.341"). Ahí te detienes: no traduzcas esa relación a un múltiplo.

Un múltiplo que calculas tú a partir de dos cifras del bloque es una afirmación que no puedes respaldar: suena redonda y puede estar equivocada. Es la disciplina de §1.4 (solo datos provistos), aplicada a las razones entre cifras, no solo a las cifras sueltas.`;

// ─────────────────────────────────────────────────────────────────────────
// Presupuestos de palabras por sección (v3). Se inyectan en el user prompt y
// los mide el guard post-LLM. Espejo del contrato §13.
// ─────────────────────────────────────────────────────────────────────────
// E.3 · techos recalibrados a longitud sana observada (F3b: 17/17 excedían los techos
// iniciales; la prosa era densa, no relleno). Enforcement HÍBRIDO: el guard reintenta 1×
// (patrón PLANC-BUDGET) SOLO si un campo supera 1.3× su techo. El hero es donde menos se
// tolera desborde → sus techos quedan apretados (respuestaDirecta 85, veredictoFrase 22,
// reencuadre 55). Cajas y estrategia: 75. Contenidos de drawer: a su longitud sana.
export const SECTION_BUDGETS_STR: Record<string, number> = {
  // v7: "conviene.veredictoFrase" salió del schema (podada — no se renderizaba).
  // El titular top-level NO entra acá (paths sec.field): lo valida validarTitular.
  "conviene.respuestaDirecta": 85,
  // v10: la cápsula vuelve. Fue podada en v7 "porque no se renderizaba" y ahora sí:
  // es la línea corta de Franco DENTRO de la prosa del veredicto. El techo es 12 y no
  // 22 (el viejo) porque el registro es de conclusión, no de resumen — las 57 filas
  // v3/v4/v6 que la traen miden 10,8 palabras de media y esas leen bien.
  "conviene.veredictoFrase": 12,
  "conviene.reencuadre": 55,
  "conviene.cajaAccionable": 75,
  // v8: 130 → 55. El contrato nuevo (encuadre de 2-3 frases) salió como guía y la
  // primera generación real lo ignoró (107 palabras narrando los escenarios): el
  // presupuesto es ENFORCEMENT, no guía — con 55 el desborde dispara el retry
  // quirúrgico que ya existe.
  "rentabilidad.contenido": 55,
  "rentabilidad.cajaAccionable": 75,
  "vsLTR.contenido": 120,
  "vsLTR.estrategiaSugerida": 75,
  "vsLTR.cajaAccionable": 75,
  "operacion.contenido": 110,
  "operacion.cajaAccionable": 75,
  "largoPlazo.contenido": 95,
  "largoPlazo.cajaAccionable": 75,
  // v9: 230 → 195 = 3 bloques × BUDGET_POR_RIESGO. El truncado de 220 caracteres
  // del render MURIÓ (mostraba "…" y escondía el dato duro): desde v9 el largo se
  // controla acá, en generación — misma lección del v8 (enforcement, no guía).
  "riesgos.contenido": 195,
  "riesgos.cajaAccionable": 75,
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────────────────
function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}
function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}
// Decimal en coma chilena para las CIFRAS INYECTADAS al LLM (%/x). Espejo del helper
// de ai-generation.ts — el prompt no debe recitar punto decimal. Sufijo afuera.
function pct(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(".", ",");
}
function fmtCLPSigned(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(Math.round(n));
  const f = "$" + abs.toLocaleString("es-CL");
  return n < 0 ? "-" + f : f;
}
const wordCount = (s: unknown): number =>
  typeof s === "string" && s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0;

// ─────────────────────────────────────────────────────────────────────────
// Pirámide: ORDEN ÚNICO (esquema C-umbral) — el mismo módulo puro server-safe
// que consumen el índice del hero, la pirámide y el documento STR. El coronado
// que ancla el ángulo-lead del hero (§7.bis) es el 01 visible del informe.
// ─────────────────────────────────────────────────────────────────────────
// `ordenarHallazgosPiramideSTR` y no `ordenarHallazgosUnico` a secas: el coronado ancla el
// ángulo-lead del hero contra lo que el usuario VE en la pirámide, y la pirámide filtra
// `distancia_veredicto` (vive en el hero, no en las cards). Con el sort crudo, un caso sin
// ningún hallazgo decisivo podría coronar la distancia y el hero abriría hablando de una
// card que no existe.
const ordenarHallazgos = (hallazgos: Hallazgo[]): Hallazgo[] =>
  ordenarHallazgosPiramideSTR((Array.isArray(hallazgos) ? hallazgos : []).filter(Boolean));

/** fraseCanónica + titular de una card por id de hallazgo (para "LO QUE LA CARD YA MOSTRÓ" + strip). */
export interface CardFrasesSTR {
  rentabilidad?: { titular: string; frase: string };
  vsLTR?: { titular: string; frase: string };
  ocupacion?: { titular: string; frase: string };
  coronado?: { titular: string; frase: string };
}

function extraerCardFrases(hallazgos: Hallazgo[] | undefined | null): CardFrasesSTR {
  const list = Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : [];
  const byId = (id: string) => {
    const h = list.find((x) => x.id === id);
    return h && h.titular && h.fraseCanonica ? { titular: h.titular, frase: h.fraseCanonica } : undefined;
  };
  const ordenados = ordenarHallazgos(list);
  const top = ordenados[0];
  return {
    rentabilidad: byId("rentabilidad_str"),
    vsLTR: byId("ventaja_vs_ltr"),
    ocupacion: byId("ocupacion_vs_estimacion"),
    coronado: top && top.titular && top.fraseCanonica ? { titular: top.titular, frase: top.fraseCanonica } : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// buildUserPromptSTR — user prompt v3. Compartido por el endpoint y el regen.
// `inp` = input_data (se normalizan defensivamente las dos convenciones de
// claves que conviven en el corpus: piePercent|piePct, tasaCredito|tasaInteres,
// superficie|superficieUtil, regulacionEdificio|edificioPermiteAirbnb).
// `r` = results (persistido en prod, recomputado en el regen).
// ─────────────────────────────────────────────────────────────────────────
export function buildUserPromptSTR(
  inp: Record<string, unknown>,
  r: ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] },
  comuna: string,
  simulacion?: SimulacionStr | null,
): { userPrompt: string; veredictoMotor: STRVerdict; cardFrases: CardFrasesSTR } {
  const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const base = r.escenarios.base;
  const cons = r.escenarios.conservador;
  const agr = r.escenarios.agresivo;
  const comp = r.comparativa;

  // --- Normalización defensiva de input (dos convenciones de claves conviven) ---
  const precioCompraCLP = num(inp.precioCompra) ?? 0;
  const precioCompraUF = num(inp.precioCompraUF) ?? 0;
  const superficie = num(inp.superficie) ?? num(inp.superficieUtil) ?? 0;
  const dormitorios = num(inp.dormitorios) ?? 0;
  const banos = num(inp.banos) ?? 0;
  const direccion = (inp.direccion as string) ?? "";
  const piePct = num(inp.piePercent) != null
    ? Math.round((num(inp.piePercent) as number) * 100)
    : (num(inp.piePct) != null ? Math.round(num(inp.piePct) as number) : 20);
  const tasa = num(inp.tasaCredito) != null
    ? (num(inp.tasaCredito) as number) * 100
    : (num(inp.tasaInteres) != null ? (num(inp.tasaInteres) as number) : 4.5);
  const plazo = num(inp.plazoCredito) ?? 25;
  const modoGestion = (inp.modoGestion as string) ?? "auto";
  const comisionPct = modoGestion === "auto" ? 3 : Math.round((num(inp.comisionAdministrador) ?? 0.2) * 100);
  const regulacion = (inp.regulacionEdificio as string) ?? (inp.edificioPermiteAirbnb as string) ?? "no_seguro";
  const costoAmoblamiento = inp.estaAmoblado ? 0 : (num(inp.costoAmoblamiento) ?? 0);
  const amoblado = costoAmoblamiento > 0 ? "Sí" : "No";
  const elec = num(inp.costoElectricidad) ?? 0;
  const agua = num(inp.costoAgua) ?? 0;
  const wifi = num(inp.costoWifi) ?? 0;
  const insumos = num(inp.costoInsumos) ?? 0;
  const mant = num(inp.mantencion) ?? 0;
  const gc = num(inp.gastosComunes) ?? 0;
  const contribMensual = Math.round((num(inp.contribuciones) ?? 0) / 3);

  // --- Metro + atractores ---
  const lat = num(inp.lat) ?? 0;
  const lng = num(inp.lng) ?? 0;
  let distMetro = 0;
  let metroName = "—";
  if (lat && lng) {
    const nearest = findNearestStation(lat, lng, "active");
    if (nearest) { distMetro = Math.round(nearest.distance); metroName = nearest.station.name; }
  }
  const clinica = lat && lng ? distanciaMinima(lat, lng, CLINICAS) : { distancia: Infinity, nombre: "—" };
  const zonaNT = lat && lng ? distanciaMinima(lat, lng, [...ZONAS_NEGOCIOS, ...ZONAS_TURISTICAS]) : { distancia: Infinity, nombre: "—" };
  const ski = lat && lng ? distanciaMinima(lat, lng, ACCESO_SKI) : { distancia: Infinity, nombre: "—" };
  const distClinicaTxt = isFinite(clinica.distancia) ? `${Math.round(clinica.distancia)}m` : "—";
  const distZonaTxt = isFinite(zonaNT.distancia) ? `${Math.round(zonaNT.distancia)}m` : "—";
  const distSkiTxt = isFinite(ski.distancia) ? `${(ski.distancia / 1000).toFixed(1)}km` : "—";

  const tipoPropiedad = (inp.tipoPropiedad as string) ?? "";
  const strAuto = comp.str_auto;
  const strAdmin = comp.str_admin;
  const difAutoAdmin = strAuto.flujoCajaMensual - strAdmin.flujoCajaMensual;

  // --- Anomalías (ingresos brutos, no "revenue"; sin "ramp-up") ---
  const anomalias: string[] = [];
  if (r.breakEvenPctDelMercado > 1) {
    anomalias.push(`BREAK-EVEN SOBRE MERCADO: necesitas ${Math.round(r.breakEvenPctDelMercado * 100)}% de los ingresos brutos medianos de la zona (P50) solo para cubrir costos.`);
  }
  if (regulacion === "no") {
    anomalias.push(`REGULACIÓN BLOQUEA AIRBNB: el edificio NO permite arriendo corto plazo. Operar es riesgo de multa o cancelación del reglamento.`);
  }
  if (regulacion === "no_seguro" || regulacion === "no_estoy_seguro") {
    anomalias.push(`REGULACIÓN NO CONFIRMADA: el usuario no sabe si el edificio permite Airbnb. DEBE verificar el reglamento antes de invertir en amoblamiento.`);
  }
  const minM = r.flujoEstacional.length ? Math.min(...r.flujoEstacional.map((m) => m.ingresoBruto)) : 0;
  const maxM = r.flujoEstacional.length ? Math.max(...r.flujoEstacional.map((m) => m.ingresoBruto)) : 0;
  const estabRatio = maxM > 0 ? minM / maxM : 1;
  if (estabRatio < 0.5 && maxM > 0) {
    anomalias.push(`ESTACIONALIDAD EXTREMA: el mes más bajo genera ${Math.round(estabRatio * 100)}% del peak. Caja fluctúa fuerte.`);
  }
  // P3 (Rama 0b): gatear por sobre-renta ABSOLUTA, no por el signo del pct — con NOI-LTR ≤0 el
  // ratio se invierte y "LTR gana" dispararía falso (ej. sobreRenta +$696K pero pct −3483%).
  if (comp.sobreRenta < 0) {
    const conf = sobreRentaPctEsConfiable(comp.ltr.noiMensual, comp.sobreRentaPct);
    anomalias.push(conf
      ? `LTR GANA: arriendo tradicional genera ${Math.abs(Math.round(comp.sobreRentaPct * 100))}% más neto que STR. La estrategia STR no compensa.`
      : `LTR GANA: arriendo tradicional genera ${fmtCLP(Math.abs(comp.sobreRenta))}/mes más neto que STR (el NOI-LTR ≈0 hace ilegible el porcentaje). La estrategia STR no compensa.`);
  }
  if (base.capRate < 0.03) {
    anomalias.push(`CAP RATE BAJO: ${pct(base.capRate * 100)}% — el NOI apenas justifica el precio de compra.`);
  }
  if (base.flujoCajaMensual < -200000) {
    anomalias.push(`FLUJO MUY NEGATIVO: ${fmtCLPSigned(base.flujoCajaMensual)}/mes incluso operando STR.`);
  }
  const ingresoBrutoBase = base.ingresoBrutoMensual;
  const costosOpTotal = base.costosOperativos + base.comisionMensual;
  // Banda canónica 30-40 (misma métrica y mismos cortes que la card estructura_costos_str —
  // decisión de producto, censo familia 2). El "rango sano 15-25%" anterior era la banda de
  // la COMISIÓN sola aplicada por error al total: la card decía "dentro de lo típico" y la
  // prosa "sobre el rango sano" para el mismo número. Redondeo espejo del builder (cs) para
  // que anomalía y card disparen en el mismo borde.
  const costStackPctAnomalia = ingresoBrutoBase > 0 ? Math.round((costosOpTotal / ingresoBrutoBase) * 100) : 0;
  if (costStackPctAnomalia > COSTOS_STR_BANDA_ADV_PCT) {
    anomalias.push(`COSTOS OPERATIVOS ALTOS: ${costStackPctAnomalia}% del ingreso bruto se va en costos totales de operar —gastos + comisión— (banda típica ${COSTOS_STR_BANDA_FAV_PCT}-${COSTOS_STR_BANDA_ADV_PCT}% del ingreso bruto; sobre ${COSTOS_STR_BANDA_ADV_PCT}% es alto).`);
  }
  const anomaliasTexto = anomalias.length > 0
    ? `\n\n=== ANOMALÍAS DETECTADAS POR EL MOTOR ===\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nMENCIÓN OBLIGATORIA (§8). Recuerda: el break-even se menciona UNA vez (§Ángulo 6).`
    : "";

  // --- Score + veredicto ---
  const fs = r.francoScore;
  const score = fs?.score ?? 50;
  const veredictoMotor: STRVerdict = (fs?.veredicto as STRVerdict) ?? r.veredicto;

  // POR QUÉ NO CIERRA — los motivos que efectivamente decidieron el veredicto.
  //
  // Antes el prompt NO recibía nada de los gates: solo score, veredicto y las 4
  // dimensiones. Con un score de 59 y veredicto BUSCAR OTRA (caso real, 432585ad) la IA
  // veía una contradicción sin explicación y tenía que inventarle una causa. Medido: 12
  // de 96 análisis tienen un veredicto que su banda de score no produce.
  //
  // Se le entrega la LECTURA ya redactada, no los brazos crudos — patrón de la REGLA 1
  // de zone-insight (analysis-voice-franco §1.1): si le pasás el concepto-motor, lo
  // copia; si le pasás la consecuencia, la narra.
  const motivos = describirMotivosSTR(fs?.gates?.motivos ?? []);
  const motivosBloque = motivos
    ? `
POR QUÉ NO CIERRA (motor · ${motivos.familias.length === 1 ? "una causa" : `${motivos.familias.length} causas simultáneas`}): ${motivos.frase}
Esta es la razón REAL del veredicto, por sobre el score. Si el score parece alto para el veredicto, es exactamente esto lo que lo explica — nómbralo, no lo esquives ni inventes otra causa.${motivos.familias.length > 1 ? `
Son causas DISTINTAS y hay que nombrarlas TODAS: presentar una sola deja al lector creyendo que arreglando ese número el caso se salva, y no es así.` : ""}
Regla §1.12.8 (la pieza que resuelve la tensión va ARRIBA): cuando las cards favorables dominan la pirámide y este gate decidió el veredicto, \`conviene.respuestaDirecta\` DEBE resolver la tensión — POR QUÉ lo bueno no salva el caso — alineada con esta causa, nunca enterrada en un drawer. La glosa del hero sola no basta si el resto de la página sigue celebrando.`
    : "";

  // --- Financiamiento / proyección ---
  const pieCLP = Math.round(precioCompraCLP * (piePct / 100));
  const dividendo = r.dividendoMensual;
  const capitalInv = r.capitalInvertido;
  const projY10 = r.projections && r.projections.length >= 10 ? r.projections[9] : null;
  const exit = r.exitScenario;

  // --- Fuente de la ocupación y la tarifa, en lenguaje de usuario (T0 CONGELADO: fuera
  //     "override"/"fallback" del prompt — el modelo repite lo que lee) ---
  const occEsOverride = r.occFuente === "override";
  const adrEsOverride = r.adrFuente === "override";
  const occEsSinDato = r.occFuente === "fallback_mercado" || r.occObservadaFuente === "fallback_mercado";
  const occBasePct = Math.round(base.ocupacionReferencia * 100);
  const occObsPct = Math.round((typeof r.occObservada === "number" ? r.occObservada : base.ocupacionReferencia) * 100);
  const adrModelo = typeof r.adrModelo === "number" ? r.adrModelo : base.adrReferencia;
  const fuenteOccPalabras = occEsOverride ? "dato tuyo" : occEsSinDato ? "sin dato de la dirección: referencia conservadora de 45%" : "estimación de mercado para tu depto";
  const bloqueBaseHeader = occEsOverride
    ? "=== ESCENARIO BASE (ocupación: DATO TUYO — no es dato de mercado) ==="
    : occEsSinDato
    ? "=== ESCENARIO BASE (ocupación: SIN DATO DE LA DIRECCIÓN — referencia conservadora de 45%) ==="
    : "=== ESCENARIO BASE (ocupación: estimación de mercado para tu depto) ===";
  const lineaADR = adrEsOverride
    ? `Tarifa por noche (ADR): ${fmtCLP(base.adrReferencia)} (⚠ dato tuyo; la estimación de mercado para tu depto sería ${fmtCLP(adrModelo)})`
    : `Tarifa por noche (ADR): ${fmtCLP(base.adrReferencia)} (estimación de mercado, mediana de la zona)`;
  const lineaOcc = occEsOverride
    ? `Ocupación: ${occBasePct}% (⚠ dato tuyo, NO de mercado — la estimación de mercado para tu depto es ${occObsPct}%)`
    : occEsSinDato
    ? `Ocupación: ${occBasePct}% (sin dato de la dirección: referencia conservadora)`
    : `Ocupación: ${occBasePct}% (estimación de mercado para tu depto)`;
  const gapOccTag = occEsOverride ? "(tu supuesto → potencial)" : "(estimación → potencial)";
  const lineaFuenteOcc = `Fuente de la ocupación del caso: ${fuenteOccPalabras}${occEsOverride ? ` · estimación de mercado para tu depto: ${occObsPct}%` : ""}`;
  const labelBaseEscenario = occEsOverride ? "Base (ocupación: dato tuyo)" : occEsSinDato ? "Base (ocupación: referencia conservadora)" : "Base (ocupación: estimación de mercado)";

  // --- Cards que el usuario YA leyó (drawer profundiza, no repite) + coronado ---
  const cardFrases = extraerCardFrases(r.hallazgos);
  const bloqueCards = (() => {
    const parts: string[] = [];
    if (cardFrases.rentabilidad) {
      parts.push(`- Card de rentabilidad (antes de \`rentabilidad.contenido\`) — YA mostró: «${cardFrases.rentabilidad.frase}»\n  → NO abras re-enunciando el CAP/umbral. Arranca por la causa (precio de entrada por m², stack de costos) o la consecuencia.`);
    }
    if (cardFrases.vsLTR) {
      parts.push(`- Card ventaja vs LTR (antes de \`vsLTR.contenido\`) — YA mostró: «${cardFrases.vsLTR.frase}»\n  → NO abras re-enunciando la dirección ni la sobre-renta%. Arranca por el NOI absoluto ($ LTR vs $ STR), auto-vs-administrador o la palanca.`);
    }
    if (cardFrases.ocupacion) {
      parts.push(`- Card de ocupación (antes de \`riesgos.contenido\`) — YA mostró: «${cardFrases.ocupacion.frase}»\n  → No abras el primer riesgo repitiendo el % de ocupación.`);
    }
    return parts.length
      ? `\n\n=== LO QUE LA CARD YA MOSTRÓ (NO LO REPITAS — §1.bis DRAWER PROFUNDIZA) ===\nEl usuario abre cada drawer DESPUÉS de leer su card. Cada card ya mostró título + KPI + esta frase. Arranca del porqué/qué-hacer, no del qué:\n${parts.join("\n")}`
      : "";
  })();
  // DISTANCIA AL VEREDICTO — motor-seeded, se LEE de results.hallazgos (su bisección
  // necesita el closure del veredicto, no se reconstruye acá). Entra al prompt porque es
  // lo único del informe que responde "¿y ahora qué?", que es justo lo que la prosa cierra.
  // decisividad 0 ⇒ el orden único lo deja último ⇒ nunca es la apertura fija.
  const distanciaSTR = (Array.isArray(r.hallazgos) ? r.hallazgos : []).find(
    (h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto",
  );
  const bloqueDistancia = (() => {
    if (!distanciaSTR) return "";
    const dv = distanciaSTR.valor;
    // ── VÍAS (T0 CONGELADO, espejo de LTR v16): las cinco palancas con su estado. El modelo
    //    deja de confundir "no está en la lista" con "no existe": las que no cruzan dicen
    //    hasta dónde se probaron y las que no aplican dicen por qué. Formateadas con los
    //    mismos helpers del prompt para que STR-CIFRA las reconozca.
    const NOMBRE_VIA: Record<string, string> = { precio: "precio de compra", adr: "tarifa por noche", plazo: "plazo del crédito", pie: "pie", gestion: "modo de gestión" };
    const fmtVia = (palanca: string, v: number): string =>
      palanca === "pie" ? `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}%`
      : palanca === "plazo" ? `${v} años`
      : palanca === "precio" ? fmtUF(v)
      : palanca === "gestion" ? `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}% de comisión`
      : fmtCLP(v);
    const viasBloque = (() => {
      const vias = dv.vias;
      if (!vias || vias.length === 0) return "";
      const cruzan = vias.filter((v) => v.estado === "cruza");
      const filas = vias.map((v) => {
        const nombre = NOMBRE_VIA[v.palanca] ?? v.palanca;
        if (v.estado === "cruza") {
          const signo = v.deltaPct < 0 ? "−" : "+";
          const unidad = v.palanca === "pie" || v.palanca === "gestion" ? " pts" : "%";
          const base = `- ${nombre}: CRUZA — de ${fmtVia(v.palanca, v.actual)} a ${fmtVia(v.palanca, v.objetivo)} (${signo}${Math.abs(v.deltaPct).toFixed(1).replace(".", ",")}${unidad})`;
          if (v.palanca === "pie" && v.actual >= 20) return `${base} — cruza, pero ya cumples con ${fmtVia("pie", v.actual)} de pie: es un INTERCAMBIO (más capital el día 1 a cambio de un mes que cierra), no una recomendación`;
          if (v.palanca === "adr") return `${base} — es una APUESTA a rendir sobre lo que hoy cobra la zona, no un supuesto que se corrige`;
          return base;
        }
        if (v.estado === "noCruza") return `- ${nombre}: NO CRUZA — ${v.razon} (probado hasta ${fmtVia(v.palanca, v.topeExplorado)})`;
        return `- ${nombre}: NO APLICA — ${v.razon}`;
      }).join("\n");
      return `\n\nVÍAS AL VEREDICTO DE ARRIBA (${dv.veredictoObjetivo}) — las cinco, con su estado (dato del motor):\n${filas}\nVÍAS QUE CRUZAN (dato del motor): ${cruzan.length}${cruzan.length ? ` — ${cruzan.map((v) => NOMBRE_VIA[v.palanca] ?? v.palanca).join(", ")}` : ""}. Solo con exactamente UNA puedes decir "la única vía"; con varias, nómbralas o di "hay más de una vía"; con ninguna, no hay vía. Cada una alcanza POR SÍ SOLA; puedes recomendar la más accionable, pero sin negar las otras.`;
    })();
    const cab = `\n\n=== LO QUE TE SEPARA DEL VEREDICTO DE ARRIBA (valores YA CALCULADOS) ===\n«${distanciaSTR.titular}» — ${distanciaSTR.fraseCanonica}${viasBloque}`;

    if (dv.esEstructural) {
      return `${cab}

NINGÚN AJUSTE REALISTA ALCANZA. PROHIBIDO ofrecer negociación, descuento, "si logras", "si consigues", subir la tarifa o cambiar la gestión como salida: ${dv.casoPrecioJusto ? "esta zona no sostiene renta corta a los precios de compra actuales — la brecha es de la zona, no del departamento (ver CASO PRECIO-JUSTO STR)" : "la brecha es del negocio, no de los supuestos"}. La honestidad acá es cerrar la puerta, no dejarla entornada. El cierre entra por la alternativa (§1.2 capa 4), no por una palanca que no existe. NO menciones distancia al veredicto en \`conviene.respuestaDirecta\`: no hay una que prometer.`;
    }

    // La tarifa es la única vía que pide superar al mercado. Si el modelo la presenta como
    // un supuesto que se corrige, miente sobre el riesgo — por eso la instrucción es
    // explícita y no queda a criterio del tono.
    const esAdr = dv.palancaMasBarata?.palanca === "adr";
    const avisoAdr = esAdr
      ? `\n\nLA VÍA MÁS BARATA ES LA TARIFA, y la tarifa NO es un supuesto del usuario: sale de lo que se cobra realmente en su zona. Decilo como lo que es — una APUESTA a rendir sobre la mediana de la zona, sostenida con trabajo de gestión (fotos, calendario, respuesta) — nunca como "ajusta este supuesto" ni como un número que estaba mal.`
      : "";

    const avisoPuroGate = dv.esPuroGate
      ? `\n\nOJO — EL PUNTAJE YA ALCANZA la banda de arriba: lo que retiene el veredicto es que la operación todavía no cierra, no que falten puntos. PROHIBIDO escribir "estás cerca del puntaje", "te faltan puntos" o cualquier variante que atribuya el veredicto al Franco Score. Nombra primero, en consecuencia vivida, qué es lo que hoy no cierra, y recién después la vía que lo da vuelta.`
      : "";

    const avisoPie = dv.pieExcluidoPorBono
      ? `\n\nEl pie de este caso lo cubre un bono de la inmobiliaria: NO ofrezcas subir el pie como vía — desarma la compra que se está evaluando.`
      : "";

    // §1.12.1 — banda de esfuerzo de la palanca precio, pre-digerida (helper
    // compartido con LTR; los cortes 5/12 son doctrinales y conviven con los
    // topes propios STR — la banda describe el esfuerzo del delta emitido).
    const palancaPrecioStr = dv.palancas.find((l) => l.palanca === "precio");
    const avisoBandaPrecio = palancaPrecioStr
      ? `\n\nBANDA DE ESFUERZO del descuento de la palanca precio (§1.12.1 — dato del motor; nárrala con este lenguaje, NUNCA la reclasifiques): ${bandaEsfuerzoDescuento(Math.abs(palancaPrecioStr.deltaPct)).lectura}.`
      : "";

    // §1.12.3 — doble filo del pie, obligatorio al recomendarlo como palanca.
    const avisoDobleFiloPie = dv.palancas.some((l) => l.palanca === "pie")
      ? `\n\nHONESTIDAD DE DOBLE FILO DEL PIE (§1.12.3 — obligatoria al recomendarlo): "más pie mejora el flujo, pero también significa poner más plata tuya para que el mismo negocio se vea mejor — tapa el síntoma, no convierte una mala compra en buena". El pie sano nunca se presenta como mérito de la propiedad. (Con pie 0 rige ## 5.bis.)`
      : "";

    // §1.12.2 (alcance STR, SIN anclas — el motor no las produce): caso negociador
    // de la palanca precio, con los argumentos que el análisis ya tiene.
    const sobreNeg = (Array.isArray(r.hallazgos) ? r.hallazgos : []).find((h) => h.id === "sobreprecio");
    const sobreNegV = sobreNeg?.valor as { desviacionPct?: number; sujetoUfM2?: number } | undefined;
    const casoNegociador = palancaPrecioStr
      ? `\n\nCASO NEGOCIADOR de la palanca precio (§1.12.2 — los argumentos van EN LA MISMA PIEZA que el número, en este orden de fuerza; SOLO estos — señales que no vienen acá NO existen: nada de urgencia del vendedor, días en mercado ni pre-aprobación del comprador):${sobreNegV?.desviacionPct != null && sobreNegV.desviacionPct > 2 ? `
  1) sobreprecio vs mediana comunal: pides UF ${(sobreNegV.sujetoUfM2 ?? 0).toLocaleString("es-CL")}/m² donde la mediana confiable de la comuna está ${pct(sobreNegV.desviacionPct)}% más abajo — el ancla de comparables
  2) ` : `
  1) `}umbral del análisis: bajo ${fmtUF(palancaPrecioStr.objetivo)} el veredicto sube a ${dv.veredictoObjetivo} — no es regateo, es la conclusión del análisis`
      : "";

    // §1.12.6 — un precio protagonista + arbitraje pre-digerido cuando una fila
    // de la tabla de sensibilidad queda a <2% del umbral de veredicto.
    const ufValorStr = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : 0;
    const filaCercana =
      palancaPrecioStr && ufValorStr > 0 && Array.isArray(r.sensibilidadPrecio)
        ? r.sensibilidadPrecio.find(
            (s) => s.label !== "actual" && s.precioCLP > 0 &&
              Math.abs(s.precioCLP / ufValorStr - palancaPrecioStr.objetivo) / palancaPrecioStr.objetivo < 0.02,
          )
        : undefined;
    const avisoJerarquia = palancaPrecioStr
      ? `\n\nUN PRECIO PROTAGONISTA (§1.12.6): el número de esta sección es el UMBRAL DE VEREDICTO (${fmtUF(palancaPrecioStr.objetivo)}); las filas de la tabla de sensibilidad de precio son escenarios ilustrativos, no objetivos. Si citas dos precios en la misma pieza, di explícitamente cuál manda y por qué.${filaCercana ? ` OJO — la fila "${filaCercana.label}" de sensibilidad (${fmtCLP(filaCercana.precioCLP)}) queda a MENOS de 2% del umbral: EL QUE MANDA es el umbral (cambia la conclusión del análisis); la fila se menciona solo pegada a él, nunca como un segundo objetivo.` : ""}`
      : "";

    return `${cab}

OBLIGATORIO: \`conviene.cajaAccionable\` DEBE nombrar esa distancia con su cifra. Es la condición concreta bajo la que tu posición se sostiene (§1.10) y lo único que responde "¿y ahora qué?".

TAMBIÉN en \`conviene.respuestaDirecta\`: cierra con UNA mención breve de esa distancia, con la cifra tipada, SIN desarrollar las vías — el detalle vive en cajaAccionable y en su drawer.

REGLA DURA de cifras: usa SOLO los montos y porcentajes que vienen en la frase de arriba. NUNCA los recalcules, NUNCA propongas una palanca que no esté ahí, NUNCA inventes un valor intermedio. La OCUPACIÓN no es palanca de este análisis (no la fija el propietario y en el cálculo mueve lo mismo que la tarifa); la TASA tampoco (es condición del banco).${avisoPuroGate}${avisoAdr}${avisoPie}${avisoDobleFiloPie}${avisoBandaPrecio}${casoNegociador}${avisoJerarquia}`;
  })();

  // PLUSVALÍA — la card (builder, con el puente histórica↔proyección) entra al prompt.
  // Sin esto el modelo escribía el "condicional de plusvalía" de largoPlazo SIN el dato
  // comunal y lo improvisaba — caso ab7d865d: prosa fresca negando un histórico (Ñuñoa
  // 3,2%) que la card del mismo informe cita. La fuente única es la fraseCanonica.
  const hallazgoPlusvalia = (Array.isArray(r.hallazgos) ? r.hallazgos : []).find((h) => h.id === "plusvalia");
  const bloquePlusvalia = hallazgoPlusvalia?.fraseCanonica
    ? `

=== PLUSVALÍA HISTÓRICA DE LA COMUNA (lectura canónica de la card) ===
«${hallazgoPlusvalia.fraseCanonica}»
→ El condicional de plusvalía de \`largoPlazo.contenido\` usa ESTA lectura: mismas cifras, mismo marco. NUNCA afirmes que falta histórico comunal cuando esta línea trae la cifra — y si dice "promedio del Gran Santiago", entonces la comuna NO tiene dato propio y lo dices así.`
    : "";

  // ── FRONTERAS Y MATRICES (T0 CONGELADO): lo que dibujan los diales y las dos matrices, como
  //    datos. El modelo no bisecciona ni cuenta celdas: lee.
  const bloqueSimulacion = (() => {
    if (!simulacion) return "";
    const fi = simulacion.fronterasIngreso;
    const fp = simulacion.fronteraPrecio;
    const mto = simulacion.matrizTarifaOcupacion;
    const mpp = simulacion.matrizPiePlazo;
    const pctF = (f: number) => `${f >= 1 ? "+" : "−"}${Math.abs((f - 1) * 100).toFixed(1).replace(".", ",")}%`;
    const arriba = fi.arriba && fi.tarifa.arriba != null && fi.ocupacion.arriba != null
      ? `sube a ${fi.arriba.veredicto} con ${pctF(fi.arriba.factor)} de ingreso (${fmtCLP(fi.tarifa.arriba)} por noche o ${Math.round(fi.ocupacion.arriba * 1000) / 10}% de ocupación)`
      : simulacion.veredictoBase === "COMPRAR" ? "no hay veredicto superior" : "no sube ni con el triple de ingreso";
    const abajo = fi.abajo && fi.tarifa.abajo != null && fi.ocupacion.abajo != null
      ? `cae a ${fi.abajo.veredicto} con ${pctF(fi.abajo.factor)} de ingreso (${fmtCLP(fi.tarifa.abajo)} por noche o ${Math.round(fi.ocupacion.abajo * 1000) / 10}% de ocupación)`
      : "no cae ni con el ingreso a un tercio";
    const precio = `${fp.subeA ? `sube a ${fp.subeA.veredicto} bajo ${fmtUF(fp.subeA.precioUF)}` : "no sube por precio"} · ${fp.caeA ? `cae a ${fp.caeA.veredicto} sobre ${fmtUF(fp.caeA.precioUF)}` : "no cae por precio"}`;
    const negCruza = mto.celdas.find((c) => c.cruza && c.flujoMensual < 0);
    return `

=== FRONTERAS Y MATRICES (dato del motor · lo que dibujan los diales y las matrices) ===
Ingreso (tarifa y ocupación mueven el ingreso por la misma razón): ${arriba}; ${abajo}.
Precio: ${precio}.
Matriz tarifa × ocupación (${mto.celdas.length} recomputes): ${mto.celdas.filter((c) => c.cruza).length} cruzan al veredicto de arriba, ${mto.celdas.filter((c) => c.cae).length} caen.${negCruza ? ` OJO: ${fmtCLP(negCruza.tarifaCLP)} por noche con ${Math.round(negCruza.ocupacion * 100)}% de ocupación cruza a ${negCruza.veredicto} aunque el mes quede en ${fmtCLP(negCruza.flujoMensual)}: el veredicto lo decide el Franco Score, no el signo del mes — si lo mencionas, dilo así.` : ""}
Matriz pie × plazo (${mpp.celdas.length} recomputes): ${mpp.celdas.filter((c) => c.cruza).length} cruzan, ${mpp.celdas.filter((c) => c.flujoMensual >= 0).length} dejan el mes en verde.
→ Cita estas cifras tal cual cuando hables de fronteras o de la matriz; no inventes intermedios ni cuentes celdas por tu cuenta.`;
  })();

  // ── PIRÁMIDE COMO DATOS (T0 CONGELADO): los hallazgos en su orden real, cada uno con qué ·
  //    cuánto · dirección. El #1 es el que ancla el hero (§7.bis); el resto es el mapa.
  const bloquePiramide = (() => {
    const list = Array.isArray(r.hallazgos) ? r.hallazgos.filter(Boolean) : [];
    if (!list.length) return "";
    const NOMBRE_H: Record<string, string> = {
      rentabilidad_str: "rentabilidad operativa (cap rate)", flujo_str: "flujo mensual", sobreprecio: "precio por m² frente a la mediana comunal",
      ventaja_vs_ltr: "corto frente a largo", ocupacion_vs_estimacion: "ocupación del caso frente a la estimación", sensibilidad_str: "punto de equilibrio",
      estructura_costos_str: "costos de operar", estructura_financiamiento: "estructura de financiamiento", plusvalia: "plusvalía histórica de la comuna",
      tir: "TIR a 10 años", patrimonio: "tu parte a 10 años", capex_puesta_a_punto: "puesta a punto", distancia_veredicto: "distancia al veredicto de arriba", gate_veredicto: "lo que retiene el veredicto",
    };
    const cuanto = (h: Hallazgo): string => {
      const v = h.valor as Record<string, unknown>;
      const n = (k: string) => (typeof v[k] === "number" ? (v[k] as number) : undefined);
      switch (h.id) {
        case "rentabilidad_str": return `${pct(n("capRatePct") ?? 0)}% frente a ${pct(n("umbralPct") ?? 5)}%`;
        case "flujo_str": return `${fmtCLP(n("flujoMensualCLP") ?? 0)} al mes`;
        case "sobreprecio": return `${pct(n("desviacionPct") ?? 0)}% frente a la mediana`;
        case "ventaja_vs_ltr": return `${pct(n("sobreRentaPct") ?? 0)}% de sobre-renta`;
        case "ocupacion_vs_estimacion": return `${n("ocupacionPct") ?? 0}% frente a ${n("estimacionPct") ?? 0}% estimado`;
        case "sensibilidad_str": return `${n("beRatioPct") ?? 0}% del ingreso de mercado para no perder plata`;
        case "estructura_costos_str": return `${n("costStackPct") ?? 0} de cada 100 pesos`;
        case "estructura_financiamiento": return `pie ${n("piePct") ?? 0}% · tasa ${pct(n("tasaPct") ?? 0)}%`;
        case "plusvalia": return `${pct(n("anualizadaPct") ?? 0)}% anual histórico`;
        case "tir": return `${pct(n("tirPct") ?? 0)}%`;
        case "patrimonio": return `×${pct(n("multiplicador") ?? 0, 2)} sobre lo puesto`;
        default: return "";
      }
    };
    const ordenados = ordenarHallazgosPiramideSTR(list);
    const filas = ordenados.map((h, i) => `${String(i + 1).padStart(2, "0")} · ${NOMBRE_H[h.id] ?? h.id} · ${h.direccion === "adverso" ? "en contra" : h.direccion === "favorable" ? "a favor" : "neutral"}${cuanto(h) ? ` · ${cuanto(h)}` : ""}${i < 4 ? " · TOP-4 (se ve en la página)" : ""}`).join("\n");
    const top = ordenados[0];
    const dir = (h: Hallazgo) => (h.direccion === "adverso" ? "en contra" : h.direccion === "favorable" ? "a favor" : "neutral");
    const flujoCaso = base.flujoCajaMensual;
    const bolsillo = flujoCaso < 0 ? `pones ${fmtCLP(-flujoCaso)} de tu bolsillo cada mes` : `te quedan ${fmtCLP(flujoCaso)} cada mes`;
    // La razón que manda, como dato. Cuando el #1 es la ventaja frente al largo, el dato que
    // manda es el bolsillo (lo que pone o le queda cada mes) y la comparación es el segundo.
    const esVentaja = top.id === "ventaja_vs_ltr";
    const datoManda = esVentaja
      ? `qué = lo que te deja operar por día, pagado todo · cuánto = ${bolsillo} · dirección = ${flujoCaso < 0 ? "en contra" : "a favor"}. SEGUNDO DATO: ${NOMBRE_H[top.id]} · ${cuanto(top)} · ${dir(top)}.`
      : `qué = ${NOMBRE_H[top.id] ?? top.id} · cuánto = ${cuanto(top) || "(sin cifra)"} · dirección = ${dir(top)}.`;
    // Ejemplo positivo pegado al campo, con la cifra de ESTE caso (patrón de los ejemplos del titular).
    const v = top.valor as Record<string, unknown>;
    const n = (k: string) => (typeof v[k] === "number" ? (v[k] as number) : 0);
    const ejemplo = (() => {
      switch (top.id) {
        case "rentabilidad_str": return n("capRatePct") < n("umbralPct")
          ? `Rinde ${pct(n("capRatePct"))}% sobre el precio, bajo el ${pct(n("umbralPct"))}% que le pedimos a una renta corta: **el precio no se justifica con lo que deja operar por día**.`
          : `Rinde ${pct(n("capRatePct"))}% sobre el precio, sobre el ${pct(n("umbralPct"))}% que le pedimos a una renta corta: **el metro se paga solo operando por día**.`;
        case "ventaja_vs_ltr": return flujoCaso < 0
          ? `Operando por día ${bolsillo}, pagado todo; **le gana al largo, pero esa ventaja la pagas con tus horas**.`
          : `Operando por día ${bolsillo}, pagado todo: **le gana al largo con la ocupación que el mercado estima**.`;
        case "flujo_str": return flujoCaso < 0
          ? `**${bolsillo[0].toUpperCase()}${bolsillo.slice(1)}** con la ocupación que el mercado estima para tu depto: la operación no se paga sola.`
          : `**${bolsillo[0].toUpperCase()}${bolsillo.slice(1)}**, pagado todo, con la ocupación que el mercado estima para tu depto.`;
        case "sobreprecio": return n("desviacionPct") > 0
          ? `Pagas el metro un ${pct(n("desviacionPct"))}% sobre la mediana de la comuna: **entras caro y el corto no lo compensa**.`
          : `Entras un ${pct(Math.abs(n("desviacionPct")))}% bajo la mediana de la comuna: **el precio no es el problema**.`;
        case "ocupacion_vs_estimacion": return `Supusiste ${n("ocupacionPct")}% de ocupación cuando el mercado estima ${n("estimacionPct")}%: **el veredicto descansa en tu supuesto, no en el mercado**.`;
        case "estructura_financiamiento": return `Con ${n("piePct")}% de pie y ${pct(n("tasaPct"))}% de tasa, **la cuota se come lo que deja la operación**.`;
        case "sensibilidad_str": return `Necesitas facturar el ${n("beRatioPct")}% de lo que rinde la zona para no perder plata: **el margen es el problema**.`;
        default: return `${NOMBRE_H[top.id] ?? top.id}: ${cuanto(top)} — **y eso es lo que decide este caso**.`;
      }
    })();
    return `

=== PIRÁMIDE DE HALLAZGOS (orden real por decisividad · dato del motor) ===
${filas}
HALLAZGO #1 COMO DATOS (la razón que manda la primera oración): ${datoManda} Los cuatro del TOP-4 son los que el usuario ve en la página, en ese orden.
Ejemplo del patrón para la primera oración de \`conviene.respuestaDirecta\` (la razón y la cifra son las de ESTE caso; no lo copies, copia el movimiento): «${ejemplo}»`;
  })();

  const bloqueCoronado = cardFrases.coronado
    ? `\n\n=== LO QUE LA CARD DEL #1 YA MUESTRA (no la copies · §1.bis) ===\n«${cardFrases.coronado.titular}» — ${cardFrases.coronado.frase}`
    : "";

  // §1.12.4 — caso precio-justo STR: el flag viaja en el hallazgo de distancia
  // (el recompute de la persistencia STR SÍ corre con mediana — str-prosa-persist).
  const bloquePrecioJustoStr = distanciaSTR?.valor.casoPrecioJusto
    ? `

=== CASO PRECIO-JUSTO STR (§1.12.4 — PRECIO E INGRESOS A MERCADO, VEREDICTO ${String(r.francoScore?.veredicto ?? "")}) ===
El precio está alineado con la mediana comunal (dato confiable) Y la tarifa/ocupación corren ancladas a la mediana observada de la zona (sin datos tuyos: tarifa y ocupación de mercado). El problema NO es el departamento — es la zona.
REENCUADRE OBLIGATORIO (lenguaje canónico; adáptalo lo mínimo): "esta zona no sostiene renta corta a los precios de compra actuales".
SALIDA CONSTRUCTIVA: no un descuento cosmético — la comparación honesta con el arriendo largo (sección vsLTR / recomendación de modalidad) y, si el dato lo permite, dónde el corto sí rinde.
PROHIBIDO resolver este caso pidiendo un descuento chico "por matemática propia" sin este reencuadre. Si el descuento que arreglaría el caso excede lo plausible, se dice — no se maquilla.`
    : "";

  // §1.12.5 — simetría del sobreprecio (pérdida concreta + años de recuperación,
  // con el mismo caveat temporal del puente de plusvalía; nunca fecha).
  const bloqueSimetriaStr = (() => {
    const sobre = (Array.isArray(r.hallazgos) ? r.hallazgos : []).find((h) => h.id === "sobreprecio");
    const v = sobre?.valor as { desviacionPct?: number; sobreprecioUfM2?: number } | undefined;
    if (!v || v.desviacionPct == null || v.sobreprecioUfM2 == null || v.desviacionPct <= 5 || !(superficie > 0)) return "";
    const totalUF = Math.round(v.sobreprecioUfM2 * superficie);
    if (!(totalUF > 0)) return "";
    const plusV = hallazgoPlusvalia?.valor as { anualizadaPct?: number } | undefined;
    const anios = plusV?.anualizadaPct != null && plusV.anualizadaPct > 0
      ? Math.max(1, Math.round(v.desviacionPct / plusV.anualizadaPct))
      : null;
    return `

=== SIMETRÍA DEL SOBREPRECIO (§1.12.5 — misma vara que la ganancia) ===
- Pérdida patrimonial concreta: estás pagando ~UF ${totalUF.toLocaleString("es-CL")} sobre el valor estimado de la zona (${pct(v.desviacionPct)}%) — plata que entregas el día de la firma. Tradúcela así, nunca como porcentaje seco.${anios !== null ? `
- Tiempo de recuperación (orden de magnitud condicionado, NUNCA fecha): a la plusvalía histórica de esta comuna, tardarías ~${anios} año${anios === 1 ? "" : "s"} solo en recuperar el sobreprecio, antes de ganar tu primer peso de apreciación — con el MISMO caveat temporal de la lectura de plusvalía (histórico atípico, no proyección).` : `
- Sin histórico comunal positivo no se estima tiempo de recuperación — no lo inventes.`}
- REGLA DE ORO — misma prominencia: si una ventaja de compra de este tamaño iría en el hero, esta pérdida va en el hero. Prohibido celebrar fuerte y advertir bajito.`;
  })();

  // §1.12.7 — driver no accionable: la plusvalía adversa corona el orden único.
  const ordenDriver = ordenarHallazgosPiramideSTR((Array.isArray(r.hallazgos) ? r.hallazgos : []).filter(Boolean));
  const bloqueDriverNoAccionableStr =
    ordenDriver[0]?.id === "plusvalia" && ordenDriver[0]?.direccion === "adverso"
      ? `

=== DRIVER NO ACCIONABLE (§1.12.7) ===
Lo que más pesa en esta lectura es la plusvalía histórica de la comuna — una dimensión que el usuario NO controla. ANTES de ofrecer cualquier palanca, dilo con el marco canónico (adáptalo lo mínimo): "lo que más pesa acá no se negocia con nadie — es la historia de apreciación de la comuna. Las palancas de abajo mejoran el flujo, pero no cambian ese hecho". Ofrecer precio/tarifa/pie sin ese marco vende la ilusión de que todo se arregla negociando.`
      : "";

  // Pie cero (RESUELTO fase 4): con pie 0 las métricas sobre capital llegan como
  // NO_APLICA_PROMPT, el input declara la razón (enum RazonSinCapital, extensible)
  // y la comparación de múltiplos del Ángulo 3 se reemplaza por la lectura en
  // flujo. Doctrina en ## 5.bis del system; copy canónico en no-aplica-copy.ts.
  const cocNoAplicaSTR = esMetricaNoAplica(base.cashOnCash)
    ? base.cashOnCash
    : piePct === 0
      ? ({ tipo: "no_aplica", razon: "sin_pie" } as const)
      : null;
  const sinCapitalPropio = cocNoAplicaSTR !== null;

  const userPrompt = `Analiza esta inversión inmobiliaria en renta corta (Airbnb). Aplica la doctrina §0-§14 del system prompt y devuelve el JSON v3.

=== DATOS DE LA PROPIEDAD ===
Dirección: ${direccion || "—"}
Comuna: ${comuna}
Superficie: ${superficie} m²
Dormitorios: ${dormitorios}, Baños: ${banos}
Tipo: ${tipoPropiedad || "—"}
Precio compra: ${fmtUF(precioCompraUF)} (${fmtCLP(precioCompraCLP)})
Pie: ${piePct}% = ${fmtCLP(pieCLP)}${sinCapitalPropio ? ` — FINANCIAMIENTO DEL 100% (razonSinCapital: ${razonSinCapitalPrompt(cocNoAplicaSTR!.razon)}). APLICA LA DOCTRINA ## 5.bis del system.` : ""}
Tasa crédito: ${pct(tasa)}%, Plazo: ${plazo} años
Dividendo: ${fmtCLP(dividendo)}/mes
Capital invertido inicial: ${fmtCLP(capitalInv)} (pie + amoblamiento + gastos cierre)${sinCapitalPropio ? " — SIN pie: amoblamiento y cierre, NO capital propio que rente" : ""}
Modo gestión seleccionado: ${modoGestion} (comisión: ${comisionPct}%)
Edificio permite Airbnb: ${regulacion}
Amoblado: ${amoblado} (costo amoblamiento: ${fmtCLP(costoAmoblamiento)})

=== FRANCO SCORE STR: ${score}/100 ===
veredicto (dado — úsalo como conclusión, no lo contradigas · §7): ${veredictoMotor}
${fs ? `Rentabilidad: ${fs.desglose.rentabilidad.score}/100 — ${fs.desglose.rentabilidad.detail}
Sostenibilidad: ${fs.desglose.sostenibilidad.score}/100 — ${fs.desglose.sostenibilidad.detail}
Ventaja vs LTR: ${fs.desglose.ventaja.score}/100 — ${fs.desglose.ventaja.detail}
Factibilidad: ${fs.desglose.factibilidad.score}/100 — ${fs.desglose.factibilidad.detail}` : "(desglose no disponible)"}
${motivosBloque}

${bloqueBaseHeader}
Ingresos brutos anuales: ${fmtCLP(base.ingresoAnual)}
${lineaADR}, ${lineaOcc}
Ocupación upside (potencial con gestión profesional, estabilizado): ${Math.round(agr.ocupacionReferencia * 100)}%
Gap ocupación: ${(() => { const g = Math.round((agr.ocupacionReferencia - base.ocupacionReferencia) * 100); return `${g >= 0 ? "+" : ""}${g}`; })()} pts ${gapOccTag}
${lineaFuenteOcc}
Ingreso bruto mensual: ${fmtCLP(base.ingresoBrutoMensual)}
Comisión (${comisionPct}%): -${fmtCLP(base.comisionMensual)}/mes
Costos operativos (electricidad ${fmtCLP(elec)} + agua ${fmtCLP(agua)} + wifi ${fmtCLP(wifi)} + insumos ${fmtCLP(insumos)} + mantención ${fmtCLP(mant)} + GC ${fmtCLP(gc)} + contrib ${fmtCLP(contribMensual)}): -${fmtCLP(base.costosOperativos)}/mes
NOI mensual: ${fmtCLPSigned(base.noiMensual)}
Dividendo: -${fmtCLP(dividendo)}/mes
FLUJO DE CAJA MENSUAL: ${fmtCLPSigned(base.flujoCajaMensual)}
CAP rate: ${pct(base.capRate * 100, 2)}% (umbral STR de referencia: 5%)
Cash-on-Cash: ${sinCapitalPropio ? NO_APLICA_PROMPT : metricaDisplay(base.cashOnCash, (n) => `${pct(n * 100)}%`)}

=== ESCENARIOS (conservador / base / upside) ===
Conservador (ocupación en el cuartil bajo observado): NOI ${fmtCLPSigned(cons.noiMensual)}/mes, Flujo ${fmtCLPSigned(cons.flujoCajaMensual)}/mes
${labelBaseEscenario}: NOI ${fmtCLPSigned(base.noiMensual)}/mes, Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
Upside (gestión profesional): NOI ${fmtCLPSigned(agr.noiMensual)}/mes, Flujo ${fmtCLPSigned(agr.flujoCajaMensual)}/mes

=== COMPARATIVA STR vs LTR ===
Arriendo largo (LTR): Ingreso bruto ${fmtCLP(comp.ltr.ingresoBruto)}/mes · NOI ${fmtCLPSigned(comp.ltr.noiMensual)}/mes · Flujo ${fmtCLPSigned(comp.ltr.flujoCaja)}/mes
STR (modo ${modoGestion}, base): NOI ${fmtCLPSigned(base.noiMensual)}/mes · Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
DIFERENCIA: Sobre-renta NOI ${fmtCLPSigned(comp.sobreRenta)}/mes${sobreRentaPctEsConfiable(comp.ltr.noiMensual, comp.sobreRentaPct) ? ` (${comp.sobreRentaPct >= 0 ? "+" : ""}${Math.round(comp.sobreRentaPct * 100)}%)` : ` (porcentaje N/D — NOI-LTR ≈0; usá el monto, nunca un %)`} · STR ${base.flujoCajaMensual > comp.ltr.flujoCaja ? "GANA" : "PIERDE"} en flujo · Payback amoblamiento: ${comp.paybackMeses > 0 ? comp.paybackMeses + " meses" : comp.paybackMeses === 0 ? "sin amoblamiento" : "no se recupera con sobre-renta"}

=== AUTO-GESTIÓN vs ADMINISTRADOR ===
Auto (comisión 3% Airbnb): NOI ${fmtCLPSigned(strAuto.noiMensual)}/mes, Flujo ${fmtCLPSigned(strAuto.flujoCajaMensual)}/mes — requiere ~8-12 hrs/semana del usuario.
Admin (comisión ${Math.round((num(inp.comisionAdministrador) ?? 0.2) * 100)}%): NOI ${fmtCLPSigned(strAdmin.noiMensual)}/mes, Flujo ${fmtCLPSigned(strAdmin.flujoCajaMensual)}/mes — inversión 100% pasiva.
Diferencia: auto-gestión genera ${fmtCLPSigned(difAutoAdmin)}/mes ${difAutoAdmin > 0 ? "más" : "menos"} que con administrador.
(NUNCA recomiendes administradores por nombre. Cierra con: "Franco pronto te conectará con operadores verificados." cuando el modo sea administrador.)

=== ESTACIONALIDAD (tiene su propio drawer con gráfico — NO la narres en detalle, §Ángulo 7) ===
Estacionalidad Santiago general: julio peak (vacaciones invierno + ski), febrero valle. El gráfico de 12 meses ya vive en la página; a lo sumo 1 frase de consecuencia operativa en \`operacion.contenido\` si cambia una decisión.

=== BREAK-EVEN (ya digerido — menciónalo UNA vez, §Ángulo 6) ===
Para no poner plata de tu bolsillo, este depto necesita ingresos brutos de ${fmtCLP(r.breakEvenIngresoAnual)}/año, que es el ${Math.round(r.breakEvenPctDelMercado * 100)}% de los ingresos brutos medianos de la zona (P50). ${r.breakEvenPctDelMercado > 1 ? "Está SOBRE el mercado: ni operando al nivel mediano cubre costos — riesgo estructural." : "Está bajo el mercado: hay margen antes de poner plata."}

=== ESTABILIZACIÓN INICIAL (no "ramp-up" en el output) ===
Los primeros ~6 meses el listing opera bajo su ocupación normal mientras gana reseñas; pérdida estimada acumulada de ese período: ${fmtCLP(r.perdidaRampUp)}.
DUEÑO DE ESTA CIFRA: el monto ${fmtCLP(r.perdidaRampUp)} se escribe en EXACTAMENTE UNA sección — ni dos veces ni cero. En \`riesgos\` si la estabilización es uno de tus 3 flancos (y entonces SU explicación lleva el monto completo: un riesgo de estabilización sin su cifra es adjetivo); si no es flanco, en \`operacion\`. La otra sección, si la menciona, la referencia SIN monto ("la pérdida de estabilización ya dimensionada en los riesgos"). Duplicarlo es el defecto que el rediseño eliminó del render; omitirlo en todas partes es esconderle al lector la única cifra que dimensiona el arranque.

=== PROYECCIÓN LARGO PLAZO (plusvalía proyectada: ${PROY_PCT} anual flat, proyección estándar Franco) ===
${projY10 && exit ? `Patrimonio neto al año ${exit.yearVenta} (valor del activo − deuda, SIN flujo): ${fmtCLP(projY10.patrimonioNeto)} (valor depto ${fmtCLP(projY10.valorDepto)} - saldo crédito ${fmtCLP(projY10.saldoCredito)})
Flujo operativo acumulado a ese año (dato APARTE, no entra al patrimonio): ${fmtCLPSigned(projY10.flujoAcumulado)}
Tu parte al vender año ${exit.yearVenta} (EQUITY = lo que te queda en la mano al liquidar el activo, neto de deuda y comisión, SIN flujo; NO "ganancia neta"): ${fmtCLPSigned(exit.equityCLP)}
Retorno total (equity + flujo acumulado): ${fmtCLPSigned(exit.retornoTotal)}
${sinCapitalPropio || metricaValorONull(exit.tirAnual) !== null ? `TIR @ ${exit.yearVenta} años: ${sinCapitalPropio ? NO_APLICA_PROMPT : metricaDisplay(exit.tirAnual, (n) => `${pct(n)}%`)} · ` : ""}Multiplicador de capital (equity/aportado, ×1 = recuperas lo puesto): ${sinCapitalPropio ? NO_APLICA_PROMPT : metricaDisplay(exit.multiplicadorCapital, (n) => `${pct(n, 2)}x`)}
${sinCapitalPropio
  ? `Comparación de múltiplos: no aplica — sin capital propio (pie $0) no hay múltiplo que comparar. El Ángulo 3 se hace en FLUJO y esfuerzo (## 5.bis.c): nombra el flujo mensual y lo que exige operar el STR frente a no operar nada; nunca un retorno sobre capital que no existe.`
  : `Depósito a plazo (UF+5%) a 10 años, sobre ese mismo capital aportado (${fmtCLP(exit.totalAportado)}): ${fmtCLP(Math.round(exit.totalAportado * Math.pow(1.05, 10)))} (múltiplo ×${pct(Math.pow(1.05, 10), 2)})
Fondo mutuo (7%) a 10 años, sobre ese mismo capital: ${fmtCLP(Math.round(exit.totalAportado * Math.pow(1.07, 10)))} (múltiplo ×${pct(Math.pow(1.07, 10), 2)})
Comparación de múltiplos (YA calculada — úsala tal cual, no recalcules): tu capital rinde ${metricaDisplay(exit.multiplicadorCapital, (n) => `×${pct(n, 2)}`)} en el depto (equity/aportado) frente a ×${pct(Math.pow(1.05, 10), 2)} en depósito UF y ×${pct(Math.pow(1.07, 10), 2)} en fondo mutuo. Ese es el ancla honesta del Ángulo 3: ajústala por esfuerzo, iliquidez y riesgo; nunca inventes el rendimiento del instrumento.`}` : "(proyecciones long-term no disponibles)"}

=== ATRACTORES DE DEMANDA EN LA ZONA ===
Metro más cercano: ${metroName} a ${distMetro}m
Clínica/hospital más cercano: ${clinica.nombre} a ${distClinicaTxt} (demanda médica captura estadías 3-15 días)
Zona negocios/turismo: ${zonaNT.nombre} a ${distZonaTxt} (demanda corporativa)
Acceso ski (junio-septiembre): ${distSkiTxt} (peak julio coincide con peak STR Santiago)

=== VIABILIDAD STR POR ZONA (honestidad de modalidad · §3.bis) ===
${r.zonaSTR ? `Tier zona: ${r.zonaSTR.tierZona} (score ${r.zonaSTR.score}/100)
ADR percentil vs comunas de Santiago con datos: p${r.zonaSTR.percentilADR} · Ocupación p${r.zonaSTR.percentilOcupacion} · Ingresos brutos p${r.zonaSTR.percentilIngreso}
${r.zonaSTR.comunaOcupacion && r.zonaSTR.ocupacionVsComuna && r.zonaSTR.ocupacionVsComuna !== "sin_datos" ? `Contexto comunal (datos de mercado): la estimación para esta dirección es ${Math.round(r.zonaSTR.occZona * 100)}% de ocupación frente a ${Math.round(r.zonaSTR.comunaOcupacion.valor * 100)}% típico de la comuna (${r.zonaSTR.comunaOcupacion.n} direcciones) → tu zona ocupa ${r.zonaSTR.ocupacionVsComuna === "mas" ? "más" : r.zonaSTR.ocupacionVsComuna === "menos" ? "menos" : "parecido a"} lo típico de la comuna. Es CONTEXTO de La zona, no un hallazgo: nómbralo en \`operacion\`/\`riesgos\` solo si cambia la lectura, y di "datos de mercado", nunca el nombre del proveedor.` : "(comuna sin datos de mercado suficientes — NO compares con la comuna; usa caveat al mencionar percentiles)"}` : "(sin datos de zonaSTR)"}
Recomendación de modalidad: ${r.recomendacionModalidad ?? "(no disponible)"}
${r.recomendacionModalidad === "LTR_PREFERIDO" ? `→ OBLIGATORIO en \`vsLTR.contenido\`: decir explícitamente que en esta zona LTR rinde mejor neto que STR y que la complejidad operativa del corto no se justifica. NO endulces (§1.1). Pero arranca del NOI absoluto, no re-enunciando la dirección que la card ya mostró (§1.bis).` : r.recomendacionModalidad === "STR_VENTAJA_CLARA" ? `→ En \`vsLTR.contenido\`: cuantifica el upside STR sobre LTR (sobre-renta > +15%); el esfuerzo se justifica.` : r.recomendacionModalidad === "INDIFERENTE" ? `→ En \`vsLTR.contenido\`: di "está parejo"; la decisión depende del esfuerzo operativo y el perfil de riesgo.` : ""}

=== SUBSIDIO LEY 21.748 (palanca financiera externa · Ángulo 4) ===
${r.subsidioTasa ? `califica=${r.subsidioTasa.califica} | aplicado=${r.subsidioTasa.aplicado} | tasaConSubsidio=${pct(r.subsidioTasa.tasaConSubsidio)}%
${r.subsidioTasa.califica && !r.subsidioTasa.aplicado ? `→ DEBES mencionar: el usuario puede pedir tasa subsidiada al banco (desde 0,6 pp menos; el banco define cuánto más). BAJA el dividendo y MEJORA el flujo. No está reflejado en este cálculo. Requisito: vivienda NUEVA EN PRIMERA VENTA hasta UF 6.000 — NO se exige que sea la primera vivienda del comprador.` : r.subsidioTasa.califica && r.subsidioTasa.aplicado ? `→ Ya aplicado (la tasa ingresada coincide con la subsidiada). No lo menciones como mejora.` : `→ No califica. NO mencionar el subsidio.`}` : "(subsidio no calculado)"}

=== SENSIBILIDAD DE PRECIO (Ángulo 4 — la tabla vive en su propio drawer de datos) ===
${r.sensibilidadPrecio ? r.sensibilidadPrecio.map((s) => `${s.label === "actual" ? "Precio actual" : `${s.label} → ${fmtCLP(s.precioCLP)}`}: CAP ${pct(s.capRate * 100, 2)}%, CoC ${esMetricaNoAplica(s.cashOnCash) ? NO_APLICA_PROMPT : metricaDisplay(s.cashOnCash, (n) => `${pct(n * 100)}%`)}, Flujo ${fmtCLPSigned(s.flujoCajaMensual)}/mes`).join("\n") : "(sin sensibilidad de precio)"}${sinCapitalPropio ? `
→ Con pie 0 la sensibilidad de precio se narra en FLUJO (## 5.bis.e): cada peso menos de precio es crédito que no tomas — el flujo de cada fila ya trae ese efecto.` : ""}${bloqueCards}${bloqueCoronado}${bloquePiramide}${bloqueDistancia}${bloqueSimulacion}${bloquePlusvalia}${bloqueSimetriaStr}${bloquePrecioJustoStr}${bloqueDriverNoAccionableStr}${anomaliasTexto}
${(() => {
    // §7.ter — CIFRA CLAVE de portada (motor: cifra-clave.ts; caption de catálogo).
    const distanciaStr = (r.hallazgos as { id: string }[] | undefined)?.find(
      (h) => h.id === "distancia_veredicto",
    ) as import("./types").HallazgoDistanciaVeredicto | undefined;
    const cifra = derivarCifraClaveStr({
      veredicto: veredictoMotor,
      flujoBaseMensual: base.flujoCajaMensual,
      // Ahorro de pasar a auto-gestión = diferencia de flujo auto vs admin, que el
      // motor ya trae (misma cifra del bloque AUTO-GESTIÓN vs ADMINISTRADOR).
      ahorroAutogestionClpMes: modoGestion === "administrador" && difAutoAdmin > 0 ? difAutoAdmin : null,
      distancia: distanciaStr ?? null,
      ufValue: precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : 0,
    });
    if (!cifra) return `
=== CIFRA CLAVE DE PORTADA (§7.ter) ===
Este caso NO tiene cifra clave — el titular carga solo.`;
    const valorTxt = cifra.tipo === "pct" ? `${cifra.valorPct}%` : `${cifra.signo < 0 ? "-" : ""}${fmtCLP(cifra.valorClp)}/mes`;
    return `
=== CIFRA CLAVE DE PORTADA (§7.ter — el lector la ve como cifra grande JUNTO a tu titular) ===
valor: ${valorTxt} · caption fijo (no lo escribas tú): "${captionDeCifraClave(cifra)}"
Tu titular la ENCUADRA: no la repite, no la contradice, no cita otro monto en su lugar.
`;
  })()}

═══════════=== §CÁPSULA — \`conviene.veredictoFrase\` (≤12 palabras) ===
UNA línea de Franco DENTRO de la prosa del veredicto, en primera persona y en rojo.
Es CONCLUSIÓN, no resumen: la frase que dirías mirando al comprador a los ojos después
de haber leído todo. Si se puede reemplazar por un encabezado, está mal escrita.
- NO recita cifras (la prosa y la cifra clave ya las tienen).
- NO repite el titular ni la primera oración de \`respuestaDirecta\`.
- NO es un consejo genérico ("evalúa bien"): es el juicio de este caso.
Del registro que se busca, tres ejemplos REALES de análisis del parque:
> "Flujo negativo estructural: ajusta supuestos antes de comprometerte."
> "STR gana al largo, pero ninguno llega al dividendo."
> "Ajusta la gestión o el precio antes de firmar."

════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL
═══════════════════════════════════════════════════════════════════

1. Doctrina §0-§14 sin excepción. Test §1 (¿se reemplaza por una tabla?) es real. Regla central §1.bis: EL DRAWER PROFUNDIZA, NO REPITE lo que la card ya mostró.
2. \`veredicto\` = "${veredictoMotor}" — cópialo EXACTO. No lo modifiques.
3. Umbrales SOLO del input (§1.ter). El umbral de CAP es 5%; PROHIBIDO inventar "rangos sanos 6-8%".
4. Si crees que el veredicto está mal calibrado, NO lo contradigas: usa \`francoCaveat\` opcional (audit-only).
5. Cada anomalía detectada aparece en el output (§8); el break-even, UNA sola vez.
6. Cierre obligatorio en \`riesgos.cajaAccionable\` con posición personal (§9), NO checklist.
7. Voz tuteo neutro chileno (§10). Auto-chequeo: ningún voseo (-ás/-és/-ís); ningún "revenue"/"ramp-up".
8. \`riesgos.contenido\`: EXACTO 3 riesgos en prosa, separados por \\n\\n. Sin bullets.
9. Respeta los MÁXIMOS de palabras por campo del §13. Un guard los mide.
10. JSON válido y completo. Sin texto fuera del JSON, sin backticks.
11. DESTACADORES \`**…**\` (único markdown permitido; el render los pinta con plumón): marca las frases clave. Máximo 2 marcas por párrafo; cada marca envuelve una FRASE COMPLETA con predicado que se lee sola como mini-hallazgo — nunca un número pelado ni un fragmento sin verbo. Una marca JAMÁS cruza un punto ni parte un token de cifra. En el \`titular\` rige §7.ter (exactamente UNA marca). Desde v9, CADA \`cajaAccionable\` lleva EXACTAMENTE UNA marca sobre su frase-fuerza (el render las muestra como cierre del cuerpo, y un cierre sin frase-fuerza destacada se lee plano); \`riesgos.contenido\` sigue SIN marcas (regla propia).

Responde SOLO con el JSON.`;

  return { userPrompt, veredictoMotor, cardFrases };
}

// ─────────────────────────────────────────────────────────────────────────
// Guards puros (compartidos endpoint + regen)
// ─────────────────────────────────────────────────────────────────────────

/** Aplana todos los strings del objeto con su path. */
function collectStrings(node: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof node === "string") { out.push({ path, value: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, `${path}[${i}]`, out)); return; }
  if (node && typeof node === "object") {
    Object.entries(node as Record<string, unknown>).forEach(([k, v]) => collectStrings(v, path ? `${path}.${k}` : k, out));
  }
}

// HARD drift: jerga inglesa que NO puede persistir (invariante del corpus). Dispara
// reintento — "revenue"/"ramp-up" nunca son aceptables en el output. El source-
// determinism del prompt (ingresos brutos / estabilización inicial) los previene;
// esto es la red.
const STR_HARD_RE = /\brevenue\b|ramp-?up/i;
// SOFT drift: engine-isms (mecánica del modelo filtrada al copy). Desde el Goal 2 STR
// (04-sep-2026) la lista vive en str-guards.ts (STR_ENGINEISM_RE) y el guard
// [STR-ENGINEISM] REINTENTA por campo; este monitor reporta el residual con la misma
// lista. ("el/del motor" NO está acá: lo elimina despersonalizarMotor.)
const STR_SOFT_RE = STR_ENGINEISM_RE;

function scanWith(ai: unknown, re: RegExp): string[] {
  const strings: { path: string; value: string }[] = [];
  collectStrings(ai, "", strings);
  const hits: string[] = [];
  for (const { path, value } of strings) {
    const m = value.match(re);
    if (m) hits.push(`${path}="${m[0]}"`);
  }
  return hits;
}

/** HARD drift (revenue/ramp-up) — invariante, dispara reintento. */
export function scanStrHardDrift(ai: unknown): string[] { return scanWith(ai, STR_HARD_RE); }
/** SOFT drift (engine-isms temporales) — detección-only, no bloquea (paridad LTR). */
export function scanStrSoftDrift(ai: unknown): string[] { return scanWith(ai, STR_SOFT_RE); }
/** Todos los hits (hard+soft), para reporte no-bloqueante. */
export function scanStrDrift(ai: unknown): string[] { return [...scanStrHardDrift(ai), ...scanStrSoftDrift(ai)]; }

// Guard de cifras: extraído a módulo compartido al portarlo a LTR (rama
// prosa-no-recalcula-ltr). Se re-exporta para los consumidores existentes.
import { cifrasFueraDeInput, empeoraCifras } from "./cifras-guard";
import {
  contextoGuardsStr, violacionesPorCampo, totalViolaciones, leerCampo, escribirCampo,
  razonesHeroClaimStrTexto, STR_ENGINEISM_RE, type ReglaStr,
} from "./str-guards";
import { derivarCifraClaveStr, captionDeCifraClave } from "./cifra-clave";
import { validarTitular, evaluarTitular, normalizarMarcasTitular, marcasBalanceadas, stripMarcas } from "./prosa-marcas";
import { reescribirTitular } from "./titular-retry";
export { cifrasFueraDeInput };

/** Techo POR RIESGO (v9): título (~10) + explicación de 45-55 palabras. El render
 *  muestra el texto ÍNTEGRO desde v9 — un bloque pasado de este techo ya no lo
 *  salva ningún truncado. */
export const BUDGET_POR_RIESGO = 65;

/** Secciones sobre presupuesto (por un factor de tolerancia). Devuelve [path, palabras, máximo].
 *  Caso especial `riesgos.contenido` (v9): además del total, cada bloque \n\n se mide
 *  contra BUDGET_POR_RIESGO — un solo riesgo desbordado dispara el retry quirúrgico
 *  del campo completo (el rewriter direcciona por sec.field, no por bloque). */
export function sectionsOverBudget(ai: Record<string, unknown> | null | undefined, factor = 1.15): { path: string; wc: number; max: number }[] {
  if (!ai) return [];
  const out: { path: string; wc: number; max: number }[] = [];
  for (const [path, max] of Object.entries(SECTION_BUDGETS_STR)) {
    const [sec, field] = path.split(".");
    const section = ai[sec] as Record<string, unknown> | undefined;
    const val = section?.[field];
    const wc = wordCount(val);
    if (wc > max * factor) {
      out.push({ path, wc, max });
      continue;
    }
    if (path === "riesgos.contenido" && typeof val === "string") {
      const bloques = val.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      const peor = Math.max(0, ...bloques.map((b) => wordCount(b)));
      if (peor > BUDGET_POR_RIESGO * factor) out.push({ path, wc, max });
    }
  }
  return out;
}

/** Normaliza una oración para comparar eco (montos/% neutralizados). */
function normSent(s: string): string {
  return s
    .replace(/\$[\d.,]+/g, "«M»")
    .replace(/UF\s?[\d.,]+/gi, "«M»")
    .replace(/[\d.,]+\s?%/g, "«P»")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function firstSentence(s: string): { first: string; rest: string } {
  const parts = s.split(/(?<=[.;])\s+/);
  const first = (parts[0] ?? "").trim();
  const rest = parts.slice(1).join(" ").trim();
  return { first, rest };
}

/**
 * Strip de eco card↔drawer (backstop determinístico, capa secundaria; el primario
 * es el prompt §1.bis). Si la 1ª oración de la prosa RE-ENUNCIA el dato que la card
 * ya mostró (patrón exacto que F1b cazó), se strippea — solo si el resto queda ≥18
 * palabras (mejor eco que mutilado). Cada strip loguea con `logger`.
 */
export function stripCardEcho(
  ai: AIAnalysisSTRv2 | null | undefined,
  cardFrases: CardFrasesSTR,
  logger: (msg: string) => void = () => {},
): AIAnalysisSTRv2 | null | undefined {
  if (!ai) return ai;
  const MIN_REST = 18;

  // rentabilidad: la card abre "Tu CAP rate en corto es X%…"; strippea si la prosa
  // abre re-enunciando el CAP ("El/Un/Tu CAP (rate) de X% …") o clona la fraseCanónica.
  const capRe = /^(el|un|tu)\s+cap\s*rate\s+de\s+[\d.,]+\s?%/i;
  const rentSkel = cardFrases.rentabilidad ? new Set(cardFrases.rentabilidad.frase.split(/(?<=[.;])\s+/).map(normSent)) : new Set<string>();
  if (ai.rentabilidad?.contenido) {
    const { first, rest } = firstSentence(ai.rentabilidad.contenido);
    const echoes = capRe.test(first) || rentSkel.has(normSent(first));
    if (echoes && wordCount(rest) >= MIN_REST) {
      logger(`[STR-ECHO-STRIPPED] rentabilidad.contenido: 1ª oración re-enunciaba el CAP — strippeada`);
      ai.rentabilidad.contenido = rest;
    }
  }

  // vsLTR: la card abre con la dirección; strippea si la prosa abre re-enunciándola.
  const dirRe = /^(en esta zona,?\s+)?(el arriendo largo|ltr|la ventaja str|la sobre-?renta str|str genera|el corto)\b/i;
  const vsSkel = cardFrases.vsLTR ? new Set(cardFrases.vsLTR.frase.split(/(?<=[.;])\s+/).map(normSent)) : new Set<string>();
  if (ai.vsLTR?.contenido) {
    const { first, rest } = firstSentence(ai.vsLTR.contenido);
    const echoes = vsSkel.has(normSent(first)) || (dirRe.test(first) && !/\$[\d.]/.test(first));
    // solo strippea la re-enunciación PELADA de dirección (sin cifra propia); si la
    // 1ª oración ya trae el NOI absoluto ($…), es profundización, no eco → se conserva.
    if (echoes && wordCount(rest) >= MIN_REST) {
      logger(`[STR-ECHO-STRIPPED] vsLTR.contenido: 1ª oración re-enunciaba la dirección — strippeada`);
      ai.vsLTR.contenido = rest;
    }
  }

  return ai;
}

/**
 * Despersonaliza "el/del motor" → "el/del análisis" en TODO string del output (A11:
 * el motor es instrumento interno; el usuario ve a Franco, no al motor). Es un swap
 * seguro y determinístico — "motor" no tiene uso legítimo en prosa inmobiliaria STR —
 * y es la capa que GARANTIZA que la entidad interna nunca llega al usuario, sin
 * reintento caro (el source-scrub del prompt reduce la frecuencia; esto la elimina).
 */
export function despersonalizarMotor<T>(ai: T, logger: (msg: string) => void = () => {}): T {
  let hits = 0;
  const fix = (s: string): string =>
    s
      .replace(/\bel\s+motor\b/gi, (m) => { hits++; return m[0] === "E" ? "El análisis" : "el análisis"; })
      .replace(/\bdel\s+motor\b/gi, (m) => { hits++; return m[0] === "D" ? "Del análisis" : "del análisis"; });
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return fix(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = walk(v);
      return out;
    }
    return node;
  };
  const result = walk(ai) as T;
  if (hits > 0) logger(`[STR-MOTOR-DESPERSONALIZADO] ${hits} ocurrencia(s) de "el/del motor" → "análisis"`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// generateStrProse — orquestador compartido. Un solo camino LLM+guards para
// el endpoint y el regen, así el corpus regenerado == producción.
//  1. build prompt v3 · 2. LLM (hasta maxTries, mejor por leaks+presupuesto)
//  3. strip de eco determinístico · 4. drift scan (log) · 5. veredicto fill.
// NO persiste — el caller decide (supabase o archivo).
// ─────────────────────────────────────────────────────────────────────────
export interface GenerateStrProseArgs {
  anthropic: Anthropic;
  inp: Record<string, unknown>;
  r: ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] };
  comuna: string;
  /** Simulaciones del CONGELADO (fronteras y matrices), si el caller las tiene. Entran al
   *  prompt y a las razones de [HERO-CLAIM]. */
  simulacion?: SimulacionStr | null;
  maxTries?: number;
  logger?: (msg: string) => void;
}
export interface GenerateStrProseResult {
  ai: AIAnalysisSTRv2;
  driftHits: string[];        // todos (hard+soft), reporte
  hardDriftHits: string[];    // invariante — si >0, NO persistir
  softDriftHits: string[];    // engine-isms, detección-only
  overBudget: { path: string; wc: number; max: number }[];
  /** Guard STR-CIFRA: cifras de la prosa que no vienen del input (residual tras reintentos). */
  cifrasFuera: string[];
  tries: number;
  /**
   * Consumo de tokens de esta generación (intento principal + retries). Lo
   * persiste el CALLER: esta función genera y devuelve, no toca la base.
   */
  usage: AiUsage;
  /** Timing por llamada LLM (Goal A). Mismo contrato que usage: lo persiste el
   *  CALLER (route → pipeline_timing); los scripts pueden ignorarlo. */
  llamadas: LlamadaTiming[];
}

function parseStrJson(raw: string): AIAnalysisSTRv2 | null {
  let clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const f = clean.indexOf("{");
  const l = clean.lastIndexOf("}");
  if (f !== -1 && l !== -1) clean = clean.substring(f, l + 1);
  clean = clean.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(clean) as AIAnalysisSTRv2; } catch { return null; }
}

// Prompt caching (Goal C): system STR (~8.7k tokens) idéntico entre los intentos
// del loop de calidad y el budget-retry — cache_control ephemeral (5 min) los
// sirve a 0.1×. Solo shape del request; el texto no cambia.
const SYSTEM_STR_CACHED = [
  { type: "text" as const, text: SYSTEM_PROMPT_STR, cache_control: { type: "ephemeral" as const } },
];

export async function generateStrProse(args: GenerateStrProseArgs): Promise<GenerateStrProseResult> {
  const { anthropic, inp, r, comuna } = args;
  const simulacion = args.simulacion ?? null;
  const maxTries = args.maxTries ?? 3;
  const log = args.logger ?? (() => {});
  const { userPrompt, veredictoMotor, cardFrases } = buildUserPromptSTR(inp, r, comuna, simulacion);

  // FASE 1 — reintento por HARD drift (invariante que no puede persistir: ingreso/
  // ramp-up) y por voseo NO corregible (pronombre "vos" o -és/-ís fuera del léxico:
  // no sabemos a qué tuteo mapean, así que la única salida es regenerar). Los
  // engine-isms SOFT son detección-only; "el/del motor" lo elimina la
  // despersonalización y el voseo CONOCIDO lo arregla sanitizeVozChilena abajo, sin
  // gastar un reintento. El presupuesto se enforca aparte, en FASE 2 (1 reintento por
  // desborde grosero). Así un caso limpio y dentro de techo hace 1 intento.
  const vozDura = (ai: AIAnalysisSTRv2 | null) => (ai ? hitsQueExigenReintento(scanVozChilena(ai)) : []);
  // STR-CIFRA entra al score con el MISMO peso que el hard drift: elige la muestra con
  // menos cifras re-derivadas y gasta reintentos en converger a 0. NO es un gate duro —
  // si tras los intentos queda residual, se acepta y se reporta (lección del guard
  // flaky A8: c>0 sobre generación fresca como invariante dura revienta por azar).
  const cifrasDe = (ai: AIAnalysisSTRv2 | null) => (ai ? cifrasFueraDeInput(userPrompt, ai) : []);
  const scoreOf = (ai: AIAnalysisSTRv2 | null): number =>
    ai ? scanStrHardDrift(ai).length + vozDura(ai).length + cifrasDe(ai).length : Number.POSITIVE_INFINITY;

  // Consumo de tokens de todos los intentos. Viaja en el resultado; el caller lo
  // escribe junto con ai_analysis.
  const usage = nuevoAcumuladorUsage();
  // Timing por llamada (Goal A): mismo contrato que usage — viaja en el
  // resultado y lo persiste el caller. Solo medición.
  const reg = nuevoRegistroLlamadas();

  let best: AIAnalysisSTRv2 | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let usedTries = 0;
  for (let t = 0; t < maxTries; t++) {
    usedTries = t + 1;
    let correctivo = "";
    if (t > 0 && best) {
      const hard = scanStrHardDrift(best);
      if (hard.length) {
        correctivo = `\n\n⚠️ CORRECCIÓN: la versión anterior usó términos prohibidos (${hard.join(", ")}). Reemplázalos ("revenue"→"ingresos brutos", "ramp-up"→"estabilización inicial"). Reescribe el JSON COMPLETO respetando la doctrina §0-§14.`;
      }
      const voz = vozDura(best);
      if (voz.length) correctivo += correctivoVoz(voz);
      const cifras = cifrasDe(best);
      if (cifras.length) {
        correctivo += `

⚠️ CORRECCIÓN DE CIFRAS (§1.quater): la versión anterior citó cifras que NO vienen del input: ${cifras.join(", ")}. Cada monto y porcentaje del texto debe ser EXACTAMENTE uno de los provistos en el bloque de datos — sin sumas propias, sin restas, sin convertir montos a porcentajes. Donde la cifra que necesitas no exista, escribe la frase sin cifra. Reescribe el JSON COMPLETO respetando la doctrina §0-§15.`;
      }
    }
    let ai: AIAnalysisSTRv2 | null = null;
    try {
      const msg = await reg.medir(`quality-try-${t + 1}`, CLAUDE_MODEL, () => anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: userPrompt + correctivo }],
        system: SYSTEM_STR_CACHED,
      }));
      acumularUsage(usage, msg);
      const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      ai = parseStrJson(rawText);
    } catch (e) {
      log(`[STR-PROSE] intento ${t + 1} falló: ${(e as Error)?.message ?? e}`);
    }
    const sc = scoreOf(ai);
    if (sc < bestScore) { best = ai; bestScore = sc; }
    if (bestScore === 0) break; // sin HARD drift → aceptado
  }

  if (!best) throw new Error("generateStrProse: ningún intento parseó JSON válido");

  // FASE 2 — reintento QUIRÚRGICO de presupuesto (Goal F, patrón Goal D). Antes el
  // retry regeneraba el JSON COMPLETO (~12-14k tokens de input + ~3k de output,
  // ~50s) para acortar campos puntuales. Ahora reescribe SOLO los campos sobre
  // presupuesto: cada uno es prosa autocontenida de su drawer (paths seccion.campo
  // de SECTION_BUDGETS_STR) — sin costura alguna, ni siquiera la apertura del LTR.
  // Se enforca SOLO el desborde grosero (>1.3× del techo), 1 reintento, y se
  // acepta bajo el MISMO estándar de antes (menos campos desbordados, sin hard
  // drift ni voz dura nuevos) + el invariante de cifras delegado al módulo
  // compartido (empeoraCifras, cifras-guard.ts). Fallback: conservar el previo
  // (conducta de siempre — STR no tiene trim determinístico y crearlo cambiaría
  // el estándar). No corre si el mejor aún tiene HARD drift.
  const grossOf = (ai: AIAnalysisSTRv2): { path: string; wc: number; max: number }[] =>
    sectionsOverBudget(ai as unknown as Record<string, unknown>, 1.3);
  const grossBest = grossOf(best);
  if (grossBest.length > 0 && scanStrHardDrift(best).length === 0) {
    log(`[STR-BUDGET-RETRY] ${grossBest.length} campo(s) >1.3× techo (${grossBest.map((o) => `${o.path}:${o.wc}/${o.max}`).join(", ")}) — retry quirúrgico`);
    const bestRec = best as unknown as Record<string, Record<string, unknown>>;
    const campos = grossBest
      .map((o) => {
        const [sec, field] = o.path.split(".");
        const actual = bestRec[sec]?.[field];
        return { ...o, sec, field, actual: typeof actual === "string" ? actual : "" };
      })
      .filter((c) => c.actual);
    if (campos.length > 0) {
      const promptQuirurgico = `Estás corrigiendo SOLO ${campos.length} campo(s) de un análisis de renta corta YA generado y validado. El resto de la prosa no se toca y no lo verás.

${campos.map((c) => `CAMPO ${c.path} — mide ${c.wc} palabras, máximo ${c.max}:\n${c.actual}`).join("\n\n")}

TU TAREA: comprime cada campo a su máximo conservando el MISMO contenido — mismas cifras (ninguna cifra nueva), UN solo matiz por campo; la card ya mostró el dato, el drawer profundiza sin repetir.

Responde SOLO este JSON, sin texto alrededor:
{${campos.map((c) => `"${c.path}": "..."`).join(", ")}}`;
      try {
        const msg = await reg.medir("budget-retry", CLAUDE_MODEL, () => anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: promptQuirurgico }],
          system: SYSTEM_STR_CACHED,
        }));
        acumularUsage(usage, msg);
        usedTries += 1;
        const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
        // Parse tolerante: primer objeto {...} del texto; claves "seccion.campo".
        let reemplazos: Record<string, unknown> = {};
        try {
          const m = rawText.match(/\{[\s\S]*\}/);
          reemplazos = JSON.parse(m ? m[0] : rawText) as Record<string, unknown>;
        } catch {
          /* no parseó — candidato vacío, se conserva el previo */
        }
        const candidato = JSON.parse(JSON.stringify(best)) as AIAnalysisSTRv2;
        const candidatoRec = candidato as unknown as Record<string, Record<string, unknown>>;
        let aplicados = 0;
        for (const c of campos) {
          const nuevo = reemplazos[c.path];
          if (typeof nuevo === "string" && nuevo.trim() && candidatoRec[c.sec]) {
            candidatoRec[c.sec][c.field] = nuevo.trim();
            aplicados++;
          }
        }
        if (
          aplicados > 0 &&
          scanStrHardDrift(candidato).length === 0 &&
          vozDura(candidato).length === 0 &&
          grossOf(candidato).length < grossBest.length &&
          !empeoraCifras(userPrompt, best, candidato)
        ) {
          log(`[STR-BUDGET-RETRY] quirúrgico mejoró: ${grossBest.length}→${grossOf(candidato).length} campo(s) >1.3× (${aplicados} reescritos) — aceptado`);
          best = candidato;
        } else {
          log(`[STR-BUDGET-RETRY] quirúrgico no mejoró, reintrodujo drift o empeoró cifras — conservo el previo`);
        }
      } catch (e) {
        log(`[STR-BUDGET-RETRY] falló (best-effort, conservo el previo): ${(e as Error)?.message ?? e}`);
      }
    }
  }

  // ── RETRY SEMÁNTICO · dueño de la cifra de estabilización (decisión 28-ago) ──
  // La instrucción del prompt reduce pero no garantiza: medido sobre 4 corridas v9,
  // 1 duplicó el monto (riesgos + operación) y 1 lo omitió en todas partes. Este es
  // el enforcement por construcción, con la forma del budget-retry: la cifra
  // formateada de perdidaRampUp debe aparecer en EXACTAMENTE UNA sección de prosa.
  // Duplicada → se reescribe cada NO-dueño referenciando sin monto; omitida → se
  // reescribe operación para incluirla (dueño por defecto cuando riesgos no la
  // tomó). Una sola llamada, best-effort: si el candidato no queda en exactamente
  // una, se conserva el previo y el monitor lo reporta.
  const rampDigits = r.perdidaRampUp > 0 ? fmtCLP(r.perdidaRampUp).replace(/^\$/, "") : null;
  if (rampDigits && best && scanStrHardDrift(best).length === 0) {
    const PROSA_PATHS = [
      "riesgos.contenido", "operacion.contenido", "rentabilidad.contenido",
      "conviene.respuestaDirecta", "conviene.reencuadre", "largoPlazo.contenido", "vsLTR.contenido",
      "riesgos.cajaAccionable", "operacion.cajaAccionable",
    ];
    const conRamp = (ai: AIAnalysisSTRv2): string[] => {
      const rec = ai as unknown as Record<string, Record<string, unknown>>;
      return PROSA_PATHS.filter((path) => {
        const [sec, field] = path.split(".");
        const val = rec[sec]?.[field];
        return typeof val === "string" && val.includes(rampDigits);
      });
    };
    const donde = conRamp(best);
    if (donde.length !== 1) {
      const bestRec = best as unknown as Record<string, Record<string, unknown>>;
      const dueno = donde.includes("riesgos.contenido") ? "riesgos.contenido" : donde[0];
      const targets = donde.length === 0
        ? ["operacion.contenido"]
        : donde.filter((pth) => pth !== dueno);
      const campos = targets
        .map((path) => {
          const [sec, field] = path.split(".");
          const actual = bestRec[sec]?.[field];
          return { path, sec, field, actual: typeof actual === "string" ? actual : "" };
        })
        .filter((c) => c.actual);
      if (campos.length > 0) {
        log(`[STR-RAMP-DUENO] cifra de estabilización en ${donde.length} sección(es) (${donde.join(", ") || "ninguna"}) — retry quirúrgico sobre ${campos.map((c) => c.path).join(", ")}`);
        const instruccion = donde.length === 0
          ? `TU TAREA: reescribe cada campo conservando su contenido e integrando el monto de la pérdida de estabilización inicial (${fmtCLP(r.perdidaRampUp)}) donde el texto ya habla de los primeros meses de operación. Ninguna otra cifra nueva.`
          : `TU TAREA: reescribe cada campo conservando su contenido pero SIN el monto ${fmtCLP(r.perdidaRampUp)} — esa cifra ya vive en otra sección del análisis; si el campo la necesita, referénciala sin número ("la pérdida de estabilización ya dimensionada en los riesgos"). Ninguna cifra nueva.`;
        const promptDueno = `Estás corrigiendo SOLO ${campos.length} campo(s) de un análisis de renta corta YA generado y validado. El resto de la prosa no se toca y no lo verás.

${campos.map((c) => `CAMPO ${c.path}:\n${c.actual}`).join("\n\n")}

${instruccion}

Responde SOLO este JSON, sin texto alrededor:
{${campos.map((c) => `"${c.path}": "..."`).join(", ")}}`;
        try {
          const msg = await reg.medir("ramp-dueno-retry", CLAUDE_MODEL, () => anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 1000,
            messages: [{ role: "user", content: promptDueno }],
            system: SYSTEM_STR_CACHED,
          }));
          acumularUsage(usage, msg);
          usedTries += 1;
          const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
          let reemplazos: Record<string, unknown> = {};
          try {
            const m = rawText.match(/\{[\s\S]*\}/);
            reemplazos = JSON.parse(m ? m[0] : rawText) as Record<string, unknown>;
          } catch { /* no parseó — se conserva el previo */ }
          const candidato = JSON.parse(JSON.stringify(best)) as AIAnalysisSTRv2;
          const candidatoRec = candidato as unknown as Record<string, Record<string, unknown>>;
          let aplicados = 0;
          for (const c of campos) {
            const nuevo = reemplazos[c.path];
            if (typeof nuevo === "string" && nuevo.trim() && candidatoRec[c.sec]) {
              candidatoRec[c.sec][c.field] = nuevo.trim();
              aplicados++;
            }
          }
          if (
            aplicados > 0 &&
            conRamp(candidato).length === 1 &&
            scanStrHardDrift(candidato).length === 0 &&
            vozDura(candidato).length === 0 &&
            !empeoraCifras(userPrompt, best, candidato)
          ) {
            log(`[STR-RAMP-DUENO] quirúrgico dejó la cifra en exactamente una sección (${conRamp(candidato)[0]}) — aceptado`);
            best = candidato;
          } else {
            log(`[STR-RAMP-DUENO] quirúrgico no convergió a una sección (o reintrodujo drift/cifras) — conservo el previo; queda para el monitor`);
          }
        } catch (e) {
          log(`[STR-RAMP-DUENO] falló (best-effort, conservo el previo): ${(e as Error)?.message ?? e}`);
        }
      }
    }
  }

  // ── GUARDS DE SALIDA (Goal 2 · 04-sep-2026) · paridad con LTR ────────────────
  // Detección pura en str-guards.ts: la MISMA que evalúan los fixtures del golden y el
  // reporte sobre el dump. Cada regla hace UN reintento quirúrgico por campo y acepta
  // solo si mejora (menos violaciones, sin drift ni voz nuevos, sin empeorar cifras); si
  // no, conserva el previo y el residual queda en el log. Corre ANTES del strip de eco y
  // de los monitores finales, así estos miden lo que se persiste. Orden: estructural
  // (regla contable pegada al campo), múltiplos, palabras internas, engine-ism, copia.
  {
    const ctxGuards = contextoGuardsStr(r, inp, comuna, simulacion);
    const reintentoQuirurgico = async (
      regla: ReglaStr,
      etiqueta: string,
      problema: (v: string[]) => string,
      instruccion: string,
    ): Promise<void> => {
      if (!best) return;
      const antes = violacionesPorCampo(best, regla, ctxGuards);
      const nAntes = totalViolaciones(antes);
      if (nAntes === 0) return;
      const campos = Object.keys(antes)
        .map((path) => ({ path, actual: leerCampo(best, path) ?? "", viol: antes[path] }))
        .filter((c) => c.actual);
      log(`${etiqueta} ${campos.map((c) => `${c.path}: ${c.viol.map((v) => `«${v.slice(0, 100)}»`).join(" · ")}`).join(" | ")} — 1 reintento quirúrgico`);
      try {
        const prompt = `Estás corrigiendo SOLO ${campos.length} campo(s) de un análisis de renta corta YA generado y validado. El resto de la prosa no se toca y no lo ves.

${campos.map((c) => `CAMPO ${c.path}\nPROBLEMA: ${problema(c.viol)}\nTEXTO ACTUAL:\n${c.actual}`).join("\n\n")}

TU TAREA: ${instruccion} Conserva el mismo contenido, las mismas cifras (ninguna cifra nueva), el mismo largo aproximado y las marcas \`**…**\` que ya tenía cada campo. Tuteo chileno neutro, sin voseo.

Responde SOLO este JSON, sin texto alrededor:
{${campos.map((c) => `"${c.path}": "..."`).join(", ")}}`;
        const msg = await reg.medir(`guard-${regla}`, CLAUDE_MODEL, () => anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
          system: SYSTEM_STR_CACHED,
        }));
        acumularUsage(usage, msg);
        usedTries += 1;
        const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
        let reemplazos: Record<string, unknown> = {};
        try {
          const m = rawText.match(/\{[\s\S]*\}/);
          reemplazos = JSON.parse(m ? m[0] : rawText) as Record<string, unknown>;
        } catch { /* no parseó — candidato vacío, se conserva el previo */ }
        const candidato = JSON.parse(JSON.stringify(best)) as AIAnalysisSTRv2;
        let aplicados = 0;
        for (const c of campos) {
          const nuevo = reemplazos[c.path];
          if (typeof nuevo === "string" && nuevo.trim()) { escribirCampo(candidato, c.path, nuevo.trim()); aplicados++; }
        }
        const nDespues = totalViolaciones(violacionesPorCampo(candidato, regla, ctxGuards));
        if (
          aplicados > 0 &&
          nDespues < nAntes &&
          scanStrHardDrift(candidato).length === 0 &&
          vozDura(candidato).length === 0 &&
          !empeoraCifras(userPrompt, best, candidato)
        ) {
          log(`${etiqueta} retry mejoró ${nAntes}→${nDespues} — aceptado`);
          best = candidato;
        } else {
          log(`${etiqueta} retry no mejoró (${nAntes}→${nDespues}), no parseó o empeoró cifras/drift — conservo el previo`);
        }
      } catch (e) {
        log(`${etiqueta} falló (best-effort, el análisis sigue normal): ${(e as Error)?.message ?? e}`);
      }
    };

    // 4. [STR-ESTRUCTURAL] — con distancia estructural ninguna caja ofrece negociar.
    await reintentoQuirurgico(
      "estructural",
      "[STR-ESTRUCTURAL]",
      (v) => `la distancia al veredicto es ESTRUCTURAL (ningún ajuste realista alcanza) y la caja ofrece negociar, un descuento o un "si logras" como salida: ${v.map((x) => `«${x}»`).join(" · ")}`,
      "reescribe cada campo cerrando la puerta: sin negociación, sin descuento, sin \"si logras / si consigues\"; la brecha es del negocio, no de los supuestos, y el cierre entra por la alternativa.",
    );
    // 1. [HERO-CLAIM] — múltiplos contra la razón del motor.
    const razonesTxt = razonesHeroClaimStrTexto(ctxGuards.razones);
    await reintentoQuirurgico(
      "hero-claim",
      "[HERO-CLAIM]",
      (v) => `afirma un múltiplo que el motor contradice — ${v.join("; ")}`,
      `RAZONES DEL MOTOR (sujeto ÷ comparador): ${razonesTxt}. "El doble" / "la mitad" / "el triple" / "N veces" solo con el SUJETO y el COMPARADOR nombrados en la MISMA oración y con la razón del motor dentro del rango; si no hay razón para ese par, escribe la cifra y no el múltiplo.`,
    );
    // 3. [STR-INTERNAS] — nombres de la mecánica interna.
    await reintentoQuirurgico(
      "internas",
      "[STR-INTERNAS]",
      (v) => `usa nombres de la mecánica interna del cálculo que el usuario no debe ver: ${v.join(", ")}`,
      "reemplaza cada palabra interna por lenguaje de usuario: \"fallback\" → \"sin dato observado propio, se usa una referencia conservadora de mercado\"; \"override\" → \"el valor que tú definiste\"; en general, di qué es el dato, no de qué rama del cálculo sale.",
    );
    // 2. [STR-ENGINEISM] — verbo-trayectoria del modelo.
    await reintentoQuirurgico(
      "engineism",
      "[STR-ENGINEISM]",
      (v) => `describe cómo se mueve un número dentro del cálculo en vez de la consecuencia vivida: ${v.map((x) => `«${x}»`).join(", ")}`,
      "reescribe cada frase con la consecuencia para el usuario (\"dejas de poner plata cada mes\", \"el arriendo pasa a cubrir la cuota\", \"si la tarifa real baja a la del mercado\"), nunca con verbos de trayectoria como cruzar, converger o dar vuelta.",
    );
    // 5. [STR-COPIA] — la frase de la card no se repite.
    await reintentoQuirurgico(
      "copia",
      "[STR-COPIA]",
      (v) => `reproduce casi literal la frase de una card que el usuario ya leyó: ${v.map((x) => `«${x}»`).join(" · ")}`,
      "redacta esa oración con tu ángulo y otras palabras: la frase del hallazgo vive en la card; la prosa la interpreta, no la repite.",
    );
  }

  // Garantía de veredicto (si la IA olvidó copiarlo).
  if (!best.veredicto) best.veredicto = veredictoMotor;

  // Strip de eco card↔drawer (determinístico, post-LLM).
  best = stripCardEcho(best, cardFrases, log) as AIAnalysisSTRv2;
  // Despersonaliza "el/del motor" → "análisis" (A11) — garantiza que la entidad interna
  // nunca llega al usuario, sin reintento caro.
  best = despersonalizarMotor(best, log);
  // Red final de voz (§2.1): el voseo conocido y los typos recurrentes se reescriben a
  // tuteo chileno. Mismo contrato que despersonalizarMotor — swap determinístico, 1
  // token por 1 token, así que corre después del guard de presupuesto sin invalidarlo.
  best = sanitizeVozChilena(best, log);
  const vozResidual = vozDura(best);
  if (vozResidual.length) log(`[VOZ-RESIDUAL] ${vozResidual.length} forma(s) sin corrección tras los reintentos — ${vozResidual.map((h) => h.token).join(", ")}`);

  const hardDriftHits = scanStrHardDrift(best);
  const softDriftHits = scanStrSoftDrift(best);
  const driftHits = [...hardDriftHits, ...softDriftHits];
  if (hardDriftHits.length) log(`[STR-HARD-DRIFT] ${hardDriftHits.length} residual (invariante) — ${hardDriftHits.join(" | ")}`);
  if (softDriftHits.length) log(`[STR-SOFT-DRIFT] ${softDriftHits.length} engine-ism (detección) — ${softDriftHits.join(" | ")}`);
  const overBudget = sectionsOverBudget(best as unknown as Record<string, unknown>, 1.15);
  if (overBudget.length) log(`[STR-BUDGET] ${overBudget.length} campo(s) sobre presupuesto — ${overBudget.map((o) => `${o.path}:${o.wc}/${o.max}`).join(", ")}`);
  // Los post-procesos de arriba (strip/despersonalizar/sanitize) no tocan números, así
  // que medir acá equivale a medir sobre lo que se persiste.
  const cifrasFuera = cifrasDe(best);
  if (cifrasFuera.length) log(`[STR-CIFRA] ${cifrasFuera.length} cifra(s) fuera del input tras ${usedTries} intento(s) — ${cifrasFuera.join(" | ")}`);

  // GUARD DEL TITULAR (§7.ter, v7) — espejo del LTR: validación de FORMA
  // (validarTitular, fuente única con el golden AS4). Inválido ⇒ null + log,
  // SIN reintento (el render tolera ausencia; el golden mide la tasa). Marcas
  // `**` desbalanceadas en cualquier campo (recorte por oración que partió un
  // par) ⇒ strip de ese campo: pierde el plumón, nunca muestra `**` crudo.
  {
    const t = (best as { titular?: unknown }).titular;
    const v = validarTitular(t);
    if (!v.ok) {
      // Retry dirigido (titular-retry.ts) — espejo LTR.
      const reescrito = typeof t === "string" && t.trim()
        ? await reescribirTitular({
            anthropic: args.anthropic,
            model: CLAUDE_MODEL,
            titularInvalido: t,
            motivo: v.motivo ?? "",
            veredicto: String((best as { veredicto?: unknown }).veredicto ?? ""),
          })
        : null;
      if (reescrito) {
        log(`[TITULAR-REESCRITO] ${v.motivo} — corregido por retry dirigido`);
        (best as { titular?: string | null }).titular = reescrito;
      } else {
        // ESCALÓN (decisión PARÁ 3) — espejo LTR: 16-20 palabras sin montos se
        // renderiza con violación blanda; marcas rotas se normalizan; montos o
        // >20 → null.
        const ev = evaluarTitular(t);
        if (ev.nivel !== "invalido" && typeof t === "string") {
          if (ev.nivel === "largo_renderizable") log(`[TITULAR-LARGO-RENDERIZADO] ${ev.motivo}`);
          else log(`[TITULAR-MARCAS-NORMALIZADAS] ${v.motivo} — se renderiza normalizado`);
          (best as { titular?: string | null }).titular = normalizarMarcasTitular(t.trim());
        } else {
          log(`[TITULAR-INVALIDO] ${ev.motivo ?? v.motivo} — titular descartado (portada sin titular)`);
          (best as { titular?: string | null }).titular = null;
        }
      }
    }
    const stripDesbalance = (nodo: Record<string, unknown>): void => {
      for (const [k, val] of Object.entries(nodo)) {
        if (typeof val === "string") {
          if (!marcasBalanceadas(val)) {
            log(`[MARCAS-DESBALANCE] campo ${k} con \`**\` impar — marcas strippeadas`);
            nodo[k] = stripMarcas(val);
          }
        } else if (val && typeof val === "object") stripDesbalance(val as Record<string, unknown>);
      }
    };
    stripDesbalance(best as unknown as Record<string, unknown>);
  }

  // Sello de versión (F6). El caller (route + regen-corpus) persiste `ai` tal cual,
  // así endpoint y corpus sellan idéntico. Espejo ambas-generate.ts.
  best.promptVersion = PROMPT_VERSION_STR;

  return { ai: best, driftHits, hardDriftHits, softDriftHits, overBudget, cifrasFuera, tries: usedTries, usage, llamadas: reg.llamadas };
}
