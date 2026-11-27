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
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/asesoria-catch-test.ts
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  capacidad, edadDeChip, estres, tipoPerfil, avisosDelPerfil, objetivoDePerfil, cuota, creditoDeCuota, plazoDeEdad,
  RENTA_COMPUTABLE_PCT, CARGA_MAX_PCT, DEUDA_SIN_TECHO, RENTA_SIN_PISO, type Numeros,
} from "../../../src/lib/asesoria/capacidad";
import { APORTES, mascara, respuestaAporte, idsDelPlazo, distribucion, esAporte, type Candidato } from "../../../src/lib/asesoria/aporte";
import { elegirTres, mismoEdificio } from "../../../src/lib/asesoria/tres";
import { leerModoAsesoria, accesoAsesoria } from "../../../src/lib/asesoria/acceso";
import { propsPaso } from "../../../src/lib/asesoria/eventos";
import { limpiarEventoSentry } from "../../../src/lib/asesoria/sentry-limpieza";
import { ASESORIA_COPY } from "../../../src/lib/asesoria/copy";
import { validarPedidoPerfil, filaPerfil, calcularPerfil } from "../../../src/lib/asesoria/perfil";
import { comunaEn, comunasQueMasRinden } from "../../../src/lib/asesoria/lugar";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const cerca = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

const CFG = { tasaPct: 4.1, uf: 39_500 };
const base: Numeros = { renta: "r3", tipoRenta: "contrato", edad: "e2", pie: "p3", deudas: "d0", preaprobado: "no" };

function cand(id: string, o: Partial<Candidato> & { f?: Partial<Record<30 | 25 | 20 | 15, number | null>>; c?: Partial<Record<25 | 20 | 15, boolean>> } = {}): Candidato {
  return {
    id, comuna: o.comuna ?? "Ñuñoa", lat: o.lat ?? -33.45, lng: o.lng ?? -70.6, dormitorios: o.dormitorios ?? 2, precioUF: o.precioUF ?? 3000,
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
      const esperado = Math.floor(Math.min(600 / 0.2, 600 + credito) / 10) * 10;
      if (c.topeUF !== esperado) F(`1 · el tope da ${c.topeUF}, la cuenta aparte ${esperado}`);
      if (c.limita !== (600 / 0.2 <= 600 + credito ? "pie" : "renta")) F("1 · lo que limita no es el menor");
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
      if (v.plazo !== 20 || !cerca(v.creditoUF, creditoDeCuota(cuotaMax, CFG.tasaPct, 20) / CFG.uf)) F("1 · con 50–54 años el crédito no es a 20");
      // Pie «menos de UF 300»: solo por la renta (crédito / 80 %) y el pie que hace falta.
      const s = capacidad({ ...base, pie: "p1" }, CFG);
      const porRenta = Math.floor(credito / 0.8 / 10) * 10;
      if (s.pieUF !== null || s.topeUF !== porRenta || s.pieNecesarioUF !== Math.round(porRenta * 0.2)) F(`1 · sin pie no calcula por la renta (${s.topeUF} vs ${porRenta}) o no dice el pie que falta`);
      if (ASESORIA_COPY.formula.sinPieTope(4000, 800) !== "Por tu renta llegas hasta aprox. UF 4.000. Para eso necesitas un pie de UF 800.") F("1 · el texto del pie bajo no es el aprobado");
      // Deudas que se comen la carga: cero.
      const z = capacidad({ ...base, renta: "r1", tipoRenta: "boletas", deudas: "d3" }, CFG);
      if (z.topeUF !== 0) F("1 · con deudas que no dejan cuota el tope no es cero");
      // La carga que muestra la fórmula: (dividendo + deudas) / renta computable, y nunca sobre el máximo.
      if (c.cargaPct > c.cargaMaxPct) F("1 · la carga mostrada pasa el máximo");
    }

    // ── 2 · EL ESTRÉS Y EL TIPO ──
    {
      const c = capacidad(base, CFG);
      const e = estres(c, CFG.uf, { aporteCLP: 100_000, arriendoCLP: 600_000 });
      const cred = Math.max(0, c.topeUF - 600) * CFG.uf;
      if (!cerca(e.subeTasaCLP, cuota(cred, CFG.tasaPct + 1, 30) - cuota(cred, CFG.tasaPct, 30))) F("2 · +1 punto de tasa no es la diferencia de cuotas");
      if (e.mesVacioCLP !== 150_000) F("2 · un mes vacío no es el aporte + el arriendo / 12");
      if (tipoPerfil("primera", "arriendo") !== "primer_paso" || tipoPerfil("uno", "arriendo") !== "rentista" || tipoPerfil("varios", "plusvalia") !== "patrimonial" || tipoPerfil("uno", "ambas") !== "equilibrado" || tipoPerfil("uno", "no_se") !== "equilibrado") F("2 · el tipo de perfil no sigue la regla");
      if (objetivoDePerfil("no_se") !== "ambas") F("2 · «No sé» no se guarda como «ambas»");
      if (avisosDelPerfil({ tipoRenta: "contrato", experiencia: "primera" }).join() !== "estimacion") F("2 · sin boletas ni deptos, otro aviso que la estimación");
      if (avisosDelPerfil({ tipoRenta: "boletas", experiencia: "uno" }).join() !== "boletas,segunda,estimacion") F("2 · con boletas y otro depto faltan avisos");
      const A = ASESORIA_COPY.perfil.avisos;
      if (!/2 años de actividad/.test(A.boletas) || !/2 últimas declaraciones de renta/.test(A.boletas) || !/30 % de pie en la segunda vivienda/.test(A.segunda) || !/sujeta a evaluación del banco/i.test(A.estimacion)) F("2 · los avisos no dicen lo aprobado");
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
      // El distinto necesita otra comuna u otra tipología.
      const t3 = elegirTres([cand("p", { arriendo: 900_000 }), cand("q", { f: { 30: 40_000 }, lat: -33.3 }), cand("r", { lat: -33.2, score: 99 })], P);
      if (t3.length !== 2) F("4 · el tercero no es distinto (misma comuna y tipología) y salió igual");
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
      const ok = validarPedidoPerfil({ experiencia: "uno", objetivo: "no_se", numeros: base, aporte: 100_000, donde: { modo: "comunas", comunas: ["Ñuñoa"], pega: null }, lupa: "prefiero" });
      if (!ok.ok) F("6 · un pedido válido no pasa");
      else {
        const fila = filaPerfil("u", ok.pedido, calcularPerfil(ok.pedido, CFG), { esPrueba: true, existe: false, elegidos: [] });
        if (fila.objetivo !== "ambas" || fila.tipo_perfil !== "equilibrado" || fila.lupa !== null || fila.origen !== "asesoria" || fila.es_prueba !== true || fila.plazo_anios !== 30) F("6 · la fila del perfil no guarda lo aprobado (objetivo, tipo, lupa nula, origen, prueba, plazo)");
        if ("orden_id" in fila) F("6 · la fila del perfil pide una orden");
      }
      if (validarPedidoPerfil({ experiencia: "uno", objetivo: "arriendo", numeros: base, aporte: 110_000, donde: { modo: "metro", comunas: [], pega: null }, lupa: "no" }).ok) F("6 · el perfil acepta un aporte libre");
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
