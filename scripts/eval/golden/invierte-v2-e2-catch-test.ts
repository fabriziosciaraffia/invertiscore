// ─────────────────────────────────────────────────────────────────────────────
// TIER INVIERTE-V2-E2 · Invierte con Franco, comprador · etapa 2, entrega 1 (18-nov-2026; §11 a §14, láminas del 19-nov-2026 y la prueba del 20-nov): el perfil, hasta cuánto puede comprar,
// el resultado (los tres casos y el porqué), las etiquetas y la lectura por reglas, la elección, /invierte, y los detalles sin
// gastar créditos (charge_mode 'invierte') con su categoría propia en los paneles. 0 tokens.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hastaCuanto, creditoPorRenta, validarPerfil, comunasPrecargadas, ayudaPie, lineaTope, sinCortar, REGLA_TOPE, PERFIL_COPY, DONDES } from "../../../src/lib/invierte-v2/perfil";
import { ALTERNATIVAS_COPY as A12, MAX_RECOMENDADOS, cuantasPedir, cupoUsado, indicadorAlternativa, lineaPrecioDistancia, nivelDelBloque, nivelDelTitulo, subtituloAlternativas } from "../../../src/lib/invierte-v2/alternativas";
import { INTENTOS_LECTURA } from "../../../src/components/invierte-v2/LoQueVeFranco";
import { MAX_FOTOS, parsearDetalleFicha } from "../../../src/lib/guia/detalle-ficha";
import { leerFicha } from "../../../src/lib/guia/publicacion";
import { MAX_FOTOS_VISTA, pedidoFoto, respuestaFotoValida } from "../../../src/lib/invierte-v2/fotos";
import { ESQUEMA_LECTURA_FRANCO, INSTRUCCION_LECTURA_FRANCO, INSTRUCCION_LECTURA_FRANCO as I15, LECTURA_COPY, MAX_FOTOS_LECTURA as MAX_FOTOS_LECTURA15, VERSION_LECTURA as VERSION_LECTURA15, afirmaFaltanFotos as afirmaFaltanFotos15, cortaSinRepetirAlerta, lineaAlternativa, lineasElegido, lineaPermitida, recomendable, sanearLectura } from "../../../src/lib/invierte-v2/lectura-franco";
import { fotosCompletas as fotosCompletas15 } from "../../../src/lib/invierte-v2/lectura-franco-ia";
import { CLAUDE_MODEL_LECTURA } from "../../../src/lib/ai-config";
import {
  elegirOpciones, etiquetar, casoDe, porQueNoAlcanza, vsParecidos, textoMetro, textoAlMes, textoEtiqueta, estaCerca, UMBRAL_CERCA_PCT, lecturaDeFranco, MAX_ACTIVOS, MAX_OPCIONES, MIN_PARECIDOS,
  RESULTADO_COPY, fmtUF, type OpcionDepto,
} from "../../../src/lib/invierte-v2/opciones";
import { destinoInvierte, URL_BASE, URL_OPCIONES, URL_PARTIMOS } from "../../../src/lib/invierte-v2/destino";
import { reiniciarPrueba } from "../../../src/lib/invierte-v2/servidor";
import { falso, USER } from "./invierte-v2-catch-test";
import { chequearPorCarril, leidaFresca, RELECTURA_MS, TOPE_CARRIL_POR_HORA, type DepsCarril } from "../../../src/lib/invierte-v2/carril";
import { detectarCambios, lineaCambio, textoVeredicto, asuntoCambios, parrafoDepto, UMBRAL_CORREO_PCT, UMBRAL_LINEA_PCT, type Vigente } from "../../../src/lib/invierte-v2/cambios";
import { abrirDetalles, cuerpoDetalles, urlDetallesInvierte } from "../../../src/lib/invierte-v2/detalles-cliente";
import { DETALLES_COPY, abiertoDesdeInvierte, distanciaDelTuyo, indicadorContraElegido, lineaRecomendado, metrosEntre, UMBRAL_MES_CLP, UMBRAL_PRECIO_PCT } from "../../../src/lib/invierte-v2/detalles-modo";
import { CLAVE_MENU_INVIERTE, consultarMenu, entradaMenu, guardarMenu, leerMenuGuardado, olvidarMenu } from "../../../src/lib/invierte-v2/menu-cliente";
import { FLUJO_COPY, primerNombre } from "../../../src/lib/invierte-v2/flujo";
import { etiquetaVeredicto } from "../../../src/lib/veredicto-etiqueta";
import { ACTUALIZADO_COPY, BASE_COPY, DOCUMENTOS_COPY, MENU_COPY, SUMAR_COPY, fraseCambioPerfil, lineaDepto, numeroWhatsapp, urlWhatsapp, type PerfilComparable } from "../../../src/lib/invierte-v2/base";
import { sumarDepto, vigenteSobre } from "../../../src/lib/invierte-v2/base-servidor";
import { CORREO_PREAPROB, ESTADOS_COPY, MAX_BYTES_PREAPROBACION, PREAPROB_COPY, TE_TOCA_ROTULO, estadoVisible, lineaAprobada, nombreCoincide, puedeOfertar, teTocaHoy, validarAprobacion, validarArchivo, validarMotivo, vigente, hoyChile } from "../../../src/lib/invierte-v2/preaprobacion";
import { MOTIVO_REEMPLAZADA, aprobar, borrarArchivosPreaprobacion, confirmarSubida, leerPreaprobacion, pedirCorregir, pedirSubida } from "../../../src/lib/invierte-v2/preaprobacion-servidor";
import { ESQUEMA_LECTURA, INSTRUCCION_LECTURA, leerPreaprobacionIA } from "../../../src/lib/invierte-v2/preaprobacion-ia";
import { CLAUDE_MODEL_DOCUMENTOS } from "../../../src/lib/ai-config";
import { TARIFAS } from "../../../src/lib/costo-ia";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const cerca = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;

const op = (id: string, o: Partial<OpcionDepto>): OpcionDepto => ({
  avisoId: id, comuna: "Ñuñoa", dormitorios: 2, banos: 2, m2: 58, precioUF: 3000, veredicto: "COMPRAR", score: 78, flujoCLP: -50000,
  arriendoCLP: 500000, vsParecidosPct: null, metro: null, esEntrada: false, alcanza: true, ...o,
});

