// ============================================================================
// TIER ASESORIA — la asesoría en el mapa, entrega 1 (27-nov-2026, encargo y decisiones de Fabrizio). Rojo con:
//   1 · LA CAPACIDAD (capacidad.ts): la renta computable (contrato 100 %, boletas 70 %, las dos 85 %), la carga (40 % o 35 % con
//       boletas), el dividendo ≤ 25 %, el plazo por la edad (edad + plazo ≤ 75 con la más alta del rango, tope 30: 30/30/25/20/15),
//       el valor más bajo de cada chip y el MÁS ALTO de las deudas, el pie «menos de UF 300» solo por la renta con el pie que hace
//       falta, el tope redondeado hacia abajo a 10, y cero cuando las deudas no dejan cuota. Contra una cuenta hecha aparte.
//   2 · EL ESTRÉS y EL TIPO DE PERFIL: +1 punto de tasa y un mes vacío; primer paso / rentista / patrimonial / equilibrado; los avisos.
//   3 · EL APORTE (aporte.ts): cada alto del slider es un corte de `cortes_flujo` (leído de la migración de los tramos); la máscara de
//       los cuatro plazos usa el veredicto Y el flujo de ESE plazo; la respuesta al anónimo lleva solo id y máscara.
//   4 · LOS 3 DEPTOS (tres.ts): el que mejor rinde, el que pide menos al mes, el distinto; nunca dos a menos de 40 m en la misma
//       comuna; si uno gana dos lugares el otro pasa al siguiente; menos de 3 cuando no hay.
//   5 · EL INTERRUPTOR (acceso.ts): un modo raro que no cuente como apagada; «lista» que deje pasar a alguien fuera de la lista;
//       «todos» que no deje pasar; la marca de prueba.
//   6 · LAS RUTAS: /api/asesoria/aporte sin el 404 del interruptor, sin validar el alto, sin el tope, o devolviendo algo más que
//       id y máscara; /api/asesoria/agregados y /perfil sin el interruptor; /perfil sin sesión.
//   7 · LA PRIVACIDAD: un evento con un monto o el id de un chip de «Tus números»; la burbuja o la hoja sin `ph-no-capture`; Sentry
//       sin la limpieza en las tres configuraciones, o una limpieza que deje pasar la renta; nada a Meta desde la asesoría.
//   8 · LOS TEXTOS: el de boletas que no es el aprobado; voseo.
//   9 · /deptos: que redirija sin mirar el interruptor, o que deje de existir deptos-cliente / la API.
//  10 · LA BURBUJA reemplaza a la bienvenida solo con la asesoría habilitada, y no aparece al cargar.
//  15–20 · LA SEGUNDA VUELTA (27-nov-2026, decisiones de Fabrizio): la regla única del tope con los gastos (y la misma en Invierte), las
//       medianas por comuna, las tarjetas por flujo con sus dos etiquetas y la prueba de tasa, «X de cada 10 se pagan solos», el
//       destino a Invierte (botón, adopción del perfil, acceso de prueba) y lo que cambió en pantalla (sin la pega, la lupa, la
//       preaprobación, la cuenta, la hoja de registro, el filtro cerrado, la lámina «Con punch, sin abusar» y la foto de la calle).
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/asesoria-catch-test.ts
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  capacidad, edadDeChip, pruebaTasa, topeConMasPie, tipoPerfil, avisosDelPerfil, objetivoDePerfil, cuota, creditoDeCuota, plazoDeEdad,
  RENTA_COMPUTABLE_PCT, CARGA_MAX_PCT, DEUDA_SIN_TECHO, RENTA_SIN_PISO, type Numeros,
} from "../../../src/lib/asesoria/capacidad";
import { APORTES, mascara, respuestaAporte, idsDelPlazo, distribucion, esAporte, sePaganSolos, UMBRAL_SOLOS, candidatoDeFila, type Candidato, type FilaCandidato } from "../../../src/lib/asesoria/aporte";
import { elegirTres, mismoEdificio, CAP_RATE_MAX_PERFIL, CAP_RATE_MAX_MEDIANAS, M2_MIN_TRES_DORMITORIOS, universoDe, rindePorComuna, MIN_DEPTOS_COMUNA_RINDE } from "../../../src/lib/asesoria/tres";
import { tarjetasDelPerfil } from "../../../src/lib/asesoria/tarjetas";
import { topesDeCompra, pieMasGastosPct } from "../../../src/lib/tope/regla";
import { hastaCuanto } from "../../../src/lib/invierte-v2/perfil";
import { textosHoja } from "../../../src/lib/explorar/abierto";
import { idsDeLaAsesoria, contactoDeAsesoria, lineaDeptoAsesoria } from "../../../src/lib/invierte-v2/asesoria";
import { FLUJO_COPY } from "../../../src/lib/invierte-v2/flujo";
import { TARJETA_COPY } from "../../../src/lib/explorar/mapa-todos";
import { leerModoAsesoria, accesoAsesoria } from "../../../src/lib/asesoria/acceso";
import { propsPaso } from "../../../src/lib/asesoria/eventos";
import { limpiarEventoSentry } from "../../../src/lib/asesoria/sentry-limpieza";
import { ASESORIA_COPY } from "../../../src/lib/asesoria/copy";
import { validarPedidoPerfil, filaPerfil, calcularPerfil } from "../../../src/lib/asesoria/perfil";
import { CAMINOS, CAMINO_DE_HOY } from "../../../src/lib/asesoria/capacidad";
import { pedidoPerfil, ESTADO_INICIAL } from "../../../src/lib/asesoria/estado";
import { comunaEn, comunasQueMasRinden } from "../../../src/lib/asesoria/lugar";
import { conveniencia, palanca, palancaFormula } from "../../../src/lib/asesoria/palanca";

/** «Seguir con estos deptos» (D14): la misma cuenta de la URL que el componente (asesoria.tsx › urlSeguirDeptos; el componente es
 *  "use client" y no se importa acá: el tier comprueba que su código diga exactamente esto). */
const urlEsperada = (ids: string[]) => `/invierte/${ids[0]}?${new URLSearchParams({ desde: "explorar", ...(ids.length > 1 ? { mas: ids.slice(1).join(",") } : {}) })}`;

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const cerca = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

const CFG = { tasaPct: 4.1, uf: 39_500 };
const base: Numeros = { renta: "r3", tipoRenta: "contrato", edad: "e2", pie: "p3", deudas: "d0", preaprobado: "no" };

function cand(id: string, o: Partial<Candidato> & { f?: Partial<Record<30 | 25 | 20 | 15, number | null>>; c?: Partial<Record<25 | 20 | 15, boolean>> } = {}): Candidato {
  return {
    id, comuna: o.comuna ?? "Ñuñoa", lat: o.lat ?? -33.45, lng: o.lng ?? -70.6, dormitorios: o.dormitorios ?? 2, precioUF: o.precioUF ?? 3000, m2: o.m2 === undefined ? 60 : o.m2,
    score: o.score ?? 70, arriendo: o.arriendo === undefined ? 600_000 : o.arriendo,
    flujo: { 30: -50_000, 25: -80_000, 20: -120_000, 15: -200_000, ...(o.f ?? {}) },
    comprar: { 30: true, 25: true, 20: true, 15: true, ...(o.c ?? {}) },
  };
}

