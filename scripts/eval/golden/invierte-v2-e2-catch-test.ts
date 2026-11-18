// ─────────────────────────────────────────────────────────────────────────────
// TIER INVIERTE-V2-E2 · Invierte con Franco, comprador · etapa 2, entrega 1 (18-nov-2026): el perfil, hasta cuánto puede comprar,
// el resultado (los tres casos y el porqué), las etiquetas y la lectura por reglas, la elección, /invierte, y los detalles sin
// gastar créditos (charge_mode 'invierte') con su categoría propia en los paneles. 0 tokens.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hastaCuanto, creditoPorRenta, validarPerfil, comunasPrecargadas, piePrecargado, lineaTope, REGLA_TOPE, PERFIL_COPY } from "../../../src/lib/invierte-v2/perfil";
import {
  elegirOpciones, etiquetar, casoDe, porQueNoAlcanza, vsParecidos, textoMetro, textoPones, lecturaDeFranco, MAX_ACTIVOS, MAX_OPCIONES, MIN_PARECIDOS,
  RESULTADO_COPY, fmtUF, type OpcionDepto,
} from "../../../src/lib/invierte-v2/opciones";
import { destinoInvierte, URL_BASE, URL_OPCIONES, URL_PARTIMOS } from "../../../src/lib/invierte-v2/destino";
import { reiniciarPrueba } from "../../../src/lib/invierte-v2/servidor";
import { falso, USER } from "./invierte-v2-catch-test";

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
      if (textoPones({ flujoCLP: -62000 }) !== "$62.000" || !/^\$0 · te sobran \$72\.058$/.test(textoPones({ flujoCLP: 72058 }))) F("3 · «Pones al mes» no dice lo que pone o lo que sobra");
      if (RESULTADO_COPY.filas.pones !== "Pones al mes (con pie 20 %)" || RESULTADO_COPY.filas.metro !== "Metro" || /según tu pie/i.test(RESULTADO_COPY.notaTablaPie + RESULTADO_COPY.notaTabla)) F("3 · la tabla no dice «con pie 20 %», la fila no se llama Metro, o la nota dice «según tu pie»");
      if (RESULTADO_COPY.compararAvisoPc(MAX_OPCIONES) !== "" || !/Desliza la tabla/.test(RESULTADO_COPY.compararAvisoPc(7))) F("3 · con más de cinco deptos el PC no dice que la tabla se desliza");
      // Abrir los detalles tarda ≈ 10 s: una capa dice que está cargando, en el resultado y en la base.
      if (!/\{abriendo && <CargandoDetalles \/>\}/.test(codigo("src/components/invierte-v2/ResultadoOpciones.tsx")) || !/\{estado === "abriendo" && <CargandoDetalles \/>\}/.test(codigo("src/components/invierte-v2/BotonDetalles.tsx"))) F("3 · abrir los detalles no muestra que está cargando");
      // La lectura de Franco usa las mismas etiquetas (no nombra a otro como «el que menos te pide al mes»).
      const lec = lecturaDeFranco(ops, "arriendo", ["poner_plata"], Object.fromEntries(et));
      if (!lec.destacado || !/^el de Ñuñoa de 60 m² es el que mejor calza$/.test(lec.destacado) && !/^el de Ñuñoa/.test(lec.destacado) || !/^Buscas arriendo mes a mes y te preocupa poner plata cada mes\. Con eso,$/.test(lec.intro)) F(`3 · la lectura no parte por lo que respondió (${JSON.stringify(lec)})`);
      const lecSinA = lecturaDeFranco(ops, "arriendo", ["poner_plata"], { E: "el_que_elegiste", B: "menos_al_mes" });
      if (!/^el de Ñuñoa/.test(lecSinA.destacado ?? "") || !/menos te pide al mes/.test(lecSinA.resto)) F("3 · la lectura no sigue a la etiqueta «menos al mes»");
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
      for (const f of ["src/lib/invierte-v2/destino.ts", "src/app/invierte/[avisoId]/firma/page.tsx", "src/app/invierte/page.tsx", "src/components/invierte-v2/PerfilForm.tsx", "src/components/invierte-v2/ResultadoOpciones.tsx", "src/app/invierte/base/page.tsx"]) {
        if (/["'`]\/(login|register)\b/.test(codigo(f))) F(`5 · ${f} enlaza a /login o /register`);
      }
      if (c({ sesion: false }) === URL_BASE || c({ acceso: false, perfil: true, eligio: true }) !== "no-existe") F("5 · /invierte salta la sesión o el acceso");
      for (const r of ["src/app/api/invierte-v2/perfil/route.ts", "src/app/api/invierte-v2/eleccion/route.ts", "src/app/api/invierte-v2/avisar/route.ts"]) {
        if (!/const user = await personaConAcceso\(\);\s*if \(!user\) return NO_EXISTE\(\);/.test(codigo(r))) F(`5 · ${r} responde sin acceso`);
      }
      // Con la espera (loading.tsx) la página ya respondió 200 cuando corre su notFound(): el 404 lo da el layout, que va arriba.
      if (!/if \(!user \|\| !acceso\) notFound\(\);/.test(codigo("src/app/invierte/opciones/layout.tsx"))) F("5 · /invierte/opciones responde 200 sin acceso (el layout no decide el acceso arriba de la espera)");
      for (const p of ["src/app/invierte/perfil/page.tsx", "src/app/invierte/opciones/page.tsx", "src/app/invierte/base/page.tsx"]) {
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
      for (const f of ["src/components/invierte-v2/ResultadoOpciones.tsx", "src/components/invierte-v2/BotonDetalles.tsx"]) {
        if (!/fetch\("\/api\/lo-que-sigue\/guia\/analizar", \{[\s\S]{0,160}explorar: true, piePct: 20, plazoAnios: 30/.test(codigo(f))) F(`6 · ${f} no abre los detalles por la ruta del mapa`);
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