export async function runInvierteV2E2(): Promise<{ hard: number }> {
  console.log("\n─── TIER INVIERTE-V2-E2 (Invierte con Franco, comprador · etapa 2 — el perfil, hasta cuánto, el resultado y los detalles sin créditos · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  try {
    // ── 1 · HASTA CUÁNTO (la regla de Fabrizio) ──
    {
      const m = { tasaPct: 4.1, uf: 39000 };
      // Sin preaprobación: el menor entre pie/20 % y pie + el crédito que cabe en el 25 % / 40 % de la renta, a 30 años.
      const credito = creditoPorRenta(2500000, 100000, 4.1, 39000);
      const cuota = Math.min(2500000 * 0.25, 2500000 * 0.4 - 100000);
      const i = 0.041 / 12;
      const esperado = (cuota * (1 - Math.pow(1 + i, -360)) / i) / 39000;
      if (!cerca(credito, esperado, 0.01)) F(`1 · el crédito por renta no es el del 25 % / 40 % a 30 años (${credito} vs ${esperado})`);
      const conCarga = creditoPorRenta(2500000, 600000, 4.1, 39000);
      if (!(conCarga < credito) || !cerca(conCarga, ((2500000 * 0.4 - 600000) * (1 - Math.pow(1 + i, -360)) / i) / 39000, 0.01)) F("1 · las otras cuotas no bajan el crédito por la carga del 40 %");
      const r = hastaCuanto({ preaprobado: "no", pieUF: 700, rentaCLP: 2500000, otrasCuotasCLP: 100000, ...m });
      if (r.fuente !== "renta" || !cerca(r.topeUF, Math.min(700 / 0.2, 700 + credito)) || r.menosPreciso) F("1 · el tope con renta no es el menor entre pie/20 % y pie + crédito");
      const bajo = hastaCuanto({ preaprobado: "no", pieUF: 700, rentaCLP: 900000, otrasCuotasCLP: 0, ...m });
      if (bajo.limita !== "credito") F("1 · con poca renta no dice que limita el crédito");
      const sinRenta = hastaCuanto({ preaprobado: "tramite", pieUF: 500, noDiceRenta: true, rentaCLP: 3000000, ...m });
      if (sinRenta.fuente !== "solo_pie" || !cerca(sinRenta.topeUF, 2500) || !sinRenta.menosPreciso) F("1 · sin renta no es pie/20 % marcado menos preciso");
      // Con preaprobación: el banco financia el 80 %.
      const si = hastaCuanto({ preaprobado: "tengo", montoPreaprobadoUF: 2400, pieTiene: "si", ...m });
      if (si.fuente !== "preaprobacion" || !cerca(si.topeUF, 3000)) F("1 · con preaprobación y el pie completo no es monto / 0,8");
      const parte = hastaCuanto({ preaprobado: "tengo", montoPreaprobadoUF: 2400, pieTiene: "parte", pieUF: 300, ...m });
      if (!cerca(parte.topeUF, Math.min(2400 + 300, 300 / 0.2)) || parte.limita !== "pie") F("1 · con una parte del pie no es el menor entre monto + pie y pie / 20 %");
      const todavia = hastaCuanto({ preaprobado: "tengo", montoPreaprobadoUF: 2400, pieTiene: "no", pieUF: 300, ...m });
      if (todavia.topeUF !== 0) F("1 · con preaprobación y sin pie el tope no es 0");
      const aprobada = hastaCuanto({ preaprobado: "no", pieUF: 700, rentaCLP: 900000, aprobadaUF: 2000, pieTiene: "si", ...m });
      if (aprobada.fuente !== "aprobada" || !cerca(aprobada.topeUF, 2500)) F("1 · la preaprobación aprobada no reemplaza la estimación");
      if (REGLA_TOPE.piePct !== 20 || REGLA_TOPE.dividendoMaxPct !== 25 || REGLA_TOPE.cargaMaxPct !== 40 || REGLA_TOPE.plazoAnios !== 30) F("1 · la regla no es 20 % / 25 % / 40 % / 30 años");
      if (!r.supuestos || r.supuestos.tasaPct !== 4.1 || r.supuestos.uf !== 39000 || r.supuestos.version !== REGLA_TOPE.version) F("1 · los supuestos no van con el resultado");
      // En pantalla: segunda línea, «Sujeto a evaluación del banco»; con preaprobación, «según tu preaprobación».
      if (!/^Con tu pie y tu renta, estimamos que puedes comprar hasta UF 3\.500\. Sujeto a evaluación del banco\.$/.test(lineaTope({ topeUF: 3500, fuente: "renta" }, fmtUF))) F("1 · la línea del tope no es la de la lámina");
      if (!/^Según tu preaprobación/.test(lineaTope({ topeUF: 3000, fuente: "preaprobacion" }, fmtUF))) F("1 · con preaprobación la línea no dice «según tu preaprobación»");
      if (!/menos preciso/.test(lineaTope({ topeUF: 2500, fuente: "solo_pie" }, fmtUF))) F("1 · sin renta la línea no dice que es menos preciso");
    }

    // ── 2 · EL PERFIL: valida, precarga y es UN solo perfil ──
    {
      if (validarPerfil({ comunas: [], objetivo: "arriendo", preaprobado: "no", pieUF: 500, rentaCLP: 2000000 }).ok) F("2 · se acepta un perfil sin comunas");
      if (validarPerfil({ comunas: ["Ñuñoa"], objetivo: "arriendo", preaprobado: "no", pieUF: 500 }).ok) F("2 · se acepta sin renta sin marcar «Prefiero no decir mi renta»");
      if (!validarPerfil({ comunas: ["Ñuñoa"], objetivo: "arriendo", preaprobado: "no", pieUF: 500, noDiceRenta: true }).ok) F("2 · «Prefiero no decir mi renta» no deja seguir");
      if (validarPerfil({ comunas: ["Ñuñoa"], objetivo: "arriendo", preaprobado: "tengo", montoPreaprobadoUF: 2400 }).ok) F("2 · con preaprobación no pide si tiene el pie");
      const pre = validarPerfil({ comunas: ["Ñuñoa"], objetivo: "plusvalia", preaprobado: "tengo", montoPreaprobadoUF: "2.400", pieTiene: "si", rentaCLP: 9999999 });
      if (!pre.ok || pre.pedido.rentaCLP !== null || pre.pedido.montoPreaprobadoUF !== 2400) F("2 · con preaprobación se guarda la renta o no se lee el monto con puntos");
      const sinLaPregunta = JSON.stringify(PERFIL_COPY).toLowerCase();
      if (/tipo de renta|primera inversi/.test(sinLaPregunta)) F("2 · el perfil todavía pregunta el tipo de renta o si es su primera inversión");
      const c = comunasPrecargadas("Ñuñoa", ["Macul", "ñuñoa", "San Miguel"]);
      if (c.comunas.join("|") !== "Ñuñoa|Macul|San Miguel" || c.deEntrada !== "Ñuñoa" || c.dePerfil.join("|") !== "Macul|San Miguel") F("2 · las comunas no vienen primero la de entrada y después las del perfil, sin repetir");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): el «Sí» del contacto ya no llena el pie: solo muestra la ayuda «Para el depto que elegiste
      // necesitas UF X (20 %)». El campo va vacío y lo escribe la persona (§14b fija que el tope no salga del precio del depto).
      if (ayudaPie("si", 3250) !== 650 || ayudaPie("parte", 3250) !== null || ayudaPie(null, 3250) !== null) F("2 · la ayuda del pie no es el 20 % del depto solo cuando dijo que tiene el pie");
      const srv = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/const reemplaza = tope\.fuente !== "solo_pie";/.test(srv) || !/if \(reemplaza && tope\.topeUF > 0\) pbFila\.precio_max_uf = /.test(srv)) F("2 · el tope reemplaza el precio máximo también sin renta (o nunca)");
      if (!/precioMaxAnterior: anterior/.test(srv) || !/previo\?\.topeSupuestos\?\.precioMaxAnterior/.test(srv)) F("2 · el precio máximo anterior no se guarda (o se pisa en cada cambio)");
      if (!/const comunasAnterior = previo\s*\? \(\(previo\.topeSupuestos\?\.comunasAnterior[^;]*: \{ valor: \(pb\?\.comunas/.test(srv) || !/\.\.\.\(comunasAnterior \? \{ comunasAnterior \} : \{\}\)/.test(srv)) F("2 · las comunas de antes no se guardan la primera vez (o se pisan en cada cambio)");
      if (!/admin\.from\("perfil_busqueda"\)\.upsert\(pbFila, \{ onConflict: "user_id" \}\)/.test(srv) || !/comunas: pedido\.comunas, actualizado_at/.test(srv)) F("2 · las comunas no van al perfil de la selección semanal (no es un solo perfil)");
      // Nada se escribe antes de confirmar: el formulario solo llama a la ruta en «Ver mis opciones».
      const form = codigo("src/components/invierte-v2/PerfilForm.tsx");
      if ((form.match(/fetch\(/g) ?? []).length !== 1 || !/async function verOpciones[\s\S]{0,900}fetch\("\/api\/invierte-v2\/perfil"/.test(form)) F("2 · el perfil escribe algo antes de «Ver mis opciones»");
      if (!/<IndicadorPasosPerfil paso=\{1\} \/>/.test(form) || !/<IndicadorPasosPerfil paso=\{2\} \/>/.test(form)) F("2 · el perfil no lleva el indicador de pasos");
      if (PERFIL_COPY.paso1 !== "Paso 1 de 2 · Qué buscas" || PERFIL_COPY.paso2 !== "Paso 2 de 2 · Tu financiamiento") F("2 · el indicador no dice los pasos de la lámina");
    }

    // ── 3 · LAS OPCIONES, LAS ETIQUETAS Y EL CASO ──
    {
      const entrada = op("E", { esEntrada: true, precioUF: 3250, score: 78 });
      const a = op("A", { precioUF: 2980, flujoCLP: -21000, score: 77, metro: { estacion: "Ñuñoa", metros: 430 } });
      const b = op("B", { precioUF: 3090, flujoCLP: -38000, score: 81, vsParecidosPct: -7 });
      const c = op("C", { precioUF: 2640, flujoCLP: -44000, score: 76, comuna: "San Miguel" });
      const lejos = op("X", { precioUF: 5000, alcanza: false });
      const ops = elegirOpciones(entrada, [a, b, c, lejos], "arriendo", ["poner_plata"]);
      if (ops[0]?.avisoId !== "E" || ops.some((o) => o.avisoId === "X") || ops.length > MAX_OPCIONES) F("3 · las opciones no parten por la de entrada o traen una que no alcanza");
      if (ops[1]?.avisoId !== "A") F("3 · con «poner plata» la primera sumada no es la que menos pide al mes");
      const et = etiquetar(ops);
      if (et.get("E") !== "el_que_elegiste" || et.get("A") !== "menos_al_mes" || et.get("B") !== "mejor_precio" || et.get("C") !== "pie_mas_bajo") F(`3 · las etiquetas no son las de la regla (${JSON.stringify(Object.fromEntries(et))})`);
      // Una etiqueta dice algo cierto: «El mejor puntaje» no cae en otro si el mejor ya tiene otra etiqueta.
      const et2 = etiquetar([entrada, op("P", { score: 90, flujoCLP: 10000 }), op("Q", { score: 80, flujoCLP: -90000, precioUF: 3100 })]);
      if (et2.get("Q") !== "tambien_conviene") F(`3 · una etiqueta cae en uno que no es el mejor en eso (${et2.get("Q")})`);
      // Los tres casos.
      if (casoDe(ops) !== "alcanza") F("3 · el suyo le alcanza y no da el caso normal");
      if (casoDe([{ ...entrada, alcanza: false }, a]) !== "caso1") F("3 · el suyo no alcanza, otros sí, y no da el caso 1");
      if (casoDe([{ ...entrada, alcanza: false }]) !== "caso2") F("3 · no alcanza ninguno y no da el caso 2");
      // Por qué no alcanza: Y = 20 % del precio − su pie; la renta limita el crédito; con las dos, ambos datos.
      const tRenta = hastaCuanto({ preaprobado: "no", pieUF: 300, rentaCLP: 2500000, otrasCuotasCLP: 0, tasaPct: 4.1, uf: 39000 });
      const p1 = porQueNoAlcanza(3250, tRenta, 300);
      if (!p1 || p1.motivo !== "pie" || p1.faltaPieUF !== 350) F(`3 · falta de pie mal calculada (${JSON.stringify(p1)})`);
      const tCred = hastaCuanto({ preaprobado: "no", pieUF: 900, rentaCLP: 700000, otrasCuotasCLP: 0, tasaPct: 4.1, uf: 39000 });
      const p2 = porQueNoAlcanza(3250, tCred, 900);
      if (!p2 || p2.motivo !== "credito" || p2.faltaPieUF !== 0) F(`3 · con el pie de sobra no dice que limita la renta (${JSON.stringify(p2)})`);
      const tAmbas = hastaCuanto({ preaprobado: "no", pieUF: 300, rentaCLP: 700000, otrasCuotasCLP: 0, tasaPct: 4.1, uf: 39000 });
      const p3 = porQueNoAlcanza(3250, tAmbas, 300);
      if (!p3 || p3.motivo !== "pie_y_credito") F("3 · con las dos no dice las dos");
      if (porQueNoAlcanza(1400, tRenta, 300) !== null) F("3 · dice que no alcanza uno que sí");
      // Textos de la tabla.
      if (MIN_PARECIDOS !== 30 || vsParecidos(3000, 50, { precioM2UF: 70, n: 29 }) !== null || vsParecidos(3000, 50, { precioM2UF: 75, n: 40 }) !== -20) F("3 · precio contra parecidos se muestra con menos de 30 parecidos (o mal calculado)");
      if (textoMetro({ estacion: "Ñuñoa", metros: 437 }) !== "Estación Ñuñoa, a 450 m aprox." || /min/.test(textoMetro({ estacion: "X", metros: 1200 }))) F("3 · el metro no es «Estación X, a N m aprox.» (o inventa minutos)");
      // ⚠ ACTA (18-nov-2026, decisión de Fabrizio) · la fila se llama «Al mes (con pie 20 %)»: «Te sobran $X» o «Pones $Y» en
      // rojo (monto negativo), en la tabla y en la base; la etiqueta del mejor flujo dice «más te deja» si deja plata.
      const sobra = textoAlMes({ flujoCLP: 72058 }), pone = textoAlMes({ flujoCLP: -62000 });
      if (sobra.t !== "Te sobran $72.058" || sobra.pones || pone.t !== "Pones $62.000" || !pone.pones) F("3 · «Al mes» no dice «Te sobran $X» / «Pones $Y» (en rojo)");
      if (textoEtiqueta("menos_al_mes", { flujoCLP: 72058 }) !== "El que más te deja al mes" || textoEtiqueta("menos_al_mes", { flujoCLP: -62000 }) !== "El que menos te pide al mes" || textoEtiqueta("mejor_precio", { flujoCLP: 72058 }) !== "Mejor precio frente a sus parecidos") F("3 · la etiqueta del mejor flujo no cambia según deje plata o no");
      const res = codigo("src/components/invierte-v2/ResultadoOpciones.tsx");
      // ⚠ ACTA (19-nov-2026, láminas del 19-nov, entregas 2 y 3): la lista se reemplazó por las tarjetas cortas: cada alternativa dice UN indicador contra el
      // suyo (indicadorAlternativa), no la etiqueta. «Al mes» en rojo sigue en la tabla a pedido y en el elegido.
      if (!/const m = textoAlMes\(o\); return \{ t: m\.pones \? <span className="iv2-pones"/.test(res) || !/const m = textoAlMes\(entrada\); return m\.pones \? <span className="iv2-pones">/.test(res) || !/indicadorAlternativa\(o, entrada, grupo,/.test(res) || /ETIQUETAS\[/.test(res)) F("3 · la tabla o el elegido no usan «Al mes» en rojo, o la alternativa no dice su indicador");
      if (!/\.iv2-pones \{ color: var\(--signal-red/.test(leer("src/components/invierte-v2/invierte-v2.css"))) F("3 · «Pones» no va en rojo");
      const base = codigo("src/components/invierte-v2/VistaBase.tsx"); // ⚠ ACTA (19-nov-2026): lo que dibuja la base vive en VistaBase (la usan la página y /dev/invierte-v2/base)
      // ⚠ ACTA (19-nov-2026, base completa): los datos del depto vienen en `d.datos` (base-servidor › leerBase).
      if (!/const alMes = textoAlMes\(\{ flujoCLP: d\.datos\.flujoCLP \?\? null \}\);/.test(base) || !/\{RESULTADO_COPY\.filas\.pones\}: <span className=\{alMes\.pones \? "iv2-nowrap iv2-pones" : "iv2-nowrap"\}>\{alMes\.t\}/.test(base)) F("3 · la base no dice «Al mes» de cada depto");
      // «Estás cerca» solo si lo que falta es poco (el más barato, a lo más un 10 % sobre lo que puede comprar), igual con pie y renta.
      if (UMBRAL_CERCA_PCT !== 10 || !estaCerca(1000, 1100) || estaCerca(1000, 1101) || estaCerca(1000, null) || estaCerca(0, 900)) F("3 · el umbral de «Estás cerca» no es el 10 %");
      if (RESULTADO_COPY.caso2.tituloCredito(false) !== "Hoy tu renta limita el crédito" || RESULTADO_COPY.caso2.tituloCredito(true) !== "Estás cerca: tu renta limita el crédito" || RESULTADO_COPY.caso2.tituloPie("97", false) !== "Hoy te faltan UF 97 de pie" || RESULTADO_COPY.caso2.tituloPie("97", true) !== "Estás cerca: te faltan UF 97 de pie") F("3 · los títulos del caso 2 no son «Hoy…» / «Estás cerca: …»");
      if (!/const cerca = estaCerca\(p\.tope\.topeUF, z\);/.test(res) || !/R\.caso2\.tituloCredito\(cerca\)/.test(res) || !/R\.caso2\.tituloPie\(fmtUF\(pq\?\.faltaPieUF \?\? 0\), cerca\)/.test(res)) F("3 · el caso 2 no decide «Estás cerca» con el umbral");
      if (RESULTADO_COPY.filas.pones !== "Al mes (con pie 20 %)" || RESULTADO_COPY.filas.metro !== "Metro" || /según tu pie/i.test(RESULTADO_COPY.notaTablaPie + RESULTADO_COPY.notaTabla)) F("3 · la tabla no dice «con pie 20 %», la fila no se llama Metro, o la nota dice «según tu pie»");
      if (RESULTADO_COPY.compararAvisoPc(MAX_OPCIONES) !== "" || !/Desliza la tabla/.test(RESULTADO_COPY.compararAvisoPc(7))) F("3 · con más de cinco deptos el PC no dice que la tabla se desliza");
      // Abrir los detalles tarda ≈ 10 s: una capa dice que está cargando, en el resultado y en la base.
      if (!/\{abriendo && <CargandoDetalles \/>\}/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx")) || !/\{estado === "abriendo" && <CargandoDetalles \/>\}/.test(codigo("src/components/invierte-v2/BotonDetalles.tsx"))) F("3 · abrir los detalles no muestra que está cargando");
      // La lectura de Franco usa las mismas etiquetas (no nombra a otro como «el que menos te pide al mes»).
      const lec = lecturaDeFranco(ops, "arriendo", ["poner_plata"], Object.fromEntries(et));
      if (!lec.destacado || !/^el de Ñuñoa de 60 m² es el que mejor calza$/.test(lec.destacado) && !/^el de Ñuñoa/.test(lec.destacado) || !/^Buscas arriendo mes a mes y te preocupa poner plata cada mes\. Con eso,$/.test(lec.intro)) F(`3 · la lectura no parte por lo que respondió (${JSON.stringify(lec)})`);
      const lecSinA = lecturaDeFranco(ops, "arriendo", ["poner_plata"], { E: "el_que_elegiste", B: "menos_al_mes" });
      if (!/^el de Ñuñoa/.test(lecSinA.destacado ?? "") || !/menos te pide al mes/.test(lecSinA.resto)) F("3 · la lectura no sigue a la etiqueta «menos al mes»");
      const conSobra = ops.map((o) => (o.avisoId === "B" ? { ...o, flujoCLP: 40000 } : o));
      const lecSobra = lecturaDeFranco(conSobra, "arriendo", ["poner_plata"], { E: "el_que_elegiste", B: "menos_al_mes" });
      if (!/más te deja al mes/.test(lecSobra.resto) || /menos te pide/.test(lecSobra.resto)) F("3 · la lectura dice «menos te pide» de uno que deja plata");
      if (/[ÁÉÍÓÚA-Z]/.test((lec.destacado ?? "").charAt(0))) F("3 · la lectura arranca con mayúscula después de «Con eso,»");
      const sinIA = codigo("src/lib/invierte-v2/opciones.ts") + codigo("src/components/invierte-v2/ResultadoOpciones.tsx");
      if (/anthropic|claude|messages\.create/i.test(sinIA)) F("3 · la lectura de Franco usa IA");
    }

    // ── 4 · LA ELECCIÓN: como mucho seis, solo opciones que le alcanzan ──
    {
      if (MAX_ACTIVOS !== 6) F("4 · el máximo de deptos activos no es 6");
      const srv = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/if \(ids\.length > max\) return \{ ok: false, error: "maximo" \};/.test(srv) || !/some\(\(f\) => !f\.alcanza\)\) return \{ ok: false, error: "fuera" \};/.test(srv)) F("4 · la elección acepta más de seis o una que no alcanza");
      if (!/elegir\(createServiceClient\(\), \{ id: user\.id, email: user\.email \?\? null \}, ids, MAX_ACTIVOS,/.test(codigo("src/app/api/invierte-v2/eleccion/route.ts"))) F("4 · la ruta no pasa el máximo");
      if (!/if \(n\.size < MAX_ACTIVOS\) n\.add\(id\)/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx"))) F("4 · la pantalla deja marcar más de seis");
      // Lo que deja de alcanzar se marca, no se borra; lo presentado queda en la bitácora con la orden.
      if (/from\(T_DEPTOS\)\.delete/.test(srv) || !/alcanza: o\.alcanza, fuera_de_alcance_at: o\.alcanza \? null : ahora/.test(srv)) F("4 · lo que deja de alcanzar se borra en vez de marcarse");
      // ⚠ ACTA (18-nov-2026, pregunta de Fabrizio por el sexto depto) · lo elegido que salió del top de Franco sigue en la tabla
      // (al final, marcado) y no se marca fuera de alcance por no aparecer: solo por precio.
      // ⚠ ACTA (19-nov-2026, láminas del 19-nov, entregas 2 y 3): el resultado muestra el de entrada y las recomendaciones de Franco (como mucho tres, contando las
      // que ya eligió); lo sumado desde el mapa no aparece y la elección no lo suelta (solo suelta las del resultado).
      if (!/const elegidasFranco = filasPrev\.filter\(\(x\) => x\.f\.estado === "elegido"\);/.test(srv) || !/\.in\("origen", \["entrada", "franco"\]\)\.not\("aviso_id", "in"/.test(srv)) F("4 · las recomendaciones que ya eligió desaparecen del resultado, o la elección suelta lo sumado desde el mapa");
      if (/!opciones\.some\(\(o\) => o\.avisoId === p\.aviso_id\) && p\.alcanza/.test(srv)) F("4 · salir del top de Franco se marca como fuera de alcance");
      if (!/accion: "depto_presentado"/.test(srv) || !/ordenId: orden\.id, actor: "sistema", accion: "depto_presentado"/.test(srv)) F("4 · lo que Franco le presentó no queda con la orden en la bitácora");
      if (!/tipo: "avisar_alcance"/.test(srv)) F("4 · «Avísenme» no crea la tarea avisar_alcance");
    }

    // ── 5 · /invierte decide con el perfil y la elección ──
    {
      const c = (x: Partial<Parameters<typeof destinoInvierte>[0]>) => { const d = destinoInvierte({ sesion: true, acceso: true, firmo: true, contacto: null, ...x }); return "url" in d ? d.url : d.tipo; };
      if (c({}) !== URL_PARTIMOS || c({ perfil: true }) !== URL_OPCIONES || c({ perfil: true, eligio: true }) !== URL_BASE) F("5 · /invierte no manda firmó→Partimos, perfil→resultado, eligió→base");
      // Sin sesión, a la entrada vigente con la vuelta a /invierte; ningún archivo del flujo enlaza a /login ni a /register.
      if (c({ sesion: false }) !== "/entrar?next=%2Finvierte" || c({ sesion: false, acceso: false }) !== "/entrar?next=%2Finvierte") F("5 · /invierte sin sesión no manda a /entrar con la vuelta");
      for (const f of ["src/lib/invierte-v2/destino.ts", "src/app/invierte/[avisoId]/firma/page.tsx", "src/app/invierte/page.tsx", "src/components/invierte-v2/PerfilForm.tsx", "src/components/invierte-v2/ResultadoOpciones.tsx", "src/app/invierte/base/page.tsx", "src/components/invierte-v2/VistaBase.tsx", "src/app/invierte/documentos/page.tsx", "src/app/invierte/[avisoId]/sumar/page.tsx", "src/components/invierte-v2/MenuBase.tsx"]) {
        if (/["'`]\/(login|register)\b/.test(codigo(f))) F(`5 · ${f} enlaza a /login o /register`);
      }
      if (c({ sesion: false }) === URL_BASE || c({ acceso: false, perfil: true, eligio: true }) !== "no-existe") F("5 · /invierte salta la sesión o el acceso");
      for (const r of ["src/app/api/invierte-v2/perfil/route.ts", "src/app/api/invierte-v2/eleccion/route.ts", "src/app/api/invierte-v2/avisar/route.ts", "src/app/api/invierte-v2/sumar/route.ts"]) {
        if (!/const user = await personaConAcceso\(\);\s*if \(!user\) return NO_EXISTE\(\);/.test(codigo(r))) F(`5 · ${r} responde sin acceso`);
      }
      // Con la espera (loading.tsx) la página ya respondió 200 cuando corre su notFound(): el 404 lo da el layout, que va arriba.
      if (!/if \(!user \|\| !acceso\) notFound\(\);/.test(codigo("src/app/invierte/opciones/layout.tsx"))) F("5 · /invierte/opciones responde 200 sin acceso (el layout no decide el acceso arriba de la espera)");
      for (const p of ["src/app/invierte/perfil/page.tsx", "src/app/invierte/opciones/page.tsx", "src/app/invierte/base/page.tsx", "src/app/invierte/documentos/page.tsx", "src/app/invierte/perfil/actualizado/page.tsx"]) {
        if (!/if \(!user \|\| !acceso\) notFound\(\);/.test(codigo(p)) || !/force-dynamic/.test(codigo(p))) F(`5 · ${p} no da 404 sin acceso`);
      }
    }

    // ── 6 · VER DETALLES SIN GASTAR CRÉDITOS, Y SU CATEGORÍA PROPIA ──
    {
      const det = codigo("src/lib/invierte-v2/detalles.ts");
      if (!/if \(!\(await accesoInvierteV2\(user\)\)\) return false;/.test(det) || !/return !!orden && !!depto;/.test(det) || !/deptoDelFlujo\(admin, avisoId\)/.test(det)) F("6 · ver gratis no exige acceso, orden firmada y depto usado");
      const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
      if (!/const gratisInvierte = desdeExplorar \? await verGratisInvierte\(admin, user, b\.avisoId\) : false;/.test(ruta)) F("6 · los detalles gratis no se deciden en la ruta del mapa");
      if (!/if \(gratisInvierte\) return \{ ok: true, mode: MODO_INVIERTE, devolucion: \{ tipo: "nada" \} \};\s*const c = await ensureCreditCharged/.test(ruta)) F("6 · quien firmó gasta un crédito al ver los detalles");
      if (!/const ae = gratisInvierte \? null : await emitirEventoMeta\(/.test(ruta)) F("6 · los detalles del flujo mandan un evento a Meta");
      if (!/if \(mode === MODO_INVIERTE\) waitUntil\(capturarServidor\(\{ event: EVENTO_DETALLE_ABIERTO/.test(ruta) || !/via: desde, cobro: mode, precioNegociado \}\)\)/.test(ruta)) F("6 · los detalles abiertos no quedan medidos por persona (evento inv2_ y el cobro en analisis_creado)");
      if (!codigo("src/lib/invierte-v2/detalles.ts").includes('"inv2_detalle_abierto"')) F("6 · el evento no lleva el prefijo inv2_");
      if (!/\.or\("charge_mode\.is\.null,charge_mode\.neq\.invierte"\)/.test(codigo("src/app/admin/operacion/page.tsx")) || !/\.eq\("charge_mode", "invierte"\)/.test(codigo("src/app/admin/operacion/page.tsx"))) F("6 · el panel de operación cuenta los detalles como Pro o no los muestra aparte");
      const embudo = codigo("src/lib/admin-funnel-data.ts");
      if (!/\.eq\("charge_mode", "invierte"\)/.test(embudo) || /in\("charge_mode", \[[^\]]*invierte/.test(embudo) || !/detallesInvierte,/.test(embudo)) F("6 · el embudo no tiene la categoría propia (o la cuenta como gratis)");
      if (!/\.\.\.\(p\.cobro \? \{ cobro: p\.cobro \} : \{\}\)/.test(codigo("src/lib/medicion-activacion.ts"))) F("6 · PostHog no distingue el cobro de los análisis");
      const mig = leer("supabase/migrations/20261119_invierte_v2_etapa2.sql");
      if (!/'anon_cap','invierte'\)\)/.test(mig) || !/'gestionar_corredor','avisar_alcance'\)/.test(mig)) F("6 · el archivo de la migración no es igual a lo aplicado (invierte / avisar_alcance)");
      // Los «Ver detalles» del flujo van por la ruta del mapa con pie 20 % y 30 años (la que decide el modo invierte).
      // ⚠ ACTA (18-nov-2026, entrega 2) · ahora por detalles-cliente.ts, en modo Invierte (`invierte: true`): abre directo lo ya
      // preparado y lee por el carril. Los dos botones llaman a `abrirDetalles`; el cuerpo es el de la ruta del mapa.
      const dc = codigo("src/lib/invierte-v2/detalles-cliente.ts");
      if (!/export const URL_DETALLES = "\/api\/lo-que-sigue\/guia\/analizar";/.test(dc) || JSON.stringify(JSON.parse(cuerpoDetalles("a", "abrir"))) !== JSON.stringify({ avisoId: "a", explorar: true, piePct: 20, plazoAnios: 30, invierte: true, origenInvierte: "abrir" })) F("6 · los detalles del flujo no van por la ruta del mapa con pie 20 %, 30 años y el modo Invierte");
      for (const f of ["src/components/invierte-v2/ResultadoOpciones.tsx", "src/components/invierte-v2/BotonDetalles.tsx"]) {
        if (!/const id = await abrirDetalles\((o\.)?avisoId\);/.test(codigo(f)) || /fetch\("\/api\/lo-que-sigue\/guia\/analizar"/.test(codigo(f))) F(`6 · ${f} no abre los detalles por detalles-cliente (modo Invierte)`);
      }
    }

    // ── 8 · ENTREGA 2: EL CARRIL, ABRIR DIRECTO, PREPARAR AL ELEGIR, LOS CAMBIOS Y SU CORREO ──
    {
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): el carril lee también al firmar y al mostrarse el resultado, con su mismo tope, memoria y fusible;
      // la bitácora los anota con su origen («firma», «resultado»; SQL 20261125_lecturas_invierte_origenes para Claude).
      if (!/await chequearPublicacionInvierte\(admin, \{ avisoId, userId: user\.id, origen: "firma" \}\)/.test(codigo("src/app/api/invierte-v2/firma/route.ts")) || !/chequearPublicacionInvierte\(admin, \{ avisoId, userId: user\.id, origen: "resultado", forzar: true \}\)/.test(codigo("src/app/api/invierte-v2/lectura/route.ts"))) F("8 · el carril no lee al firmar o al mostrarse el resultado (o lo hace con otro origen)");
      if (!/'firma', 'resultado'/.test(leer("supabase/migrations/20261125_lecturas_invierte_origenes.sql"))) F("8 · el SQL de los orígenes nuevos del carril no está");
      // El resguardo que anotaba como 'abrir' mientras faltaba ese SQL se retiró (20-nov-2026: aplicado por Claude y verificado).
      // El carril: 60 pedidos por hora, memoria de 24 horas, fusible; lee también lo que la memoria da por despublicado.
      if (TOPE_CARRIL_POR_HORA !== 60 || RELECTURA_MS !== 24 * 3600 * 1000) F("8 · el carril no es de 60 pedidos por hora con relectura cada 24 horas");
      const ahora = new Date("2026-11-20T12:00:00Z");
      const hace = (h: number) => new Date(ahora.getTime() - h * 3600 * 1000);
      if (!leidaFresca(hace(23), ahora) || leidaFresca(hace(25), ahora) || leidaFresca(null, ahora)) F("8 · la memoria del carril no es de 24 horas");
      const dobles = (o: { estado?: "publicado" | "despublicado" | null; leidaAt?: Date | null; fusible?: boolean; lectura?: Awaited<ReturnType<DepsCarril["leer"]>> }) => {
        const r = { leidas: 0, fusibles: [] as string[] };
        const d: DepsCarril = {
          memoria: async () => ({ estado: o.estado ?? null, leidaAt: o.leidaAt ?? null }),
          fusible: async () => !!o.fusible,
          saltarFusible: async (m) => { r.fusibles.push(m); },
          leer: async () => { r.leidas++; return o.lectura ?? { leida: true, motivo: "publicado", codigo: 200, anio: null, gets: 2 }; },
        };
        return { d, r };
      };
      const a = dobles({ estado: "publicado", leidaAt: hace(2) });
      if ((await chequearPorCarril(a.d, ahora)).sinLeer !== "fresca" || a.r.leidas) F("8 · el carril lee un depto leído hace menos de 24 horas");
      const b = dobles({ estado: "despublicado", leidaAt: hace(30) });
      const rb = await chequearPorCarril(b.d, ahora);
      if (b.r.leidas !== 1 || rb.estado !== "publicado") F("8 · el carril no relee un despublicado (no sabría si volvió a publicarse)");
      const c = dobles({ fusible: true });
      if ((await chequearPorCarril(c.d, ahora)).sinLeer !== "fusible" || c.r.leidas) F("8 · el carril lee con el fusible puesto");
      const bl = dobles({ lectura: { leida: true, motivo: "bloqueo", codigo: 403, anio: null, gets: 1 } });
      await chequearPorCarril(bl.d, ahora);
      if (bl.r.fusibles[0] !== "bloqueo") F("8 · un bloqueo no salta el fusible del carril");
      const ra = dobles({ estado: "publicado", lectura: { leida: true, motivo: "publicado", codigo: 200, anio: null, gets: 2, rara: true } });
      const rra = await chequearPorCarril(ra.d, ahora);
      if (ra.r.fusibles[0] !== "rara" || rra.lectura?.leida !== true) F("8 · una respuesta rara no salta el fusible del carril");
      // El carril cuenta y anota en SU bitácora, nunca en la de las personas.
      const cs = codigo("src/lib/invierte-v2/carril-servidor.ts");
      if (!/from\("lecturas_invierte"\)\.select\("id", \{ count: "exact", head: true \}\)/.test(cs) || !/from\("lecturas_invierte"\)\.insert\(/.test(cs) || /lecturas_ficha/.test(cs)) F("8 · el carril cuenta o anota en la bitácora de las personas");
      if (!/return error \|\| count == null \? Number\.POSITIVE_INFINITY : count;/.test(cs) || !/leerFicha\(ficha, "clic", almacen, bajarFicha, new Date\(\), \{ tope: TOPE_CARRIL_POR_HORA(?:, puerta: "invierte")? \}\)/.test(cs)) F("8 · el carril no usa su tope (o sin conteo no se da por lleno)");
      // La ruta, en modo Invierte: lo preparado se abre ANTES de leer nada o de prepararlo; lo demás lee por el carril.
      const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
      const iYa = ruta.indexOf("const ya = await detallesPreparados(admin, user.id, b.avisoId);"), iMeta = ruta.indexOf("const ae = gratisInvierte ? null : await emitirEventoMeta("), iChq = ruta.indexOf("async chequear() {");
      if (!/const modoInvierte = gratisInvierte && b\.invierte === true;/.test(ruta) || iYa < 0 || iYa > iMeta || iYa > iChq || !/if \(ya\) return salir\(NextResponse\.json\(\{ id: ya, estado: "ya-creado"/.test(ruta)) F("8 · abrir lo ya preparado no es directo (lee o prepara antes)");
      if (!/async chequear\(\) \{\s*if \(modoInvierte\) \{\s*const c = await chequearPublicacionInvierte\(admin, \{ avisoId: b\.avisoId!, userId: user\.id, origen: b\.origenInvierte === "elegir" \? "elegir" : "abrir" \}\);/.test(ruta)) F("8 · el modo Invierte lee la ficha por el tope de las personas");
      // Preparar al elegir, y al entrar a la base lo que falte.
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): al elegir, además, se olvida el menú y se refresca el caché de navegación (§11d).
      if (!/if \(res\.ok\) \{ prepararEnSegundoPlano\(Array\.from\(marcados\)\); olvidarMenu\(\); router\.push\(URL_BASE\); router\.refresh\(\); return; \}/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx"))) F("8 · los detalles no se preparan al elegir");
      if (!/keepalive: true/.test(codigo("src/lib/invierte-v2/detalles-cliente.ts")) || !/cuerpoDetalles\(id, "elegir"\)/.test(codigo("src/lib/invierte-v2/detalles-cliente.ts"))) F("8 · la preparación no sigue si cambia la pantalla o no lee como «elegir»");
      const base = codigo("src/components/invierte-v2/VistaBase.tsx"); // ⚠ ACTA (19-nov-2026): lo que dibuja la base vive en VistaBase (la usan la página y /dev/invierte-v2/base)
      // ⚠ ACTA (19-nov-2026, base completa): qué está preparado lo lee base-servidor › leerBase (guia_analisis con informe) y la
      // página prepara los que no.
      if (!/<PrepararDetalles avisoIds=\{sinPreparar\} \/>/.test(base) || !/const sinPreparar = base\.elegidos\.filter\(\(d\) => !d\.preparado\)/.test(base) || !/\.from\("guia_analisis"\)[^\n]*\.not\("analysis_id", "is", null\)/.test(codigo("src/lib/invierte-v2/base-servidor.ts"))) F("8 · la base no prepara lo que quedó sin preparar");
      // Los cambios: los umbrales aprobados.
      const v: Vigente = { precioUF: 3000, publicado: true, veredicto: "COMPRAR", flujoCLP: 20000, alcanza: true, publicadorId: 7 };
      const h = (o: Partial<Parameters<typeof detectarCambios>[1]>) => ({ precioUF: 3000, publicado: true, veredicto: "COMPRAR", flujoCLP: 20000, alcanza: true, publicadorId: 7, ...o });
      if (UMBRAL_LINEA_PCT !== 0.5 || UMBRAL_CORREO_PCT !== 2) F("8 · los umbrales no son 0,5 % (línea) y 2 % (correo)");
      if (detectarCambios(v, h({ precioUF: 2990 })).length) F("8 · un cambio de 0,33 % sale en la base");
      const c1 = detectarCambios(v, h({ precioUF: 2970 }));
      if (c1.length !== 1 || c1[0].tipo !== "precio_baja" || !c1[0].enBase || c1[0].relevante) F("8 · un cambio de 1 % no va en la base sin correo");
      const c2 = detectarCambios(v, h({ precioUF: 2850, flujoCLP: 52000, veredicto: "COMPRAR" }));
      if (!c2.find((c) => c.tipo === "precio_baja" && c.relevante) || !c2.find((c) => c.tipo === "al_mes" && c.relevante)) F("8 · bajar 5 % y dejar $32.000 más al mes no va al correo");
      const c3 = detectarCambios(v, h({ precioUF: 3030, alcanza: false }));
      if (!c3.find((c) => c.tipo === "precio_sube" && c.relevante)) F("8 · subir y dejar de alcanzar no va al correo");
      if (detectarCambios(v, h({ veredicto: "BUSCAR OTRA", flujoCLP: -40000 })).length) F("8 · un veredicto o un al mes que cambian sin cambio de la publicación se le avisan");
      const c4 = detectarCambios(v, h({ publicado: false }));
      if (c4.length !== 1 || c4[0].tipo !== "despublicado" || !c4[0].relevante) F("8 · dejar de estar publicado no va al correo");
      const c5 = detectarCambios({ ...v, publicado: false }, h({ publicado: true }));
      if (!c5.find((c) => c.tipo === "republicado" && c.relevante)) F("8 · volver a publicarse no va al correo");
      const c6 = detectarCambios(v, h({ publicadorId: 9 }));
      if (c6.length !== 1 || c6[0].tipo !== "publicador" || c6[0].enBase || c6[0].relevante) F("8 · quién publica se le avisa a la persona (debe ser solo tarea)");
      // Los textos aprobados.
      if (lineaCambio({ tipo: "precio_baja", antes: { precioUF: 3000 }, despues: { precioUF: 2850 } }, "2026-11-20") !== "Bajó UF 150 el 20 de noviembre") F("8 · la línea del precio no es «Bajó UF 150 el 20 de noviembre»");
      if (lineaCambio({ tipo: "despublicado", antes: {}, despues: {} }, "2026-11-20") !== "Dejó de estar publicado el 20 de noviembre" || lineaCambio({ tipo: "republicado", antes: {}, despues: {} }, "2026-11-20") !== "Volvió a publicarse el 20 de noviembre") F("8 · las líneas de publicación no son las aprobadas");
      if (lineaCambio({ tipo: "al_mes", antes: {}, despues: { flujoCLP: -20000 } }, "2026-11-20") !== "Con el precio nuevo, pones $20.000 al mes") F("8 · la línea de al mes no es la aprobada");
      if (/AJUSTA SUPUESTOS|BUSCAR OTRA/.test(textoVeredicto("COMPRAR", "AJUSTA SUPUESTOS") + textoVeredicto("AJUSTA SUPUESTOS", "BUSCAR OTRA")) || !/ya no conviene al precio publicado/.test(textoVeredicto("COMPRAR", "AJUSTA SUPUESTOS")) || !/ahora conviene al precio publicado/.test(textoVeredicto("BUSCAR OTRA", "COMPRAR"))) F("8 · el cambio de veredicto usa nombres internos o no dice qué significa");
      // ⚠ ACTA (19-nov-2026, Fabrizio): el nombre de cada veredicto sale de la MISMA fuente que el mapa y el informe
      // (`etiquetaVeredicto`, forma «frase»), nunca escrito a mano. Se compara contra la fuente, no contra un literal.
      for (const [a, b] of [["AJUSTA SUPUESTOS", "COMPRAR"], ["BUSCAR OTRA", "COMPRAR"], ["COMPRAR", "AJUSTA SUPUESTOS"], ["BUSCAR OTRA", "AJUSTA SUPUESTOS"], ["COMPRAR", "BUSCAR OTRA"], ["AJUSTA SUPUESTOS", "BUSCAR OTRA"]] as const) {
        if (!textoVeredicto(a, b).includes(`es ${etiquetaVeredicto(b, "frase")}`)) F(`8 · el cambio ${a} → ${b} no nombra el veredicto con la fuente del mapa y el informe`);
      }
      for (const f of ["src/lib/invierte-v2/opciones.ts", "src/lib/invierte-v2/cambios.ts", "src/lib/invierte-v2/vigilancia-servidor.ts", "src/lib/email/correos.ts"]) {
        const c = codigo(f);
        const zona = f.endsWith("correos.ts") ? (c.match(/export function correoCambiosInvierte[\s\S]*?\n\}/)?.[0] ?? "") : c;
        if (f.endsWith("correos.ts") && !zona) F("8 · no encuentro correoCambiosInvierte");
        if (/["'`][^"'`\n]*\b(Comprar|Ajustar|Buscar otr[ao])\b/.test(zona)) F(`8 · ${f} escribe a mano el nombre de un veredicto (va con etiquetaVeredicto)`);
      }
      const dep = { avisoId: "x", comuna: "Ñuñoa", descripcion: "2D2B · 58 m²", cambios: [{ tipo: "precio_baja" as const, antes: { precioUF: 3000, alcanza: true }, despues: { precioUF: 2850, alcanza: true }, fecha: "2026-11-20" }, { tipo: "al_mes" as const, antes: { flujoCLP: 20000 }, despues: { flujoCLP: 52000 }, fecha: "2026-11-20" }] };
      if (asuntoCambios([dep]) !== "El depto de Ñuñoa bajó UF 150" || asuntoCambios([dep, dep]) !== "Cambiaron 2 deptos que elegiste") F("8 · el asunto del correo no es el aprobado");
      if (parrafoDepto(dep) !== "El depto de Ñuñoa (2D2B · 58 m²) que elegiste bajó UF 150 el 20 de noviembre: ahora está en UF 2.850. Con ese precio, te sobran $52.000 al mes.") F(`8 · el cuerpo del correo no es el aprobado (${parrafoDepto(dep)})`);
      // ⚠ ACTA (19-nov-2026, Fabrizio): precio y veredicto a la vez van en UNA frase («…y conviene al precio publicado (Comprar).»),
      // antes de lo que deja al mes; las otras combinaciones con la misma forma y el nombre de la fuente.
      const conV = (va: string, vb: string, fl: number) => parrafoDepto({ avisoId: "x", comuna: "Ñuñoa", descripcion: "2D2B · 58 m²", cambios: [
        { tipo: "precio_baja" as const, antes: { precioUF: 3000, alcanza: true }, despues: { precioUF: 2850, alcanza: true }, fecha: "2026-11-20" },
        { tipo: "veredicto" as const, antes: { veredicto: va }, despues: { veredicto: vb }, fecha: "2026-11-20" },
        { tipo: "al_mes" as const, antes: { flujoCLP: 0 }, despues: { flujoCLP: fl }, fecha: "2026-11-20" }] });
      const pv = `El depto de Ñuñoa (2D2B · 58 m²) que elegiste bajó UF 150 el 20 de noviembre: ahora está en UF 2.850`;
      const casosV: [string, string, number, string][] = [
        ["AJUSTA SUPUESTOS", "COMPRAR", 52000, `${pv} y conviene al precio publicado (${etiquetaVeredicto("COMPRAR", "frase")}). Con ese precio, te sobran $52.000 al mes.`],
        ["COMPRAR", "AJUSTA SUPUESTOS", -20000, `${pv} y ya no conviene al precio publicado: conviene si negocias el precio (${etiquetaVeredicto("AJUSTA SUPUESTOS", "frase")}). Con ese precio, pones $20.000 al mes.`],
        ["BUSCAR OTRA", "AJUSTA SUPUESTOS", -20000, `${pv} y conviene si negocias el precio (${etiquetaVeredicto("AJUSTA SUPUESTOS", "frase")}). Con ese precio, pones $20.000 al mes.`],
        ["COMPRAR", "BUSCAR OTRA", -90000, `${pv} y ya no conviene (${etiquetaVeredicto("BUSCAR OTRA", "frase")}). Con ese precio, pones $90.000 al mes.`],
        ["AJUSTA SUPUESTOS", "BUSCAR OTRA", -90000, `${pv} y ya no conviene ni negociando (${etiquetaVeredicto("BUSCAR OTRA", "frase")}). Con ese precio, pones $90.000 al mes.`],
      ];
      for (const [va, vb, fl, esp] of casosV) if (conV(va, vb, fl) !== esp) F(`8 · el correo con precio y veredicto a la vez no es el aprobado (${va} → ${vb}): «${conV(va, vb, fl)}»`);
      // El correo: uno por persona al día, solo a la lista mientras el modo no sea «todos», con botón a /invierte.
      const vig = codigo("src/lib/invierte-v2/vigilancia-servidor.ts");
      if (!/if \(yaHoy\.has\(userId\)\) continue;/.test(vig) || !/idempotencyKey: `invierte-cambio-\$\{p\.userId\}-\$\{p\.dia\}`/.test(codigo("src/lib/email.ts"))) F("8 · puede salir más de un correo de cambios por persona al día");
      if (!/if \(!orden\?\.email \|\| !puedeRecibirCopia\(modo, lista, orden\.email\)\) \{ fuera\+\+; continue; \}/.test(vig)) F("8 · el correo de cambios sale fuera de la lista");
      if (!/boton: \{ texto: BOTON_CAMBIOS, url: `\$\{sitio\}\$\{URL_INVIERTE\}` \}/.test(codigo("src/lib/email/correos.ts"))) F("8 · el correo de cambios no lleva a /invierte");
      if (!/if \(r\.sinLeer === "tope" \|\| r\.sinLeer === "fusible"\) break;/.test(vig) || !/if \(leidaFresca\(at, ahora\)\) continue;/.test(vig)) F("8 · la noche relee sin respetar el tope, el fusible o las 24 horas");
      if (!/ahora\.getUTCHours\(\) === HORA_CORREOS_UTC \? await correosDeCambios/.test(codigo("src/app/api/cron/invierte-vigilar/route.ts"))) F("8 · el correo sale en cada corrida de la mañana");
      // La migración: la tabla original y su disparador quedan intactos.
      const m2 = leer("supabase/migrations/20261120_invierte_v2_entrega2.sql").replace(/--.*$/gm, "");
      if (/(alter|drop|truncate)\s+table\s+(if exists\s+)?public\.scraped_properties_precios|delete\s+from\s+public\.scraped_properties_precios|update\s+public\.scraped_properties_precios|(drop|create( or replace)?)\s+trigger|registrar_precio_aviso/i.test(m2)) F("8 · la migración toca scraped_properties_precios o su disparador");
      // En los DOS lugares: el relleno inicial y la función de cada noche.
      if ((m2.match(/abs\((s\.)?puf \/ (s\.)?prev - 1\) >= 0\.001/g) ?? []).length !== 2 || (m2.match(/case when h\.moneda = 'UF' then h\.precio else h\.precio \/ u\.valor end/g) ?? []).length !== 2) F("8 · el historial no compara en UF con el umbral de 0,1 % (en el relleno y en la noche)");
    }

    // ── 9 · LA BASE COMPLETA (entrega 2, 19-nov-2026; láminas 3.3-base, -base-pc, -menu, -documentos, -perfil-editado y
    //        -sumar-otro-depto). Las reglas puras con datos, sumar con un fixture, y el cableado de cada pantalla. ──
    {
      // Los textos de la lámina, tal como están escritos.
      const esperado: [string, string][] = [
        [BASE_COPY.titulo, "Tu inversión con Franco"], [BASE_COPY.tusDeptos, "Tus deptos"], [BASE_COPY.tusDeptosLinea(2), "Los dos con que elegiste seguir. Cada uno avanza por su cuenta."],
        [BASE_COPY.otras(2), "Otras opciones que convienen · 2"], [BASE_COPY.seguirConEste, "Seguir con este"], [BASE_COPY.compararTodas, "Comparar todas"],
        [BASE_COPY.buscarEnMapa, "Buscar otro en el mapa"], [BASE_COPY.acompana, "Franco te acompaña en todo el proceso"], [BASE_COPY.escribirle, "Escribirle"],
        [BASE_COPY.francoEnEso, "Franco está en eso"], [MENU_COPY.perfil, "Mi perfil de inversión"], [MENU_COPY.documentos, "Mis documentos"],
        [MENU_COPY.documentosLinea, "Tu orden firmada y lo de cada depto"], [MENU_COPY.preguntas, "Preguntas frecuentes"], [MENU_COPY.preguntasLinea, "Qué firmé, cuánto cobra Franco"],
        [MENU_COPY.escribirle, "Escribirle a Franco"], [MENU_COPY.escribirleLinea, "Tu contacto durante todo el proceso"], [MENU_COPY.perfilLinea(4200, ["Ñuñoa", "Macul"]), "Hasta UF 4.200 · Ñuñoa y Macul"],
        [DOCUMENTOS_COPY.orden, "Orden de visita y acompañamiento"], [DOCUMENTOS_COPY.ordenLinea("15 de noviembre"), "Firmada el 15 de noviembre. Cubre todos tus deptos."],
        [DOCUMENTOS_COPY.preaprobacionLinea, "La necesitas para ofertar o visitar. Foto o PDF de tu banco."], [DOCUMENTOS_COPY.detallesLinea, "Los que elegiste, cada uno con todos sus detalles."],
        [DOCUMENTOS_COPY.promesaLinea, "Se firman en notaría; aquí queda la copia."], [SUMAR_COPY.titulo, "Súmalo a tus opciones de inversión"], [SUMAR_COPY.botonMapa, "Sumar a mis opciones de inversión"], [SUMAR_COPY.noAlcanzaTitulo, "Este depto hoy no te alcanza"], [SUMAR_COPY.irAMiInversion, "Ir a mi inversión"], [SUMAR_COPY.sinFirmaT, "No tienes que firmar de nuevo"],
        [SUMAR_COPY.sinFirma("15 de noviembre"), "Tu orden del 15 de noviembre cubre también este depto. Franco empieza a gestionarlo y puedes ver todos sus detalles desde tus deptos."],
        [`${SUMAR_COPY.teAlcanza} ${SUMAR_COPY.conQue("renta")}`, "Te alcanza con tu pie y tu renta."], [`${SUMAR_COPY.entra} ${SUMAR_COPY.entraLinea(4)}`, "Entra a tu comparativo junto a las cuatro opciones que ya tienes."],
        [SUMAR_COPY.boton, "Sumar a mis opciones de inversión"], [ACTUALIZADO_COPY.titulo, "Perfil actualizado"], [ACTUALIZADO_COPY.masDeptos(2), "Ahora te alcanzan 2 deptos más"],
        [ACTUALIZADO_COPY.hasta(4200), "Estimamos que puedes comprar hasta UF 4.200. Sujeto a evaluación del banco."], [ACTUALIZADO_COPY.cambiaron, "Tus opciones cambiaron"],
        [`${ACTUALIZADO_COPY.siguen(4)} ${ACTUALIZADO_COPY.nadaSale}`, "Las 4 que ya tenías siguen ahí. Nada sale por haber cambiado tu perfil."], [ACTUALIZADO_COPY.boton, "Ver mis opciones"],
      ];
      for (const [v, e] of esperado) if (v !== e) F(`9 · el texto no es el de la lámina: «${v}» (debía ser «${e}»)`);
      if (lineaDepto({ comuna: "Macul", dormitorios: 2, banos: 2, m2: 60.4 }) !== "Macul · 2D2B · 60 m²") F("9 · la línea del depto no es «Macul · 2D2B · 60 m²»");
      if (numeroWhatsapp("+56 9 1234 5678") !== "+56912345678" || numeroWhatsapp("912345678") !== "+56912345678" || numeroWhatsapp("+5622345678") !== null || numeroWhatsapp("") !== null) F("9 · el número de «Escribirle» no se valida como +569 y ocho dígitos");
      if (/text=[^"]*(Camila|@)/.test(urlWhatsapp("+56912345678"))) F("9 · el mensaje de «Escribirle» lleva datos de la persona");
      const pc = (o: Partial<PerfilComparable>): PerfilComparable => ({ pieUF: 700, rentaCLP: 2000000, otrasCuotasCLP: 0, comunas: ["Ñuñoa"], topeUF: 3000, montoPreaprobadoUF: null, ...o });
      if (fraseCambioPerfil(pc({}), pc({ pieUF: 900 })) !== "Subiste tu pie de UF 700 a UF 900.") F("9 · el cambio del pie no dice «Subiste tu pie de UF 700 a UF 900.»");
      if (fraseCambioPerfil(pc({}), pc({ rentaCLP: 1800000 })) !== "Bajaste tu renta de $2.000.000 a $1.800.000.") F("9 · el cambio de la renta no se dice");
      if (fraseCambioPerfil(pc({}), pc({ comunas: ["Ñuñoa", "Macul"] })) !== "Sumaste Macul a tus comunas.") F("9 · sumar una comuna no se dice");
      if (fraseCambioPerfil(pc({}), pc({})) !== null) F("9 · sin cambios, el perfil inventa una frase");

      // La tarjeta dice lo vigente (lo que supo la vigilancia), no la foto del día que lo eligió; y no repite «Al mes».
      const vs = vigenteSobre({ precioUF: 3000, veredicto: "AJUSTA SUPUESTOS", flujoCLP: -20000, score: 70, comuna: "Macul" }, { precioUF: 2850, veredicto: "COMPRAR", flujoCLP: 52000 });
      if (vs.precioUF !== 2850 || vs.veredicto !== "COMPRAR" || vs.flujoCLP !== 52000 || vs.score !== 70) F("9 · la tarjeta de la base no muestra el precio, el veredicto o el al mes vigentes");
      if (!/datos: vigenteSobre\(\(f\.datos \?\? \{\}\) as DatosDepto, f\.vigente/.test(codigo("src/lib/invierte-v2/base-servidor.ts"))) F("9 · la base no pone lo vigente sobre la foto del depto");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): la tarjeta entera es un botón (§14f): sus filas van en span.
      if (!/\{d\.datos\.flujoCLP != null && !d\.alMesEnCambio && <span/.test(codigo("src/components/invierte-v2/VistaBase.tsx"))) F("9 · la base repite «Al mes» cuando lo que cambió ya lo dice");
      if (!lineaDepto({ comuna: "X", m2: 58 }).includes("58 m²")) F("9 · «58 m²» puede quedar partido en dos renglones");
      const vb = codigo("src/components/invierte-v2/VistaBase.tsx");
      if (!/<ConMontoNegativo texto=\{l\} \/>/.test(vb) || !vb.includes("texto.split(/(pones \\$[\\d.]+)/)") || !vb.includes('<span key={i} className="iv2-pones iv2-nowrap">')) F("9 · «pones $X» de la línea de lo que cambió no va en rojo");
      // Sumar: solo lo que le alcanza, hasta seis; con seis, deja uno elegido por ella; cada sumado deja su tarea interna.
      const ORDEN = { id: "o-1", user_id: USER.id, email: USER.email, nombre: "Camila Rojas", rut: "12345678-5", aviso_id: "a0", depto_linea: "x", texto_version: 1, texto_sha256: "h", texto: "t", es_prueba: true, firmado_at: "2026-11-15T15:00:00Z" };
      const PERFIL = { user_id: USER.id, objetivo: "arriendo", comunas: ["Macul"], preaprobado: "no", tope_uf: 3000, tope_fuente: "renta", es_prueba: true, updated_at: "x" };
      const aviso = (id: string, precio: number) => ({
        sp: { id, comuna: "Macul", lat: null, lng: null, superficie_m2: 54, dormitorios: 2, banos: 1, condicion: "usado" },
        ae: { aviso_id: id, precio_uf: precio, arriendo: null, venta: null, score_20: 80, flujo_20: 15000, veredicto_20: "COMPRAR" },
      });
      const mundo = (activos: number) => {
        const avisos = [aviso("nuevo", 2760), aviso("caro", 3600), ...Array.from({ length: activos }, (_, i) => aviso(`e${i}`, 2500))];
        return falso({
          inv_ordenes: [ORDEN], inv_perfiles: [PERFIL], inv_bitacora: [], inv_tareas: [],
          inv_deptos: Array.from({ length: activos }, (_, i) => ({ user_id: USER.id, aviso_id: `e${i}`, estado: "elegido", origen: "franco", alcanza: true, datos: { comuna: "Macul" } })),
          scraped_properties: avisos.map((a) => a.sp), avisos_evaluados: avisos.map((a) => a.ae),
        });
      };
      const u = { id: USER.id, email: USER.email };
      const w1 = mundo(2);
      const r1 = await sumarDepto(w1.sb, u, "nuevo", null, "mapa", null);
      const fila = w1.datos.inv_deptos.find((f) => f.aviso_id === "nuevo");
      if (!r1.ok || fila?.estado !== "elegido" || fila?.origen !== "mapa") F("9 · sumar desde el mapa no deja el depto elegido con origen «mapa»");
      if (!w1.datos.inv_tareas.some((t) => t.tipo === "gestionar_corredor" && t.aviso_id === "nuevo")) F("9 · sumar no deja la tarea «gestionar al corredor»");
      if (!w1.datos.inv_bitacora.some((b) => b.accion === "depto_sumado")) F("9 · sumar no queda en la bitácora");
      const r2 = await sumarDepto(mundo(2).sb, u, "caro", null, "mapa", null);
      if (r2.ok || r2.error !== "fuera") F("9 · se puede sumar un depto que no le alcanza");
      const w6 = mundo(MAX_ACTIVOS);
      const r3 = await sumarDepto(w6.sb, u, "nuevo", null, "base", null);
      if (r3.ok || r3.error !== "maximo" || w6.datos.inv_deptos.some((f) => f.aviso_id === "nuevo")) F("9 · con seis activos se suma un séptimo sin dejar uno");
      const r4 = await sumarDepto(w6.sb, u, "nuevo", "e3", "base", null);
      const estados = w6.datos.inv_deptos.filter((f) => f.estado === "elegido").map((f) => f.aviso_id).sort().join(",");
      if (!r4.ok || estados !== "e0,e1,e2,e4,e5,nuevo") F(`9 · con seis activos, dejar uno no suelta ESE y suma el nuevo (${estados})`);
      const r5 = await sumarDepto(mundo(MAX_ACTIVOS).sb, u, "nuevo", "otro", "base", null);
      if (r5.ok || r5.error !== "deja") F("9 · se puede dejar un depto que no está entre los suyos");
      const sinOrden = falso({ inv_ordenes: [], inv_perfiles: [PERFIL] });
      const r6 = await sumarDepto(sinOrden.sb, u, "nuevo", null, "mapa", null);
      if (r6.ok || r6.error !== "sin-orden") F("9 · se puede sumar sin orden firmada");

      // El cableado de cada pantalla.
      const base = codigo("src/components/invierte-v2/VistaBase.tsx"); // ⚠ ACTA (19-nov-2026): lo que dibuja la base vive en VistaBase (la usan la página y /dev/invierte-v2/base)
      if (!/<SumarDepto avisoId=\{o\.avisoId\} etiqueta=\{B\.seguirConEste\} origen="base" activos=\{activos\} variante="enlace" \/>/.test(base)) F("9 · las otras opciones no tienen «Seguir con este»");
      if (!/href=\{URL_OPCIONES\}[^>]*data-inv2="comparar-todas"/.test(base) || !/href="\/explorar"[^>]*data-inv2="buscar-mapa"/.test(base)) F("9 · la base no tiene «Comparar todas» o «Buscar otro en el mapa»");
      if (!/<MenuBase nombre=/.test(base) || !/<EnlacesBase whatsapp=\{base\.whatsapp\} \/>/.test(base)) F("9 · la base no tiene el menú en el celular o los enlaces en el PC");
      if (!/\{base\.whatsapp && <a href=\{urlWhatsapp\(base\.whatsapp\)\} target="_blank"/.test(base)) F("9 · «Escribirle» aparece sin número configurado (o saca de la página)");
      if (/iv2-ind-barra|Te toca a ti|BASE_COPY\.teTocaATi|B\.teTocaATi/.test(base)) F("9 · la base muestra la barra de cuatro tramos o «Te toca a ti» (no se construyen en esta etapa)");
      const lb = codigo("src/lib/invierte-v2/base-servidor.ts");
      // ⚠ ACTA (19-nov-2026, láminas del 19-nov, entregas 2 y 3): «Otras opciones que convienen» son solo las recomendaciones de Franco, y nunca más del cupo.
      if (!/f\.estado === "opcion" && f\.origen === "franco" && f\.alcanza === true && \(f\.datos as DatosDepto \| null\)\?\.veredicto === "COMPRAR"/.test(lb) || !/\.slice\(0, cuantasPedir\(elegidasFranco\)\);/.test(lb)) F("9 · las otras opciones no son solo las recomendaciones de Franco que convienen y le alcanzan, dentro del cupo de tres");
      const css = leer("src/components/invierte-v2/invierte-v2.css");
      if (!/\.iv2-base \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 360px;/.test(css) || !/\.iv2-deptos \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/.test(css)) F("9 · la base del PC no va en dos columnas con los deptos de a dos");
      const menu = codigo("src/components/invierte-v2/MenuBase.tsx");
      // ⚠ ACTA (19-nov-2026, Fabrizio): las preguntas frecuentes van también en la columna derecha del PC (la lámina las omitió).
      if (!/export function EnlacesBase[\s\S]*data-inv2="pc-preguntas"[\s\S]*<ListaPreguntas preguntas=\{PREGUNTAS_INVIERTE\} \/>/.test(menu)) F("9 · las preguntas frecuentes no están en la columna derecha del PC");
      if (/Mis avisos/.test(menu)) F("9 · el menú trae «Mis avisos» (no se construye en esta etapa)");
      if (!/e\.key === "Escape"/.test(menu) || !/if \(e\.target === e\.currentTarget\) cerrar\(\);/.test(menu) || !/onClick=\{cerrar\}[^>]*data-inv2="menu-cerrar"/.test(menu)) F("9 · el menú no cierra con Escape, tocando afuera o con «Cerrar»");
      if (!/\.iv2-menu \{[^}]*max-height: calc\(100dvh - 88px\); overflow-y: auto;/.test(css)) F("9 · la hoja del menú puede pasarse del alto de la pantalla");
      const docs = codigo("src/app/invierte/documentos/page.tsx");
      if (!/<VerOrden clase="iv2-enlace-azul iv2-doc-accion" etiqueta=\{D\.ver\}/.test(docs)) F("9 · la orden de «Tus documentos» no se abre en la ventana");
      const hoja = codigo("src/components/invierte-v2/HojaContacto.tsx");
      if (!/router\.push\(`\$\{urlSumar\(depto\.avisoId\)\}/.test(hoja)) F("9 · el mapa no lleva a «Súmalo a tus opciones» a quien ya firmó");
      const sumar = codigo("src/app/invierte/[avisoId]/sumar/page.tsx");
      if (!/if \(!acceso\) notFound\(\);/.test(sumar) || !/force-dynamic/.test(sumar)) F("9 · la pantalla de sumar no da 404 sin acceso");
      // ⚠ ACTA (20-nov-2026, Fabrizio): cuando no alcanza, otra pantalla: «Este depto hoy no te alcanza», sin el recuadro de la
      // firma ni «Franco empieza a gestionarlo», con el precio y hasta cuánto puede comprar, y tres salidas (volver al mapa, ir a mi
      // inversión y revisar mi perfil, que dice para qué sirve). Antes exigía `{v.alcanza ? <SumarDepto`.
      const rama = sumar.match(/if \(v\.estado === "listo" && !v\.alcanza\) \{[\s\S]*?\n  \}\n/)?.[0] ?? "";
      if (!rama || /SumarDepto|sinFirma|S\.entra\b/.test(rama) || !/\{S\.noAlcanzaTitulo\}/.test(rama) || !/S\.noAlcanzaLinea\(/.test(rama) || !/data-inv2="volver-mapa"/.test(rama) || !/href=\{URL_BASE\}[^>]*data-inv2="ir-mi-inversion"/.test(rama) || !/data-inv2="revisar-perfil"[\s\S]*\{S\.revisarPerfilPara\}/.test(rama)) F("9 · la pantalla de sumar cuando no alcanza no es la pedida (título, sin firma, precio y tope, tres salidas)");
      if (sumar.indexOf('if (v.estado === "listo" && !v.alcanza)') > sumar.indexOf("<SumarDepto")) F("9 · la pantalla de sumar ofrece sumar antes de mirar si alcanza");
      if (!/volver=\{volverPerfil\(searchParams\.volver, g != null\)\}/.test(codigo("src/app/invierte/perfil/page.tsx"))) F("9 · el perfil no tiene «Volver»");
      // 5 · «Mis documentos» sin «Los detalles de tus deptos»; 7 · «Escribirle» con el ícono de WhatsApp; 8 · el botón del mapa.
      if (/doc-ver-detalles|D\.detalles\b/.test(codigo("src/app/invierte/documentos/page.tsx"))) F("9 · «Mis documentos» todavía tiene «Los detalles de tus deptos»");
      if (!/<IconoWhatsapp \/>\{M\.escribirle\}/.test(codigo("src/components/invierte-v2/MenuBase.tsx")) || !/data-inv2="pc-escribirle"><IconoWhatsapp \/>/.test(codigo("src/components/invierte-v2/MenuBase.tsx")) || !/data-inv2="escribirle"><IconoWhatsapp \/>/.test(codigo("src/components/invierte-v2/VistaBase.tsx"))) F("9 · «Escribirle» no lleva el ícono de WhatsApp");
      // ⚠ ACTA (19-nov-2026, láminas del 19-nov): en la tarjeta de uno de SUS deptos el botón dice «Mi inversión».
      if (!/etiquetaInvertir=\{\(p\) => \(invierteFirmo && destinoBoton\(\{ acceso: invierteV2, condicion: p\.condicion \}\) === "v2" \? \(misDeptos\.includes\(p\.avisoId\) \? FLUJO_COPY\.miInversion : SUMAR_COPY\.botonMapa\) : undefined\)\}/.test(codigo("src/app/explorar/explorar-cliente.tsx")) || !/const invierteFirmo = invierteV2 \? !!\(await ultimaOrdenDe\(admin, user\.id\)\) : false;/.test(codigo("src/app/explorar/page.tsx"))) F("9 · el botón del mapa no dice «Sumar a mis opciones de inversión» a quien ya firmó");
      const ed = codigo("src/components/invierte-v2/PerfilForm.tsx");
      if (!/router\.push\(d\?\.editado \? URL_PERFIL_ACTUALIZADO : URL_OPCIONES\);/.test(ed)) F("9 · cambiar el perfil no lleva a «Perfil actualizado»");
      const ps = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/const ultimoCambio = previo \? await cambioDelPerfil\(/.test(ps) || !/editado: !!ultimoCambio && ultimoCambio\.deptos\.some\(\(d\) => d\.estado === "elegido"\)/.test(ps)) F("9 · el perfil no guarda la foto de antes o «Perfil actualizado» se muestra a quien nunca eligió");
      if (!/await tareasGestionar\(admin, user\.id, ids,/.test(ps)) F("9 · elegir deptos no deja la tarea «gestionar al corredor»");
      // La ficha del admin: las tareas con «Marcar hecha», y quién publica no sale de ella.
      const ficha = codigo("src/app/admin/invierte-v2/[userId]/page.tsx");
      if (!/<TareaHecha id=\{t\.id as string\} \/>/.test(ficha) || !/requireAdminPage\(\)/.test(ficha)) F("9 · la ficha del admin no marca tareas hechas (o no pide admin)");
      if (/publicadores|avisos_publicador/.test(ficha)) F("9 · la ficha del admin lee quién publica");
      if (!/\.eq\("id", b\.id\)\.eq\("estado", "pendiente"\)/.test(codigo("src/app/api/admin/invierte-v2/route.ts"))) F("9 · «Marcar hecha» puede reescribir una tarea ya hecha");
    }

    // ── 10 · LA PREAPROBACIÓN (entrega 3, 19-nov-2026; láminas 3.4-preaprobacion, 3.4-preaprobacion-estados y el bloque de
    //        3.1-perfil-paso2-con-preaprobacion). Reglas puras, servidor con fixture (IA y correo falsos, sin red) y cableado. ──
    {
      const textos: [string, string][] = [
        [PREAPROB_COPY.titulo, "Para ofertar o visitar, sube tu preaprobación"],
        [PREAPROB_COPY.linea, "Es el documento de tu banco que dice hasta cuánto te prestaría. Se sube una vez y vale para todos tus deptos."],
        [PREAPROB_COPY.porQueT, "Por qué te la pedimos"], [PREAPROB_COPY.porQue, "Los vendedores la exigen para recibir una oferta o agendar una visita. Con ella llegas con respaldo."],
        [PREAPROB_COPY.cajaT, "Foto o PDF de tu preaprobación"], [PREAPROB_COPY.cajaS, "O el certificado de tu banco."],
        [PREAPROB_COPY.subir, "Subir mi preaprobación"], [PREAPROB_COPY.todaviaNo, "Todavía no la tengo"], [PREAPROB_COPY.sinCredito, "Compro sin crédito"],
        [PREAPROB_COPY.perfilS, "Foto o PDF. Puedes subirla ahora o después."], [PREAPROB_COPY.volver, "Volver a mis deptos"],
        [ESTADOS_COPY.en_revision.chip, "En revisión"], [ESTADOS_COPY.en_revision.titulo, "Recibimos tu preaprobación"], [ESTADOS_COPY.en_revision.texto, "La revisamos hoy. Mientras, puedes seguir viendo tus deptos."],
        [ESTADOS_COPY.en_revision.ver, "Ver lo que subí"], [ESTADOS_COPY.aprobada.chip, "✓ Aprobada"], [ESTADOS_COPY.aprobada.titulo, "Ya puedes ofertar o pedir visita"],
        [ESTADOS_COPY.aprobada.ver, "Ver mi preaprobación"], [ESTADOS_COPY.por_corregir.chip, "Te toca a ti"], [ESTADOS_COPY.por_corregir.titulo, "Necesitamos que la subas de nuevo"],
        [ESTADOS_COPY.por_corregir.boton, "Subir otra"],
        [lineaAprobada({ banco: "Estado", montoUF: 2600, vigenteHasta: "2027-02-15" }), "Banco Estado · crédito hasta UF 2.600 · vigente hasta el 15 de febrero."],
        [TE_TOCA_ROTULO, "Lo que te toca hoy"], [teTocaHoy("subir")?.titulo ?? "", "Sube tu preaprobación para ofertar o visitar"],
      ];
      for (const [v, e] of textos) if (v !== e) F(`10 · el texto no es el de la lámina: «${v}» (debía ser «${e}»)`);
      // Las reglas.
      if (!validarArchivo({ mime: "application/pdf", bytes: 1000 }).ok || validarArchivo({ mime: "image/gif", bytes: 1000 }).ok || validarArchivo({ mime: "image/jpeg", bytes: 16 * 1024 * 1024 }).ok || validarArchivo({ mime: "image/heic", bytes: 0 }).ok) F("10 · el archivo no se valida por tipo (PDF/foto) y tamaño (hasta 15 MB)");
      // Quien entró por la renta (sin la pregunta del pie) y le aprueban la preaprobación: cuenta el pie que declaró.
      if (hastaCuanto({ preaprobado: "no", pieUF: 700, rentaCLP: 2500000, otrasCuotasCLP: 0, tasaPct: 4.1, uf: 41357, aprobadaUF: 2600 }).topeUF !== 3300) F("10 · con un monto aprobado, el pie declarado por el camino de la renta cuenta como cero");
      if (MAX_BYTES_PREAPROBACION !== 15 * 1024 * 1024) F("10 · el tope del archivo no es el del bucket (15 MB)");
      if (teTocaHoy("en_revision") || teTocaHoy("aprobada") || teTocaHoy("sin_credito") || teTocaHoy("explicando") || !teTocaHoy("por_corregir")) F("10 · «Lo que te toca hoy» aparece cuando no le toca a la persona (o falta cuando hay que corregir)");
      if (!puedeOfertar("aprobada") || !puedeOfertar("sin_credito") || puedeOfertar("en_revision") || puedeOfertar("subir") || puedeOfertar("por_corregir")) F("10 · se puede ofertar sin una preaprobación aprobada (o sin «compro sin crédito»)");
      if (estadoVisible(null, false) !== "subir" || estadoVisible(null, true) !== "explicando" || estadoVisible({ estado: "subiendo" }, false) !== "subir" || estadoVisible({ estado: "en_revision" }, true) !== "en_revision") F("10 · el estado visible no sale del documento y de la tarea de explicar");
      if (nombreCoincide("CAMILA ANDREA ROJAS PEREZ", "Camila Rojas Pérez") !== true || nombreCoincide("Rojas Pérez, Camila", "Camila Rojas Pérez") !== true || nombreCoincide("Pedro Rojas", "Camila Rojas Pérez") !== false || nombreCoincide("Camila", "Camila Rojas Pérez") !== false || nombreCoincide(null, "Camila Rojas") !== null) F("10 · el nombre del documento no se compara bien con el de la orden");
      if (!validarAprobacion({ banco: "Estado", montoUF: "2600", vigenteHasta: "2027-02-15" }).ok || validarAprobacion({ banco: "", montoUF: 2600, vigenteHasta: "2027-02-15" }).ok || validarAprobacion({ banco: "Estado", montoUF: 50, vigenteHasta: "2027-02-15" }).ok || validarAprobacion({ banco: "Estado", montoUF: 2600, vigenteHasta: "15-02-2027" }).ok) F("10 · la aprobación acepta datos incompletos o inválidos");
      if (validarMotivo("corto") || !validarMotivo("Venció el 3 de noviembre. Pídele a tu banco una vigente.")) F("10 · el motivo de corregir no se valida (10 a 300 caracteres)");
      if (CORREO_PREAPROB.aprobada.parrafo({ banco: "Estado", montoUF: 2600, vigenteHasta: "2027-02-15" }) !== "Revisamos tu preaprobación: Banco Estado · crédito hasta UF 2.600 · vigente hasta el 15 de febrero. Ya puedes ofertar o pedir visita en tus deptos.") F("10 · el correo de aprobada no es el propuesto");
      if (CORREO_PREAPROB.por_corregir.parrafo("Venció el 3 de noviembre") !== "Revisamos tu preaprobación y necesitamos que la subas de nuevo. Venció el 3 de noviembre.") F("10 · el correo de por corregir no es el propuesto");

      // La lectura con IA, con un cliente falso: transcribe; HEIC no se manda; una negativa no rompe nada; el costo con la tarifa.
      const respuesta = (o: { stop_reason?: string; texto?: string }) => ({ beta: { messages: { create: async () => ({ model: CLAUDE_MODEL_DOCUMENTOS, stop_reason: o.stop_reason ?? "end_turn", usage: { input_tokens: 3000, output_tokens: 200 }, content: o.texto ? [{ type: "text", text: o.texto }] : [] }) } } });
      const JSONLECT = JSON.stringify({ es_preaprobacion: true, banco: "Banco Estado", monto: 103000000, moneda: "CLP", vigente_hasta: "2027-02-15", nombre_titular: "Camila Rojas Pérez", rut_titular: "12.345.678-5", observaciones: null, certeza: { banco: "alta", monto: "alta", vigencia: "media", nombre: "alta" } });
      const l1 = await leerPreaprobacionIA(respuesta({ texto: JSONLECT }) as never, { bytes: new Uint8Array([37, 80]), mime: "application/pdf" });
      if (!l1.ok || l1.lectura.monto !== 103000000 || l1.lectura.moneda !== "CLP" || l1.lectura.vigenteHasta !== "2027-02-15" || l1.costoUsd !== 0.016) F(`10 · la lectura con IA no transcribe o no calcula su costo (${JSON.stringify(l1)})`);
      const l2 = await leerPreaprobacionIA(respuesta({ stop_reason: "refusal" }) as never, { bytes: new Uint8Array([1]), mime: "image/png" });
      const l3 = await leerPreaprobacionIA(respuesta({ texto: JSONLECT }) as never, { bytes: new Uint8Array([1]), mime: "image/heic" });
      if (l2.ok || l2.motivo !== "rechazo" || l3.ok || l3.motivo !== "formato") F("10 · una negativa o un HEIC no terminan en revisión a mano");
      // La API rechaza (400) un `enum` junto a `type: [..., "null"]`: así falló la primera lectura real (19-nov-2026). Lo nulo con
      // lista de valores va con anyOf.
      const malos = Object.entries(ESQUEMA_LECTURA.properties as Record<string, Record<string, unknown>>).filter(([, v]) => Array.isArray(v.type) && "enum" in v).map(([k]) => k);
      if (malos.length) F(`10 · el esquema de la lectura tiene enum con tipo nulo (la API lo rechaza): ${malos.join(", ")}`);
      if (!TARIFAS[CLAUDE_MODEL_DOCUMENTOS]) F("10 · el modelo de los documentos no tiene tarifa (el costo saldría sin medir)");
      // Voseo: imperativos y presentes agudos (Transcribí, calculá, tenés). `\b` no corta después de una vocal con tilde en JS, así
      // que se buscan palabras que terminan en á/é/í (con o sin s) seguidas de un separador, salvo las que son castellano neutro.
      const agudas = (INSTRUCCION_LECTURA.match(/[A-Za-zñ]+[íáé]s?(?=[\s.,:;)])/g) ?? []).filter((w) => !["está", "están", "más", "también", "aquí"].includes(w.toLowerCase()));
      if (agudas.length) F(`10 · la instrucción de la IA tiene voseo: ${agudas.join(", ")}`);

      // El servidor, con un fixture: subir, confirmar (huella, IA, tarea), aprobar (tope y correo) y corregir.
      const ORDEN_P = { id: "o-p", user_id: USER.id, email: USER.email, nombre: "Camila Rojas Pérez", rut: "12345678-5", aviso_id: "a0", depto_linea: "x", texto_version: 1, texto_sha256: "h", texto: "t", es_prueba: true, firmado_at: "2026-11-15T15:00:00Z" };
      const PERFIL_P = { user_id: USER.id, objetivo: "arriendo", comunas: ["Macul"], preaprobado: "no", pie_uf: 700, renta_liquida_clp: 2500000, otras_cuotas_clp: 0, tope_uf: 3500, tope_fuente: "renta", tope_supuestos: { reemplazoPrecioMax: true }, es_prueba: true, updated_at: "x" };
      const w = falso({ inv_ordenes: [ORDEN_P], inv_perfiles: [PERFIL_P], inv_documentos: [], inv_tareas: [{ user_id: USER.id, tipo: "explicar_preaprobacion", estado: "pendiente" }], inv_bitacora: [], config: [{ key: "uf_value", value: "41357" }, { key: "tasa_hipotecaria", value: "4.1" }], perfil_busqueda: [{ user_id: USER.id, precio_max_uf: 3500 }] });
      const u = { id: USER.id, email: USER.email };
      if ((await pedirSubida(w.sb, u, { mime: "image/gif", bytes: 10 })).ok) F("10 · se pide subida para un archivo que no es PDF ni foto");
      const ps = await pedirSubida(w.sb, u, { mime: "application/pdf", bytes: 120000 });
      if (!ps.ok || !/^preaprobaciones\/0381a589-0000-4000-8000-00000000abcd\/[0-9a-f-]+\.pdf$/.test(ps.path) || w.datos.inv_documentos[0]?.estado !== "subiendo") F(`10 · la subida no va a preaprobaciones/<persona>/<id>.pdf o no queda «subiendo» (${JSON.stringify(ps)})`);
      if (ps.ok) {
        const llamadas: unknown[] = [];
        const r = await confirmarSubida(w.sb, u, ps.id, { leerIA: async (a) => { llamadas.push(a.mime); return { ok: true, lectura: { esPreaprobacion: true, banco: "Banco Estado", monto: 103000000, moneda: "CLP", vigenteHasta: "2027-02-15", nombreTitular: "CAMILA ROJAS PEREZ", rutTitular: null, observaciones: null, certeza: { banco: "alta", monto: "alta", vigencia: "alta", nombre: "alta" } }, modelo: CLAUDE_MODEL_DOCUMENTOS, costoUsd: 0.016 }; } }, null);
        const d = w.datos.inv_documentos[0];
        const ia = (d?.ia ?? {}) as Record<string, unknown>;
        if (!r.ok || d.estado !== "en_revision" || typeof d.sha256 !== "string" || (d.sha256 as string).length !== 64 || llamadas.length !== 1) F("10 · confirmar no deja el documento en revisión con su huella, o no lo lee la IA");
        if (ia.montoUF !== Math.round(103000000 / 41357) || ia.nombreCoincide !== true) F(`10 · el monto no pasa a UF con la UF del día o el nombre no se compara con la orden (${JSON.stringify(ia)})`);
        if (!w.datos.inv_tareas.some((t) => t.tipo === "revisar_preaprobacion" && t.estado === "pendiente") || w.datos.inv_tareas.some((t) => t.tipo === "explicar_preaprobacion" && t.estado === "pendiente")) F("10 · confirmar no deja la tarea de revisar o no cierra la de explicar");
        if (!w.datos.inv_bitacora.some((b) => b.accion === "preaprobacion_subida")) F("10 · la subida no queda en la bitácora");
        // Una segunda subida reemplaza a la que seguía en revisión (el admin revisa la última).
        const ps2 = await pedirSubida(w.sb, u, { mime: "image/png", bytes: 5000 });
        if (ps2.ok) {
          await confirmarSubida(w.sb, u, ps2.id, { leerIA: null }, null);
          const vieja = w.datos.inv_documentos.find((x) => x.id === ps.id);
          if (vieja?.estado !== "por_corregir" || vieja?.motivo !== MOTIVO_REEMPLAZADA || w.datos.inv_documentos.find((x) => x.id === ps2.id)?.estado !== "en_revision") F("10 · una subida nueva no reemplaza a la que seguía en revisión");
          // Para seguir con la revisión de la primera, se devuelve a «en revisión».
          if (vieja) { vieja.estado = "en_revision"; vieja.motivo = null; }
          const nueva = w.datos.inv_documentos.find((x) => x.id === ps2.id); if (nueva) nueva.estado = "por_corregir";
        }
        const correos: { tipo: string; to: string }[] = [];
        const deps = { correo: async (p: { tipo: string; to: string }) => { correos.push(p); return true; }, puedeRecibir: async () => true } as never;
        const ap = await aprobar(w.sb, "admin@x", ps.id, { banco: "Estado", montoUF: 2600, vigenteHasta: "2027-02-15" }, deps);
        const pf = w.datos.inv_perfiles[0];
        if (!ap.ok || w.datos.inv_documentos[0].estado !== "aprobada" || w.datos.inv_documentos[0].monto_aprobado_uf !== 2600) F("10 · aprobar no deja la preaprobación aprobada con su monto");
        if (pf.tope_fuente !== "aprobada" || (pf.tope_supuestos as Record<string, unknown>).aprobadaUF !== 2600 || w.datos.perfil_busqueda[0].precio_max_uf !== Math.round(Number(pf.tope_uf))) F(`10 · el monto aprobado no reemplaza la estimación de hasta cuánto puede comprar (${pf.tope_fuente}, ${pf.tope_uf})`);
        if (correos.length !== 1 || correos[0].tipo !== "aprobada" || w.datos.inv_tareas.some((t) => t.tipo === "revisar_preaprobacion" && t.estado === "pendiente")) F("10 · aprobar no manda el correo o no cierra la tarea");
        const otra = await aprobar(w.sb, "admin@x", ps.id, { banco: "Estado", montoUF: 2600, vigenteHasta: "2027-02-15" }, deps);
        if (otra.ok || otra.error !== "estado") F("10 · se puede aprobar dos veces la misma preaprobación");
      }
      // Corregir, y el correo que no sale fuera de la lista.
      const w2 = falso({ inv_ordenes: [ORDEN_P], inv_documentos: [{ id: "00000000-0000-4000-8000-0000000000d1", user_id: USER.id, tipo: "preaprobacion", estado: "en_revision", path: "preaprobaciones/x/d1.pdf", es_prueba: true, created_at: "x" }], inv_tareas: [{ user_id: USER.id, tipo: "revisar_preaprobacion", estado: "pendiente" }], inv_bitacora: [] });
      const enviados: string[] = [];
      const fuera = { correo: async (p: { tipo: string }) => { enviados.push(p.tipo); return true; }, puedeRecibir: async () => false } as never;
      const co = await pedirCorregir(w2.sb, "admin@x", "00000000-0000-4000-8000-0000000000d1", "Venció el 3 de noviembre. Pídele a tu banco una vigente.", fuera);
      if (!co.ok || w2.datos.inv_documentos[0].estado !== "por_corregir" || w2.datos.inv_documentos[0].motivo !== "Venció el 3 de noviembre. Pídele a tu banco una vigente.") F("10 · pedir corregir no guarda el estado y el motivo");
      if (enviados.length || co.ok && co.correo) F("10 · el correo de la preaprobación sale a una cuenta fuera de la lista");
      const n = await borrarArchivosPreaprobacion(w2.sb, USER.id);
      if (n !== 1 || !w2.bucket.borrados.includes("preaprobaciones/x/d1.pdf")) F("10 · pedir la eliminación no borra los archivos de la preaprobación");

      // ⚠ ACTA (20-nov-2026, Fabrizio) · con una aprobada VIGENTE, una subida posterior rechazada (o en revisión) no le quita
      // «Aprobada»: la nueva se muestra aparte, con su motivo. Vencida, manda la última. (El fixture va de la más nueva a la más vieja,
      // como la consulta.)
      const docsP = (vence: string, estadoNueva: string) => falso({
        inv_documentos: [
          { id: "d-nueva", user_id: USER.id, tipo: "preaprobacion", estado: estadoNueva, motivo: "Es un documento de muestra.", created_at: "2026-11-20" },
          { id: "d-aprob", user_id: USER.id, tipo: "preaprobacion", estado: "aprobada", banco: "Estado", monto_aprobado_uf: 2600, vigente_hasta: vence, created_at: "2026-11-10" },
        ],
        inv_tareas: [],
      });
      const pv1 = await leerPreaprobacion(docsP("2099-12-31", "por_corregir").sb, USER.id);
      if (pv1.estado !== "aprobada" || pv1.doc?.id !== "d-aprob" || pv1.otra?.id !== "d-nueva") F("10 · con una aprobada vigente, una subida rechazada le quita «Aprobada»");
      const pv2 = await leerPreaprobacion(docsP("2099-12-31", "en_revision").sb, USER.id);
      if (pv2.estado !== "aprobada" || pv2.otra?.id !== "d-nueva") F("10 · con una aprobada vigente, una subida en revisión le quita «Aprobada»");
      const pv3 = await leerPreaprobacion(docsP("2020-01-01", "por_corregir").sb, USER.id);
      if (pv3.estado !== "por_corregir" || pv3.otra) F("10 · con la aprobada vencida, sigue mandando «Aprobada»");
      if (!vigente("2026-11-20", "2026-11-20") || vigente("2026-11-19", "2026-11-20") || !vigente(null, "2026-11-20") || !/^\d{4}-\d{2}-\d{2}$/.test(hoyChile())) F("10 · la vigencia no se mide hasta el día que dice, en la hora de Chile");
      if (!/\{pre\.otra && \(/.test(codigo("src/app/invierte/preaprobacion/page.tsx"))) F("10 · la subida posterior no se muestra aparte con su motivo");

      // ⚠ ACTA (20-nov-2026, la prueba de Fabrizio) · «Abrir» mientras la preparación en segundo plano está en curso: la ruta responde
      // 409 «en-curso» y antes eso era «no se pudo». Ahora espera y vuelve a preguntar; con otro error, no insiste.
      const respuestas = (lista: { status: number; body: Record<string, unknown> }[]) => { let i = 0; return (async () => { const r = lista[Math.min(i++, lista.length - 1)]; return { ok: r.status < 300, status: r.status, json: async () => r.body }; }) as unknown as typeof fetch; };
      const esperas: number[] = [];
      const a1 = await abrirDetalles("x", { pedir: respuestas([{ status: 409, body: { error: "en-curso" } }, { status: 409, body: { error: "en-curso" } }, { status: 200, body: { id: "inf-1" } }]), esperar: async (ms) => { esperas.push(ms); } });
      if (a1 !== "inf-1" || esperas.length !== 2) F("10 · «Abrir» no espera a que termine la preparación en curso");
      const a2 = await abrirDetalles("x", { pedir: respuestas([{ status: 409, body: { error: "sin-creditos" } }]), esperar: async () => { esperas.push(-1); } });
      if (a2 !== null || esperas.includes(-1)) F("10 · «Abrir» insiste ante un error que no es «en curso»");
      const a3 = await abrirDetalles("x", { pedir: respuestas([{ status: 409, body: { error: "en-curso" } }]), esperar: async () => undefined });
      if (a3 !== null) F("10 · «Abrir» espera para siempre una preparación que no termina");

      // El cableado.
      const ruta = codigo("src/app/api/invierte-v2/preaprobacion/route.ts");
      if (!/const user = await personaConAcceso\(\);\s*if \(!user\) return NO_EXISTE\(\);/.test(ruta) || !/export const maxDuration = 60;/.test(ruta)) F("10 · la ruta de la preaprobación responde sin acceso o puede cortarse antes de leer");
      if (!/process\.env\.ANTHROPIC_API_KEY \? new Anthropic\(\) : null/.test(ruta)) F("10 · sin la llave de Anthropic la subida se rompe (debe quedar para revisión a mano)");
      const adm = codigo("src/app/api/admin/invierte-v2/route.ts");
      if (!/puedeRecibir: async \(email\) => \{ const \{ modo, lista \} = await estadoInterruptor\(\); return puedeRecibirCopia\(modo, lista, email\); \}/.test(adm) || !/const v = validarAprobacion\(b\);/.test(adm) || !/const motivo = validarMotivo\(b\?\.motivo\);/.test(adm)) F("10 · el admin aprueba o corrige sin validar, o el correo no mira la lista");
      const vb = codigo("src/components/invierte-v2/VistaBase.tsx");
      if (!/const toca = teTocaHoy\(base\.preaprobacion\);/.test(vb) || !/<Link href=\{URL_PREAPROBACION\} className="inv-principal" data-inv2="te-toca-boton">/.test(vb)) F("10 · «Lo que te toca hoy» no está en la base o no lleva a la preaprobación");
      if (vb.indexOf('data-inv2="te-toca-hoy"') < 0 || vb.indexOf('data-inv2="te-toca-hoy"') > vb.indexOf('data-inv2="tus-deptos"')) F("10 · «Lo que te toca hoy» no va arriba de «Tus deptos» (lámina 3.3-base)");
      if (!/await borrarArchivosPreaprobacion\(admin, user\.id\);/.test(codigo("src/app/api/account/request-deletion/route.ts"))) F("10 · pedir la eliminación de la cuenta no borra los archivos de la preaprobación");
      if (!/\{inicial\.puedeSubirPreaprobacion && <SubirPreaprobacion variante="perfil" \/>\}/.test(codigo("src/components/invierte-v2/PerfilForm.tsx"))) F("10 · el paso 2 del perfil con preaprobación no deja subirla");
      const sub = codigo("src/components/invierte-v2/Preaprobacion.tsx");
      if (!/uploadToSignedUrl\(path, token, file/.test(sub) || !/disabled=\{enviando\} aria-busy=\{enviando \|\| undefined\} data-inv2="subir"/.test(sub)) F("10 · el archivo no va directo al bucket con la URL firmada, o «Subir» se puede apretar dos veces");
      if (!/<RevisarPreaprobacion id=\{pre\.doc\.id\}/.test(codigo("src/app/admin/invierte-v2/[userId]/page.tsx"))) F("10 · la ficha del admin no deja revisar la preaprobación");
    }

    // ── 11 · LÁMINAS DEL 19-nov-2026, ENTREGA 1: firmar cae en el perfil, la franja la primera vez, Nombres y Apellidos, «Mi
    //        inversión» en el menú y arriba de las páginas, los detalles que saben de dónde vienen, y ningún enlace al portal para
    //        quien firmó ──
    {
      // 11a · Al firmar se cae directo en el paso 1 del perfil; Partimos queda solo para quien vuelve sin perfil (/invierte).
      const firmaForm = codigo("src/components/invierte-v2/FirmaForm.tsx");
      if (!/if \(!res\.ok\) \{[\s\S]*?\}\s*olvidarMenu\(\);\s*router\.push\(URL_PERFIL\);/.test(firmaForm) || /URL_PARTIMOS/.test(firmaForm)) F("11a · al firmar no se cae en el perfil (o todavía se pasa por Partimos)");
      if (!/if \(orden\) redirect\(URL_INVIERTE\);/.test(codigo("src/app/invierte/[avisoId]/firma/page.tsx"))) F("11a · la firma con una orden ya firmada no deja decidir a /invierte");
      if (!/router\.push\(d\.firmo \? URL_INVIERTE : urlFirma\(/.test(codigo("src/components/invierte-v2/ContactoForm.tsx"))) F("11a · el contacto de quien ya firmó no deja decidir a /invierte");
      if (destinoInvierte({ sesion: true, acceso: true, firmo: true, contacto: null, perfil: false }).tipo !== "ir" || (destinoInvierte({ sesion: true, acceso: true, firmo: true, contacto: null, perfil: false }) as { url: string }).url !== URL_PARTIMOS) F("11a · quien vuelve sin perfil ya no va a Partimos");

      // 11b · La franja «Orden firmada» y el saludo, SOLO la primera vez (decisión de Fabrizio, 19-nov-2026), con la copia en chico.
      const perfilPag = codigo("src/app/invierte/perfil/page.tsx");
      if (!/const primeraVez = g == null;/.test(perfilPag) || !/franja=\{primeraVez \? <FranjaOrden orden=\{orden\} \/> : undefined\}/.test(perfilPag) || !/primeraVez: primeraVez \? \{ nombre: primerNombre\(orden\.nombre, orden\.nombres\) \} : undefined,/.test(perfilPag)) F("11b · la franja y el saludo no van solo la primera vez");
      const franja = codigo("src/components/invierte-v2/FranjaOrden.tsx");
      if (!/✓ \{P\.estado\}/.test(franja) || !/orden\.copiaEnviadaAt \? P\.guardada : P\.copiaPendiente/.test(franja) || !/<VerOrden etiqueta=\{FLUJO_COPY\.franjaVer\}/.test(franja)) F("11b · la franja no dice «✓ Orden firmada», la copia y «Ver» (la orden en ventana)");
      if (FLUJO_COPY.franjaVer !== "Ver" || FLUJO_COPY.partimos.guardada !== "Te mandamos una copia a tu correo.") F("11b · los textos de la franja no son los de la lámina");
      if (PERFIL_COPY.p1.tituloPrimera("Camila") !== "Partimos, Camila. ¿Qué buscas?" || PERFIL_COPY.p1.tituloPrimera(null) !== "Partimos. ¿Qué buscas?" || PERFIL_COPY.p1.lineaPrimera !== "Dos minutos. Con esto te mostramos las mejores opciones.") F("11b · el saludo del perfil no es el de la lámina 3.1");
      if (!/\{inicial\.primeraVez \? P1\.tituloPrimera\(inicial\.primeraVez\.nombre\) : P1\.titulo\}/.test(codigo("src/components/invierte-v2/PerfilForm.tsx"))) F("11b · el perfil no saluda la primera vez");
      const marco = codigo("src/components/invierte-v2/MarcoInvierte.tsx");
      if (marco.indexOf("{franja}") < 0 || marco.indexOf("{franja}") > marco.indexOf('<div className={`inv-cuerpo')) F("11b · la franja no va a todo el ancho, sobre el contenido");

      // 11c · Nombres y Apellidos: el formulario pide los dos con su autocompletado; el saludo, la primera palabra de los nombres.
      if (!/autoComplete="given-name"[^>]*value=\{nombres\}/.test(firmaForm) || !/autoComplete="family-name"[^>]*value=\{apellidos\}/.test(firmaForm) || /autoComplete="name"/.test(firmaForm)) F("11c · la firma no pide Nombres (given-name) y Apellidos (family-name)");
      if (!/validarFirma\(\{ avisoId: depto\.avisoId, nombres, apellidos, rut,/.test(firmaForm)) F("11c · la firma no manda nombres y apellidos");
      if (!/nombres: pedido\.nombres,\s*apellidos: pedido\.apellidos,/.test(codigo("src/lib/invierte-v2/servidor.ts"))) F("11c · la orden no guarda nombres y apellidos");
      // Nota (verificación por mutación, 19-nov-2026): leer `nombre` en vez de `nombres` es una mutación EQUIVALENTE —la regla de
      // la base obliga a que `nombre` empiece con los nombres—, así que ningún caso la distingue; lo que sí se fija es el resultado.
      if (primerNombre("María José Pérez", "María José") !== "María" || primerNombre("Camila Rojas", null) !== "Camila") F("11c · el saludo no sale de los nombres (o de `nombre` en las órdenes de antes)");
      for (const f of ["src/app/invierte/base/page.tsx", "src/app/invierte/partimos/page.tsx"]) if (!/primerNombre\([a-z.]*orden\.nombre, [a-z.]*orden\.nombres\)/.test(codigo(f))) F(`11c · ${f} no saluda con los nombres`);

      // 11d · La entrada de Invierte en el menú: solo con firma y acceso; el texto, según el estado; la consulta se guarda por correo.
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): antes de elegir deptos dice «Seguir con Franco» y va a /invierte (que la lleva
      // adonde quedó: el perfil o el resultado); desde que elige al menos uno, «Mi inversión», a la base. Lo guardado en la sesión
      // del navegador es el estado, no un sí/no. Y elegir, sumar, firmar o guardar el perfil limpian el caché de navegación: sin eso,
      // «Volver» y «Mi inversión» reusaban el desvío guardado de /invierte al resultado (Mis documentos llevaba a /invierte/opciones
      // aunque la persona ya había elegido).
      const ms = codigo("src/lib/invierte-v2/menu-servidor.ts");
      if (!/if \(!\(await accesoInvierteV2\(user\)\.catch\(\(\) => false\)\)\) return false;/.test(ms) || !/return \(await ultimaOrdenDe\(createServiceClient\(\), user\.id\)[^;]*\) != null;/.test(ms)) F("11d · la entrada del menú no exige firma y acceso");
      if (!/if \(!user \|\| !\(await muestraMiInversion\(user\)\)\) return "ninguno";/.test(ms) || !/\.eq\("user_id", user\.id\)\.eq\("estado", "elegido"\);\s*return \(count \?\? 0\) > 0 \? "inversion" : "seguir";/.test(ms)) F("11d · el estado del menú no sale de la firma y de los deptos elegidos");
      if (!/const estado = await estadoMenuInvierte\(user \?\? null\);\s*return NextResponse\.json\(\{ estado,/.test(codigo("src/app/api/invierte-v2/menu/route.ts"))) F("11d · la consulta del menú no responde el estado");
      {
        const se = entradaMenu("seguir"), inv = entradaMenu("inversion");
        if (se?.texto !== "Seguir con Franco" || se.href !== "/invierte" || inv?.texto !== "Mi inversión" || inv.href !== URL_BASE || entradaMenu("ninguno") !== null || entradaMenu(null) !== null) F("11d · el menú no dice «Seguir con Franco» (a /invierte) antes de elegir y «Mi inversión» (a la base) después");
      }
      {
        const caja = new Map<string, string>();
        const g = globalThis as unknown as { window?: unknown };
        const antes = g.window;
        g.window = { sessionStorage: { getItem: (k: string) => caja.get(k) ?? null, setItem: (k: string, v: string) => void caja.set(k, v), removeItem: (k: string) => void caja.delete(k) } };
        try {
          if (leerMenuGuardado("a@x.cl") !== null) F("11d · sin consulta, el menú inventa una respuesta");
          guardarMenu("a@x.cl", "seguir");
          if (leerMenuGuardado("a@x.cl") !== "seguir" || leerMenuGuardado("b@x.cl") !== null) F("11d · la respuesta guardada no es por correo");
          caja.set(CLAVE_MENU_INVIERTE, JSON.stringify({ email: "a@x.cl", firmo: true }));
          if (leerMenuGuardado("a@x.cl") !== null) F("11d · lo guardado antes del 20-nov (solo «firmó») elige el texto sin volver a preguntar");
          guardarMenu("a@x.cl", "inversion");
          olvidarMenu();
          if (leerMenuGuardado("a@x.cl") !== null) F("11d · al firmar, elegir o salir no se olvida la respuesta");
        } finally { g.window = antes; }
        const resp = (cuerpo: unknown, ok = true) => (async () => ({ ok, json: async () => cuerpo })) as unknown as typeof fetch;
        const inv = await consultarMenu(resp({ estado: "inversion", firmo: true }));
        const viejo = await consultarMenu(resp({ firmo: true }));
        const no = await consultarMenu(resp({}, false));
        if (inv !== "inversion" || viejo !== null || no !== null || CLAVE_MENU_INVIERTE !== "franco_inv2_menu") F("11d · la consulta del menú no lee su respuesta (o inventa una ante un error)");
      }
      const header = codigo("src/components/chrome/HeaderFranco.tsx");
      const conSesion = header.slice(header.indexOf("  } else {\n    derecha = ("));
      if (!/\{entradaInvierte && <EnlaceCarga href=\{entradaInvierte\.href\} className="hf-lnk hf-solo-ancho" data-hf="mi-inversion">\{entradaInvierte\.texto\}<\/EnlaceCarga>\}\s*<EnlaceCarga href="\/dashboard"/.test(conSesion)) F("11d · la entrada de Invierte no es la primera del menú del PC, o no sale del estado");
      if (!/<div className="hf-menu-mail">\{email\}<\/div>\s*(?:\{\}\s*)?\{entrada && <EnlaceCarga href=\{entrada\.href\} role="menuitem" onClick=\{\(\) => setAbierto\(false\)\} data-hf="mi-inversion-menu">\{entrada\.texto\}<\/EnlaceCarga>\}/.test(header)) F("11d · la entrada de Invierte no va primera en el menú del celular");
      if (!/if \(!email\) \{ setEstado\(null\); return; \}/.test(header) || !/return email \? entradaMenu\(estado\) : null;/.test(header) || !/if \(dePagina === false\) \{ setEstado\("ninguno"\);/.test(header) || !/if \(esEstadoMenu\(dePagina\)\) \{ setEstado\(dePagina\); guardarMenu\(email, dePagina\); return; \}/.test(header)) F("11d · el menú muestra la entrada sin sesión, sin saber si firmó o sin respetar lo que dice la página");
      if (!/pc=\{\{ sesionEmail: user\.email \?\? null, invierte: "inversion" \}\}/.test(codigo("src/app/invierte/base/page.tsx"))) F("11d · la base no le dice al menú que ya eligió");
      if (!/olvidarMenu\(\); router\.push\(URL_BASE\); router\.refresh\(\);/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx"))
        || !/olvidarMenu\(\); router\.push\(URL_BASE\); router\.refresh\(\);/.test(codigo("src/components/invierte-v2/SumarDepto.tsx"))
        || !/router\.push\(URL_PERFIL\);\s*router\.refresh\(\);/.test(codigo("src/components/invierte-v2/FirmaForm.tsx"))
        || !/router\.push\(d\?\.editado \? URL_PERFIL_ACTUALIZADO : URL_OPCIONES\);\s*router\.refresh\(\);/.test(codigo("src/components/invierte-v2/PerfilForm.tsx"))) F("11d · elegir, sumar, firmar o guardar el perfil no limpian el caché de navegación (Volver y «Mi inversión» reusan el desvío viejo)");
      if (!/purgarBorradoresYPestana\(\);\s*olvidarMenu\(\);/.test(header)) F("11d · al cerrar sesión no se olvida «Mi inversión»");

      // 11e · «← Mi inversión» arriba de las páginas de Invierte que no son la base (ni adonde /invierte lleva solo).
      if (!/\{miInversion && \(\s*<div className="iv2-mi-inversion">\s*<Link href=\{URL_INVIERTE\} className="iv2-mi-inversion-a" data-inv2="mi-inversion">← \{FLUJO_COPY\.miInversion\}<\/Link>/.test(marco)) F("11e · el marco no lleva «← Mi inversión» a /invierte");
      // El perfil la primera vez no lo lleva: la lámina 3.1 pone la franja justo bajo la cabecera, y /invierte lo mandaría a Partimos.
      if (!/invierte: true \}\} miInversion=\{!primeraVez\}/.test(perfilPag)) F("11e · el perfil no lleva «← Mi inversión» al editar (o lo lleva la primera vez)");
      for (const f of ["src/app/invierte/documentos/page.tsx", "src/app/invierte/preaprobacion/page.tsx", "src/app/invierte/perfil/actualizado/page.tsx", "src/app/invierte/[avisoId]/sumar/page.tsx"]) {
        if (!/invierte: true \}\} miInversion/.test(codigo(f))) F(`11e · ${f} no lleva «← Mi inversión»`);
      }
      for (const f of ["src/app/invierte/base/page.tsx", "src/app/invierte/opciones/page.tsx", "src/app/invierte/partimos/page.tsx"]) {
        if (/\bmiInversion\b/.test(codigo(f))) F(`11e · ${f} lleva «← Mi inversión» (es adonde /invierte lleva: daría vueltas)`);
      }

      // 11f · Los detalles abiertos desde Invierte: el modo solo con `?desde=invierte`, dueño y firma; qué es el depto, por su base.
      if (!abiertoDesdeInvierte({ desde: "invierte", esDueno: true, firmo: true }) || abiertoDesdeInvierte({ desde: "invierte", esDueno: false, firmo: true }) || abiertoDesdeInvierte({ desde: "invierte", esDueno: true, firmo: false }) || abiertoDesdeInvierte({ desde: null, esDueno: true, firmo: true }) || abiertoDesdeInvierte({ desde: "explorar", esDueno: true, firmo: true })) F("11f · el modo Invierte no exige el parámetro, ser dueño y la firma");
      if (urlDetallesInvierte("abc") !== "/analisis/abc?desde=invierte") F("11f · «Ver detalles» no dice que viene de Invierte");
      for (const f of ["src/components/invierte-v2/BotonDetalles.tsx", "src/components/invierte-v2/ResultadoOpciones.tsx"]) if (!/window\.location\.assign\(urlDetallesInvierte\(id\)\)/.test(codigo(f))) F(`11f · ${f} no abre los detalles en modo Invierte`);
      const ltr = codigo("src/app/analisis/[id]/informe-ltr.tsx");
      if (!/const modoInvierte = user && avisoInforme && abiertoDesdeInvierte\(\{ desde, esDueno: isOwner, firmo: firmoInvierte \}\)/.test(ltr)) F("11f · el informe activa el modo sin pasar por abiertoDesdeInvierte");
      if (!/invierte=\{modoInvierte \? null : invierte\}/.test(ltr) || !/\{modoInvierte && <BarraDetalles modo=\{modoInvierte\} \/>\}/.test(ltr) || !/\{modoInvierte && <AccionDetalles modo=\{modoInvierte\} \/>\}/.test(ltr)) F("11f · en modo Invierte no va la barra arriba y la acción abajo en vez de la franja");
      if (!/const desde = typeof searchParams\?\.desde === "string" \? searchParams\.desde : null;\s*return <InformeLtr id=\{params\.id\} desde=\{desde\} \/>;/.test(codigo("src/app/analisis/[id]/page.tsx"))) F("11f · la página del informe no le pasa de dónde viene");
      const mds = codigo("src/lib/invierte-v2/detalles-modo-servidor.ts");
      if (!/if \(v\.estado === "ya"\) return \{ cabeza, relacion: "suyo"/.test(mds) || !/if \(v\.estado !== "listo" \|\| !v\.alcanza \|\| v\.datos\?\.veredicto !== "COMPRAR" \|\| !v\.orden \|\| !v\.perfil\) return null;/.test(mds)) F("11f · «Te lo recomendamos» sin que dé Comprar y le alcance (o «Uno de tus deptos» sin estar en su base)");
      const det = codigo("src/components/invierte-v2/DetallesInvierte.tsx");
      if (!/modo\.relacion === "suyo"\s*\? <span className="iv2-det-chip iv2-det-chip-suyo"[^>]*>\{D\.chipSuyo\}<\/span>\s*: <span className="iv2-det-chip iv2-det-chip-reco"[^>]*>\{D\.chipRecomendado\}<\/span>/.test(det)) F("11f · el chip no dice qué es el depto para la persona");
      if (!/<SumarDepto avisoId=\{modo\.avisoId\} etiqueta=\{D\.seguir\} origen="base" variante="principal"/.test(det) || !/\{D\.estadoSuyo\}/.test(det) || !/href=\{urlWhatsapp\(modo\.whatsapp\)\}/.test(det)) F("11f · la acción no es «Seguir con este» (recomendación) o su estado y «Escribirle a Franco» (suyo)");
      if (DETALLES_COPY.chipSuyo !== "Uno de tus deptos" || DETALLES_COPY.chipRecomendado !== "Te lo recomendamos" || DETALLES_COPY.estadoSuyo !== "Ya sigues con este depto. Franco lo está gestionando." || DETALLES_COPY.escribirle !== "Escribirle a Franco" || DETALLES_COPY.seguir !== "Seguir con este") F("11f · los textos de los detalles no son los de la lámina");
      if (lineaRecomendado("a 4 cuadras del tuyo", "te pide $40.000 menos al mes") !== "Franco te lo recomienda: a 4 cuadras del tuyo y te pide $40.000 menos al mes.") F("11f · la línea de la recomendación no es la de la lámina");
      if (distanciaDelTuyo(420, "Ñuñoa") !== "a 4 cuadras del tuyo" || distanciaDelTuyo(90, null) !== "a 1 cuadra del tuyo" || distanciaDelTuyo(12300, "La Florida") !== "en La Florida, a 12 km del tuyo" || distanciaDelTuyo(800, "Ñuñoa", true) !== "en Ñuñoa, a 0,8 km del tuyo" || distanciaDelTuyo(1800, "Macul") !== "en Macul, a 1,8 km del tuyo") F("11f · la distancia no va en cuadras cerca y en comuna y km lejos (o en «Donde más convenga»)");
      if (Math.abs(metrosEntre({ lat: -33.45, lng: -70.6 }, { lat: -33.46, lng: -70.6 }) - 1112) > 5) F("11f · la distancia entre dos puntos está mal medida");
      const P0 = { objetivo: "arriendo" as const, preocupaciones: [] };
      if (indicadorContraElegido({ precioUF: 3180, flujoCLP: -45000 }, { precioUF: 3250, flujoCLP: -85000 }, P0)?.frase !== "te pide $40.000 menos al mes") F("11f · el indicador no dice lo que pide menos al mes");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): una ventaja cuenta solo si es relevante (5 % o más en precio): 160 de 3.250 (4,9 %) ya no; 170 sí.
      if (indicadorContraElegido({ precioUF: 3080, flujoCLP: -45000 }, { precioUF: 3250, flujoCLP: -85000 }, { objetivo: "plusvalia", preocupaciones: [] })?.frase !== "cuesta UF 170 menos" || indicadorContraElegido({ precioUF: 3090, flujoCLP: -90000 }, { precioUF: 3250, flujoCLP: -85000 }, { objetivo: "plusvalia", preocupaciones: [] }) !== null) F("11f · buscando plusvalía, el indicador no prefiere el precio (o cuenta una diferencia bajo el 5 %)");
      if (indicadorContraElegido({ precioUF: 3090, flujoCLP: -45000 }, { precioUF: 3250, flujoCLP: -85000 }, { objetivo: "plusvalia", preocupaciones: ["poner_plata"] })?.tipo !== "mes") F("11f · si le preocupa poner plata cada mes, el indicador no prefiere el mes");
      if (indicadorContraElegido({ precioUF: 3300, flujoCLP: -90000 }, { precioUF: 3250, flujoCLP: -85000 }, P0) !== null) F("11f · el indicador dice algo que no favorece a la alternativa");
      if (indicadorContraElegido({ precioUF: 3250, flujoCLP: 20000 }, { precioUF: 3250, flujoCLP: -30000 }, P0)?.frase !== "te deja $20.000 al mes" || indicadorContraElegido({ precioUF: 3250, flujoCLP: 60000 }, { precioUF: 3250, flujoCLP: 20000 }, P0)?.frase !== "te deja $40.000 más al mes") F("11f · el indicador no dice lo que deja al mes");

      // 11g · Ningún enlace al portal para quien firmó, en todos los modos (decisión de Fabrizio, 19-nov-2026). Censo: todo archivo
      // que lee `url` de scraped_properties pasa por sinEnlaceAlPortal, o está en la lista de los que solo leen la ficha (no la
      // muestran a una persona), con su razón.
      const SOLO_FICHA = new Map<string, string>([
        ["src/lib/guia/analizar-servidor.ts", "lee la ficha para chequearla; no devuelve el enlace a la pantalla"],
        ["src/lib/guia/semanal-servidor.ts", "lee la ficha para chequearla; el correo semanal enlaza a Franco"],
        ["src/lib/publicadores/publicadores-servidor.ts", "el panel interno de /admin/invierte"],
        ["src/lib/services/scraper/toctoc-unidades.ts", "el scraper de la noche"],
        ["src/lib/services/scraper/unidades-presupuesto.ts", "el scraper de la noche"],
        ["src/lib/services/market-suggestions.ts", "sugerencias del wizard: no trae avisos de Franco a una persona con orden"],
        ["src/lib/guia/publicacion-portada.ts", "la portada: el informe la descarta con sinEnlaceAlPortal"],
        ["src/lib/guia/seleccion-pagina-servidor.ts", "pasa por sinEnlaceAlPortal antes de publicacionesDeAvisos"],
        ["src/app/api/lo-que-sigue/quiero-verlo/route.ts", "pasa por sinEnlaceAlPortal antes de mandar el correo"],
      ]);
      const recorrer = (dir: string): string[] => readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? recorrer(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
      for (const f of recorrer("src")) {
        const c = codigo(f);
        if (!/from\(["']scraped_properties["']\)\s*\.select\("[^"]*\burl\b/.test(c) && !/\.select\("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, url,/.test(c)) continue;
        if (!SOLO_FICHA.has(f) && !/sinEnlaceAlPortal\(/.test(c)) F(`11g · ${f} lee el enlace de la publicación sin pasar por sinEnlaceAlPortal ni estar en la lista`);
      }
      if (!/const sinPortal = await sinEnlaceAlPortal\(createServiceClient\(\), user\?\.id\);\s*const publicacion = sinPortal \? null :/.test(ltr)) F("11g · el informe de renta larga muestra el enlace a quien firmó");
      if (!/const sinPortal = await sinEnlaceAlPortal\(createServiceClient\(\), user\?\.id\);\s*const publicacion = sinPortal \? null :/.test(codigo("src/app/analisis/renta-corta/[id]/informe-str.tsx"))) F("11g · el informe de renta corta muestra el enlace a quien firmó");
      if (!/\{esDueno && !invierte && !sinPortal && \(/.test(codigo("src/components/guia/InformeDeAviso.tsx"))) F("11g · «Mandármelo por correo» (el enlace por correo) se ofrece a quien firmó");
      for (const f of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) if (!/publicacion=\{publicacion\} sinPortal=\{sinPortal\} \/>/.test(codigo(f))) F(`11g · ${f} no le pasa sinPortal a InformeDeAviso`);
      if (!/publicacion = \(await sinEnlaceAlPortal\(admin, user\.id\)\) \? null : ficha\.url;/.test(codigo("src/app/api/semanal/analizar-str/route.ts"))) F("11g · el pop-up «no da» de renta corta muestra el enlace a quien firmó");
      if (!/sinEnlaceAlPortal\(admin, userId\)\.then\(\(sin\) => \(sin \? \(\{\} as Record<string, string>\) : publicacionesDeAvisos\(admin, noDan\)\)\)/.test(codigo("src/lib/guia/seleccion-pagina-servidor.ts"))) F("11g · la selección muestra el enlace a quien firmó");
      const qv = codigo("src/app/api/lo-que-sigue/quiero-verlo/route.ts");
      if (!/if \(await sinEnlaceAlPortal\(admin, user\.id\)\) return NextResponse\.json\(\{ error: "firmo" \}, \{ status: 403 \}\);/.test(qv) || qv.indexOf("sinEnlaceAlPortal(admin, user.id)") > qv.indexOf("interes_avisos")) F("11g · «Quiero verlo» le manda el enlace por correo a quien firmó");
      if (!/return \(await ultimaOrdenDe\(admin, userId\)\.catch\(\(\) => true\)\) != null;/.test(codigo("src/lib/invierte-v2/portal-servidor.ts"))) F("11g · la regla del portal no es «tiene una orden» (o ante un error muestra el enlace)");
    }

    // ── 12 · LÁMINAS DEL 19-nov-2026, ENTREGAS 2 Y 3: «¿Dónde buscamos?», las alternativas de la función con el tope de tres en
    //        todo el flujo, el resultado nuevo (el elegido en grande, las alternativas en corto, la tabla a pedido) y las fotos ──
    {
      // 12a · El tope de tres: cuentan las de Franco como opción y las que ya eligió; sumar una no rellena el cupo.
      if (MAX_RECOMENDADOS !== 3) F("12a · Franco recomienda más (o menos) de tres además del elegido");
      if (cuantasPedir(0) !== 3 || cuantasPedir(2) !== 1 || cuantasPedir(3) !== 0 || cuantasPedir(5) !== 0) F("12a · el cupo no es «tres menos las que ya cuentan»");
      if (cupoUsado([{ origen: "franco", estado: "opcion" }, { origen: "franco", estado: "elegido" }, { origen: "franco", estado: "descartado" }, { origen: "mapa", estado: "elegido" }, { origen: "entrada", estado: "elegido" }]) !== 2) F("12a · el cupo cuenta lo sumado desde el mapa, el de entrada o lo descartado (o no cuenta lo elegido)");
      const ps = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      const calc = ps.slice(ps.indexOf("export async function calcularOpciones"), ps.indexOf("// ── LA ELECCIÓN"));
      if (!/admin\.rpc\("invierte_alternativas", \{ p_aviso: p\.aviso, p_modo: p\.modo, p_tope: p\.tope, p_comunas: null, p_excluir: p\.excluir, p_max: p\.cuantas \}\)/.test(ps)) F("12a · las alternativas no salen de la función con «¿Dónde buscamos?», el tope, la exclusión y el cupo");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): las alternativas quedan fijas; se piden todas solo en la primera búsqueda tras guardar el perfil, y
      // después solo para reemplazar las que dejaron de valer (§14c).
      if (!/const cuantas = Math\.min\(cuantasPedir\(elegidasFranco\.length \+ opcionesValidas\.length\), buscarTodas \? MAX_RECOMENDADOS : descartar\.length\);/.test(calc) || !/modo: perfil\.donde, tope, excluir, cuantas/.test(calc)) F("12a · se piden alternativas sin descontar las que ya cuentan (las elegidas y las opciones vigentes)");
      if (!/if \(vale && elegidasFranco\.length \+ opcionesValidas\.length < MAX_RECOMENDADOS\) opcionesValidas\.push\(x\);\s*else descartar\.push\(x\.f\.aviso_id\);/.test(calc)) F("12a · una opción de más (o que dejó de valer) no se descarta");
      if (!/x\.e\.veredicto === "COMPRAR" && Number\(x\.e\.fila\.precio_uf\) <= tope \+ 0\.5 && esNivel\(x\.f\.datos\?\.nivel\)/.test(calc)) F("12a · se queda una opción que ya no conviene, no le alcanza o no salió de la función");
      if (!/\]\.filter\(\(x\): x is \{ o: OpcionDepto; nivel: NivelAlt \| null; dist: number \| null \} => !!x\.o\)\.slice\(0, MAX_RECOMENDADOS\);/.test(calc)) F("12a · el resultado puede mostrar más de tres de Franco");
      if (!/\.filter\(\(f\) => f\.estado === "elegido" \|\| f\.estado === "opcion"\)\.map\(\(f\) => f\.aviso_id\), \.\.\.\(avisoEntrada \? \[avisoEntrada\] : \[\]\)/.test(calc)) F("12a · la función puede devolver deptos que ya están en su base");
      if (!/if \(previo\) await admin\.from\(T_DEPTOS\)\.update\(\{ estado: "descartado", updated_at: [^}]*\}\)\.eq\("user_id", user\.id\)\.eq\("origen", "franco"\)\.eq\("estado", "opcion"\);/.test(ps)) F("12a · un perfil nuevo no descarta las opciones de Franco que no eligió");

      // 12b · «¿Dónde buscamos?» reemplaza a «Comunas»: Cerca de este (marcado), En toda la comuna, Donde más convenga.
      if (JSON.stringify(DONDES) !== '["cerca","comuna","convenga"]' || PERFIL_COPY.p1.donde !== "¿Dónde buscamos?" || PERFIL_COPY.p1.dondes.cerca !== "Cerca de este" || PERFIL_COPY.p1.dondes.comuna !== "En toda la comuna" || PERFIL_COPY.p1.dondes.convenga !== "Donde más convenga") F("12b · «¿Dónde buscamos?» no dice lo de la lámina");
      if (PERFIL_COPY.p1.dondeLinea("cerca", "Ñuñoa") !== "Cerca del depto que elegiste en Ñuñoa, y parecidos en tamaño.") F("12b · la línea de «Cerca de este» no es la de la lámina");
      const pf = codigo("src/components/invierte-v2/PerfilForm.tsx");
      if (!/<Chips opciones=\{DONDES\} etiquetas=\{P1\.dondes\}/.test(pf) || /data-inv2="comuna"/.test(pf) || !/comunas, donde, objetivo,/.test(pf)) F("12b · el perfil todavía pregunta las comunas, o no manda «¿Dónde buscamos?»");
      if (validarPerfil({ comunas: ["Ñuñoa"], donde: "convenga", objetivo: "arriendo", preocupaciones: [], preaprobado: "no", pieUF: 700, rentaCLP: 2000000 }).ok !== true || (validarPerfil({ comunas: ["Ñuñoa"], donde: "convenga", objetivo: "arriendo", preocupaciones: [], preaprobado: "no", pieUF: 700, rentaCLP: 2000000 }) as { pedido: { donde: string } }).pedido.donde !== "convenga") F("12b · «¿Dónde buscamos?» no llega al perfil guardado");
      if (!/comunas: pedido\.comunas, donde: pedido\.donde,/.test(ps)) F("12b · el perfil no guarda «¿Dónde buscamos?»");

      // 12c · Los textos del resultado dicen la verdad del nivel usado.
      if (A12.titulo(3, "cerca", "Ñuñoa") !== "Tu depto te alcanza. Y hay 3 parecidos cerca que también convienen." || A12.titulo(0, "solo_elegido", "Ñuñoa") !== "Tu depto te alcanza." || A12.titulo(1, "comuna", "Ñuñoa") !== "Tu depto te alcanza. Y hay 1 parecido en Ñuñoa que también conviene.") F("12c · el título del resultado no es el de la lámina (o no dice el nivel)");
      if (A12.subtitulo(3, "cerca", "cerca", "Ñuñoa") !== "Otros 3 parecidos, cerca del tuyo" || A12.subtitulo(2, "tres_km", "cerca", "Ñuñoa") !== "Otros 2 parecidos, un poco más lejos: a menos de 3 km del tuyo" || A12.subtitulo(2, "comuna", "cerca", "Ñuñoa") !== "Cerca del tuyo no hay otros que convengan; estos están en el resto de Ñuñoa" || A12.subtitulo(3, "perfil", "convenga", null) !== "Los que más convienen, parecidos al tuyo") F("12c · el subtítulo no dice la verdad del nivel usado");
      if (A12.soloElegido !== "Hoy no hay otros parecidos que convengan. Te avisamos si aparece uno.") F("12c · sin alternativas, la línea no es la del LEEME");
      if (nivelDelBloque(["cerca", "tres_km"]) !== "tres_km" || nivelDelBloque(["cerca", "comuna"]) !== "comuna" || nivelDelBloque([]) !== "solo_elegido" || nivelDelBloque([null]) !== "perfil" || nivelDelBloque(["perfil", "cerca"]) !== "perfil") F("12c · el nivel de un bloque mezclado no es el más lejano (o inventa uno)");
      if (lineaPrecioDistancia(3180, 420, "Ñuñoa", "cerca") !== "UF 3.180 · a 4 cuadras del tuyo" || lineaPrecioDistancia(3180, 12300, "La Florida", "convenga") !== "UF 3.180 · en La Florida, a 12 km del tuyo" || lineaPrecioDistancia(3180, 800, "Ñuñoa", "convenga") !== "UF 3.180 · en Ñuñoa, a 0,8 km del tuyo") F("12c · la distancia no va en cuadras cerca y en comuna y km en «Donde más convenga»");

      // 12d · El indicador único, por reglas y contra el suyo.
      const ele12 = { precioUF: 3250, flujoCLP: -85000, score: 78 };
      const grupo12 = [{ avisoId: "e", precioUF: 3250 }, { avisoId: "a", precioUF: 3180 }, { avisoId: "b", precioUF: 2940 }];
      const per = (o: Partial<{ objetivo: "arriendo" | "plusvalia" | "ambas"; preocupaciones: ("poner_plata" | "no_arriende")[]; limitaPie: boolean }>) => ({ objetivo: "arriendo" as const, preocupaciones: [], limitaPie: false, ...o });
      // ⚠ ACTA (19-nov-2026): el indicador dice además si supera al suyo (para el subtítulo «El tuyo es el mejor…»); se compara su texto.
      if (indicadorAlternativa({ avisoId: "a", precioUF: 3180, flujoCLP: -45000, score: 77 }, ele12, grupo12, per({}))?.texto !== "Te pide $40.000 menos al mes que el tuyo") F("12d · el indicador no dice lo que pide menos al mes, como la lámina");
      if (indicadorAlternativa({ avisoId: "b", precioUF: 2940, flujoCLP: -90000, score: 76 }, ele12, grupo12, per({ limitaPie: true }))?.texto !== "El pie más bajo: UF 588") F("12d · si el pie es lo que lo limita, el indicador no dice el pie más bajo, como la lámina");
      if (indicadorAlternativa({ avisoId: "b", precioUF: 3080, flujoCLP: -45000, score: 81 }, ele12, [{ avisoId: "b", precioUF: 3080 }, { avisoId: "c", precioUF: 3000 }], per({ objetivo: "plusvalia" })).texto !== "Cuesta UF 170 menos que el tuyo") F("12d · buscando plusvalía, el indicador no dice el precio, como la lámina");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): sin ventaja relevante, «Parecido al tuyo», sin una cifra que se lea como ventaja (antes, lo que dejaba al mes).
      { const n12 = indicadorAlternativa({ avisoId: "x", precioUF: 3300, flujoCLP: 20000, score: 70 }, { precioUF: 3250, flujoCLP: 90000, score: 80 }, [], per({}));
        if (n12.texto !== "Parecido al tuyo" || n12.supera !== false) F("12d · sin nada a favor, no dice algo neutro (o inventa una ventaja)"); }

      // 12e · La pantalla: un solo botón rojo, sin pestañas Lista/Comparar, la tabla en ventana, sin alternativas la línea.
      const res12 = codigo("src/components/invierte-v2/ResultadoOpciones.tsx");
      const ele = res12.slice(res12.indexOf("const alternativas = p.opciones.filter"));
      if ((ele.match(/className="[^"]*\binv-principal\b/g) ?? []).length !== 1) F("12e · la elección no tiene un solo botón principal");
      if (/vista-lista|vista-comparar|role="tablist"/.test(res12)) F("12e · todavía están las pestañas Lista/Comparar");
      if (!/\{comparando && \(\s*<VentanaDocumento nombre="comparar" titulo=\{A\.compararTitulo\(listaOpciones\.length\)\}/.test(ele) || !/onClick=\{\(\) => setComparando\(true\)\} aria-haspopup="dialog" data-inv2="comparar">\{A\.comparar\(listaOpciones\.length\)\}/.test(ele)) F("12e · la tabla no se abre a pedido, en ventana, desde «Comparar los N lado a lado»");
      if (!/\) : entrada \? \(\s*<p className="iv2-linea-chica iv2-res-solo" data-inv2="solo-elegido">\{A\.soloElegido\}<\/p>/.test(ele)) F("12e · sin alternativas no va solo el elegido con su línea");
      // ⚠ ACTA (19-nov-2026, Fabrizio): cuando ninguna alternativa supera al suyo, el subtítulo es «El tuyo es el mejor…» (§13e).
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): con niveles mezclados, el subtítulo dice cuántas hay de cada uno (subtituloAlternativas, §14d).
      if (!/data-inv2="subtitulo">\{ningunaSupera \? A\.tuyoMejor\(nivelDelBloque\(itemsNivel\.map\(\(x\) => x\.nivel\)\), entrada\?\.comuna \?\? null\) : subtituloAlternativas\(itemsNivel, p\.donde, entrada\?\.comuna \?\? null\)\}/.test(ele)) F("12e · el subtítulo no sale del nivel usado");
      // ⚠ ACTA (19-nov-2026): Fabrizio aprobó los textos de «Lo que ve Franco»; esta regla pasa a la §13 (que exige que esté y
      // cómo). Lo que queda acá: el resultado no escribe la lectura a mano, la toma de LoQueVeFranco.
      if (/Lo que ve Franco|LO QUE VE FRANCO/.test(res12)) F("12e · el resultado escribe «Lo que ve Franco» a mano en vez de usar LoQueVeFranco");
      const opPag = codigo("src/app/invierte/opciones/page.tsx");
      if (!/const fotos = await fotosDe\(createServiceClient\(\), r\.opciones\.map\(\(o\) => o\.avisoId\)\);/.test(opPag) || !/nivel=\{r\.nivel\} donde=\{r\.perfil\.donde\} distancias=\{r\.distancias\} niveles=\{r\.niveles\} fotos=\{fotos\}/.test(opPag)) F("12e · el resultado no recibe el nivel, la distancia y las fotos");

      // 12f · Las fotos, el texto y la dirección: del mismo 200 de la ficha, sin un GET extra; nunca con la dirección de la fuente.
      const img = (n: string) => `https://cdn.ejemplo.cl/fotos/${n}.jpg`;
      const datos12 = { props: { pageProps: { initialState: { property: { property: { data: { description: "  Depto luminoso.\r\nCon bodega.  ", address: { street: "  Av. Siempre Viva   742 " }, multimedia: { images: [img("a"), img("a"), "http://inseguro.cl/x.jpg", "https://cdn.ejemplo.cl/video.mp4", img("b"), ...Array.from({ length: 45 }, (_, k) => img(`n${k}`))] } } } } } } } };
      const html12 = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(datos12)}</script></html>`;
      const d12 = parsearDetalleFicha(html12);
      if (!d12 || d12.fotos[0] !== img("a") || d12.fotos[1] !== img("b") || d12.fotos.length !== MAX_FOTOS || d12.fotos.some((u) => !u.startsWith("https://") || !/\.jpg$/.test(u))) F("12f · las fotos no salen limpias (https, imágenes, sin repetir, como mucho 40)");
      if (d12?.descripcion !== "Depto luminoso.\nCon bodega." || d12?.direccion !== "Av. Siempre Viva 742") F("12f · el texto o la dirección no salen limpios");
      if (parsearDetalleFicha("<html>sin datos</html>") !== null || parsearDetalleFicha(null) !== null) F("12f · una página sin datos inventa un detalle");
      // leerFicha guarda el detalle del 200, con su puerta; una ficha «rara» no se guarda. Nota (mutación, 19-nov-2026): quitar el
      // `rara ?` es EQUIVALENTE hoy —una página sin los datos de la ficha tampoco trae el bloque que lee parsearDetalleFicha—; el
      // caso «rara» de abajo fija el resultado, no la línea.
      const guardados: { aviso: string; puerta: string; fotos: number }[] = [];
      const alm12 = {
        async publicacion() { return null; }, async lecturasUltimaHora() { return 0; }, async anotar() {}, async cerrar() {}, async guardarPublicacion() {}, async despublicar() {}, async alertarBloqueo() {}, async guardarPublicador() {},
        async guardarDetalle(aviso: string, d: { fotos: string[] }, puerta: string) { guardados.push({ aviso, puerta, fotos: d.fotos.length }); },
      };
      const htmlFicha = html12.replace("<html>", '<html><script>"initialState"</script>');
      const bajar12 = async () => ({ status: 200, location: null, html: htmlFicha });
      await leerFicha({ id: "av-1", url: "https://www.fuente.cl/venta/departamento/nunoa/o_1", edificio: "e" }, "relleno", alm12, bajar12);
      await leerFicha({ id: "av-2", url: "https://www.fuente.cl/venta/departamento/nunoa/o_2", edificio: "e" }, "clic", alm12, bajar12, new Date(), { puerta: "invierte" });
      await leerFicha({ id: "av-3", url: "https://www.fuente.cl/venta/departamento/nunoa/o_3", edificio: "e" }, "clic", alm12, async () => ({ status: 200, location: null, html: "<html>otra cosa</html>" }));
      if (JSON.stringify(guardados.map((g) => [g.aviso, g.puerta])) !== '[["av-1","relleno"],["av-2","invierte"]]' || guardados[0]?.fotos !== MAX_FOTOS) F("12f · la lectura no guarda el detalle con su puerta (o guarda el de una ficha «rara»)");
      if (!/leerFicha\(ficha, "clic", almacen, bajarFicha, new Date\(\), \{ tope: TOPE_CARRIL_POR_HORA, puerta: "invierte" \}\)/.test(codigo("src/lib/invierte-v2/carril-servidor.ts"))) F("12f · el carril no guarda el detalle como puerta de Invierte");
      if (!/from\("publicacion_detalle"\)\.upsert\(/.test(codigo("src/lib/guia/ficha-servidor.ts"))) F("12f · el detalle no se guarda en publicacion_detalle");
      const rel12 = leer("supabase/migrations/20261123_relleno_detalle_invierte.sql");
      if (!/from public\.inv_deptos d[\s\S]*?where d\.estado in \('opcion', 'elegido'\)[\s\S]*?publicacion_detalle pd where pd\.aviso_id = s\.id and pd\.leido_at > now\(\) - interval '7 days'/.test(rel12) || !/-1 as prio/.test(rel12)) F("12f · el SQL del relleno no pone primero los deptos de Invierte sin fotos");

      // 12g · Las fotos se ven solo con orden firmada, por la ruta propia; la página nunca lleva la dirección de la fuente.
      if (pedidoFoto("4f543801-000f-4d45-87b8-b245b4b014fb", "0")?.i !== 0 || pedidoFoto("x", "0") !== null || pedidoFoto("4f543801-000f-4d45-87b8-b245b4b014fb", String(MAX_FOTOS_VISTA)) !== null || pedidoFoto("4f543801-000f-4d45-87b8-b245b4b014fb", "-1") !== null) F("12g · la ruta de fotos acepta un pedido raro");
      if (!respuestaFotoValida("image/jpeg", 1000) || respuestaFotoValida("text/html", 10) || respuestaFotoValida("image/jpeg", 7 * 1024 * 1024)) F("12g · la ruta de fotos deja pasar algo que no es una imagen liviana");
      const ruta12 = codigo("src/app/api/invierte-v2/foto/route.ts");
      if (ruta12.indexOf("sinEnlaceAlPortal(admin, user.id)") < 0 || ruta12.indexOf("sinEnlaceAlPortal(admin, user.id)") > ruta12.indexOf('from("publicacion_detalle")') || !/if \(!user\) return NO_EXISTE\(\);/.test(ruta12)) F("12g · la ruta de fotos las entrega sin sesión o sin orden firmada");
      if (/NextResponse\.redirect|json\(\{[^}]*url/.test(ruta12)) F("12g · la ruta de fotos le pasa al navegador la dirección de la fuente");
      const fd = codigo("src/components/invierte-v2/FotosDepto.tsx");
      // ⚠ ACTA (20-nov-2026, prueba de Fabrizio del resultado): si una foto que no es la primera no carga, se salta a la siguiente; si no carga la primera, la tarjeta va sin foto.
      if (!/src=\{urlFoto\(avisoId, i\)\}/.test(fd) || !/if \(!n \|\| rota\) return null;/.test(fd) || !/onError=\{\(\) => \(i === 0 \? setRota\(true\) : ir\(1\)\)\}/.test(fd)) F("12g · las fotos no van por la ruta propia, o una tarjeta sin fotos deja un hueco");
      if (!/select\("aviso_id, fotos"\)/.test(codigo("src/lib/invierte-v2/fotos-servidor.ts")) || !/Math\.min\(\(f\.fotos \?\? \[\]\)\.length, MAX_FOTOS_VISTA\)/.test(codigo("src/lib/invierte-v2/fotos-servidor.ts"))) F("12g · a la pantalla llega algo más que cuántas fotos hay");
      // ⚠ ACTA (20-nov-2026, decisión de Fabrizio): las fotos de los detalles viven en DetallesCabezaCliente: llegan solas si la publicación se lee en segundo plano.
      if (!/<FotosDepto avisoId=\{avisoId\} n=\{fotos\} clase="iv2-det-fotos" \/>/.test(codigo("src/components/invierte-v2/DetallesCabezaCliente.tsx")) || !/<DetallesCabezaCliente avisoId=\{c\.avisoId\} fotos=\{c\.fotos\} lectura=\{c\.lectura\}>/.test(codigo("src/components/invierte-v2/DetallesInvierte.tsx")) || !/\{modoInvierte && <CabezaDeDetalles modo=\{modoInvierte\} \/>\}/.test(codigo("src/app/analisis/[id]/informe-ltr.tsx"))) F("12g · los detalles desde Invierte no llevan las fotos arriba del informe");
    // ── 14 · PRUEBA DE FABRIZIO EN EL PREVIEW (20-nov-2026): las fotos y la lectura llegan al resultado; el pie lo escribe la
    //        persona; ventajas solo relevantes; «Sumar»; alternativas fijas; el subtítulo con niveles mezclados; la comuna solo
    //        si es otra ──
    {
      // 14a · La publicación se lee al firmar (el elegido) y al mostrarse el resultado (los que no la tienen), y la tarjeta se completa sola.
      const fir14 = codigo("src/app/api/invierte-v2/firma/route.ts");
      if (!/if \(!r\.yaFirmada\) \{[\s\S]*?waitUntil\(\(async \(\) => \{\s*await chequearPublicacionInvierte\(admin, \{ avisoId, userId: user\.id, origen: "firma" \}\)[^;]*;\s*if \(process\.env\.ANTHROPIC_API_KEY\) await lecturaDe\(admin, new Anthropic\(\), avisoId\)/.test(fir14)) F("14a · al firmar no se lee la publicación del elegido ni se escribe su lectura en segundo plano");
      const srv14 = codigo("src/lib/invierte-v2/lectura-franco-servidor.ts");
      const iMarca = srv14.indexOf('estado: "generando", version: VERSION_LECTURA'), iLeer = srv14.indexOf("if (!det && leerSiFalta) await leerSiFalta()"), iEntrada = srv14.indexOf("const e = await entradaDe(admin, avisoId);");
      if (iMarca < 0 || iLeer < 0 || iEntrada < 0 || !(iMarca < iLeer && iLeer < iEntrada)) F("14a · la lectura no lee la publicación que falta (o la lee antes de marcar «generando» y dos pantallas la leerían dos veces)");
      const lq14 = codigo("src/components/invierte-v2/LoQueVeFranco.tsx");
      if (INTENTOS_LECTURA < 15 || !/if \(r\.status !== 202\) return \{ lectura: null, fotos \};/.test(lq14) || !/if \(x\.fotos != null\) alFotos\?\.\(x\.fotos\);/.test(lq14)) F("14a · la tarjeta no sigue preguntando hasta que llega la lectura, o no avisa las fotos");
      const res14 = codigo("src/components/invierte-v2/ResultadoOpciones.tsx");
      if (!/const \[fotos, setFotos\] = useState<Record<string, number>>\(p\.fotos\);/.test(res14) || !/n=\{fotos\[entrada\.avisoId\] \?\? 0\}/.test(res14) || !/alFotos=\{conFotos\(entrada\.avisoId\)\}/.test(res14)) F("14a · las fotos del resultado no aparecen solas cuando llegan");

      // 14b · El pie lo escribe la persona: el tope nunca sale del precio del depto elegido (decisión de Fabrizio, 20-nov-2026).
      const ps14 = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/pieSugeridoUF: guardado\?\.pieUF \?\? null, pieAyudaUF: ayudaPie\(persona\?\.pie \?\? null, entrada\?\.precioUF \?\? null\)/.test(ps14) || (ps14.match(/ayudaPie\(/g) ?? []).length !== 1) F("14b · el pie se llena con el precio del depto elegido (el tope saldría de su precio)");
      const pf14 = codigo("src/components/invierte-v2/PerfilForm.tsx");
      if (!/const \[pie, setPie\] = useState\(inicial\.pieSugeridoUF != null \? conPuntos\(String\(Math\.round\(inicial\.pieSugeridoUF\)\)\) : ""\);/.test(pf14) || /pieAyudaUF[^\n]*setPie|setPie\([^)]*pieAyudaUF/.test(pf14)) F("14b · el formulario llena el pie con la ayuda");
      // ⚠ ACTA (20-nov-2026): la ayuda se dibuja con sinCortar, para que «(20 %)» no se corte (§14g).
      if (!/\{inicial\.pieAyudaUF != null && <p className="iv2-linea-chica" data-inv2="pie-ayuda">\{sinCortar\(P2\.pieAyuda\(fmtUF\(inicial\.pieAyudaUF\)\)\)\}<\/p>\}/.test(pf14) || !/data-inv2="pie-no-se"/.test(pf14)) F("14b · bajo el pie no va la ayuda o falta «Todavía no sé»");
      if (PERFIL_COPY.p2.pieAyuda("220") !== "Para el depto que elegiste necesitas UF 220 (20 %)." || PERFIL_COPY.p2.pieNoSe !== "Todavía no sé") F("14b · los textos del pie no son los de Fabrizio");
      // Con un depto de UF 1.100, renta de $3.000.000 y el pie escrito (o «Todavía no sé»), el tope no puede ser el precio del depto.
      const m14 = { tasaPct: 4.1, uf: 39000 };
      const credito14 = creditoPorRenta(3000000, 0, 4.1, 39000);
      const noSe = hastaCuanto({ preaprobado: "no", pieNoSabe: true, rentaCLP: 3000000, otrasCuotasCLP: 0, ...m14 });
      if (!cerca(noSe.topeUF, credito14 / 0.8, 0.02) || noSe.limita !== "credito" || noSe.supuestos.pieNoSabe !== true || cerca(noSe.topeUF, 1100, 1)) F("14b · «Todavía no sé» no calcula por la renta con un pie de 20 %");
      if (validarPerfil({ comunas: ["Ñuñoa"], donde: "cerca", objetivo: "arriendo", preocupaciones: [], preaprobado: "no", rentaCLP: 3000000 }).ok) F("14b · se acepta un perfil sin pie y sin «Todavía no sé» (el pie es obligatorio)");
      if (validarPerfil({ comunas: ["Ñuñoa"], donde: "cerca", objetivo: "arriendo", preocupaciones: [], preaprobado: "no", pieNoSabe: true, noDiceRenta: true }).ok) F("14b · «Todavía no sé» sin renta se acepta (no hay con qué estimar)");
      { const v14 = validarPerfil({ comunas: ["Ñuñoa"], donde: "cerca", objetivo: "arriendo", preocupaciones: [], preaprobado: "no", pieNoSabe: true, pieUF: 220, rentaCLP: 3000000 });
        if (!v14.ok || v14.pedido.pieUF !== null || v14.pedido.pieNoSabe !== true) F("14b · con «Todavía no sé» se guarda igual un pie"); }
      // La línea de hasta cuánto, según qué limita.
      if (lineaTope({ topeUF: 1100, fuente: "renta", limita: "pie", pieUF: 220, creditoUF: 3752 }, fmtUF) !== "Con tu pie de UF 220 puedes comprar hasta UF 1.100. Por tu renta, el banco podría prestarte hasta UF 3.752: con más pie te alcanzan deptos más grandes.") F("14b · cuando limita el pie, la línea no lo dice como Fabrizio");
      if (lineaTope({ topeUF: 4690, fuente: "renta", limita: "credito", pieNoSabe: true, creditoUF: 3752 }, fmtUF) !== "Por tu renta, el banco podría prestarte hasta UF 3.752. Con un pie de 20 % podrías comprar hasta UF 4.690. Dinos tu pie para afinarlo.") F("14b · con «Todavía no sé», la línea no es la de Fabrizio");
      if (!/^Con tu pie y tu renta, estimamos/.test(lineaTope({ topeUF: 3000, fuente: "renta", limita: "credito", pieUF: 900, creditoUF: 2100 }, fmtUF))) F("14b · cuando limita la renta, la línea cambió");

      // 14c · Las alternativas quedan fijas desde que se muestran: solo se piden todas tras guardar el perfil.
      if (!/const buscarTodas = perfil\.topeSupuestos\?\.buscarAlternativas === true \|\| !previos\.some\(\(f\) => f\.origen === "franco"\);/.test(ps14)) F("14c · el resultado vuelve a buscar alternativas en cada visita");
      if (!/buscarAlternativas: true \};/.test(ps14) || !/tope_supuestos: \{ \.\.\.perfil\.topeSupuestos, buscarAlternativas: false \}/.test(ps14)) F("14c · guardar el perfil no pide una búsqueda nueva, o la lista no queda fija después de la primera");

      // 14d · El subtítulo con niveles mezclados y la comuna solo si es otra.
      if (subtituloAlternativas([{ nivel: "cerca", distanciaM: 420 }, { nivel: "cerca", distanciaM: 690 }, { nivel: "tres_km", distanciaM: 1800 }], "cerca", "Ñuñoa") !== "Otros 3 parecidos: 2 cerca del tuyo y 1 a 1,8 km.") F("14d · con niveles mezclados el subtítulo no dice cuántos de cada uno");
      if (subtituloAlternativas([{ nivel: "cerca", distanciaM: 420 }, { nivel: "cerca", distanciaM: 690 }], "cerca", "Ñuñoa") !== "Otros 2 parecidos, cerca del tuyo") F("14d · con un solo nivel el subtítulo cambió");
      if (nivelDelTitulo([{ nivel: "cerca" }, { nivel: "tres_km" }]) !== "perfil" || A12.titulo(3, nivelDelTitulo([{ nivel: "cerca" }, { nivel: "tres_km" }, { nivel: "cerca" }]), "Ñuñoa") !== "Tu depto te alcanza. Y hay 3 parecidos que también convienen.") F("14d · con niveles mezclados el título nombra un lugar que no es de todas");
      if (lineaPrecioDistancia(3180, 1800, "Ñuñoa", "cerca", "Ñuñoa") !== "UF 3.180 · a 1,8 km del tuyo" || lineaPrecioDistancia(3180, 1800, "Macul", "cerca", "Ñuñoa") !== "UF 3.180 · en Macul, a 1,8 km del tuyo") F("14d · la línea nombra la comuna cuando es la misma (o no la nombra cuando es otra)");
      if (!/alt\.comuna && alt\.comuna !== ele\.comuna \? alt\.comuna : null/.test(codigo("src/lib/invierte-v2/detalles-modo-servidor.ts"))) F("14d · los detalles nombran la comuna cuando es la misma");
      if (A12.tuyoMejor("tres_km", null) !== "El tuyo es el mejor de los parecidos que hay a menos de 3 km. Estos te sirven de respaldo si no se da.") F("14d · el respaldo con alternativas a menos de 3 km dice «cerca»");

      // 14e · Solo ventajas relevantes: 5 % o más en precio o pie, o $20.000 o más al mes; si no, algo neutro. «Sumar».
      if (UMBRAL_MES_CLP !== 20000 || UMBRAL_PRECIO_PCT !== 5) F("14e · los umbrales de ventaja no son los de Fabrizio ($20.000 al mes, 5 %)");
      const ele14 = { precioUF: 1100, flujoCLP: 80506, score: 88 };
      const g14 = [{ avisoId: "e", precioUF: 1100 }, { avisoId: "x", precioUF: 1065 }];
      const caso14 = indicadorAlternativa({ avisoId: "x", precioUF: 1065, flujoCLP: 55000, score: 80 }, ele14, g14, per({ limitaPie: true }));
      if (caso14.supera || caso14.texto !== "Parecido al tuyo") F("14e · el caso de Fabrizio (pie UF 213 contra 220, $55.000 contra $80.506) se muestra como ventaja");
      if (indicadorAlternativa({ avisoId: "x", precioUF: 1000, flujoCLP: 55000, score: 80 }, ele14, [{ avisoId: "e", precioUF: 1100 }, { avisoId: "x", precioUF: 1000 }], per({ limitaPie: true })).texto !== "El pie más bajo: UF 200") F("14e · un pie 9 % más bajo no cuenta como ventaja");
      if (indicadorAlternativa({ avisoId: "x", precioUF: 1100, flujoCLP: 100600, score: 80 }, ele14, [], per({})).texto !== "Te deja $20.000 más al mes que el tuyo" || indicadorAlternativa({ avisoId: "x", precioUF: 1100, flujoCLP: 99000, score: 80 }, ele14, [], per({})).supera) F("14e · el mes no cuenta desde $20.000 (o cuenta menos)");
      if (!/className=\{ind\.supera \? "iv2-res-indicador" : "iv2-linea-chica iv2-res-neutro"\}/.test(res14)) F("14e · lo neutro se ve como una ventaja (en azul)");
      if (A12.sumar !== "Sumar" || !/data-inv2="check" \/>\s*\{A\.sumar\}/.test(res14) || !/\{entrada\.alcanza \? A\.sigo : "Fuera de tu alcance hoy"\}/.test(res14)) F("14e · la casilla de las alternativas no dice «Sumar» (o el elegido dejó de decir «Sigo con este»)");
    }

    // 14g · El «%» no queda solo en la línea siguiente (20-nov-2026: «(20 %)» se cortaba a 360 px): la ayuda del pie y la línea
    // del tope se dibujan con sinCortar; el texto y lo que fija el tier no cambian.
    if (sinCortar("UF 540 (20 %).") !== "UF 540 (20 %)." || !/\{sinCortar\(P2\.pieAyuda\(fmtUF\(inicial\.pieAyudaUF\)\)\)\}/.test(codigo("src/components/invierte-v2/PerfilForm.tsx")) || !/\{sinCortar\(lineaTope\(p\.tope, fmtUF\)\)\}/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx"))) F("14g · el «%» de la ayuda del pie o de la línea del tope puede quedar solo en otra línea");
    if (!/\.iv2-campo-uf \.inv-campo:disabled \{ opacity: 0\.5;/.test(leer("src/components/invierte-v2/invierte-v2.css"))) F("14g · el pie con «Todavía no sé» se ve como un campo vacío por llenar, no apagado");

    // 14f · «Tus deptos» en la base (20-nov-2026, decisión de Fabrizio): la tarjeta entera se toca y abre los detalles, con una
    // flecha a la derecha en vez del enlace «Abrir». Por ahora lleva a los detalles. «Escribirle a Franco» se queda como está.
    {
      const vb = codigo("src/components/invierte-v2/VistaBase.tsx");
      const bd = codigo("src/components/invierte-v2/BotonDetalles.tsx");
      const tarjeta = bd.slice(bd.indexOf("export function TarjetaDetalles"), bd.indexOf("export function PrepararDetalles"));
      const dentro = vb.slice(vb.indexOf("<TarjetaDetalles"), vb.indexOf("</TarjetaDetalles>"));
      if (!/<li key=\{d\.avisoId\} className="iv2-depto-li" data-inv2="depto-base">\s*(?:\{\}\s*)?<TarjetaDetalles avisoId=\{d\.avisoId\} etiqueta=\{B\.abrirDepto\(lineaDepto\(d\.datos\)\)\}>/.test(vb) || /<BotonDetalles/.test(vb) || /B\.abrir\}/.test(vb)) F("14f · la tarjeta de «Tus deptos» no se toca entera (o sigue el enlace «Abrir»)");
      if (!dentro || /<(p|div|a|button)[\s>]/.test(dentro)) F("14f · dentro de la tarjeta hay un bloque o un control (un botón solo admite texto en línea)");
      if (!/<button type="button" className="iv2-depto iv2-depto-tocable" onClick=\{abrir\} disabled=\{estado === "abriendo"\} aria-label=\{etiqueta\}/.test(tarjeta)
        || !/<span className="iv2-depto-cuerpo">\{children\}<\/span>\s*<span className="iv2-depto-flecha" aria-hidden="true">›<\/span>\s*<\/button>/.test(tarjeta)
        || !/const id = await abrirDetalles\(avisoId\);\s*if \(id\) \{ window\.location\.assign\(urlDetallesInvierte\(id\)\); return; \}\s*setEstado\("error"\);/.test(tarjeta)) F("14f · la tarjeta no abre los detalles en modo Invierte, o no lleva la flecha a la derecha");
      if (BASE_COPY.abrirDepto("2D · 1B · 52 m²") !== "Abrir 2D · 1B · 52 m²") F("14f · el lector de pantalla no dice qué depto abre");
      const css14 = leer("src/components/invierte-v2/invierte-v2.css");
      if (!/\.iv2-depto-tocable \{[^}]*flex-direction: row;[^}]*min-height: 44px;/.test(css14) || !/\.iv2-depto-cuerpo \.iv2-depto-t, \.iv2-depto-cuerpo \.iv2-depto-s, \.iv2-depto-cuerpo \.iv2-cambio, \.iv2-depto-cuerpo \.iv2-cambio-sub \{ display: block; \}/.test(css14)) F("14f · la tarjeta no pone la flecha a la derecha, no llega a 44 px o sus filas no van en bloque");
      if (!/data-inv2="escribirle"><IconoWhatsapp \/>\{B\.escribirle\}<\/a>/.test(vb)) F("14f · «Escribirle a Franco» cambió (se rediseña con el flujo de cada depto)");
    }

    // ── 15 · LA PRUEBA DEL RESULTADO DE FABRIZIO (20-nov-2026, preview) ─────────────────────────────────────────────────────────
    {
      // 15a · La lectura recibe TODAS las fotos de la publicación, hasta 24 (antes 8: decía que faltaban fotos que sí estaban), y la
      // persona ve las mismas en las flechas. La versión sube para que las de antes se rehagan.
      if (MAX_FOTOS_LECTURA15 !== 24 || VERSION_LECTURA15 < 5 || MAX_FOTOS_VISTA !== MAX_FOTOS_LECTURA15) F("15a · la lectura no recibe hasta 24 fotos, la versión no subió o la persona no ve las mismas fotos que lee Franco");
      const n = (k: number) => Array.from({ length: k }, (_, i) => `https://x/${i}.jpg`);
      if (!fotosCompletas15(n(24)) || fotosCompletas15(n(25)) || !fotosCompletas15(n(1))) F("15a · «recibió todas las fotos» no es «la publicación tiene 24 o menos»");
      const ia15 = codigo("src/lib/invierte-v2/lectura-franco-ia.ts");
      if (!/const fotos = e\.fotos\.slice\(0, MAX_FOTOS_LECTURA\);\s*const completas = fotosCompletas\(e\.fotos\);/.test(ia15) || !/son TODAS sus fotos/.test(ia15) || !/la publicación tiene más, así que no digas que falta una foto de algo ni pidas fotos/.test(ia15)) F("15a · el mensaje al modelo no le dice si recibió todas las fotos");

      // 15b · Solo puede decir que no hay fotos de algo si las recibió todas: si no, el saneado saca esas líneas y la alerta por eso.
      for (const t of ["Pide fotos del baño antes de ofertar.", "No hay fotos del baño ni de la cocina.", "Faltan fotos del living.", "Las fotos no muestran los baños: pídelas antes de ofertar."]) if (!afirmaFaltanFotos15(t)) F(`15b · no reconoce que «${t}» dice que faltan fotos`);
      for (const t of ["En las fotos se ve la cocina renovada.", "Dos dormitorios y un baño, con metro a pie.", "La publicación dice estudio, pero nuestros datos lo cuentan como de un dormitorio."]) if (afirmaFaltanFotos15(t)) F(`15b · toma «${t}» como si dijera que faltan fotos`);
      const crudo = { alerta: { nivel: "revisar", motivo: "No hay fotos del baño." }, larga: [{ etiqueta: "Ojo", texto: "Pide fotos del baño antes de ofertar.", fuente: "fotos" }, { etiqueta: "Estado", texto: "Cocina renovada.", fuente: "fotos" }], corta: [{ texto: "No hay fotos del baño.", fuente: "fotos" }, { texto: "Cocina renovada.", fuente: "fotos" }] };
      const sinTodas = sanearLectura(crudo, { fotosCompletas: false });
      const conTodas = sanearLectura(crudo, { fotosCompletas: true });
      if (!sinTodas || sinTodas.alerta.nivel !== "ninguna" || sinTodas.larga.some((x) => x.etiqueta === "Ojo") || sinTodas.corta.join("|") !== "Cocina renovada.") F("15b · sin todas las fotos, la lectura igual dice que faltan fotos (o lo deja como alerta)");
      if (!conTodas || !conTodas.larga.some((x) => x.texto === "Pide fotos del baño antes de ofertar.")) F("15b · con todas las fotos, el pedido de fotos no pasa");

      // 15c · Que falten fotos deja de ser alerta: va como línea normal, en forma de pedido. «Revisar», solo datos que se contradicen.
      if (!/Que falten fotos de algo \(el baño, la cocina, un dormitorio\) NUNCA es alerta/.test(I15) || !/«Pide fotos del baño antes de ofertar\.»/.test(I15) || !/Solo puedes decir que no hay fotos de algo, o pedir fotos, si recibiste todas las fotos de la publicación/.test(I15)) F("15c · la instrucción no dice que faltar fotos no es alerta, que va como pedido, o que solo se afirma con todas las fotos");

      // 15d · Una lectura guardada se relee entera: la corta se guarda como texto y el saneado la perdía (el resultado mostraba solo
      // la alerta). Sanear dos veces da lo mismo.
      const una = sanearLectura({ alerta: { nivel: "ninguna", motivo: null }, larga: [{ etiqueta: "Estado", texto: "Bien.", fuente: "fotos" }], corta: [{ texto: "A.", fuente: "fotos" }, { texto: "B.", fuente: "datos" }, { texto: "C.", fuente: "datos" }] });
      if (!una || JSON.stringify(sanearLectura(una)) !== JSON.stringify(una)) F("15d · al releer una lectura guardada se pierde la versión corta");

      // 15e · El elegido: UN bloque «Lo que ve Franco» con tres líneas; si hay alerta, es la primera, con su chip. Una alternativa: una
      // sola línea, la alerta si existe; si no, la primera de la corta.
      const conAlerta = { alerta: { nivel: "revisar" as const, motivo: "La publicación dice estudio." }, larga: [], corta: ["La publicación dice estudio.", "B.", "C.", "D."] };
      const sinAlerta = { alerta: { nivel: "ninguna" as const, motivo: null }, larga: [], corta: ["A.", "B.", "C."] };
      if (lineasElegido(conAlerta).join("|") !== "La publicación dice estudio.|B.|C." || lineasElegido(sinAlerta).join("|") !== "A.|B.|C.") F("15e · el elegido no muestra tres líneas con la alerta primero");
      if (lineaAlternativa(conAlerta) !== "La publicación dice estudio." || lineaAlternativa(sinAlerta) !== "A.") F("15e · la línea de una alternativa no es la alerta o la primera de la corta");
      const lq15 = codigo("src/components/invierte-v2/LoQueVeFranco.tsx");
      if (!/if \(variante === "elegido"\) return <Caja l=\{l\} variante="elegido" lineas=\{lineasElegido\(l\)\} \/>;/.test(lq15) || !/if \(variante === "linea"\) \{ const t = lineaAlternativa\(l\); return t \? <Caja l=\{l\} variante="linea" lineas=\{\[t\]\} \/> : null; \}/.test(lq15)) F("15e · el elegido o las alternativas no usan sus líneas");
      if (!/<span className="iv2-lectura-rotulo">\{L\.rotulo\}<\/span>\s*\{alerta && <span className="iv2-lectura-chip" data-inv2="lectura-chip">\{L\.alertaNivel\[alerta\]\}<\/span>\}/.test(lq15) || !/data-alerta=\{alerta \?\? undefined\}/.test(lq15)) F("15e · el recuadro no lleva la etiqueta y, con alerta, su chip y su color");
      if (LECTURA_COPY.alertaNivel.revisar !== "Revisar" || LECTURA_COPY.alertaNivel.grave !== "Grave") F("15e · el chip no dice «Revisar» o «Grave»");

      // 15f · El recuadro: azul claro (el de las tarjetas que explican), ciruela claro con alerta, nunca rojo; el texto oscuro; en una
      // alternativa, dos renglones como máximo.
      const css15 = leer("src/components/invierte-v2/invierte-v2.css");
      const reglas = css15.split("\n").filter((x) => /iv2-lectura-(caja|linea|chip|cab|lineas|rotulo)/.test(x)).join("\n");
      if (!/\[data-theme="light"\] \.iv2-lectura-caja \{ background: #EEF2F8; \}/.test(css15) || !/\[data-theme="light"\] \.iv2-lectura-caja\[data-alerta\] \{ background: #F3EDF1; \}/.test(css15) || /#C8323C|#E05A63|signal-red/i.test(reglas)) F("15f · el recuadro no es azul claro, o con alerta no es ciruela claro (o usa rojo)");
      if (!/\.iv2-lectura-linea \.iv2-lectura-lineas \{ display: -webkit-box; -webkit-line-clamp: 2;/.test(css15) || !/\.iv2-lectura-lineas \{[^}]*color: var\(--franco-text\);/.test(css15) || /\.iv2-lectura-linea \{[^}]*color:/.test(css15)) F("15f · la línea de una alternativa no va en color oscuro o pasa de dos renglones");

      // 15g · Las fotos de las alternativas: recortadas para llenar el recuadro sin deformarse, con flechas, contador y puntos.
      const fd15 = codigo("src/components/invierte-v2/FotosDepto.tsx");
      if (!/\.iv2-fotos img \{ display: block; width: 100%; height: 100%; object-fit: cover; \}/.test(css15) || /!chica && n > 1/.test(fd15) || !/\{n > 1 && \(/.test(fd15) || !/\.iv2-fotos-chica \.iv2-foto-flecha \{/.test(css15)) F("15g · la foto de una alternativa se deforma o no lleva flechas, contador y puntos");

      // 15h · El resultado cabe en un notebook bajo: en las pantallas de 820 px o menos de alto se aprietan los espacios y la foto de
      // las alternativas baja. (Qué sale si aun así no cabe a 1.210 × 615 lo decide Fabrizio.)
      const bajo = css15.slice(css15.indexOf("@media (min-width: 1024px) and (max-height: 820px)"));
      if (!/\.iv2-res-nuevo \.iv2-fotos-chica \{ height: 64px; \}/.test(bajo) || !/\.iv2-res-nuevo \.iv2-res-elegido \.iv2-fotos \{ height: auto; min-height: 170px; align-self: stretch; \}/.test(bajo) || !/\.iv2-resultado-eleccion\.iv2-res-nuevo \{ padding-top: 14px; \}/.test(bajo)) F("15h · en un notebook bajo el resultado no aprieta los espacios ni baja la foto de las alternativas");
    }

    // ── 13 · LÁMINAS DEL 19-nov-2026, ENTREGA 4: «Lo que ve Franco» (textos aprobados por Fabrizio el 19-nov-2026) y «Lo que el
    //        puntaje no considera»; una alternativa grave no se recomienda; «El tuyo es el mejor…» ──
    {
      // 13a · La lectura no cita ni juzga el precio: la instrucción lo prohíbe y el saneado saca la línea que se salga.
      const I13 = INSTRUCCION_LECTURA_FRANCO;
      if (!/Nunca cites ni juzgues el precio/.test(I13) || !/Nunca cites una cifra del informe/.test(I13) || /precio_m2_vs_zona|−25 %|-25 %/.test(I13)) F("13a · la instrucción permite citar o juzgar el precio, o le pasa el porcentaje contra la zona");
      // ⚠ ACTA (20-nov-2026, prueba de Fabrizio del resultado): «revisar» queda SOLO para datos que se contradicen; que falten fotos ya no es alerta (va como pedido, §15c).
      if (!/nivel «grave»: la publicación o las fotos muestran que es para remodelar o está sin terminar, que es un remate, que se venden derechos o acciones, o —solo si recibiste todas las fotos— no hay ninguna foto del interior/.test(I13) || !/nivel «revisar»: SOLO cuando los datos se contradicen: las fotos o el texto contradicen un dato con que se calculó el informe —los dormitorios, los baños, la superficie o el piso/.test(I13) || /faltan fotos de partes clave/.test(I13) || !/Se decide SOLO con lo que muestran las fotos o dice el texto de la publicación, nunca por el precio/.test(I13)) F("13a · la alerta no es la de Fabrizio (grave, revisar y ninguna, solo con evidencia)");
      if (!/La publicación no explica su precio: pregúntalo/.test(I13)) F("13a · «Ojo» no tiene la pregunta sin número del precio");
      for (const malo of ["Cuesta cerca de la mitad que su zona.", "Está un 34 % bajo su zona.", "A 300 m del metro.", "Precio de UF 2.700, conveniente.", "Gastos comunes de $80.000.", "Más barato que sus parecidos.", "Tiene un buen precio para la comuna.", "Subió un 20 % desde marzo."]) if (lineaPermitida(malo)) F(`13a · el saneado deja pasar «${malo}»`);
      for (const bueno of ["La publicación no explica su precio: pregúntalo.", "El tercer dormitorio mide 6,6 m², más de escritorio que de dormitorio.", "Según la publicación, el edificio es de 2012.", "Tiene metro cerca, a pie."]) if (!lineaPermitida(bueno)) F(`13a · el saneado saca «${bueno}», que está permitido`);
      const s13 = sanearLectura({ alerta: { nivel: "grave", motivo: "Según la publicación, es para remodelar y no hay fotos del interior." }, larga: [{ etiqueta: "Ojo", texto: "Pide fotos del interior." }, { etiqueta: "Estado", texto: "Según la publicación, es para remodelar." }, { etiqueta: "Estado", texto: "Repetida." }, { etiqueta: "Precio", texto: "Inventada." }, { etiqueta: "Ubicación", texto: "Está 40 % bajo su zona." }], corta: [{ texto: "Es para remodelar." }, { texto: "Cuesta la mitad que su zona." }, { texto: "Pide fotos." }, { texto: "Cuarta." }] });
      if (!s13 || s13.alerta.nivel !== "grave" || s13.larga.map((l) => l.etiqueta).join("|") !== "Estado|Ojo" || s13.corta.join("|") !== "Es para remodelar.|Pide fotos.|Cuarta.") F("13a · el saneado no ordena, no deduplica o deja pasar etiquetas inventadas o líneas con el precio");
      if (sanearLectura({ alerta: { nivel: "ninguna", motivo: "algo" }, larga: [{ etiqueta: "Estado", texto: "Bien." }], corta: [] })?.alerta.motivo !== null) F("13a · con alerta «ninguna» queda un motivo");
      if (sanearLectura({ alerta: { nivel: "revisar", motivo: "Cuesta 30 % menos que su zona." }, larga: [{ etiqueta: "Estado", texto: "Bien." }], corta: [] })?.alerta.motivo !== null) F("13a · una alerta que se sostiene en el precio se muestra");
      if (JSON.stringify(ESQUEMA_LECTURA_FRANCO.properties.alerta.properties.motivo) !== '{"anyOf":[{"type":"string"},{"type":"null"}]}') F("13a · el motivo de la alerta no va con anyOf (la API rechaza `type: [x, \"null\"]` con enum)");
      const ia13 = codigo("src/lib/invierte-v2/lectura-franco-ia.ts");
      // ⚠ ACTA (20-nov-2026, prueba de Fabrizio del resultado): el saneado sabe si la lectura recibió todas las fotos (§15b).
      if (!/model: CLAUDE_MODEL_LECTURA,/.test(ia13) || !/system: INSTRUCCION_LECTURA_FRANCO,/.test(ia13) || !/const lectura = sanearLectura\(JSON\.parse\(txt\), \{ fotosCompletas: completas \}\);/.test(ia13) || /precio_uf|precioUF|flujo|arriendo/.test(ia13.slice(ia13.indexOf("export interface EntradaLectura"), ia13.indexOf("export type ResultadoLecturaFranco")))) F("13a · la llamada no usa el modelo elegido, la instrucción o el saneado, o le pasa el precio al modelo");
      if (CLAUDE_MODEL_LECTURA !== "claude-opus-5-5") F("13a · el modelo de la lectura no es el que eligió Fabrizio (Opus 5.5)");

      // 13b · Una por depto, guardada; se pide aparte, solo quien firmó y de un depto de su base; con tope por hora y marca.
      const srv13 = codigo("src/lib/invierte-v2/lectura-franco-servidor.ts");
      if (!/if \(count == null \|\| count >= TOPE_LECTURAS_POR_HORA\) return \{ estado: "tope" \};/.test(srv13) || !/if \(f\?\.estado === "generando" && ahora\.getTime\(\) - new Date\(f\.updated_at\)\.getTime\(\) < GENERANDO_VENCE_MS\) return \{ estado: "generando" \};/.test(srv13)) F("13b · la lectura se genera sin tope por hora o dos pantallas la piden dos veces");
      if (!/f\.version === VERSION_LECTURA && \(!det\?\.leido_at \|\| !f\.detalle_leido_at \|\| f\.detalle_leido_at >= \(det\.leido_at as string\)\)/.test(srv13)) F("13b · una lectura de otra versión o de una publicación releída se sigue mostrando");
      if (!/const informada = ae\?\.antiguedad_origen === "ficha"/.test(srv13) || !/antiguedad: anio \? \{ anio \} : "no informada"/.test(srv13)) F("13b · la antigüedad supuesta llega al modelo como dato");
      const rl13 = codigo("src/app/api/invierte-v2/lectura/route.ts");
      if (rl13.indexOf("sinEnlaceAlPortal(admin, user.id)") < 0 || !/from\("inv_deptos"\)\.select\("aviso_id"\)\.eq\("user_id", user\.id\)\.eq\("aviso_id", avisoId\)\.in\("estado", \["opcion", "elegido"\]\)/.test(rl13) || !/if \(!suyo\) return NO_EXISTE\(\);/.test(rl13) || rl13.indexOf('from("inv_deptos")') > rl13.indexOf("lecturaDe(")) F("13b · la ruta genera lecturas sin orden firmada o de deptos que no están en la base de la persona");
      const lq13 = codigo("src/components/invierte-v2/LoQueVeFranco.tsx");
      if (!/let p = enCurso\.get\(avisoId\);\s*if \(!p\) \{ p = pedirLectura\(avisoId\); enCurso\.set\(avisoId, p\); \}/.test(lq13) || !/if \(!l\) return null;/.test(lq13)) F("13b · la tarjeta espera la lectura (o la pide dos veces) en vez de completarse sola");

      // 13c · En pantalla: «Lo que el puntaje no considera» primero en el elegido y en los detalles; la corta, la larga y la línea.
      if (LECTURA_COPY.rotulo !== "Lo que ve Franco" || LECTURA_COPY.alertaRotulo !== "Lo que el puntaje no considera") F("13c · los rótulos no son los aprobados");
      // ⚠ ACTA (20-nov-2026, prueba de Fabrizio del resultado): «Lo que el puntaje no considera» queda solo en los detalles, arriba de la versión larga; el resultado ya no la pone sola (§15e).
      if (!/const lineas = l\.larga\.map[\s\S]*?<Alerta l=\{l\} \/>\s*\{lineas\.length > 0 && \(/.test(lq13) || /variante === "alerta"/.test(lq13)) F("13c · la alerta no va primero en los detalles (o el resultado la pone sola)");
      const res13 = codigo("src/components/invierte-v2/ResultadoOpciones.tsx");
      const id = res13.indexOf('data-inv2="tres-datos"'), ic = res13.indexOf('<LoQueVeFranco avisoId={entrada.avisoId} variante="elegido"');
      // ⚠ ACTA (20-nov-2026, prueba de Fabrizio del resultado): en el elegido va UN bloque «Lo que ve Franco» después de los tres datos (con la alerta como primera línea, §15e).
      if (id < 0 || ic < 0 || !(id < ic) || /variante="alerta"/.test(res13)) F("13c · en el elegido «Lo que ve Franco» no va después de los tres datos, o la alerta va aparte");
      if (!/<LoQueVeFranco avisoId=\{o\.avisoId\} variante="linea" inicial=\{p\.lecturas\[o\.avisoId\] \?\? null\} alLlegar=\{siEsGrave\(o\.avisoId\)\} alFotos=\{conFotos\(o\.avisoId\)\} \/>/.test(res13)) F("13c · las alternativas no llevan su línea de Franco");
      if (!/<LoQueVeFranco avisoId=\{avisoId\} variante="detalles" inicial=\{lectura\} alFotos=/.test(codigo("src/components/invierte-v2/DetallesCabezaCliente.tsx"))) F("13c · los detalles no llevan la versión larga");
      if (JSON.stringify(cortaSinRepetirAlerta({ alerta: { nivel: "revisar", motivo: "Faltan fotos del baño." }, larga: [], corta: ["Faltan fotos del baño.", "B", "C"] })) !== '["B","C"]' || JSON.stringify(cortaSinRepetirAlerta({ alerta: { nivel: "ninguna", motivo: null }, larga: [], corta: ["A", "B", "C"] })) !== '["A","B","C"]') F("13c · la corta del elegido repite la alerta que ya va arriba (o pierde líneas sin alerta)");

      // 13d · Una alternativa con alerta grave no se recomienda: ni del servidor, ni cuando la lectura llega en la pantalla.
      if (recomendable({ alerta: { nivel: "grave", motivo: "x" } }) || !recomendable({ alerta: { nivel: "revisar", motivo: "x" } }) || !recomendable(null)) F("13d · «grave» no deja fuera la recomendación (o «revisar» la deja fuera)");
      const ps13 = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/&& recomendable\(lecturasPrev\[x\.f\.aviso_id\]\);/.test(ps13) || !/pedidas\.filas\.filter\(\(r\) => recomendable\(lecturasNuevas\[r\.avisoId\]\)\)\.slice\(0, cuantas\)/.test(ps13)) F("13d · el servidor recomienda una alternativa con alerta grave");
      if (!/!graves\.has\(o\.avisoId\)\);/.test(res13) || !/if \(!recomendable\(l\)\) setGraves/.test(res13)) F("13d · una alternativa cuya lectura llega grave sigue en la pantalla");
      if (!/if \(!recomendable\(cabeza\.lectura\)\) return null;/.test(codigo("src/lib/invierte-v2/detalles-modo-servidor.ts"))) F("13d · los detalles de un depto grave dicen «Te lo recomendamos»");

      // 13e · Ninguna alternativa supera al suyo en nada: el subtítulo lo dice; cada una, su dato más fuerte sin comparar.
      if (A12.tuyoMejor("cerca", "Ñuñoa") !== "El tuyo es el mejor de los parecidos que hay cerca. Estos te sirven de respaldo si no se da." || A12.tuyoMejor("perfil", null) !== "El tuyo es el que más conviene entre los parecidos. Estos te sirven de respaldo si no se da." || A12.tuyoMejor("comuna", "Ñuñoa") !== "El tuyo es el mejor de los parecidos que hay en Ñuñoa. Estos te sirven de respaldo si no se da.") F("13e · el subtítulo de «el tuyo es el mejor» no es el de Fabrizio (cerca, comuna y «Donde más convenga»)");
      if (indicadorAlternativa({ avisoId: "x", precioUF: 3300, flujoCLP: 20000, score: 70 }, { precioUF: 3250, flujoCLP: 90000, score: 80 }, [], per({}))?.supera !== false || indicadorAlternativa({ avisoId: "a", precioUF: 3180, flujoCLP: -45000, score: 77 }, ele12, grupo12, per({}))?.supera !== true) F("13e · el indicador no distingue si supera al suyo");
      if (!/const ningunaSupera = !!entrada && alternativas\.length > 0 && alternativas\.every\(\(o\) => !indicadorAlternativa\(o, entrada, grupo,[^)]*\}\)\.supera\);/.test(res13) || !/\{ningunaSupera \? A\.tuyoMejor\(/.test(res13)) F("13e · cuando ninguna supera al suyo, el subtítulo no lo dice");
    }

    }

    // ── 7 · REINICIAR PRUEBA LIMPIA LA ETAPA 2 DE ESA PERSONA, Y SOLO DE ELLA ──
    {
      const OTRA = "0381a589-0000-4000-8000-00000000beef";
      const db = falso({
        test_accounts: [{ user_id: USER.id }, { user_id: OTRA }],
        inv_personas: [{ user_id: USER.id }, { user_id: OTRA }],
        inv_ordenes: [{ id: "o-a", user_id: USER.id, es_prueba: true, pdf_path: null }, { id: "o-b", user_id: OTRA, es_prueba: true, pdf_path: null }],
        inv_bitacora: [],
        inv_perfiles: [{ user_id: USER.id, tope_supuestos: { reemplazoPrecioMax: true, precioMaxAnterior: { valor: 4200 }, comunasAnterior: { valor: ["Macul"] } } }, { user_id: OTRA, tope_supuestos: { reemplazoPrecioMax: true, precioMaxAnterior: { valor: 9000 }, comunasAnterior: { valor: ["Ñuñoa"] } } }],
        inv_deptos: [{ user_id: USER.id, aviso_id: "x1" }, { user_id: USER.id, aviso_id: "x2" }, { user_id: OTRA, aviso_id: "x1" }],
        inv_documentos: [{ id: "d1", user_id: USER.id, path: "preaprobaciones/a/d1.pdf" }, { id: "d2", user_id: OTRA, path: "preaprobaciones/b/d2.pdf" }],
        inv_tareas: [{ user_id: USER.id, tipo: "avisar_alcance" }, { user_id: OTRA, tipo: "avisar_alcance" }],
        perfil_busqueda: [{ user_id: USER.id, precio_max_uf: 3000, comunas: ["La Cisterna"] }, { user_id: OTRA, precio_max_uf: 2500, comunas: ["San Miguel"] }],
      });
      const r = await reiniciarPrueba(db.sb, USER.id, "admin@x");
      const de = (t: string, u: string) => (db.datos[t] ?? []).filter((f) => f.user_id === u).length;
      if (!r.ok) F("7 · «Reiniciar prueba» falla con la etapa 2");
      for (const t of ["inv_perfiles", "inv_deptos", "inv_documentos", "inv_tareas"]) {
        if (de(t, USER.id)) F(`7 · «Reiniciar prueba» deja ${t} de la persona`);
        if (!de(t, OTRA)) F(`7 · «Reiniciar prueba» borra ${t} de otra persona`);
      }
      if (db.bucket.borrados.join("|") !== "preaprobaciones/a/d1.pdf") F("7 · «Reiniciar prueba» no borra el archivo de la persona, o borra el de otra");
      const pb = (u: string) => db.datos.perfil_busqueda.find((f) => f.user_id === u)?.precio_max_uf;
      if (pb(USER.id) !== 4200 || pb(OTRA) !== 2500) F("7 · «Reiniciar prueba» no devuelve el precio máximo de antes (o toca el de otra)");
      const cm = (u: string) => JSON.stringify(db.datos.perfil_busqueda.find((f) => f.user_id === u)?.comunas);
      if (cm(USER.id) !== '["Macul"]' || cm(OTRA) !== '["San Miguel"]') F("7 · «Reiniciar prueba» no devuelve las comunas de antes (o toca las de otra)");
      const sinReemplazo = falso({ test_accounts: [{ user_id: USER.id }], inv_ordenes: [], inv_bitacora: [], inv_personas: [], inv_perfiles: [{ user_id: USER.id, tope_supuestos: { reemplazoPrecioMax: false, precioMaxAnterior: { valor: 4200 } } }], perfil_busqueda: [{ user_id: USER.id, precio_max_uf: 3000, comunas: ["La Cisterna"] }] });
      await reiniciarPrueba(sinReemplazo.sb, USER.id, "admin@x");
      if (sinReemplazo.datos.perfil_busqueda[0].precio_max_uf !== 3000) F("7 · «Reiniciar prueba» cambia el precio máximo que el tope nunca reemplazó");
      if (JSON.stringify(sinReemplazo.datos.perfil_busqueda[0].comunas) !== '["La Cisterna"]') F("7 · «Reiniciar prueba» inventa comunas de antes cuando el perfil no las guardó");
      const real = falso({ test_accounts: [{ user_id: USER.id }], inv_ordenes: [{ id: "o-r", user_id: USER.id, es_prueba: false, pdf_path: null }], inv_perfiles: [{ user_id: USER.id }], inv_deptos: [{ user_id: USER.id }] });
      await reiniciarPrueba(real.sb, USER.id, "admin@x");
      if (real.datos.inv_perfiles.length !== 1 || real.datos.inv_deptos.length !== 1) F("7 · «Reiniciar prueba» borra la etapa 2 de una cuenta con orden real");
    }
  } catch (e) {
    F(`no corrió: ${e instanceof Error ? e.message : String(e)}`);
  }
  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ INVIERTE-V2-E2 verde");
  return { hard: fallas.length };
}

if (require.main === module) {
  runInvierteV2E2().then((r) => process.exit(r.hard ? 1 : 0));
}