export async function runAsesoria(): Promise<{ hard: number }> {
  console.log("\n─── TIER ASESORIA (la asesoría en el mapa · entrega 1 — capacidad, aporte, 3 deptos, interruptor, privacidad · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  try {
    // ── 1 · LA CAPACIDAD ──
    {
      if (RENTA_COMPUTABLE_PCT.contrato !== 100 || RENTA_COMPUTABLE_PCT.boletas !== 70 || RENTA_COMPUTABLE_PCT.ambas !== 85) F("1 · la renta computable no es 100/70/85");
      if (CARGA_MAX_PCT.contrato !== 40 || CARGA_MAX_PCT.boletas !== 35) F("1 · la carga no es 40 % (35 % con boletas)");
      const plazos = ["e1", "e2", "e3", "e4", "e5"].map((e) => edadDeChip(e as Numeros["edad"]).plazo).join();
      if (plazos !== "30,30,25,20,15") F(`1 · el plazo por edad da ${plazos}, no 30,30,25,20,15`);
      if (plazoDeEdad(39) !== 30 || plazoDeEdad(49) !== 25 || plazoDeEdad(54) !== 20) F("1 · edad + plazo ≤ 75 no se cumple con la edad más alta del rango");
      // La cuenta hecha aparte: renta 2,5M (lo más bajo de 2,5–3,5M), contrato, 30 años, pie 600, sin deudas.
      const c = capacidad(base, CFG);
      const cuotaMax = 2_500_000 * 0.25;
      const credito = creditoDeCuota(cuotaMax, CFG.tasaPct, 30) / CFG.uf;
      // ⚠ ACTA (27-nov-2026, regla única): con los gastos de la compra, por pie 600 ÷ 24,4 % y por renta (600 + crédito) ÷ 1,044,
      // cada uno redondeado hacia abajo a 10 (las mismas cifras de la fórmula).
      const esperado = Math.min(Math.floor(600 / 0.244 / 10) * 10, Math.floor((600 + credito) / 1.044 / 10) * 10);
      if (c.topeUF !== esperado) F(`1 · el tope da ${c.topeUF}, la cuenta aparte ${esperado}`);
      if (c.limita !== (600 / 0.244 <= (600 + credito) / 1.044 ? "pie" : "renta")) F("1 · lo que limita no es el menor");
      if (c.topeUF % 10 !== 0) F("1 · el tope no está redondeado a 10");
      // Boletas: 70 % de la renta y carga 35 %.
      const b = capacidad({ ...base, tipoRenta: "boletas", pie: "p4", deudas: "d1" }, CFG);
      const rc = 2_500_000 * 0.7;
      const cuotaB = Math.min(rc * 0.25, rc * 0.35 - 200_000);
      if (!cerca(b.cuotaMaxCLP, cuotaB) || b.rentaComputableCLP !== Math.round(rc)) F("1 · con boletas no cuenta el 70 % o la carga no es 35 %");
      // Las deudas van con el MÁS ALTO del rango: «$200–500 mil» = 500 mil, «+$500 mil» = DEUDA_SIN_TECHO.
      if (capacidad({ ...base, deudas: "d2" }, CFG).deudasCLP !== 500_000 || capacidad({ ...base, deudas: "d3" }, CFG).deudasCLP !== DEUDA_SIN_TECHO) F("1 · las deudas no van con el valor más alto del rango");
      // La renta con lo más bajo: «$1,5–2,5M» = 1,5M; sin piso, RENTA_SIN_PISO.
      if (capacidad({ ...base, renta: "r2" }, CFG).rentaCLP !== 1_500_000 || capacidad({ ...base, renta: "r1" }, CFG).rentaCLP !== RENTA_SIN_PISO) F("1 · la renta no va con el valor más bajo del rango");
      // Edad 50–54: el crédito a 20 años.
      const v = capacidad({ ...base, edad: "e4", pie: "p4" }, CFG);
      // ⚠ ACTA (27-nov-2026, B4: una cifra, un redondeo): el crédito que muestra la fórmula va redondeado hacia abajo a 10.
      if (v.plazo !== 20 || v.creditoUF !== Math.floor(creditoDeCuota(cuotaMax, CFG.tasaPct, 20) / CFG.uf / 10) * 10) F("1 · con 50–54 años el crédito no es a 20");
      // Pie «menos de UF 300»: solo por la renta (crédito / 80 %) y el pie que hace falta.
      const s = capacidad({ ...base, pie: "p1" }, CFG);
      const porRenta = Math.floor(credito / 0.8 / 10) * 10;
      // ⚠ ACTA (27-nov-2026): el pie que hace falta cuenta los gastos (24,4 % del tope).
      if (s.pieUF !== null || s.topeUF !== porRenta || s.pieNecesarioUF !== Math.round(porRenta * 0.244)) F(`1 · sin pie no calcula por la renta (${s.topeUF} vs ${porRenta}) o no dice el pie que falta con los gastos`);
      if (ASESORIA_COPY.formula.sinPieTope(4000, 800) !== "Por tu renta llegas hasta aprox. UF 4.000. Para eso necesitas un pie de UF 800.") F("1 · el texto del pie bajo no es el aprobado");
      // Deudas que se comen la carga: cero.
      const z = capacidad({ ...base, renta: "r1", tipoRenta: "boletas", deudas: "d3" }, CFG);
      if (z.topeUF !== 0) F("1 · con deudas que no dejan cuota el tope no es cero");
      // La carga que muestra la fórmula: (dividendo + deudas) / renta computable, y nunca sobre el máximo.
      if (c.cargaPct > c.cargaMaxPct) F("1 · la carga mostrada pasa el máximo");
    }

    // ── 2 · LA PRUEBA DE TASA Y EL TIPO ──
    // ⚠ ACTA (27-nov-2026, C8): «Si algo se mueve» (el estrés del perfil) se retiró; cada depto lleva su prueba de tasa.
    {
      const cred = 3000 * 0.8 * CFG.uf;
      const sube = cuota(cred, CFG.tasaPct + 1, 30) - cuota(cred, CFG.tasaPct, 30);
      const no = pruebaTasa({ precioUF: 3000, flujoCLP: 50_000, plazo: 30, tasaPct: CFG.tasaPct, uf: CFG.uf });
      if (no.aguanta || !cerca(no.poneCLP, sube - 50_000)) F(`2 · la prueba de tasa no es «pones la diferencia» cuando el flujo no la cubre (${JSON.stringify(no)})`);
      const si = pruebaTasa({ precioUF: 3000, flujoCLP: 100_000, plazo: 30, tasaPct: CFG.tasaPct, uf: CFG.uf });
      if (!si.aguanta || si.poneCLP !== 0) F("2 · un flujo que cubre el punto de tasa no «aguanta»");
      // Con flujo 0 pone exactamente lo que sube el dividendo, que a 20 años (~51 mil) no es lo de 30 (~57 mil): mide el plazo.
      const corto = pruebaTasa({ precioUF: 3000, flujoCLP: 0, plazo: 20, tasaPct: CFG.tasaPct, uf: CFG.uf });
      const sube20 = cuota(cred, CFG.tasaPct + 1, 20) - cuota(cred, CFG.tasaPct, 20);
      if (Math.abs(sube20 - sube) < 1000) F("2 · el fixture del plazo no distingue 20 de 30 años");
      if (!cerca(corto.poneCLP, sube20)) F("2 · la prueba de tasa no usa el plazo de la persona");
      if (tipoPerfil("primera", "arriendo") !== "primer_paso" || tipoPerfil("uno", "arriendo") !== "rentista" || tipoPerfil("varios", "plusvalia") !== "patrimonial" || tipoPerfil("uno", "ambas") !== "equilibrado" || tipoPerfil("uno", "no_se") !== "equilibrado") F("2 · el tipo de perfil no sigue la regla");
      if (objetivoDePerfil("no_se") !== "ambas") F("2 · «No sé» no se guarda como «ambas»");
      // ⚠ ACTA (27-nov-2026, tercera vuelta, punto 9): «Estimación, sujeta a evaluación del banco» sale del perfil (ya lo dice la tarjeta del tope).
      if (avisosDelPerfil({ tipoRenta: "contrato", experiencia: "primera" }).join() !== "") F("2 · sin boletas ni deptos, el perfil lleva un aviso");
      if (avisosDelPerfil({ tipoRenta: "boletas", experiencia: "uno" }).join() !== "boletas,segunda") F("2 · con boletas y otro depto faltan avisos (o vuelve la estimación)");
      const A = ASESORIA_COPY.perfil.avisos;
      if (!/2 años de actividad/.test(A.boletas) || !/2 últimas declaraciones de renta/.test(A.boletas) || !/30 % de pie en la segunda vivienda/.test(A.segunda) ) F("2 · los avisos no dicen lo aprobado");
    }

    // ── 3 · EL APORTE ──
    {
      const mig = leer("supabase/migrations/20261125_explorar_mapa_todos_tramos.sql");
      const m = mig.match(/cortes_flujo constant numeric\[\] := array\[([^\]]+)\]/);
      if (!m) F("3 · no se encontraron los cortes de flujo en la migración");
      else {
        const cortes = new Set(m[1].split(",").map((x) => Number(x.trim())));
        for (const a of APORTES) if (!cortes.has(-a) && !(a === 0 && cortes.has(0))) F(`3 · el alto ${a} no es un corte de cortes_flujo`);
      }
      if (APORTES.join() !== "0,25000,50000,75000,100000,150000,200000,300000") F("3 · los altos del slider no son los aprobados");
      if (esAporte(110_000) || esAporte("100000") || !esAporte(100_000)) F("3 · esAporte acepta un valor libre");
      const x = cand("a", { f: { 30: -40_000, 25: -60_000, 20: -90_000, 15: -150_000 }, c: { 20: false } });
      // aporte 100 mil: pasa a 30 y 25; a 20 el flujo pasaría pero NO es Comprar; a 15 el flujo no pasa.
      if (mascara(x, 100_000) !== 0b0011) F(`3 · la máscara da ${mascara(x, 100_000).toString(2)}, no 0011 (veredicto y flujo del plazo)`);
      if (mascara(cand("n", { f: { 30: null } }), 300_000) & 1) F("3 · un flujo nulo calza");
      const r = respuestaAporte([x, cand("b", { f: { 30: -500_000, 25: -500_000, 20: -500_000, 15: -500_000 } })], 100_000);
      if (JSON.stringify(Object.keys(r)) !== '["i","m"]' || r.i.join() !== "a") F("3 · la respuesta al anónimo lleva algo más que id y máscara, o incluye uno que no calza");
      if (!idsDelPlazo(r, 25).has("a") || idsDelPlazo(r, 20).has("a")) F("3 · idsDelPlazo no lee el bit de su plazo");
      const d = distribucion([cand("z", { f: { 30: 10_000 } }), cand("y", { f: { 30: -30_000 } })]);
      if (d[30][0] !== 1 || d[30][2] !== 1) F("3 · la distribución no cuenta por tramos de 25 mil");
    }

    // ── 4 · LOS 3 DEPTOS ──
    {
      const P = { plazo: 30 as const, aporte: 100_000, topeUF: 3500, comunas: [] as string[], uf: CFG.uf };
      // A rinde más (arriendo alto), B pide menos (flujo mayor), C distinto (otra comuna), D en el mismo edificio que A.
      const A = cand("A", { arriendo: 900_000, f: { 30: -90_000 }, score: 60 });
      const B = cand("B", { arriendo: 500_000, f: { 30: 20_000 }, lat: -33.40, score: 65 });
      const Cc = cand("C", { comuna: "Santiago", arriendo: 550_000, f: { 30: -10_000 }, lat: -33.44, score: 90 });
      const D = cand("D", { arriendo: 950_000, lat: -33.45 + 0.0002, f: { 30: 30_000 }, score: 99 });
      const t = elegirTres([A, B, Cc, D], P);
      // D rinde más que A y está a ~22 m de A: gana «rinde» D; A queda fuera por mismo edificio.
      const ids = t.map((e) => `${e.porQue}:${e.c.id}`).join();
      if (!mismoEdificio(A, D)) F("4 · dos pines a 22 m en la misma comuna no son el mismo edificio");
      if (t.some((e) => e.c.id === "A") && t.some((e) => e.c.id === "D")) F("4 · salieron dos del mismo edificio");
      if (ids !== "rinde:D,pide_menos:B,distinto:C") F(`4 · la elección dio ${ids}, no rinde:D,pide_menos:B,distinto:C`);
      // Si el que más rinde también es el que pide menos, el segundo lugar pasa al siguiente.
      const t2 = elegirTres([cand("X", { arriendo: 900_000, f: { 30: 50_000 } }), cand("Y", { arriendo: 400_000, f: { 30: 0 }, lat: -33.3 })], P);
      if (t2.length !== 2 || t2[0].c.id !== "X" || t2[1].c.id !== "Y") F("4 · un depto ocupó dos lugares");
      // Fuera del tope, del aporte o del plazo, no.
      const fuera = elegirTres([cand("caro", { precioUF: 4000 }), cand("pide", { f: { 25: -200_000 } }), cand("no25", { c: { 25: false } })], { ...P, plazo: 25 });
      if (fuera.length) F("4 · eligió uno fuera del tope, del aporte o que no es Comprar a su plazo");
      // La variedad es preferencia (27-nov-2026): sin uno distinto, el tercero es el de mejor puntaje («otro»), nunca «encontré 2».
      const t3 = elegirTres([cand("p", { arriendo: 900_000 }), cand("q", { f: { 30: 40_000 }, lat: -33.3 }), cand("s", { lat: -33.1, score: 50 }), cand("r", { lat: -33.2, score: 99 })], P);
      if (t3.length !== 3 || t3[2].porQue !== "otro" || t3[2].c.id !== "r") F(`4 · sin uno distinto, el tercero no es el de mejor puntaje (${t3.map((e) => e.porQue + ":" + e.c.id).join()})`);
      // Con uno distinto disponible, gana el distinto aunque otro tenga más puntaje.
      const t4 = elegirTres([cand("p", { arriendo: 900_000 }), cand("q", { f: { 30: 40_000 }, lat: -33.3 }), cand("r", { lat: -33.2, score: 99 }), cand("o", { comuna: "Santiago", lat: -33.1, score: 10 })], P);
      if (t4[2]?.porQue !== "distinto" || t4[2].c.id !== "o") F("4 · con uno distinto disponible, el tercero no es el distinto");
      // Dos que existen pero son del mismo edificio que los elegidos: no hay tercero, y eso sí es «encontré 2».
      const t5 = elegirTres([cand("p", { arriendo: 900_000 }), cand("q", { f: { 30: 40_000 }, lat: -33.3 }), cand("p2", { lat: -33.45 + 0.0001 })], P);
      if (t5.length !== 2) F("4 · el tercero salió del mismo edificio que uno elegido");
      // El cap rate fuera de rango (27-nov-2026): sobre 12 % no entra a «tus deptos», ni siquiera como «el que mejor rinde».
      // ⚠ ACTA (27-nov-2026, tercera vuelta): el corte del perfil bajó a 10 % (p95 del universo, 8,3 %); el de las medianas queda en 12 %.
      if (CAP_RATE_MAX_PERFIL !== 0.10 || CAP_RATE_MAX_MEDIANAS !== 0.12) F("4 · el corte del cap rate no es 10 % en el perfil y 12 % en las medianas");
      const raro = cand("raro", { precioUF: 1256, arriendo: 1_030_000, f: { 30: 700_000 }, lat: -33.5, score: 99 }); // ~24,9 % como el del paseo
      const justo = cand("justo", { precioUF: 3000, arriendo: Math.floor((0.10 * 3000 * CFG.uf) / 12), lat: -33.6 });
      const tc = elegirTres([raro, justo, cand("n1", { lat: -33.7 }), cand("n2", { comuna: "Santiago", lat: -33.8 })], P);
      if (tc.some((e) => e.c.id === "raro")) F("4 · un depto con cap rate sobre 12 % entró a «tus deptos»");
      if (!tc.some((e) => e.c.id === "justo")) F("4 · un depto con cap rate de 10 % justo quedó fuera (el corte es «sobre»)");
    }

    // ── 5 · EL INTERRUPTOR ──
    {
      for (const raro of [null, undefined, "", "Lista", "TODOS", "encendida", 1]) if (leerModoAsesoria(raro) !== "apagada") F(`5 · el modo ${JSON.stringify(raro)} no cuenta como apagada`);
      if (leerModoAsesoria('"lista"') !== "lista" || leerModoAsesoria(" todos ") !== "todos") F("5 · el modo válido no se lee");
      const a = (modo: "apagada" | "lista" | "todos", d: boolean, c = false) => accesoAsesoria({ modo, dispositivoEnLista: d, cuentaDePrueba: c });
      if (a("apagada", true).habilitada) F("5 · apagada deja pasar a la lista");
      if (a("lista", false).habilitada) F("5 · lista deja pasar a un dispositivo fuera de la lista");
      if (!a("lista", true).habilitada || !a("lista", false, true).habilitada) F("5 · lista no deja pasar al dispositivo habilitado o a la cuenta de prueba");
      if (!a("todos", false).habilitada || a("todos", false).prueba || !a("todos", true).prueba) F("5 · todos no deja pasar a todos, o la marca de prueba no sale de la lista");
    }

    // ── 6 · LAS RUTAS ──
    {
      const ap = codigo("src/app/api/asesoria/aporte/route.ts");
      if (!/if \(!acceso\.habilitada\) return NextResponse\.json\(\{ error: "no-existe" \}, \{ status: 404 \}\);/.test(ap)) F("6 · /aporte sin el 404 del interruptor");
      if (!/if \(!esAporte\(b\.aporte\)\) return NextResponse\.json\(\{ error: "aporte" \}, \{ status: 400 \}\);/.test(ap)) F("6 · /aporte no valida el alto del slider");
      if (!/const pasa = await topeAporte\(/.test(ap) || !/if \(!pasa\) return NextResponse\.json\(\{ error: "tope" \}, \{ status: 429 \}\);/.test(ap)) F("6 · /aporte sin el tope");
      if (!/return NextResponse\.json\(\{ i: r\.i, m: r\.m \}/.test(ap)) F("6 · /aporte devuelve algo más que id y máscara");
      for (const r of ["src/app/api/asesoria/agregados/route.ts", "src/app/api/asesoria/perfil/route.ts"]) if (!/if \(!acceso\.habilitada\) return NextResponse\.json\(\{ error: "no-existe" \}, \{ status: 404 \}\);/.test(codigo(r))) F(`6 · ${r} sin el 404 del interruptor`);
      if (!/if \(!user\) return NextResponse\.json\(\{ error: "sin-sesion" \}, \{ status: 401 \}\);/.test(codigo("src/app/api/asesoria/perfil/route.ts"))) F("6 · /perfil sin sesión");
      const srv = codigo("src/lib/asesoria/servidor.ts");
      if (/unstable_cache\([^)]*accesoAsesoria/.test(srv) || /accesoAsesoriaDe/.test(srv)) F("6 · el interruptor se lee dentro de una caché compartida");
      // El perfil: validación y la fila sin orden.
      const ok = validarPedidoPerfil({ experiencia: "uno", objetivo: "no_se", numeros: base, aporte: 100_000, donde: { modo: "comunas", comunas: ["Ñuñoa"] }, lupa: "prefiero" });
      if (!ok.ok) F("6 · un pedido válido no pasa");
      else {
        const fila = filaPerfil("u", ok.pedido, calcularPerfil(ok.pedido, CFG), { esPrueba: true, existe: false, elegidos: [] });
        if (fila.objetivo !== "ambas" || fila.tipo_perfil !== "equilibrado" || fila.lupa !== null || fila.origen !== "asesoria" || fila.es_prueba !== true || fila.plazo_anios !== 30) F("6 · la fila del perfil no guarda lo aprobado (objetivo, tipo, lupa nula, origen, prueba, plazo)");
        if ("orden_id" in fila) F("6 · la fila del perfil pide una orden");
      }
      if (validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 110_000, donde: { modo: "metro", comunas: [] }, lupa: "no" }).ok) F("6 · el perfil acepta un aporte libre");
    }

    // ── 7 · LA PRIVACIDAD ──
    {
      const p = propsPaso("numeros", "r3", false);
      if ("respuesta" in p) F("7 · un evento lleva el id de un chip de «Tus números»");
      if (propsPaso("aporte", "100000", true).respuesta) F("7 · un evento lleva el aporte");
      if (propsPaso("gancho", "primera", true).respuesta !== "primera" || propsPaso("gancho", "primera", true).es_prueba !== true) F("7 · el evento del paso no lleva la respuesta libre o es_prueba");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      for (const clase of ["as-burbuja", "as-hoja", "as-chica", "as-cuenta"]) if (!new RegExp(`className="as-raiz ${clase} ph-no-capture"`).test(comp)) F(`7 · ${clase} sin ph-no-capture`);
      const capturas = comp.match(/capture\(EVENTOS_ASESORIA\.[a-zA-Z]+, [^;]+;/g) ?? [];
      if (capturas.length < 8) F("7 · los eventos de la asesoría no pasan por EVENTOS_ASESORIA");
      for (const c of capturas) if (/topeUF|renta|aporte:|cap\.|deudas|pieUF/.test(c)) F(`7 · un evento lleva un monto: ${c.slice(0, 80)}`);
      if (/posthog\?\.capture\(/.test(comp.replace(/const capture = useCallback\(\(ev: string, props: Record<string, string \| number \| boolean>\) => \{ posthog\?\.capture\(ev, props\); \}, \[posthog\]\);/, ""))) F("7 · un posthog.capture directo, fuera de los eventos");
      if (/metaTrack|avisarLead|fbq/.test(comp)) F("7 · la asesoría manda algo a Meta");
      for (const s of ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) if (!/limpiarEventoSentry\(event\)/.test(codigo(s))) F(`7 · ${s} sin la limpieza de la asesoría`);
      const ev = limpiarEventoSentry({ extra: { renta: 2_500_000, ok: 1, anidado: { aporte_clp: 1 } }, breadcrumbs: [{ data: { pie_uf: 600 }, message: "sessionStorage franco_asesoria" }] });
      if ((ev.extra as Record<string, unknown>).renta !== "[borrado]" || ((ev.extra as unknown as Record<string, Record<string, unknown>>).anidado.aporte_clp) !== "[borrado]" || (ev.extra as Record<string, unknown>).ok !== 1) F("7 · la limpieza de Sentry deja pasar la renta o el aporte (o borra de más)");
      if ((ev.breadcrumbs[0].data as Record<string, unknown>).pie_uf !== "[borrado]" || ev.breadcrumbs[0].message !== "[borrado]") F("7 · la limpieza no toca los breadcrumbs");
      // La capacidad corre en el navegador: la ruta del aporte no recibe la renta, el pie, las deudas ni la edad.
      if (/(renta|rentaCLP|pie|pieUF|deudas?|edad|numeros|topeUF)/i.test(codigo("src/app/api/asesoria/aporte/route.ts"))) F("7 · la ruta del aporte lee algo de «Tus números»");
    }

    // ── 8 · LOS TEXTOS ──
    {
      if (ASESORIA_COPY.boletas !== "Con boletas, los bancos suelen contar solo una parte de tu renta. Uso el 70 % para no prometerte de más.") F("8 · el texto de boletas no es el aprobado");
      const todo = JSON.stringify(ASESORIA_COPY);
      const voseo = todo.match(/\b(tenés|querés|podés|sabés|mirá|tocá|elegí|escribí|comprá|revisá|seguí|contá|decí|ponés|sos)\b/i);
      if (voseo) F(`8 · voseo en los textos: «${voseo[0]}»`);
      if (/no soy corredor|anti-?corredor/i.test(todo)) F("8 · copy anti-corredor");
      if (/asesor[ií]a de inversi[oó]n|con IA/i.test(todo)) F("8 · un texto visible dice «asesoría de inversión» o «con IA»");
      if (ASESORIA_COPY.reaccionObjetivo.plusvalia !== "Entonces lo que más pesa es la zona. Igual cuido que no te pida mucho al mes." || ASESORIA_COPY.reaccionObjetivo.ambas !== "Se pueden buscar las dos cosas. Partimos por lo que se puede medir: cuánto rinde cada UF.") F("8 · los textos de «Que gane valor» o «Las dos» no son los aprobados");
      if (!/<p className="as-quien-n" data-asesoria="encabezado"><b>\{C\.franco\}<\/b> · \{C\.encabezado\}<\/p>/.test(codigo("src/app/explorar/asesoria/asesoria.tsx")) || ASESORIA_COPY.encabezado !== "tu perfil de inversión") F("8 · el encabezado no dice «Franco · tu perfil de inversión»");
    }

    // ── 9 · /deptos ──
    {
      const d = codigo("src/app/deptos/page.tsx");
      if (!/if \(!user && \(await accesoAsesoriaDe\(\{ dispositivoHash: huellaDeCabeceras\(headers\(\)\)\.dispositivo, userId: null \}\)\)\.habilitada\) redirect\(DESTINO_DEPTOS_CON_ASESORIA\);/.test(d)) F("9 · /deptos redirige sin mirar el interruptor (o no redirige)");
      for (const f of ["src/app/deptos/deptos-cliente.tsx", "src/app/api/deptos/correo/route.ts", "src/app/api/deptos/conteo/route.ts"]) if (!existsSync(join(RAIZ, f)) && f !== "src/app/api/deptos/conteo/route.ts") F(`9 · ${f} dejó de existir`);
    }

    // ── 10 · LA BURBUJA ──
    {
      const cli = codigo("src/app/explorar/explorar-cliente.tsx");
      if (!/if \(!sinCuenta \|\| inicial\.n == null \|\| compartido\) return;\s*if \(asesoria\.habilitada\) return;/.test(cli)) F("10 · la bienvenida no cede ante la asesoría");
      if (!/asesoria = SIN_ASESORIA/.test(cli)) F("10 · el mapa no arranca sin asesoría");
      if (!/\{asesoria\.habilitada && vista === "mapa" && \(\s*<Asesoria/.test(cli)) F("10 · la asesoría se monta sin el interruptor");
      if (!/lista=\{yaMiro && !compartido\}/.test(cli) || !/const yaMiro = miro\.tarjetas >= MIRO_TARJETAS \|\| \(miro\.veinte && miro\.movimientos >= MIRO_MOVIMIENTOS\);/.test(cli)) F("10 · la burbuja no espera a que haya mirado deptos");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/: p\.lista && p\.sinCuenta \? "burbuja" : "nada"/.test(comp)) F("10 · la burbuja aparece sin haber mirado deptos o con cuenta");
      // «Dónde»: la comuna que se toca sale de los límites de la capa.
      const datos = { fuente: "", comunas: [{ n: "Cuadrado", e: [0, 0] as [number, number], a: [[0, 0, 0, 1, 1, 1, 1, 0]] }] };
      if (comunaEn(0.5, 0.5, datos) !== "Cuadrado" || comunaEn(2, 2, datos) !== null) F("10 · el toque no encuentra la comuna");
      if (comunasQueMasRinden([{ comuna: "A", cap: 0.06 }, { comuna: "B", cap: 0.05 }, { comuna: "C", cap: 0.07 }], new Map([["A", 5], ["B", 5], ["C", 1]])).join() !== "A,B") F("10 · «donde más rinde» no exige deptos que calcen");
    }

    // ── 11 · EL PLAZO CORTO Y LA PALANCA (punto 5, 27-nov-2026) ──
    {
      const cs = [cand("a"), cand("b", { c: { 20: false } }), cand("c", { f: { 20: null } })];
      const cv = conveniencia(cs, 20);
      if (cv.x !== 1 || cv.y !== 3) F(`11 · «convienen X de los Y» a 20 años da ${cv.x} de ${cv.y}, no 1 de 3`);
      if (ASESORIA_COPY.formula.plazoCorto(20, 1596, 4814) !== "Con tu plazo de 20 años, convienen 1.596 de los 4.814.") F("11 · el texto del plazo corto no es el aprobado");
      // Limita la renta: más pie también sube el tope (pie + crédito), pero acá no deja más deptos (todos ya alcanzan); gana el aporte.
      const P0 = { plazo: 30 as const, aporte: 50_000, topeUF: 99_999, comunas: [] as string[], uf: CFG.uf };
      const pide = (id: string, f: number) => cand(id, { precioUF: 1000, arriendo: 250_000, f: { 30: f }, lat: -33.4 - Number(id.slice(1)) * 0.01 });
      const pool = [pide("x1", -40_000), pide("x2", -60_000), pide("x3", -70_000), pide("x4", -70_000)];
      const nRenta = { ...base, renta: "r1" as const, pie: "p3" as const };
      const capR = capacidad(nRenta, CFG);
      const pa = palanca(pool, { ...P0, topeUF: capR.topeUF }, nRenta, CFG);
      if (capR.limita === "pie") F("11 · el caso de prueba de renta quedó limitado por el pie");
      if (capacidad({ ...nRenta, pie: "p4" }, CFG).topeUF <= capR.topeUF) F("11 · con la renta limitando, más pie no sube el tope");
      if (!pa || pa.tipo !== "aporte" || pa.aporte !== 75_000 || pa.n !== 4) F(`11 · con la renta limitando, la palanca no es «hasta $75.000 → 4» (${JSON.stringify(pa)})`);
      // Limita el pie (300): el chip siguiente (600) sube el tope y deja más que el aporte siguiente.
      const nPie = { ...base, pie: "p2" as const };
      const capP = capacidad(nPie, CFG);
      // y4 entra con el aporte siguiente (+1); y2 e y3 entran con el pie siguiente (+2): gana el que más mueve, el pie.
      const caros = [cand("y1", { precioUF: capP.topeUF - 10, arriendo: 300_000, f: { 30: -40_000 } }), cand("y2", { precioUF: capP.topeUF + 500, arriendo: 300_000, lat: -33.3, f: { 30: -40_000 } }), cand("y3", { precioUF: capP.topeUF + 600, arriendo: 300_000, lat: -33.2, f: { 30: -40_000 } }), cand("y4", { precioUF: capP.topeUF - 20, arriendo: 300_000, lat: -33.1, f: { 30: -70_000 } })];
      const pp = palanca(caros, { ...P0, topeUF: capP.topeUF }, nPie, CFG);
      if (!pp || pp.tipo !== "pie" || pp.pieUF !== 600 || pp.n !== 3) F(`11 · con el pie limitando, la palanca no es «pie UF 600 → 3» (${JSON.stringify(pp)})`);
      // Ninguna mueve: null (no se ofrece nada que no suma).
      if (palanca([pide("z1", -400_000)], { ...P0, aporte: 300_000, topeUF: capR.topeUF }, nRenta, CFG) !== null) F("11 · se ofrece una palanca que no deja más deptos");
      const ruta = codigo("src/app/api/asesoria/perfil/route.ts");
      if (!/const laPalanca = tres\.length < 3 && calc\.cap\.topeUF > 0 \? palanca\(/.test(ruta) || !/const conv = plazo < 30 \? conveniencia\(universo, plazo\) : null;/.test(ruta)) F("11 · /perfil no calcula la palanca con menos de 3 o la conveniencia con plazo corto");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/\{!cero && plazoCorto && <p className="as-bf" data-asesoria="plazo-corto">/.test(comp) || !/if \(plazo >= 30 \|\| !d \|\| a\?\.total == null\) return null;/.test(comp)) F("11 · la fórmula no dice el plazo corto (o lo dice a 30 años)");
      if (!/\{r\.conveniencia && <p className="as-bf" data-asesoria="perfil-plazo-corto">/.test(comp)) F("11 · el perfil no dice el plazo corto");
      if (!/\{r\.tres\.length < 3 && <p className="as-bf" data-asesoria="perfil-palanca">\{!r\.palanca \? P\.sinPalanca : r\.palanca\.tipo === "aporte" \? P\.palancaAporte\(r\.palanca\.aporte, r\.palanca\.n\) : P\.palancaPie\(r\.palanca\.pieUF, r\.palanca\.n\)\}<\/p>\}/.test(comp)) F("11 · con menos de 3, el perfil no ofrece la palanca con su cifra");
      if (/aporte|zonas/.test(ASESORIA_COPY.perfil.menos(2) + ASESORIA_COPY.perfil.ninguno)) F("11 · «encontré N» repite la palanca (redundancia)");
    }

    // ── 12 · LO QUE ENCONTRÓ EL PASEO (27-nov-2026) ──
    {
      const t = ASESORIA_COPY.cierre;
      if (/3/.test(t.titulo(2)) || /3/.test(t.titulo(0)) || !/3 deptos/.test(t.titulo(3))) F("12 · el cierre promete 3 deptos cuando calzan menos");
      if (/3/.test(ASESORIA_COPY.perfil.tresTitulo(2)) || ASESORIA_COPY.perfil.tresTitulo(3) !== "Tus 3 deptos") F("12 · el perfil titula «Tus 3 deptos» con menos de 3");
      if (/bajo el 35/.test(ASESORIA_COPY.formula.deudas(35, 35)) || !/bajo el 40/.test(ASESORIA_COPY.formula.deudas(19, 40))) F("12 · la fórmula dice «bajo» el máximo cuando está justo en él");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      const css = leer("src/app/explorar/asesoria/asesoria.css");
      for (const clase of ["as-burbuja", "as-hoja", "as-chica"]) if (!(comp.split(`className="as-raiz ${clase} ph-no-capture"`)[1] ?? "").split(">")[0].includes('style={{ ["--as-abajo" as string]: `${abajo}px` }}')) F(`12 · ${clase} no sube sobre el aviso de cookies`);
      if (!/const el = document\.querySelector<HTMLElement>\('\[data-cookies="aviso"\]'\);\s*setAbajo\(el \? Math\.round\(el\.getBoundingClientRect\(\)\.height\) : 0\);/.test(comp)) F("12 · la altura del aviso de cookies no se mide");
      // E18 (27-nov-2026): medir en cada mutación del body forzaba un layout por nodo del mapa; se mira una vez por frame y se mide solo
      // si el aviso aparece o desaparece.
      if (!/const mo = new MutationObserver\(revisar\);/.test(comp) || !/const ahora = document\.querySelector\('\[data-cookies="aviso"\]'\);\s*if \(ahora === previo\) return;/.test(comp)) F("12 · el aviso de cookies se mide en cada mutación del body (layout forzado con cada nodo del mapa)");
      if (!/\.as-hoja \{[^}]*bottom: var\(--as-abajo, 0px\); height: calc\(100% - 150px - var\(--as-abajo, 0px\)\);/.test(css) || !/\.as-burbuja \{[^}]*bottom: calc\(12px \+ var\(--as-abajo, 0px\)\);/.test(css)) F("12 · el CSS no usa la altura del aviso");
      // ⚠ ACTA (27-nov-2026, E15): la regla de «la conversación baja sola» se reemplazó: cada pantalla abre con su primer mensaje nuevo arriba.
      if (!/const t = window\.setTimeout\(\(\) => \{ conv\.scrollTop = scrollAlInicio\(conv\); \}, 60\);/.test(comp) || /conv\.scrollHeight/.test(comp)) F("12 · la hoja no abre cada pantalla con su primer mensaje nuevo arriba (E15)");
      if (!/const marcas = conv\.querySelectorAll<HTMLElement>\("\[data-inicio\]"\);\s*const el = marcas\.length \? marcas\[marcas\.length - 1\] : conv\.querySelector<HTMLElement>\("\.as-bf, \.as-tarjeta"\);/.test(comp)) F("12 · el scroll no va al último mensaje nuevo marcado");
      for (const paso of ["paso-objetivo", "paso-numeros-antes", "paso-numeros", "paso-formula", "paso-aporte-solos", "paso-aporte", "paso-donde", "paso-lupa", "paso-cierre", "perfil"]) {
        const bloque = (comp.split(`data-asesoria="${paso}"`)[1] ?? "").split("</div>\n")[0];
        if (!/data-inicio="1"/.test(bloque.slice(0, 900))) F(`12 · la pantalla ${paso} no marca su primer mensaje nuevo`);
      }
      const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
      // ⚠ ACTA (27-nov-2026, E16): el margen con la hoja se achicó (52 arriba, 12 a los lados, 8 sobre la hoja): con 64 y 24 la franja
      // del teléfono dejaba ~60 px para los pines.
      if (!/a \? \{ top: 52, left: 12, right: 12 \+ a\.derecha, bottom: 8 \+ a\.abajo \} : 24;/.test(mapa) || !/margenDeEncuadre\(aireRef\.current\)\);/.test(mapa)) F("12 · el encuadre no deja los pines en lo que se ve de la hoja");
      const cli = codigo("src/app/explorar/explorar-cliente.tsx");
      if (!/const claveEncuadreAsesoria = !filtroAsesoria \? "" : filtroAsesoria\.quieto \? "\|as:quieto" : "\|as:" \+ \(filtroAsesoria\.ids\?\.size \?\? "todos"\)/.test(cli) || !/\$\{claveEncuadreAsesoria\}`\}/.test(cli)) F("12 · el mapa no se reencuadra con los que calzan (o se mueve mientras se tocan comunas)");
      if (!/quieto: e\?\.paso === "donde"/.test(comp)) F("12 · en «Dónde» el mapa no queda quieto");
      // Con plazo corto, la fórmula ya cuenta los Comprar a SU plazo (pide el alto más alto del slider, no una cifra de la persona).
      // ⚠ ACTA (27-nov-2026, tercera vuelta): antes del caso de siempre va el del aporte libre («Seguir» en la buena noticia, §24).
      if (!/: pasoN >= PASO_N\.aporte \? aporte : pasoN >= PASO_N\.formula && plazo < 30 \? ALTO_MAXIMO : null;/.test(comp) || !/const ALTO_MAXIMO: Aporte = TOPE_SLIDER;/.test(comp) || !/if \(idsAporte\) xs = xs\.filter\(\(x\) => idsAporte\.has\(x\.avisoId\)\);/.test(comp)) F("12 · con plazo corto, «te alcanzan» de la fórmula no cuenta el plazo");
      if (!/alcanzan=\{aportePendiente \? null : calzan\?\.length \?\? null\}/.test(comp)) F("12 · la fórmula dice «te alcanzan» antes de que llegue el plazo");
      if (!/const calzanVisto = aportePendiente \? null : calzan;/.test(comp) || !/\{calzanVisto\s*\? <span className="as-cuenta-t" data-asesoria="cuenta-calzan">\{C\.calzanDe\(calzanVisto\.length, convienen\)\}<\/span>\s*: <><span className="as-cuenta-n">\{miles\(convienen\)\} de \{miles\(total\)\}<\/span>/.test(comp)) F("12 · la pastilla del mapa muestra la cifra anterior mientras llega el aporte");
      // El mismo universo que el mapa: las comunas disponibles y la ventana semanal.
      const srvA = codigo("src/lib/asesoria/servidor.ts");
      if (!/admin\.rpc\("asesoria_candidatos", \{ p_comunas: comunas, p_desde: desde, p_tope: null \}\)/.test(srvA) || !/const comunas = \[\.\.\.\(COMUNAS_DISPONIBLES as readonly string\[\]\)\]\.map\(comunaDeAviso\);/.test(srvA) || !/VENTANA_SEMANAL_DIAS \* 864e5/.test(srvA)) F("12 · el universo de la asesoría no es el del mapa (comunas o ventana)");
      if (!/const aportePendiente = altoPedido != null && !respuestas\[altoPedido\];/.test(comp) || !/calzan=\{aportePendiente \? null : calzan\?\.length \?\? null\}/.test(comp)) F("12 · mientras llega el aporte, «Calzan» muestra la cifra anterior");
    }

    // ── 13 · CON 0 EN LA FÓRMULA, LA PALANCA AHÍ MISMO (decisión de Fabrizio, 27-nov-2026) ──
    {
      const F2 = ASESORIA_COPY.formula;
      if (F2.ceroDeptos !== "Con estos números, hoy no te alcanza ningún usado de los que convienen." || F2.ajustar !== "Ajustar mis números" || F2.seguirIgual !== "Seguir igual") F("13 · los textos del caso con 0 no son los aprobados");
      // Pie UF 300 con renta de 1M por boletas: tope bajo. El chip de pie más bajo con el que aparece alguno, con su cifra.
      const n0 = { ...base, renta: "r1" as const, tipoRenta: "boletas" as const, pie: "p2" as const, deudas: "d1" as const };
      const t0 = capacidad(n0, CFG).topeUF, t600 = capacidad({ ...n0, pie: "p3" }, CFG).topeUF, t900 = capacidad({ ...n0, pie: "p4" }, CFG).topeUF;
      if (!(t600 > t0 && t900 > t600)) F("13 · el caso de prueba no sube el tope con más pie");
      const precios = [{ avisoId: "a", precioUF: t0 + 5 }, { avisoId: "b", precioUF: t600 - 5 }, { avisoId: "c", precioUF: t600 - 1 }, { avisoId: "d", precioUF: t900 - 5 }];
      const pf = palancaFormula(precios, n0, CFG, null);
      if (!pf || pf.pieUF !== 600 || pf.n !== 3) F(`13 · la palanca de la fórmula no es «pie UF 600 → 3» (${JSON.stringify(pf)})`);
      const pfPlazo = palancaFormula(precios, n0, CFG, new Set(["d"]));
      if (!pfPlazo || pfPlazo.pieUF !== 900 || pfPlazo.n !== 1) F("13 · la palanca de la fórmula no respeta los Comprar a su plazo");
      if (palancaFormula([{ avisoId: "x", precioUF: 99_999 }], n0, CFG, null) !== null) F("13 · se ofrece una palanca de pie que no hace aparecer ninguno");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/\{!cero && alcanzan === 0 && <p className="as-bf" data-asesoria="formula-cero">\{F\.ceroDeptos\}<\/p>\}/.test(comp) || !/\{!cero && alcanzan === 0 && palanca && <p className="as-bf" data-asesoria="formula-palanca">\{C\.perfil\.palancaPie\(palanca\.pieUF, palanca\.n\)\}<\/p>\}/.test(comp)) F("13 · con 0, la fórmula no dice el texto y la palanca con su cifra");
      if (!/\{cero \|\| alcanzan === 0 \? \(\s*<div className="as-pie as-pie-dos">\s*<button type="button" className="as-principal" onClick=\{alAjustar\} data-asesoria="formula-ajustar">\{F\.ajustar\}<\/button>\s*<button type="button" className="as-secundario" onClick=\{alSeguir\} data-asesoria="formula-seguir-igual">\{F\.seguirIgual\}<\/button>/.test(comp)) F("13 · con 0, las dos salidas no son «Ajustar mis números» (principal) y «Seguir igual» (secundaria)");
      if (!/\{!cero && alcanzan != null && alcanzan > 0 && <p className="as-bf" data-asesoria="formula-alcanzan">\{F\.filtre\(alcanzan\)\}<\/p>\}/.test(comp)) F("13 · con 1 o más, la fórmula no sigue como antes");
      if (!/alAjustar=\{\(\) => \{ responder\("formula", "ajustar"\); setNumerosAbiertos\(true\); cambiar\(\(s\) => \(\{ \.\.\.s, paso: "numeros" \}\)\); \}\}/.test(comp)) F("13 · «Ajustar mis números» no vuelve a la tarjeta con lo ya contestado");
      if (!/palancaFormula\(p\.comprar, numeros, \{ tasaPct: agregados\.tasa, uf: agregados\.uf \}, idsAporte\)/.test(comp)) F("13 · la palanca de la fórmula no usa los Comprar del mapa con el plazo");
    }

    // ── 14 · LOS NUEVOS NO QUEDAN AFUERA (ajuste de Fabrizio, 27-nov-2026) ──
    {
      // a · la regla del pie por camino y los dos topes por separado.
      if (JSON.stringify(Object.keys(CAMINOS)) !== '["usado"]' || CAMINOS.usado.piePct !== 20 || CAMINOS.usado.forma !== "contado" || CAMINO_DE_HOY !== "usado") F("14 · el camino de hoy no es «usado, 20 % al contado»");
      const c = capacidad(base, CFG);
      const credito = creditoDeCuota(2_500_000 * 0.25, CFG.tasaPct, 30) / CFG.uf;
      // ⚠ ACTA (27-nov-2026, regla única): los dos topes con los gastos de la compra (600 ÷ 24,4 % = 2.450; (600 + crédito) ÷ 1,044).
      if (c.camino !== "usado" || c.topePieUF !== 2450 || c.topeRentaUF !== Math.floor((600 + credito) / 1.044 / 10) * 10 || c.topeUF !== Math.min(c.topePieUF, c.topeRentaUF)) F(`14 · los dos topes no son los esperados (renta ${c.topeRentaUF}, pie ${c.topePieUF}, tope ${c.topeUF})`);
      if (capacidad({ ...base, pie: "p1" }, CFG).topePieUF !== null) F("14 · sin pie, el tope por pie no es nulo");
      // b · la cifra de usados lo dice.
      if (ASESORIA_COPY.formula.filtre(1240) !== "De los usados que convienen, hoy te alcanzan 1.240.") F("14 · la cifra no dice que es de usados");
      // c · los dos límites. ⚠ ACTA (27-nov-2026, G24): el texto «Por tu renta llegas hasta… Con tu pie…» pasó a ser la tarjeta del tope
      // con los dos límites dibujados como barras («Por tu renta UF X» · «Con tu pie de UF 600, contando gastos UF Y»), siempre.
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      // ⚠ ACTA (27-nov-2026, tercera vuelta, punto 4): la tarjeta del tope va primero y marca el inicio de la pantalla.
      if (!/\{cero \? <p className="as-bf" data-inicio="1">\{F\.cero\}<\/p> : <TarjetaTope cap=\{cap\} inicio \/>\}/.test(comp)) F("14 · la fórmula no muestra la tarjeta del tope con los dos límites");
      if (!/\.\.\.\(cap\.pieUF != null && cap\.topePieUF != null \? \[\{ clave: "pie", etiqueta: F\.barraPie\(cap\.pieUF\), valor: cap\.topePieUF \}\] : \[\]\)/.test(comp) || !/\{ clave: "renta", etiqueta: cap\.limita === "deudas" \? F\.barraRenta\.deudas : F\.barraRenta\.renta, valor: cap\.topeRentaUF \}/.test(comp)) F("14 · la tarjeta del tope no dibuja los dos límites");
      if (!/data-manda=\{f\.valor === cap\.topeUF \? "1" : undefined\}/.test(comp)) F("14 · la tarjeta del tope no marca el límite que manda");
      if (ASESORIA_COPY.formula.barraPie(600) !== "Con tu pie de UF 600, contando gastos" || ASESORIA_COPY.formula.barraRenta.renta !== "Por tu renta" || ASESORIA_COPY.formula.puedes !== "Puedes comprar hasta aprox.") F("14 · los rótulos de la tarjeta del tope no son los de la lámina");
      // d · la salida «Avísame»: cuando limita el pie o con 0, 1 o 2; en el perfil con menos de 3, después de la palanca.
      const N = ASESORIA_COPY.nuevos;
      if (N.oferta !== "En deptos nuevos el pie se paga en cuotas. Pronto los sumo: ¿te aviso?" || N.boton !== "Avísame") F("14 · los textos de la salida de nuevos no son los aprobados");
      // ⚠ ACTA (27-nov-2026, C11): «Avísame» solo cuando calzan menos de 3 (ya no «cuando limita el pie»).
      if (!/\{!cero && alcanzan != null && alcanzan < 3 && <OfertaNuevos dicho=\{interesNuevos\} alAvisar=\{alAvisar\} \/>\}/.test(comp) || /cap\.limita === "pie" \|\|/.test(comp)) F("14 · la fórmula ofrece «Avísame» con 3 o más (C11)");
      if (!/data-asesoria="perfil-palanca">[^\n]*\n\s*\{r\.tres\.length < 3 && <OfertaNuevos dicho=\{interesNuevos\} alAvisar=\{alAvisar\} \/>\}/.test(comp)) F("14 · el perfil no ofrece «Avísame» con menos de 3, después de la palanca");
      if (!/className="as-depto-ver" onClick=\{alAvisar\} data-asesoria="nuevos-avisame"/.test(comp)) F("14 · «Avísame» no es un botón secundario");
      // Se guarda: en el estado sin cuenta, en el perfil al crearlo, y al momento si el perfil ya existe. Nunca un correo.
      if (pedidoPerfil({ ...ESTADO_INICIAL, interesNuevos: true }).interesNuevos !== true || pedidoPerfil(ESTADO_INICIAL).interesNuevos !== false) F("14 · «Avísame» no viaja al crear el perfil");
      const ok = validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 100_000, donde: { modo: "metro", comunas: [] }, lupa: "no", interesNuevos: true });
      const okNo = validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 100_000, donde: { modo: "metro", comunas: [] }, lupa: "no" });
      if (!ok.ok || !okNo.ok) F("14 · un pedido válido con o sin «Avísame» no pasa");
      else {
        const fila = filaPerfil("u", ok.pedido, calcularPerfil(ok.pedido, CFG), { esPrueba: true, existe: false, elegidos: [] });
        if (fila.camino !== "usado" || fila.tope_renta_uf !== c.topeRentaUF || fila.tope_pie_uf !== c.topePieUF || fila.tope_uf !== c.topeUF) F("14 · el perfil no guarda los dos topes y el camino");
        if (fila.interes_nuevos !== true || typeof fila.interes_nuevos_at !== "string") F("14 · el perfil no guarda «Avísame»");
        const filaNo = filaPerfil("u", okNo.pedido, calcularPerfil(okNo.pedido, CFG), { esPrueba: true, existe: true, elegidos: [] });
        if ("interes_nuevos" in filaNo) F("14 · un perfil rehecho sin «Avísame» borra un sí anterior");
      }
      const ruta = codigo("src/app/api/asesoria/interes-nuevos/route.ts");
      if (!/if \(!user\) return NextResponse\.json\(\{ error: "sin-sesion" \}, \{ status: 401 \}\);/.test(ruta) || !/if \(!acceso\.habilitada\) return NextResponse\.json\(\{ error: "no-existe" \}, \{ status: 404 \}\);/.test(ruta)) F("14 · la ruta de «Avísame» sin sesión o sin el interruptor");
      if (!/\.update\(\{ interes_nuevos: true, interes_nuevos_at: new Date\(\)\.toISOString\(\), updated_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("user_id", user\.id\)/.test(ruta)) F("14 · la ruta de «Avísame» escribe algo más que su respuesta, o de otra cuenta");
      if (/email|resend|enviarCorreo|sendEmail|capturarServidor/i.test(ruta) || /email|resend|enviarCorreo|sendEmail/i.test(codigo("src/lib/asesoria/perfil.ts"))) F("14 · «Avísame» manda un correo (todavía solo se guarda)");
      if (!/capture\(EVENTOS_ASESORIA\.nuevos, propsBase\(prueba, \{ paso: e\?\.paso \?\? "formula" \}\)\);/.test(comp)) F("14 · «Avísame» no se mide (o se mide con un monto)");
      // e · ninguna pregunta nueva: los pasos son los mismos.
      if (Object.keys(ESTADO_INICIAL).filter((k) => !["v", "paso", "cerrada"].includes(k)).join() !== "experiencia,objetivo,numeros,aporte,donde,lupa,interesNuevos") F("14 · el recorrido ganó una pregunta");
      const sql = leer("supabase/migrations/20261127_asesoria_dos_topes.sql");
      for (const col of ["camino text not null default 'usado'", "tope_renta_uf numeric", "tope_pie_uf numeric", "interes_nuevos boolean", "interes_nuevos_at timestamptz"]) if (!sql.includes(col)) F(`14 · la migración no trae ${col}`);
    }

    // ── 15 · LA REGLA ÚNICA DEL TOPE (tope/regla.ts, decisión de Fabrizio del 27-nov-2026) ──
    {
      if (pieMasGastosPct("usado") !== 24.4) F("15 · el pie más los gastos de un usado no es 24,4 %");
      const t = topesDeCompra({ pieUF: 600, creditoUF: 3000 });
      if (!cerca(t.topePieUF ?? 0, 600 / 0.244, 0.01) || !cerca(t.topeRentaUF ?? 0, 3600 / 1.044, 0.01) || t.limita !== "pie") F(`15 · los topes no son pie ÷ 24,4 % y (pie + crédito) ÷ 1,044 (${JSON.stringify(t)})`);
      const sinPie = topesDeCompra({ pieUF: null, creditoUF: 3000 });
      if (!cerca(sinPie.topeUF, 3000 / 0.8, 0.01) || sinPie.topePieUF !== null) F("15 · sin pie, el tope no es el crédito ÷ 80 % (los gastos los paga el pie que hace falta)");
      // La misma cuenta en Invierte: con el plazo por edad y la forma de la renta, la cifra antes de redondear es la de la asesoría.
      for (const n of [base, { ...base, tipoRenta: "boletas" as const, edad: "e4" as const, deudas: "d1" as const }, { ...base, pie: "p4" as const, edad: "e3" as const }]) {
        const a = capacidad(n, CFG);
        const renta = n.renta === "r3" ? 2_500_000 : 0;
        const deudas = n.deudas === "d1" ? 200_000 : 0;
        const pie = n.pie === "p4" ? 900 : 600;
        const i = hastaCuanto({ preaprobado: "no", pieUF: pie, rentaCLP: renta, otrasCuotasCLP: deudas, tasaPct: CFG.tasaPct, uf: CFG.uf, plazoAnios: a.plazo, tipoRenta: n.tipoRenta });
        if (Math.floor(i.topeUF / 10) * 10 !== a.topeUF) F(`15 · Invierte y la asesoría no dan el mismo tope (${i.topeUF} contra ${a.topeUF}, ${n.tipoRenta}, ${a.plazo} años)`);
      }
      const ps = codigo("src/lib/invierte-v2/perfil-servidor.ts");
      if (!/plazoAnios: previo\?\.plazoAnios \?\? null, tipoRenta: previo\?\.tipoRenta \?\? null \}\);/.test(ps)) F("15 · confirmarPerfil no usa el plazo y la renta del perfil de la asesoría");
      const pv = codigo("src/lib/invierte-v2/perfil.ts");
      if (!/creditoPorRentaRegla\(\{ rentaCLP, otrasCuotasCLP, tasaPct, uf, plazoAnios: o\.plazoAnios \?\? PLAZO_MAX, tipoRenta: o\.tipoRenta \?\? "contrato" \}\)/.test(pv) || /Math\.pow|\*\* -/.test(pv)) F("15 · Invierte tiene su propia cuenta del crédito (no la de la regla)");
      // B4: una cifra, un redondeo. La fórmula y la tarjeta muestran las mismas.
      const c = capacidad(base, CFG);
      if (c.porRentaUF !== c.topeRentaUF || c.porPieUF !== c.topePieUF) F("15 · la fórmula y la tarjeta del tope no usan la misma cifra");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/F\.porRentaCifra\(cap\.creditoUF, cap\.pieUF, cap\.porRentaUF\)/.test(comp) || !/F\.porPieCifra\(cap\.pieUF, cap\.porPieUF\)/.test(comp)) F("15 · la fórmula no muestra las cifras redondeadas de la capacidad");
      const Fo = ASESORIA_COPY.formula;
      if (Fo.porPieCifra(600, 2450) !== "UF 600 ÷ 24,4 % = UF 2.450" || !/÷ 1,044/.test(Fo.porRentaCifra(3270, 600, 3700)) || !/gastos de la compra/.test(Fo.porPie)) F("15 · la fórmula no cuenta los gastos en su texto");
      // La lámina 3: solo cuando limita el pie, «Con UF 100 más llegas a UF X» con la misma regla.
      const mas = topeConMasPie(c);
      if (c.limita !== "pie" || mas !== Math.min(c.topeRentaUF, Math.floor(700 / 0.244 / 10) * 10)) F(`15 · «con UF 100 más» no es el tope con 100 de pie más (${mas})`);
      if (topeConMasPie(capacidad({ ...base, renta: "r1", pie: "p4" }, CFG)) !== null) F("15 · «lo que te frena es el pie» aparece cuando limita la renta");
      if (Fo.frenaPie(2860) !== "Lo que te frena es el pie, no la renta. Con UF 100 más llegas a UF 2.860.") F("15 · el texto de la lámina 3 no es el aprobado");
      if (!/\{!cero && frena != null && frena > cap\.topeUF && <p className="as-bf" data-asesoria="formula-frena">\{F\.frenaPie\(frena\)\}<\/p>\}/.test(comp) || !/frena=\{cap \? topeConMasPie\(cap\) : null\}/.test(comp)) F("15 · la fórmula no dice qué la frena");
    }

    // ── 16 · LO QUE RINDE CADA COMUNA: la mediana (decisión de Fabrizio, 27-nov-2026) ──
    {
      if (MIN_DEPTOS_COMUNA_RINDE !== 15) F("16 · el mínimo por comuna no es 15");
      // A: 15 deptos con cap 4 % + k² · 0,02 % (asimétrica: mediana 4,98 %, media 5,35 %) y uno de 20 % que no cuenta; B: 14 (no entra).
      const arr = (cap: number, precio = 3000) => Math.round((cap * precio * CFG.uf) / 12);
      const capA = (k: number) => 0.04 + k * k * 0.0002;
      const A = Array.from({ length: 15 }, (_, k) => cand(`a${k}`, { comuna: "A", arriendo: arr(capA(k)) }));
      const raro = cand("araro", { comuna: "A", arriendo: arr(0.2) });
      const B = Array.from({ length: 14 }, (_, k) => cand(`b${k}`, { comuna: "B", arriendo: arr(0.09) }));
      const r = rindePorComuna([...A, raro, ...B], CFG.uf);
      if (r.rinde.length !== 1 || r.rinde[0].comuna !== "A" || !cerca(r.rinde[0].cap, capA(7), 0.0002) || r.rinde[0].n !== 15) F(`16 · lo que rinde la comuna no es la mediana sin los de más de 12 % y sin comunas chicas (${JSON.stringify(r.rinde)})`);
      const todos = [...A.map((_, k) => capA(k)), ...B.map(() => 0.09)].sort((x, y) => x - y);
      if (!cerca(r.santiago ?? 0, todos[Math.floor(todos.length / 2)], 0.0002)) F("16 · «Todo Santiago» no es la mediana de todos (sin los de más de 12 %)");
      if (ASESORIA_COPY.capRate.santiago !== "Todo Santiago") F("16 · la fila gris no dice «Todo Santiago»");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/const xs = agregados\.santiago != null \? \[\.\.\.top, \{ comuna: C\.capRate\.santiago, cap: agregados\.santiago, gris: true \}\] : top;/.test(comp)) F("16 · la fila gris no es todo Santiago");
      if (!/santiago: a\?\.santiago \?\? null/.test(codigo("src/app/api/asesoria/agregados/route.ts"))) F("16 · /agregados no devuelve la mediana de Santiago");
    }

    // ── 17 · LAS TARJETAS DE TUS DEPTOS (tarjetas.ts) ──
    {
      const cfg = { plazo: 30, tasaPct: CFG.tasaPct, uf: CFG.uf };
      const d = (id: string, o: { precioUF?: number; flujo?: number | null; lat?: number; lng?: number }) => ({ id, comuna: "Santiago", dormitorios: 2, precioUF: o.precioUF ?? 3000, flujo: o.flujo === undefined ? 0 : o.flujo, cap: 0.06, lat: o.lat ?? -33.40, lng: o.lng ?? -70.52 });
      const t = tarjetasDelPerfil([d("a", { flujo: 10_000, precioUF: 2500 }), d("b", { flujo: 90_000, lat: -33.4374154, lng: -70.6512777 }), d("c", { flujo: 40_000, precioUF: 2600 })], cfg);
      if (t.map((x) => x.id).join() !== "b,c,a") F(`17 · las tarjetas no van ordenadas por lo que dejan al mes (${t.map((x) => x.id).join()})`);
      if (t.filter((x) => x.masBarato).map((x) => x.id).join() !== "a") F("17 · «El más barato» no cae en el de menor precio");
      if (!t[0].metro || t[0].metro.m > 1000 || t.find((x) => x.id === "a")!.metro !== null) F("17 · «A X m del metro» no sale solo con una estación a 1 km o menos");
      if (tarjetasDelPerfil([d("x", { precioUF: 2000 })], cfg)[0].masBarato) F("17 · con un solo depto dice «El más barato»");
      if (tarjetasDelPerfil([d("x", { precioUF: 2000 }), d("y", { precioUF: 2000 })], cfg).some((x) => x.masBarato)) F("17 · con un empate dice «El más barato»");
      const tasa = t[0].tasa;
      const pt = pruebaTasa({ precioUF: 3000, flujoCLP: 90_000, plazo: 30, tasaPct: CFG.tasaPct, uf: CFG.uf });
      if (!tasa || tasa.aguanta !== pt.aguanta || tasa.poneCLP !== pt.poneCLP) F("17 · la línea de tasa no es la prueba de tasa del depto");
      if (tarjetasDelPerfil([d("n", { flujo: null })], cfg)[0].tasa !== null) F("17 · sin flujo se inventa una prueba de tasa");
      const P = ASESORIA_COPY.perfil;
      if (P.masBarato !== "El más barato" || P.metro("Santa Isabel", 437) !== "A 440 m del metro Santa Isabel" || P.aguanta !== "Aguanta si la tasa sube 1 punto" || P.conPunto(8000) !== "Con un punto más de tasa, pones $8.000 al mes") F("17 · los textos de las tarjetas no son los aprobados");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (/porQue/.test(comp) || "porQue" in P) F("17 · quedan las etiquetas viejas («El que mejor rinde», «El que pide menos»)");
      if (!/\{t\.masBarato && <span data-asesoria="etq-barato">\{P\.masBarato\}<\/span>\}/.test(comp) || !/\{t\.metro && <span data-asesoria="etq-metro">\{P\.metro\(t\.metro\.nombre, t\.metro\.m\)\}<\/span>\}/.test(comp)) F("17 · las etiquetas no salen solo cuando son verdad");
      if (!/\{t\.tasa && <span className="as-depto-tasa" data-asesoria="depto-tasa">\{t\.tasa\.aguanta \? P\.aguanta : P\.conPunto\(t\.tasa\.poneCLP\)\}<\/span>\}/.test(comp)) F("17 · la tarjeta no lleva su prueba de tasa");
      if (!/tres: tarjetasDelPerfil\(tres\.map\(/.test(codigo("src/app/api/asesoria/perfil/route.ts"))) F("17 · /perfil no arma las tarjetas con tarjetasDelPerfil");
      if (/estres|estresTitulo|subeTasa|mesVacio/.test(comp + JSON.stringify(Object.keys(P)))) F("17 · queda «Si algo se mueve» (C8)");
    }

    // ── 18 · «X DE CADA 10 SE PAGAN SOLOS» (C7) ──
    {
      if (UMBRAL_SOLOS !== 0.8) F("18 · el umbral no es 8 de cada 10");
      const a = sePaganSolos(10, 8), b = sePaganSolos(10, 7), c = sePaganSolos(2130, 1930), z = sePaganSolos(0, 0), h = sePaganSolos(100, 88);
      if (!a.mostrar || a.k !== 8 || b.mostrar || !c.mostrar || c.k !== 9 || z.mostrar || h.k !== 8) F(`18 · la regla de la buena noticia no es «al menos 80 %, hacia abajo» (${JSON.stringify([a, b, c, z])})`);
      const A = ASESORIA_COPY.alMes;
      if (A.solos(9).grande !== "9 de cada 10" || A.solos(9).chico !== "se pagan solos con el arriendo" || A.noPones !== "No tienes que poner plata cada mes." || A.puedoPoner !== "Puedo poner algo al mes") F("18 · los textos de la buena noticia no son los aprobados");
      if (A.solosLinea(1930, 2130) !== "1.930 de los 2.130 que te alcanzan te dejan plata cada mes, después del dividendo y los gastos.") F("18 · la línea de la buena noticia no es la de la lámina");
      if (A.izq !== "Nada" || /casi todo depto/i.test(A.pregunta)) F("18 · el slider dice algo falso o su izquierda no es «Nada»");
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      if (!/\? \{ \.\.\.sePaganSolos\(alcanzanAporte, calzan\.length\), n: calzan\.length, m: alcanzanAporte \} : null;/.test(comp) || !/e\?\.paso === "aporte" && !sliderAbierto && aporte === 0 && !aportePendiente/.test(comp)) F("18 · la buena noticia no se decide con 0 al mes contra los que te alcanzan");
      if (!/return p\.comprar\.filter\(\(x\) => x\.precioUF <= cap\.topeUF && \(!idsAlcanzan \|\| idsAlcanzan\.has\(x\.avisoId\)\)\)\.length;/.test(comp)) F("18 · «los que te alcanzan» del aporte no son los de la fórmula");
      if (!/cambiar\(\(s\) => \(\{ \.\.\.s, paso: PROYECTOS_VISIBLE \? "proyecto" : "aporte", aporte: 0, aporteLibre: false \}\)\)/.test(comp)) F("18 · el aporte no parte en 0");
      if (!/<button type="button" className="as-secundario" data-azul="1" onClick=\{alPoner\} data-asesoria="aporte-poner">\{A\.puedoPoner\}<\/button>\s*<button type="button" className="as-principal" onClick=\{alSeguir\} data-asesoria="aporte-seguir">\{A\.seguir\}<\/button>/.test(comp)) F("18 · «Seguir» no es el principal y «Puedo poner algo al mes» el secundario");
      if (!/const sinBuenaNoticia = solos != null && !solos\.mostrar;\s*useEffect\(\(\) => \{ if \(sinBuenaNoticia && !sliderAbierto\) setSliderAbierto\(true\); \}, \[sinBuenaNoticia, sliderAbierto\]\);/.test(comp)) F("18 · sin la buena noticia, el slider no queda abierto (mover el slider lo haría desaparecer)");
    }

    // ── 19 · EL DESTINO: Invierte con los tres (D14 y punto 2 de Fabrizio) ──
    {
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      const def = comp.match(/export const urlSeguirDeptos = \(ids: readonly string\[\]\): string =>\s*`([^`]+)`;/);
      if (!def || def[1] !== '/invierte/${ids[0]}?${new URLSearchParams({ desde: "explorar", ...(ids.length > 1 ? { mas: ids.slice(1).join(",") } : {}) })}') F("19 · el botón no lleva al primer depto con los otros en la dirección");
      if (urlEsperada(["a", "b", "c"]) !== "/invierte/a?desde=explorar&mas=b%2Cc") F("19 · la dirección del botón no es la esperada");
      if (!/<a className="as-principal" data-rojo="1" href=\{urlSeguirDeptos\(r\.tres\.map\(\(t\) => t\.id\)\)\} onClick=\{alSeguir\} data-asesoria="seguir-deptos">\{P\.seguirDeptos\(r\.tres\.length\)\}<\/a>/.test(comp) || ASESORIA_COPY.perfil.seguirDeptos(3) !== "Seguir con estos deptos" || ASESORIA_COPY.perfil.seguirDeptos(1) !== "Seguir con este depto") F("19 · el perfil no lleva el botón rojo «Seguir con estos deptos»");
      if ((comp.match(/data-rojo="1"/g) ?? []).length !== 2) F("19 · el rojo aparece en otro botón que «Partir» y «Seguir con estos deptos»");
      const ad = codigo("src/lib/invierte-v2/asesoria-servidor.ts");
      if (!/if \(!orden \|\| !perfil \|\| perfil\.origen !== "asesoria" \|\| perfil\.topeSupuestos\?\.adoptadoInvierte\) return \{ adoptado: false \};/.test(ad)) F("19 · la adopción del perfil no exige orden, perfil de la asesoría y una sola vez");
      if (!/for \(const avisoId of perfil\.elegidos\) \{\s*const s = await sumarDepto\(admin, user, avisoId, null, "mapa", null\)/.test(ad)) F("19 · al firmar no se suman los deptos elegidos");
      if (/hastaCuanto\(/.test(ad)) F("19 · la adopción recalcula el tope (manda el de la asesoría)");
      const pg = codigo("src/app/invierte/perfil/page.tsx");
      if (!/if \(\(await adoptarPerfilAsesoria\(admin, \{ id: user\.id, email: user\.email \?\? null \}\)\)\.adoptado\) redirect\(URL_BASE\);/.test(pg)) F("19 · Invierte vuelve a preguntar el perfil a quien viene de la asesoría (o no lo lleva a sus deptos)");
      const ct = codigo("src/app/invierte/[avisoId]/page.tsx");
      if (!/if \(perfil\?\.origen === "asesoria" && perfil\.topePieUF != null && depto\.precioUF != null && depto\.precioUF <= perfil\.topePieUF && !inicial\?\.pie\)/.test(ct) || !/\{!inicial\?\.pieConocido && !asesoria && <fieldset className="inv-pregunta">/.test(codigo("src/components/invierte-v2/ContactoForm.tsx"))) F("19 · el contacto vuelve a preguntar el pie que ya dijo en la asesoría");
      const ac = codigo("src/lib/invierte-v2/acceso-servidor.ts");
      if (!/if \(modo !== "lista"\) return false;\s*return accesoPorAsesoria\(user\?\.id \?\? null\);/.test(ac) || !/const \{ modo \} = await estadoAsesoria\(\);\s*if \(modo !== "lista"\) return false;/.test(ac) || !/return a\.habilitada && a\.prueba;/.test(ac)) F("19 · el acceso de prueba abre Invierte fuera de «lista» o a alguien que no está en la lista de la asesoría");
    }

    // ── 20 · LA SEGUNDA VUELTA EN PANTALLA ──
    {
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      const css = leer("src/app/explorar/asesoria/asesoria.css");
      // C6: sin «Cerca de mi pega».
      for (const f of ["src/app/explorar/asesoria/asesoria.tsx", "src/lib/asesoria/lugar.ts", "src/lib/asesoria/estado.ts", "src/lib/asesoria/perfil.ts", "src/lib/asesoria/eventos.ts", "src/lib/asesoria/estilo-marcas.ts", "src/app/explorar/mapa-explorar.tsx"]) if (/pega\b|RADIO_PEGA|cercaDe\(/i.test(codigo(f))) F(`20 · queda «Cerca de mi pega» en ${f}`);
      if ("pega" in ASESORIA_COPY.donde || "tocaPega" in ASESORIA_COPY.donde) F("20 · quedan los textos de la pega");
      if (validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 0, donde: { modo: "pega", comunas: [] }, lupa: "no" }).ok) F("20 · el perfil todavía acepta «pega»");
      // C10: la lupa.
      const L = ASESORIA_COPY.lupa;
      if (L.pasos.length !== 2 || L.pasos[0] !== "Si tienes una deuda atrasada, ponte al día o repacta. Si emites boletas hace poco, junta al menos 12 meses antes de pedir el crédito." || !/CMF/.test(L.pasos[1])) F("20 · los pasos de la lupa no son los aprobados");
      if (!L.pregunta.endsWith("Queda en tu perfil, para orientarte mejor.") || /nadie más/.test(L.pregunta)) F("20 · la lupa todavía dice «Esto no lo ve nadie más»");
      // C12: la preaprobación.
      const Pr = ASESORIA_COPY.perfil.preaprobacion;
      if (Pr.tengo !== "Con preaprobación ya puedes ofertar." || Pr.no !== "Sin preaprobación, es lo primero que te pediría el banco." || Pr.tramite !== "Con la preaprobación en trámite, apenas salga puedes ofertar.") F("20 · las líneas de la preaprobación no son las aprobadas");
      if (!/\{numeros && <p className="as-aviso" data-asesoria="perfil-preaprobacion">\{P\.preaprobacion\[numeros\.preaprobado\]\}<\/p>\}/.test(comp)) F("20 · el perfil no dice la línea de la preaprobación");
      // F19 y F20.
      if (ASESORIA_COPY.calzanDe(3624, 4512) !== "3.624 de los 4.512 que convienen te calzan") F("20 · la cuenta del mapa no dice «X de los Y que convienen te calzan»");
      // ⚠ ACTA (27-nov-2026, tercera vuelta, punto 5): el paso 0 ya no repite el universo de la burbuja; parte con la pregunta (§24).
      // F21: la hoja de registro con el número real, y el chat de atrás no la repite.
      const h3 = textosHoja({ motivo: "asesoria", pin: null, deptosAsesoria: 3 }), h2 = textosHoja({ motivo: "asesoria", pin: null, deptosAsesoria: 2 }), h0 = textosHoja({ motivo: "asesoria", pin: null, deptosAsesoria: 0 });
      if (h3.titulo !== "Tu perfil y tus 3 deptos están listos." || h3.cuerpo !== "Crea tu cuenta gratis y te los muestro. Trae un crédito de regalo." || h2.titulo !== "Tu perfil y tus 2 deptos están listos." || /\d/.test(h0.titulo)) F(`20 · la hoja de registro no dice el número real de deptos (${h3.titulo} / ${h2.titulo} / ${h0.titulo})`);
      if (/C\.cierre\.titulo|C\.cierre\.cuerpo/.test(comp) || !/deptos: Math\.min\(3, calzan\?\.length \?\? 0\)/.test(comp)) F("20 · el chat repite el texto de la hoja de registro, o la hoja no recibe cuántos deptos");
      const cli = codigo("src/app/explorar/explorar-cliente.tsx");
      if (!/deptosAsesoria: deptos,/.test(cli)) F("20 · el mapa no pasa cuántos deptos a la hoja de registro");
      // F22: con la hoja cerrada, el filtro se ve en la barra y se quita.
      if (!/\{filtroAsesoria\?\.cerrada && \(\s*<button type="button" className="ex-boton" data-activo="1" data-explorar="filtro-perfil" aria-label=\{FILTRO_PERFIL_COPY\.quitar\} onClick=\{\(\) => setQuitarAsesoria\(\(n\) => n \+ 1\)\}>/.test(cli) || !/quitarFiltro=\{quitarAsesoria\}/.test(cli)) F("20 · con la hoja cerrada, el filtro del perfil no se ve ni se quita desde la barra (F22)");
      if (!/cerrada: visible === "chica" && !!calzan/.test(comp) || !/cambiar\(\(x\) => \(\{ \.\.\.x, sinFiltro: true \}\)\);/.test(comp) || !/const filtroQuitado = e\?\.sinFiltro === true && visible === "chica";/.test(comp)) F("20 · quitar el filtro no lo apaga hasta «Retomar»");
      if (!/cambiar\(\(x\) => \(\{ \.\.\.x, cerrada: false, sinFiltro: false \}\)\)/.test(comp)) F("20 · «Retomar» no vuelve a poner el filtro");
      // F23: un solo contador y «Retomar» que no tapa la tarjeta.
      if (!/const conCuenta = !!e && e\.paso !== "perfil" && !filtroQuitado && !!calzan;/.test(comp) || !/\{conCuenta && cuenta\}/.test(comp)) F("20 · desde el perfil se montan dos contadores (F23)");
      if (!/\{!p\.tapado && <button type="button" className="as-raiz as-chica ph-no-capture"/.test(comp) || !/tapado=\{!!tarjeta\}/.test(cli)) F("20 · «Retomar» tapa los botones de la tarjeta del depto (F23)");
      // E17: la pastilla en dos líneas como mucho.
      if (!/\.as-cuenta \{[^}]*max-height: 3\.2em; overflow: hidden; line-height: 1\.3;/.test(css)) F("20 · la pastilla del mapa puede pasar de dos líneas (E17)");
      // G24: la burbuja con el número, el ícono de Franco, el degradado solo en la burbuja y el tope.
      const B = ASESORIA_COPY.burbuja;
      if (B.titulo !== "¿Cuáles te alcanzan a ti?" || B.revisados !== "Revisados anoche, uno por uno" || B.numero(4512, 19037).n !== "4.512" || B.numero(4512, 19037).de !== "de 19.037 convienen") F("20 · la burbuja no dice lo de la lámina");
      if (!/<p className="as-banda-n"><b data-asesoria="burbuja-numero">\{n\.n\}<\/b><span>\{n\.de\}<\/span><\/p>/.test(comp)) F("20 · la burbuja no parte con el número");
      if (!/src="\/icon\.png"/.test(comp) || />F<\/span>/.test(comp)) F("20 · queda la F negra en vez del ícono de Franco");
      if ((comp.match(/className="as-banda"/g) ?? []).length !== 2 || (css.match(/var\(--as-degradado\)/g) ?? []).length !== 1 || !/\.as-banda \{[^}]*background: var\(--as-degradado\)/.test(css)) F("20 · el degradado aparece fuera de la burbuja y la tarjeta del tope");
      if (!/\.as-principal\[data-rojo="1"\] \{ background: var\(--signal-red, #C8323C\)/.test(css) || /chip-v-b[^;]*\)[^;]*;/.test(css.replace(/--as-degradado:[^;]*;/, "").replace(/\.as-prop[^\n]*\n/g, ""))) F("20 · el rojo se usa fuera de «Partir» y «Seguir con estos deptos» (o de los datos)");
      // La foto de la calle: la de siempre, solo con la tarjeta en pantalla.
      if (!/const io = new IntersectionObserver\(\(es\) => \{ if \(es\.some\(\(x\) => x\.isIntersecting\)\) \{ setEnPantalla\(true\); io\.disconnect\(\); \} \}/.test(comp) || !/const tipos = useCalle\(enPantalla \? \[id\] : \[\]\);/.test(comp) || !/\{enPantalla && <ImagenDepto avisoId=\{id\} tipo=\{tipos\[id\]\} clase="as-foto-img" carga="lazy" \/>\}/.test(comp)) F("20 · la foto del depto no es la vista de la calle cargada solo en pantalla");
    }

    // ── 21 · LOS DATOS MALOS FUERA DEL PERFIL (tercera vuelta, 27-nov-2026) ──
    {
      if (M2_MIN_TRES_DORMITORIOS !== 50) F("21 · el mínimo de m² para 3 dormitorios no es 50");
      const P = { plazo: 30 as const, aporte: 100_000, topeUF: 5000, comunas: [] as string[], uf: CFG.uf };
      const arr = (cap: number) => Math.round((cap * 3000 * CFG.uf) / 12);
      const u = universoDe([
        cand("cap105", { arriendo: arr(0.105) }), cand("cap95", { arriendo: arr(0.095), lat: -33.3 }),
        cand("3d44", { dormitorios: 3, m2: 44, lat: -33.2 }), cand("2d44", { dormitorios: 2, m2: 44, lat: -33.1 }),
        cand("3dnull", { dormitorios: 3, m2: null, lat: -33.0 }), cand("3d50", { dormitorios: 3, m2: 50, lat: -33.5 }), cand("4d48", { dormitorios: 4, m2: 48, lat: -33.6 }),
      ], P).map((c) => c.id).sort().join();
      if (u !== "2d44,3d50,3dnull,cap95") F(`21 · el universo del perfil no saca el cap rate sobre 10 % y los 3D o más de menos de 50 m² (${u})`);
      // La palanca usa el mismo universo (palanca.ts › universoDe): un 3D de 44 m² no hace aparecer deptos.
      const conPie600 = palanca([cand("grande", { dormitorios: 3, m2: 70, precioUF: 2400, f: { 30: -40_000 } })], { ...P, topeUF: 1220 }, { ...base, pie: "p2" }, CFG);
      if (!conPie600 || conPie600.n !== 1) F("21 · el fixture de la palanca no la ejercita (un 3D de 70 m² con pie UF 600 debía aparecer)");
      const pP = palanca([cand("chico", { dormitorios: 3, m2: 44, precioUF: 2400, f: { 30: -40_000 } })], { ...P, topeUF: 1220 }, { ...base, pie: "p2" }, CFG);
      if (pP !== null) F("21 · la palanca cuenta un 3D de menos de 50 m²");
      // Las medianas siguen con el corte de 12 % (lo aprobado para «Todo Santiago»).
      const once = Array.from({ length: 15 }, (_, k) => cand(`m${k}`, { comuna: "M", arriendo: arr(0.11) }));
      if (rindePorComuna(once, CFG.uf).rinde.length !== 1) F("21 · las medianas por comuna sacan los de 10-12 % (su corte es 12 %)");
      // Los m² llegan en la fila (posición 15) y, sin ella, quedan nulos.
      const fila = ["x", "Ñuñoa", -33.4, -70.6, 3, 3000, 70, 600_000, -1, -1, -1, -1, true, true, true] as unknown as FilaCandidato;
      if (candidatoDeFila(fila).m2 !== null || candidatoDeFila([...fila, 44] as unknown as FilaCandidato).m2 !== 44) F("21 · candidatoDeFila no lee los m² de la posición 15");
      const srv = codigo("src/lib/asesoria/servidor.ts");
      if (!/\.from\("scraped_properties"\)\.select\("id, superficie_m2"\)\.in\("id", tanda\)/.test(srv) || !/TANDA_M2 = 200;/.test(srv) || !/Number\(f\[4\]\) >= 3/.test(srv)) F("21 · el universo no completa los m² de los 3D o más en tandas bajo el corte de 1.000");
    }

    // ── 22 · INVIERTE RECIBE LOS 3 (tercera vuelta, 27-nov-2026) ──
    {
      const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", Cc = "33333333-3333-4333-8333-333333333333", X = "99999999-9999-4999-8999-999999999999";
      const el = [B, A, Cc];
      if ((idsDeLaAsesoria(A, `${B},${Cc}`, el) ?? []).join() !== [A, B, Cc].join()) F("22 · los 3 de la asesoría no llegan en el orden del botón");
      if (idsDeLaAsesoria(A, `${B},${X}`, el) !== null || idsDeLaAsesoria(X, B, el) !== null) F("22 · se aceptan ids que no son de los elegidos de la persona");
      if (idsDeLaAsesoria(A, null, el) !== null || idsDeLaAsesoria(A, `${B},${Cc},${A}`, el)?.length !== 3) F("22 · sin «mas» no es la asesoría, o un id repetido cuenta dos veces");
      if (idsDeLaAsesoria(A, "no-es-uuid", el) !== null) F("22 · se acepta un «mas» que no es una lista de ids");
      // Lo que ya se sabe: la urgencia sale de la preaprobación y el pie de su tope por pie.
      const k = (pre: "tengo" | "tramite" | "no", tope: number | null, pie: "si" | "parte" | "no" | null, precio: number) => contactoDeAsesoria({ preaprobado: pre, topePieUF: tope, pieTiene: pie }, precio);
      if (k("tengo", 2450, "si", 2000).urgencia !== "este_mes" || k("tramite", 2450, "si", 2000).urgencia !== "uno_a_tres" || k("no", 2450, "si", 2000).urgencia !== "mas_adelante") F("22 · la urgencia no sale de la preaprobación");
      if (k("no", 2450, "si", 2000).pie !== "si" || k("no", 2450, "si", 2600).pie !== "parte" || k("no", null, "parte", 2600).pie !== "parte" || k("no", null, "no", 2600).pie !== "no") F("22 · el pie no sale de su tope por pie");
      const Fc = FLUJO_COPY.contacto;
      if (Fc.asesoriaTitulo(3) !== "Invierte en tus 3 deptos con Franco" || Fc.asesoriaTitulo(1) !== "Invierte en tu depto con Franco" || Fc.asesoriaParrafo(3) !== "Franco trabaja con tus 3 deptos y te va mostrando más opciones.") F("22 · los textos del contacto desde la asesoría no son los aprobados");
      if (lineaDeptoAsesoria({ lugar: "Av. Pajaritos", precioUF: 2123, flujoCLP: 314_167 }) !== "Av. Pajaritos · UF 2.123 · Te deja $314.167 al mes" || lineaDeptoAsesoria({ lugar: "Maipú", precioUF: 2000, flujoCLP: -12_000 }) !== "Maipú · UF 2.000 · Pones $12.000 al mes") F("22 · la fila de cada depto no dice lugar, precio y lo que deja");
      const form = codigo("src/components/invierte-v2/ContactoForm.tsx");
      if (!/\{!asesoria && <fieldset className="inv-pregunta">\s*<legend>\{H\.cuando\}<\/legend>/.test(form)) F("22 · desde la asesoría todavía se pregunta «¿Cuándo piensas comprar?»");
      if (!/\{!inicial\?\.pieConocido && !asesoria && <fieldset className="inv-pregunta">/.test(form)) F("22 · desde la asesoría todavía se pregunta el pie");
      if (!/<h1 className="inv-titulo" id="iv2-t">\{asesoria \? C\.asesoriaTitulo\(asesoria\.deptos\.length\) : C\.titulo\}<\/h1>/.test(form) || !/\{asesoria \? C\.asesoriaParrafo\(asesoria\.deptos\.length\) : C\.parrafo\}/.test(form)) F("22 · el título o el párrafo del contacto no dicen los deptos de la asesoría");
      if (!/asesoria\.deptos\.map\(\(d\) => <li key=\{d\.avisoId\}[^>]*>\{lineaDeptoAsesoria\(d\)\}<\/li>\)/.test(form)) F("22 · el contacto no muestra la fila de los deptos");
      const pg = codigo("src/app/invierte/[avisoId]/page.tsx");
      if (!/const asesoria = user && perfil\?\.origen === "asesoria" \? await contactoDesdeAsesoria\(admin, perfil, depto, searchParams\.mas\) : null;/.test(pg) || !/<ContactoForm [^>]*asesoria=\{asesoriaContacto\}/.test(pg)) F("22 · la página del contacto no arma los deptos de la asesoría");
    }

    // ── 23 · LA TARJETA DEL MAPA DICE SU PLAZO (tercera vuelta, 27-nov-2026) ──
    {
      if (TARJETA_COPY.aPlazo(15) !== "a 15 años" || TARJETA_COPY.aPlazo(30) !== "a 30 años") F("23 · la tarjeta no dice el plazo del flujo");
      const tj = codigo("src/app/explorar/tarjeta-pin.tsx");
      if (!/const flujos = useFlujoPlazo\(pines\.map\(\(p\) => p\.avisoId\), plazo\);/.test(tj) || !/const flujoVisto = plazo != null && plazo < 30 \? flujos\[p\.avisoId\] : p\.flujo;/.test(tj)) F("23 · la tarjeta no usa el flujo al plazo del perfil");
      if (!/<span className="ex-cifra-plazo" data-explorar="flujo-plazo">\{TARJETA_COPY\.aPlazo\(plazo != null && plazo < 30 \? plazo : plazoMapa\)\}<\/span>/.test(tj)) F("23 · la tarjeta no dice «a N años» (con perfil su plazo; sin perfil, el del mapa, 30 por defecto)");
      const rt = codigo("src/app/api/explorar/flujo-plazo/route.ts");
      if (!/if \(!user\) return NextResponse\.json\(\{ error: "sin-sesion" \}, \{ status: 401 \}\);/.test(rt) || !/\.from\("inv_perfiles"\)\.select\("plazo_anios"\)\.eq\("user_id", user\.id\)/.test(rt) || /b\.plazo|body\.plazo/.test(rt)) F("23 · la ruta del flujo por plazo no exige sesión o no lee el plazo de SU perfil");
      if (!/const plazoPerfil = user \? await plazoDelPerfil\(admin, user\.id\) : null;/.test(codigo("src/app/explorar/page.tsx")) || !/plazo=\{plazoVivo != null && plazoVivo < PLAZO_POR_DEFECTO && filtros\.plazo === PLAZO_POR_DEFECTO \? plazoVivo : null\}\s*plazoMapa=\{filtros\.plazo\}/.test(codigo("src/app/explorar/explorar-cliente.tsx"))) F("23 · el mapa no pasa el plazo del perfil a la tarjeta");
      // El perfil se crea en el navegador DESPUÉS de cargar la página (paseo del 27-nov-2026: con perfil a 15 años la tarjeta decía «a 30
      // años»): la asesoría avisa el plazo apenas lo guarda.
      if (!/p\.alPlazoPerfil\?\.\(d\.plazo\);/.test(codigo("src/app/explorar/asesoria/asesoria.tsx")) || !/alPlazoPerfil=\{setPlazoVivo\}/.test(codigo("src/app/explorar/explorar-cliente.tsx")) || !/const \[plazoVivo, setPlazoVivo\] = useState<number \| null>\(plazoPerfil\);/.test(codigo("src/app/explorar/explorar-cliente.tsx"))) F("23 · el plazo del perfil recién creado no llega a la tarjeta");
    }

    // ── 24 · LA PANTALLA, TERCERA VUELTA (27-nov-2026) ──
    {
      const comp = codigo("src/app/explorar/asesoria/asesoria.tsx");
      const css = leer("src/app/explorar/asesoria/asesoria.css");
      const cssEx = leer("src/app/explorar/explorar.css");
      const cli = codigo("src/app/explorar/explorar-cliente.tsx");
      // 4 · el tope primero; «Así lo calculo» plegado bajo «Ver la cuenta».
      const formula = (comp.split("function Formula(")[1] ?? "").split("\nfunction ")[0];
      if (!(formula.indexOf("<TarjetaTope cap={cap} inicio />") > 0 && formula.indexOf("<TarjetaTope cap={cap} inicio />") < formula.indexOf('className="as-paso"'))) F("24 · la tarjeta del tope no va antes de «Así lo calculo»");
      if (!/\{verCuenta && \(\s*<div className="as-tarjeta" data-asesoria="cuenta-formula">/.test(formula) || !/data-asesoria="ver-cuenta"[^>]*>\{verCuenta \? F\.ocultarCuenta : F\.verCuenta\}<\/button>/.test(formula) || ASESORIA_COPY.formula.verCuenta !== "Ver la cuenta") F("24 · «Así lo calculo» no va plegado con «Ver la cuenta»");
      // 5 · el paso 0 parte con la pregunta y, con la burbuja, el contador del mapa se esconde.
      if (ASESORIA_COPY.gancho.pregunta !== "Para partir: ¿es tu primera inversión?") F("24 · el paso 0 no parte con «Para partir: ¿es tu primera inversión?»");
      const gancho = (comp.split("function Gancho(")[1] ?? "").split("\nfunction ")[0];
      if (/as-tarjeta|gancho\.revise|gancho\.tarjeta/.test(gancho) || "revise" in ASESORIA_COPY.gancho) F("24 · el paso 0 repite el universo de la burbuja");
      if (!/useEffect\(\(\) => \{ p\.alBurbuja\?\.\(visible === "burbuja"\); \}, \[visible\]\);/.test(comp) || !/\{vista === "mapa" && !filtroAsesoria && !burbujaAsesoria && \(/.test(cli) || !/alBurbuja=\{setBurbujaAsesoria\}/.test(cli)) F("24 · con la burbuja abierta el contador del mapa repite el número");
      // 6 · «Seguir» de la buena noticia no filtra por aporte: quedan todos los que le alcanzan.
      if (!/alSeguir=\{\(\) => \{ responder\("aporte", "solos"\); cambiar\(\(s\) => \(\{ \.\.\.s, aporte: ALTO_MAXIMO, aporteLibre: true, paso: "donde" \}\)\); \}\}/.test(comp)) F("24 · «Seguir» en la buena noticia filtra por aporte");
      if (!/const altoPedido: Aporte \| null = e\?\.aporteLibre && pasoN >= PASO_N\.aporte \? \(plazo < 30 \? ALTO_MAXIMO : null\) : pasoN >= PASO_N\.aporte \? aporte :/.test(comp)) F("24 · con el aporte libre, el mapa no cuenta los mismos que «te alcanzan»");
      if (!/alCambiar=\{\(a\) => cambiar\(\(s\) => \(\{ \.\.\.s, aporte: a, aporteLibre: false \}\)\)\}/.test(comp)) F("24 · mover el slider no deja de ser «libre»");
      if (pedidoPerfil({ ...ESTADO_INICIAL, aporteLibre: true }).aporteLibre !== true) F("24 · el aporte libre no viaja al crear el perfil");
      const libre = validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 300_000, aporteLibre: true, donde: { modo: "metro", comunas: [] }, lupa: "no" });
      if (!libre.ok || libre.pedido.aporteLibre !== true || filaPerfil("u", libre.pedido, calcularPerfil(libre.pedido, CFG), { esPrueba: true, existe: false, elegidos: [] }).aporte_mensual_clp !== null) F("24 · el perfil con aporte libre no se guarda sin límite de aporte");
      if (!/aporte: p\.aporteLibre \? Number\.MAX_SAFE_INTEGER : p\.aporte/.test(codigo("src/app/api/asesoria/perfil/route.ts"))) F("24 · con el aporte libre, los deptos del perfil se filtran por aporte");
      // 9 · los textos.
      if (ASESORIA_COPY.capRate.bajada !== "Lo que rinde un depto típico de los que convienen") F("24 · la bajada del cap rate no es la aprobada");
      if ("estimacion" in ASESORIA_COPY.perfil.avisos) F("24 · el perfil todavía dice «Estimación, sujeta a evaluación del banco»");
      if (!/\{aporte > 0 && <b data-asesoria="aporte-valor">\{pesos\(aporte\)\}<\/b>\}/.test(comp)) F("24 · el slider dice «Nada» dos veces");
      // 10 · el aporte 0 se pide durante la fórmula.
      if (!/const altoPrevio: Aporte \| null = e\?\.paso === "formula" \? 0 : null;/.test(comp) || !/\[altoPedido, altoAlcanzan, altoPrevio\]\.filter/.test(comp)) F("24 · el aporte 0 no se pide durante la fórmula");
      // 8 · las casillas del contador del mapa en dos líneas como mucho a 375.
      if (!/@media \(max-width: 400px\) \{\s*\.ex-vc \{[^}]*padding: 4px 6px[^}]*\}\s*\.ex-vc-t \{[^}]*white-space: nowrap;[^}]*font-size: 11px;/.test(cssEx)) F("24 · las casillas del contador pueden pasar de dos líneas a 375");
      void css;
    }
  } catch (e) {
    F(`excepción: ${(e as Error).stack ?? e}`);
  }
  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ todo en orden");
  return { hard: fallas.length };
}

if (require.main === module) void runAsesoria().then((r) => { process.exitCode = r.hard ? 1 : 0; });

// ── ACTA DE MUTACIONES (27-nov-2026) ──
// 23 mutaciones, las 23 en ROJO (runner aparte que restaura cada archivo byte a byte): boletas al 80 %; deudas con el valor más bajo;
// 55+ a 20 años; el pie bajo sin dividir por 80 %; el tope sin redondeo; la máscara sin el veredicto del plazo; un alto libre
// (110 mil); el edificio a 10 m; «el distinto» sin condición; «lista» que deja pasar a todos; la burbuja sin ph-no-capture; el
// evento con el chip; el evento del perfil con el tope; Sentry del servidor sin la limpieza; la limpieza que deja pasar la renta; el
// texto de boletas cambiado; /deptos que redirige sin mirar el interruptor; la bienvenida que no cede; la burbuja al cargar; /aporte
// sin el tope; /aporte devolviendo una cifra; /perfil sin el interruptor; la lupa «no» guardada como false.
// Punto 5 (27-nov-2026), 8 mutaciones más, las 8 en ROJO: la conveniencia sin el veredicto del plazo; la palanca del pie sin
// recalcular el tope; la palanca que menos mueve; una palanca que no suma; la palanca con 3 o más; el plazo corto dicho a 30 años; el
// texto del plazo corto cambiado; «encontré N» que repite la palanca. (La primera versión limitaba el pie a «cuando limita el pie»:
// la mutación que la quitaba salió VERDE y mostró que era falso —con la renta limitando, el tope es pie + crédito y más pie suma—.)
// 27-nov-2026 (tercera ronda), 6 mutaciones más, las 6 en ROJO: sin el tercero por puntaje; el tercero por puntaje antes que el
// distinto; el tercero sin mirar el edificio; el texto viejo de «Que gane valor»; el encabezado con «asesoría de inversión»; el
// encabezado sin «Franco».
// El paseo (27-nov-2026), 6 mutaciones más, las 6 en ROJO: el cierre que promete 3 cuando calzan menos; la hoja sin subir sobre el
// aviso de cookies; el CSS sin la altura del aviso; la conversación que no baja sola; el encuadre sin el aire de la hoja; «Dónde» sin
// dejar el mapa quieto.
// Paseo con 50–54 años (27-nov-2026), 5 mutaciones más, las 5 en ROJO: «Calzan» con la cifra anterior mientras llega el aporte; la
// fórmula sin el plazo; la fórmula que dice «te alcanzan» antes de que llegue; el universo sin las comunas del mapa; el perfil desde abajo.
// Cap rate y 0 en la fórmula (27-nov-2026), 9 mutaciones más, las 9 en ROJO: sin el corte del cap rate; el corte con «>=»; el corte a
// 15 %; la palanca de la fórmula sin el plazo; la palanca con 0; la fórmula sin el texto del 0; con 0, un solo botón; «Ajustar mis
// números» sin abrir la tarjeta; «Seguir igual» con otro texto.
// Los nuevos no quedan afuera (27-nov-2026), 10 mutaciones más, las 10 en ROJO: el pie sin la regla del camino; el tope por renta igual
// al menor; el perfil sin el tope por pie; la cifra sin decir «usados»; sin los dos límites; «Avísame» solo con 0; «Avísame» que no viaja
// al perfil; un perfil rehecho que borra el sí; la ruta de «Avísame» sin el interruptor; el botón con otro texto.
// La segunda vuelta (27-nov-2026), 48 mutaciones (45 sobre este tier y 3 sobre INVIERTE-V2-E2), las 48 en ROJO (runner aparte que
// restaura cada archivo byte a byte): la regla sin gastos; el tope por renta sin dividir por 1,044; la fórmula sin redondear (B4); «con
// UF 100 más» con 200; «lo que te frena» con la renta limitando; la prueba de tasa a 30 años siempre; confirmarPerfil sin el plazo y la
// renta del perfil; Invierte ignorando el plazo; las medianas con los de más de 12 %; el promedio en vez de la mediana; el mínimo a 14;
// la fila gris que no es Santiago; las tarjetas por precio; «el más barato» con uno solo; el metro a 5 km; la buena noticia con 70 %;
// «X de cada 10» redondeado hacia arriba; el aporte que parte en 100 mil; «Puedo poner» como principal; el slider que no queda abierto;
// el botón sin el segundo depto; el rojo en «Seguir» de la fórmula; la adopción repetida; Invierte que vuelve a preguntar el perfil; el
// acceso sin la marca de prueba; el acceso fuera de «lista»; el contacto que pregunta el pie igual; la lupa con el paso 3; sin la línea
// de preaprobación; la hoja que siempre dice 3; sin el filtro en la barra; «Retomar» que no repone el filtro; «Retomar» que tapa la
// tarjeta; dos contadores en el perfil; el scroll al primer marcado; la fórmula sin su marca; la pastilla sin tope de líneas; el
// degradado en la buena noticia; sin el ícono de Franco; la foto antes de estar en pantalla; «Avísame» con 3; vuelve la pega; el tope sin
// marcar quién manda; la tarjeta del tope sin el pie; vuelve a bajar sola; y en Invierte: la falta de pie sin gastos, la ayuda del pie
// sin gastos, el monto aprobado sin contar el pie.
// CUATRO SALIERON VERDES EN LA PRIMERA PASADA, y los cuatro eran el fixture, no el código: la prueba de tasa con un flujo que cubría la
// subida a los dos plazos (pasó a flujo 0), una muestra simétrica donde la media y la mediana coinciden (pasó a una cuadrática), un
// depto sin ninguna estación a menos de 5 km (pasó a uno a 2,5 km de Los Dominicos) y 1.930 de 2.130, que da 9 truncando y redondeando
// (se sumó 88 de 100). Reescritos, los cuatro salen rojos.
// La tercera vuelta (27-nov-2026), secciones 21 a 24 y las actas sobre 2, 4, 12, 14, 18, 19 y 20: 26 mutaciones, las 26 en ROJO (runner
// aparte que restaura cada archivo byte a byte): el corte del perfil en 12 %; sin la regla de los 3D chicos; los 3D chicos con 2
// dormitorios; las medianas con el corte del perfil; los m² sin leer de la fila; los m² en tandas de 2.000; ids ajenos aceptados en
// Invierte; la urgencia fija; el pie siempre «sí»; vuelve «¿Cuándo piensas comprar?»; el título de un solo depto; la página sin los
// deptos; la tarjeta sin el flujo al plazo; la tarjeta siempre «a 30 años»; la ruta que lee el plazo del cuerpo; el plazo del perfil
// nuevo que no llega a la tarjeta; el tope después de la cuenta; la cuenta abierta siempre; el contador con la burbuja; «Seguir» que
// filtra por aporte; el aporte libre guardado como 300 mil; el perfil que filtra el aporte libre; vuelve la estimación; «Nada» dos
// veces; sin pedir el 0 en la fórmula; el contador en tres líneas. La línea de la palanca de §21 salió verde con un fixture que no la
// ejercitaba (UF 3.600 no entraba ni con el pie siguiente): se bajó a UF 2.400 con un control de que el fixture sí la ejercita.
