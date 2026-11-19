// ─────────────────────────────────────────────────────────────────────────────
// TIER INVIERTE-V2-E2 · Invierte con Franco, comprador · etapa 2, entrega 1 (18-nov-2026): el perfil, hasta cuánto puede comprar,
// el resultado (los tres casos y el porqué), las etiquetas y la lectura por reglas, la elección, /invierte, y los detalles sin
// gastar créditos (charge_mode 'invierte') con su categoría propia en los paneles. 0 tokens.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hastaCuanto, creditoPorRenta, validarPerfil, comunasPrecargadas, piePrecargado, lineaTope, REGLA_TOPE, PERFIL_COPY } from "../../../src/lib/invierte-v2/perfil";
import {
  elegirOpciones, etiquetar, casoDe, porQueNoAlcanza, vsParecidos, textoMetro, textoAlMes, textoEtiqueta, estaCerca, UMBRAL_CERCA_PCT, lecturaDeFranco, MAX_ACTIVOS, MAX_OPCIONES, MIN_PARECIDOS,
  RESULTADO_COPY, fmtUF, type OpcionDepto,
} from "../../../src/lib/invierte-v2/opciones";
import { destinoInvierte, URL_BASE, URL_OPCIONES, URL_PARTIMOS } from "../../../src/lib/invierte-v2/destino";
import { reiniciarPrueba } from "../../../src/lib/invierte-v2/servidor";
import { falso, USER } from "./invierte-v2-catch-test";
import { chequearPorCarril, leidaFresca, RELECTURA_MS, TOPE_CARRIL_POR_HORA, type DepsCarril } from "../../../src/lib/invierte-v2/carril";
import { detectarCambios, lineaCambio, textoVeredicto, asuntoCambios, parrafoDepto, UMBRAL_CORREO_PCT, UMBRAL_LINEA_PCT, type Vigente } from "../../../src/lib/invierte-v2/cambios";
import { cuerpoDetalles } from "../../../src/lib/invierte-v2/detalles-cliente";
import { etiquetaVeredicto } from "../../../src/lib/veredicto-etiqueta";
import { ACTUALIZADO_COPY, BASE_COPY, DOCUMENTOS_COPY, MENU_COPY, SUMAR_COPY, fraseCambioPerfil, lineaDepto, numeroWhatsapp, urlWhatsapp, type PerfilComparable } from "../../../src/lib/invierte-v2/base";
import { sumarDepto, vigenteSobre } from "../../../src/lib/invierte-v2/base-servidor";

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
      if (piePrecargado("si", 3250) !== 650 || piePrecargado("parte", 3250) !== null) F("2 · el pie sugerido no es el 20 % del depto cuando dijo que tiene el pie");
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
      if (!/const m = textoAlMes\(o\); return \{ t: m\.pones \? <span className="iv2-pones"/.test(res) || !/textoEtiqueta\(p\.etiquetas\[o\.avisoId\]/.test(res) || /ETIQUETAS\[/.test(res)) F("3 · la tabla o la lista no usan «Al mes» en rojo o la etiqueta según el flujo");
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
      if (!/const faltan = \(previos \?\? \[\]\)\.filter\(\(p\) => p\.estado === "elegido" && !deFranco\.some/.test(srv) || !/const opciones = \[\.\.\.deFranco, \.\.\.extras\];/.test(srv)) F("4 · lo que ya eligió y salió del top desaparece de la tabla");
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
      if (!/return error \|\| count == null \? Number\.POSITIVE_INFINITY : count;/.test(cs) || !/leerFicha\(ficha, "clic", almacen, bajarFicha, new Date\(\), \{ tope: TOPE_CARRIL_POR_HORA \}\)/.test(cs)) F("8 · el carril no usa su tope (o sin conteo no se da por lleno)");
      // La ruta, en modo Invierte: lo preparado se abre ANTES de leer nada o de prepararlo; lo demás lee por el carril.
      const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
      const iYa = ruta.indexOf("const ya = await detallesPreparados(admin, user.id, b.avisoId);"), iMeta = ruta.indexOf("const ae = gratisInvierte ? null : await emitirEventoMeta("), iChq = ruta.indexOf("async chequear() {");
      if (!/const modoInvierte = gratisInvierte && b\.invierte === true;/.test(ruta) || iYa < 0 || iYa > iMeta || iYa > iChq || !/if \(ya\) return salir\(NextResponse\.json\(\{ id: ya, estado: "ya-creado"/.test(ruta)) F("8 · abrir lo ya preparado no es directo (lee o prepara antes)");
      if (!/async chequear\(\) \{\s*if \(modoInvierte\) \{\s*const c = await chequearPublicacionInvierte\(admin, \{ avisoId: b\.avisoId!, userId: user\.id, origen: b\.origenInvierte === "elegir" \? "elegir" : "abrir" \}\);/.test(ruta)) F("8 · el modo Invierte lee la ficha por el tope de las personas");
      // Preparar al elegir, y al entrar a la base lo que falte.
      if (!/if \(res\.ok\) \{ prepararEnSegundoPlano\(Array\.from\(marcados\)\); router\.push\(URL_BASE\); return; \}/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx"))) F("8 · los detalles no se preparan al elegir");
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
        [DOCUMENTOS_COPY.promesaLinea, "Se firman en notaría; aquí queda la copia."], [SUMAR_COPY.titulo, "Súmalo a tus opciones"], [SUMAR_COPY.sinFirmaT, "No tienes que firmar de nuevo"],
        [SUMAR_COPY.sinFirma("15 de noviembre"), "Tu orden del 15 de noviembre cubre también este depto. Franco empieza a gestionarlo y puedes ver todos sus detalles desde tus deptos."],
        [`${SUMAR_COPY.teAlcanza} ${SUMAR_COPY.conQue("renta")}`, "Te alcanza con tu pie y tu renta."], [`${SUMAR_COPY.entra} ${SUMAR_COPY.entraLinea(4)}`, "Entra a tu comparativo junto a las cuatro opciones que ya tienes."],
        [SUMAR_COPY.boton, "Sumar a mis opciones"], [ACTUALIZADO_COPY.titulo, "Perfil actualizado"], [ACTUALIZADO_COPY.masDeptos(2), "Ahora te alcanzan 2 deptos más"],
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
      if (!/\{d\.datos\.flujoCLP != null && !d\.alMesEnCambio && <p/.test(codigo("src/components/invierte-v2/VistaBase.tsx"))) F("9 · la base repite «Al mes» cuando lo que cambió ya lo dice");
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
      if (!/f\.estado === "opcion" && f\.alcanza === true && \(f\.datos as DatosDepto \| null\)\?\.veredicto === "COMPRAR"/.test(lb)) F("9 · las otras opciones no son solo las que convienen y le alcanzan");
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
      if (!/\{v\.alcanza\s*\? <SumarDepto [^>]*origen="mapa"/.test(sumar)) F("9 · la pantalla de sumar ofrece sumar un depto que no le alcanza");
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
