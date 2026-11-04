// ============================================================================
// TIER EXPLORAR-TURNOS — la base primero (04-nov-2026, goal de Fabrizio después de la caída del 04-nov, 13:44 a 14:04 UTC: 20
// minutos de producción sin base mientras el QA recalculaba las 25 comunas con una tasa nueva).
//
//   1 · DE A UNA COMUNA: el navegador pide las comunas de a una (cola-recalculo.ts) y el servidor responde DESPUÉS de guardar,
//       así la siguiente empieza cuando terminó el guardado de la anterior. El pop-up muestra el avance.
//   2 · EL TOPE GLOBAL: nunca más de dos recálculos de comuna a la vez en todo el sitio (turnos-recalculo.ts: dos filas de `config`
//       tomadas con una escritura condicionada). El tercero recibe «ocupado» (503), espera en cola y el pop-up dice «Franco está
//       ocupado con otro cálculo, un momento…». Lo ya guardado se lee sin turno. Los guardados van en tandas de 100, cada una con
//       10 s como mucho; una que se corta se reintenta sola una vez y, si vuelve a cortarse, el guardado para y suelta el turno.
//   3 · EL FUSIBLE: una respuesta de la base de más de 2 s o con error abre el fusible por 30 s, en la instancia y para las demás
//       (`explorar_fusible`); los recálculos nuevos reciben «pausado» y el pop-up ofrece «Ver con la tasa del mes» en vez de
//       esperar. La landing, el login y los correos no pasan por los turnos.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, 0 lecturas.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-turnos-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as tr from "../../../src/lib/explorar/turnos-recalculo";
import * as cola from "../../../src/lib/explorar/cola-recalculo";
import * as po from "../../../src/lib/explorar/portal";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const texto = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e).replace(/\s+/g, " ").trim();
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Los turnos en memoria, con la misma semántica que `config`: `cambiar` escribe solo si el valor sigue siendo el leído. Con
 *  `pausa`, cada operación cede el hilo (así tres pedidos simultáneos se intercalan de verdad). */
function almacenEnMemoria(pausa = 0) {
  const m = new Map<string, string>();
  const tic = () => (pausa ? dormir(pausa) : Promise.resolve());
  const almacen: tr.AlmacenTurnos = {
    async leer(claves) { await tic(); const o: Record<string, string | null> = {}; for (const k of claves) if (m.has(k)) o[k] = m.get(k) ?? null; return o; },
    async cambiar(k, de, a) { await tic(); if (m.get(k) !== de) return false; m.set(k, a); return true; },
    async crear(k, v) { await tic(); if (!m.has(k)) m.set(k, v); },
    async escribir(k, v) { await tic(); m.set(k, v); },
  };
  return { m, almacen };
}
const esTurno = (t: tr.Turno | tr.EsperaRecalculo): t is tr.Turno => typeof t === "object";

type RpcFalsa = (p: Record<string, unknown>) => unknown;
function baseFalsa(rpcs: Record<string, RpcFalsa>) {
  const llamadas: Array<{ nombre: string; params: Record<string, unknown> }> = [];
  const rpc = (nombre: string, params: Record<string, unknown>) => { llamadas.push({ nombre, params }); return Promise.resolve(rpcs[nombre] ? rpcs[nombre](params) : { data: null, error: null }); };
  return { admin: { rpc, from: () => ({}) } as never, llamadas };
}
const fila = (id: string, combo: unknown = null) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 60, dormitorios: 2, banos: 2, precio_uf: 4000, arriendo_monto: 700_000, evaluado_at: "2026-11-03T03:00:00", combo, pub_estado: null, pub_at: null });
const CFG = { uf: 39600, tasa: 4.1 };
const SONDA_COMPRAR = () => ({ veredicto: "COMPRAR", score: 80, flujo: 1000, cuota: 1 });

export async function runExplorarTurnosTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-TURNOS (de a una comuna, dos recálculos a la vez en todo el sitio y el tercero en cola, guardado en tandas con tope, el fusible y la tasa del mes · 0 tokens) ───");
  const srv = cargar<typeof import("../../../src/lib/explorar/portal-servidor")>("src/lib/explorar/portal-servidor.ts", F);
  const sv = cargar<typeof import("../../../src/lib/explorar/servidor")>("src/lib/explorar/servidor.ts", F);
  const rc = cargar<typeof import("../../../src/app/explorar/recalculo")>("src/app/explorar/recalculo.tsx", F);
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  const ahora = new Date("2026-11-04T16:00:00Z");

  // ══ §1 · DE A UNA COMUNA ═══════════════════════════════════════════════════
  {
    let enVuelo = 0, maximo = 0;
    const tramos: Array<{ c: string; ini: number; fin: number }> = [];
    let tiempo = 0;
    const r = await cola.recalcularEnCola<number>({
      comunas: ["Santiago", "Providencia", "Ñuñoa"],
      pedir: async (c) => { enVuelo++; maximo = Math.max(maximo, enVuelo); const ini = ++tiempo; await dormir(5); tramos.push({ c, ini, fin: ++tiempo }); enVuelo--; return { tipo: "ok", datos: 1 }; },
      alListo: () => {}, alAvance: () => {}, esperar: async () => {},
    });
    if (maximo !== 1) F(`1 · el navegador pide ${maximo} comunas a la vez (una sola)`);
    const ordenado = tramos.map((t) => t.c).join();
    if (ordenado !== "Santiago,Providencia,Ñuñoa" || tramos.some((t, i) => i > 0 && t.ini < tramos[i - 1].fin)) F(`1 · una comuna sale antes de que termine la anterior: ${JSON.stringify(tramos)}`);
    if (r.perdidas.length || r.pausado) F(`1 · la cola sin tropiezos pierde comunas o se pausa: ${JSON.stringify(r)}`);
    // El avance del pop-up: de «0 de 3» a «3 de 3», siempre calculando.
    const avances: string[] = [];
    await cola.recalcularEnCola<number>({ comunas: ["A", "B", "C"], pedir: async () => ({ tipo: "ok", datos: 1 }), alListo: () => {}, alAvance: (a) => avances.push(`${a.hechas}/${a.total}/${a.estado}`), esperar: async () => {} });
    if (avances.join() !== "0/3/calculando,1/3/calculando,2/3/calculando,3/3/calculando") F(`1 · el avance del pop-up no es «0 de 3 … 3 de 3»: ${avances.join()}`);
    // Las dos colas del navegador (el universo calculado y la capa aparte) van por acá, sin trabajadores en paralelo.
    if ((cli.match(/await recalcularEnCola</g) ?? []).length !== 2 || (cli.match(/pedir: async \(c\) => respuestaDeComuna\(await fetch\(`\$\{base\}&c=\$\{encodeURIComponent\(c\)\}`, \{ cache: "default" \}\)\),/g) ?? []).length !== 2
      || /COMUNAS_A_LA_VEZ|trabajador|Promise\.all\(Array\.from\(\{ length: Math\.min\(/.test(cli)) F("1 · el navegador no pide las comunas de a una por la cola (o le quedan trabajadores en paralelo)");
    if (!/alAvance: \(a\) => \{ if \(vivo\.current\) setProgreso\(a\); \},/.test(cli) || !/<PopupRecalculo texto=\{textoRecalculo\(filtros\)\} hechas=\{progreso\.hechas\} total=\{progreso\.total\} estado=\{progreso\.estado\}/.test(cli)) F("1 · el pop-up no muestra el avance ni el estado de la cola");

    // El servidor responde DESPUÉS de guardar, y suelta el turno después del guardado.
    if (srv) {
      const eventos: string[] = [];
      let liberar: (() => void) | null = null;
      const { admin } = baseFalsa({
        explorar_universo_liviano: () => ({ data: [fila("A")], error: null }),
        explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map((id) => ({ id })), error: null }),
        explorar_guardar_combos: () => new Promise((ok) => { eventos.push("guarda"); liberar = () => { eventos.push("guardó"); ok({ data: 1, error: null }); }; }),
      });
      const { almacen } = almacenEnMemoria();
      const turnos = new tr.TurnosRecalculo(almacen, { hasta: 0 }, () => ahora.getTime());
      const espiaTurnos = { pedir: (q: string) => turnos.pedir(q), soltar: async (t: tr.Turno) => { eventos.push("suelta"); await turnos.soltar(t); }, notar: (ms: number, e: unknown) => turnos.notar(ms, e), abierto: () => turnos.abierto() };
      const enCurso = srv.universoYCapaCalculados(admin, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: CFG, sondaLtr: SONDA_COMPRAR, turnos: espiaTurnos, quien: "u1" });
      const antes = await Promise.race([enCurso.then(() => "respondió"), dormir(300).then(() => "espera")]);
      (liberar as (() => void) | null)?.();
      const r2 = await Promise.race([enCurso, dormir(2000).then(() => null)]);
      if (antes !== "espera" || !r2 || r2.pines.length !== 1) F(`1 · la comuna responde antes de guardar (${antes}): la siguiente empezaría con el guardado en vuelo`);
      if (eventos.join() !== "guarda,guardó,suelta") F(`1 · el turno se suelta antes de que termine el guardado: ${eventos.join()}`);
    }
  }

  // ══ §2 · EL TOPE: DOS A LA VEZ Y EL TERCERO ESPERA ═════════════════════════
  {
    if (tr.TOPE_RECALCULOS !== 2 || tr.CLAVES_TURNO.length !== 2 || new Set(tr.CLAVES_TURNO).size !== 2) F(`2 · el tope del sitio no es de dos recálculos (${tr.TOPE_RECALCULOS}, ${tr.CLAVES_TURNO.join()})`);
    // Tres pedidos simultáneos, de tres funciones distintas (cada una con su memoria), contra los mismos turnos.
    let reloj = 1_000_000;
    const { almacen, m } = almacenEnMemoria(2);
    const fn = () => new tr.TurnosRecalculo(almacen, { hasta: 0 }, () => reloj);
    const [a, b, c] = await Promise.all([fn().pedir("a"), fn().pedir("b"), fn().pedir("c")]);
    const tomados = [a, b, c].filter(esTurno);
    if (tomados.length !== 2 || new Set(tomados.map((t) => t.clave)).size !== 2 || [a, b, c].filter((x) => x === "ocupado").length !== 1) F(`2 · tres recálculos simultáneos no dan dos turnos distintos y un «ocupado»: ${JSON.stringify([a, b, c])}`);
    // El tercero espera: con los dos tomados sigue «ocupado»; al soltarse uno, entra.
    if ((await fn().pedir("c")) !== "ocupado") F("2 · un tercero entra con los dos turnos tomados");
    if (tomados[0]) await fn().soltar(tomados[0]);
    const tercero = await fn().pedir("c");
    if (!esTurno(tercero)) F(`2 · al soltarse un turno, el que esperaba no entra: ${JSON.stringify(tercero)}`);
    // Soltar no pisa a otro: el turno vencido que tomó otro no se libera con el valor viejo.
    if (tomados[1]) {
      reloj += tr.TURNO_MS + 1;
      const nuevo = await fn().pedir("d");
      if (!esTurno(nuevo)) F("2 · un turno vencido (una función cortada) no se libera solo");
      else {
        const vencido = tomados.find((t) => t.clave === nuevo.clave) ?? (esTurno(tercero) && tercero.clave === nuevo.clave ? tercero : null);
        if (vencido) { await fn().soltar(vencido); if (m.get(nuevo.clave) !== nuevo.valor) F("2 · soltar un turno vencido libera el de otro"); }
      }
    }
    if (tr.TURNO_MS <= 60_000) F(`2 · un turno vence antes de que termine una ruta de 60 s (${tr.TURNO_MS} ms)`);
    // Lo ya guardado se lee sin turno: con los dos tomados, una comuna sin nada que calcular responde igual.
    if (srv) {
      const lleno = almacenEnMemoria();
      const ocupar = new tr.TurnosRecalculo(lleno.almacen, { hasta: 0 }, () => ahora.getTime());
      await ocupar.pedir("x"); await ocupar.pedir("y");
      const vigente = { v: "COMPRAR", s: 80, f: 1, at: new Date(ahora.getTime() - 3600_000).toISOString() };
      const { admin } = baseFalsa({ explorar_universo_liviano: () => ({ data: [fila("V", vigente)], error: null }) });
      const r = await srv.universoYCapaCalculados(admin, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: CFG, turnos: new tr.TurnosRecalculo(lleno.almacen, { hasta: 0 }, () => ahora.getTime()), quien: "z" })
        .then((x) => x.pines.length, (e) => (tr.esRecalculoEnEspera(e) ? `en espera: ${e.motivo}` : String(e)));
      if (r !== 1) F(`2 · una comuna ya guardada espera turno (${r}): leer lo guardado no recalcula`);
    }
    // Tres comunas calculándose a la vez en el servidor: dos entran, la tercera recibe «ocupado» y, al terminar una, entra.
    if (srv) {
      const comun = almacenEnMemoria(1);
      const liberadores: Array<() => void> = [];
      const base = () => baseFalsa({
        explorar_universo_liviano: () => ({ data: [fila("A")], error: null }),
        explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map((id) => ({ id })), error: null }),
        explorar_guardar_combos: () => new Promise((ok) => { liberadores.push(() => ok({ data: 1, error: null })); }),
      }).admin;
      const calcular = (quien: string) => srv.universoYCapaCalculados(base(), { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined,
        { cfg: CFG, sondaLtr: SONDA_COMPRAR, turnos: new tr.TurnosRecalculo(comun.almacen, { hasta: 0 }, () => ahora.getTime()), quien })
        .then(() => "listo", (e) => (tr.esRecalculoEnEspera(e) ? e.motivo : `error: ${(e as Error).message}`));
      const p1 = calcular("p1"), p2 = calcular("p2");
      await dormir(60);
      const p3 = await calcular("p3");
      if (p3 !== "ocupado" || liberadores.length !== 2) F(`2 · con dos recálculos en curso, el tercero no espera (${p3}; ${liberadores.length} guardando)`);
      liberadores.shift()?.();
      await dormir(30);
      const p4 = calcular("p3-de-nuevo");
      await dormir(60);
      for (const l of liberadores.splice(0)) l();
      await dormir(30);
      for (const l of liberadores.splice(0)) l();
      const fin = await Promise.all([p1, p2, p4]);
      if (fin.join() !== "listo,listo,listo") F(`2 · al terminar uno, el que esperaba no entra: ${fin.join()}`);
    }
    // Las dos rutas convierten la espera en un 503 que el navegador entiende, sin caché.
    for (const ruta of ["src/app/api/explorar/route.ts", "src/app/api/explorar/negociar/route.ts"]) {
      const r = codigo(ruta);
      if (!/if \(esRecalculoEnEspera\(e\)\) return NextResponse\.json\(\{ error: e\.motivo \}, \{ status: 503, headers: \{ "Cache-Control": "no-store", "Retry-After": "3" \} \}\);/.test(r)
        || !/const turnos = new TurnosRecalculo\(almacenDeConfig\(admin\)\);/.test(r) || !/turnos, quien: user\.id \}\)/.test(r)) F(`2 · ${ruta} no pasa por los turnos o no responde «ocupado»/«pausado» con 503`);
    }
    // Los turnos en `config`: la escritura condicionada (cambia solo si sigue valiendo lo leído).
    const turnosSrc = codigo("src/lib/explorar/turnos-recalculo.ts");
    if (!/\.update\(\{ value: a, updated_at: ahora\(\) \}\)\.eq\("key", clave\)\.eq\("value", de\)\.select\("key"\)/.test(turnosSrc) || !/return \(data\?\.length \?\? 0\) === 1;/.test(turnosSrc)) F("2 · tomar un turno en `config` no es una escritura condicionada (dos funciones podrían tomar el mismo)");
    // El navegador: «ocupado» espera y pide la misma comuna de nuevo, con el pop-up diciéndolo; no cuenta la comuna hasta que llega.
    {
      const respuestas: Array<cola.RespuestaDeComuna<number>> = [{ tipo: "ocupado" }, { tipo: "ocupado" }, { tipo: "ok", datos: 7 }];
      const esperas: number[] = [], avances: string[] = [], pedidas: string[] = [];
      const r = await cola.recalcularEnCola<number>({
        comunas: ["Santiago"], pedir: async (c) => { pedidas.push(c); return respuestas.shift() ?? { tipo: "error" }; },
        alListo: () => {}, alAvance: (a) => avances.push(`${a.hechas}/${a.estado}`), esperar: async (ms) => { esperas.push(ms); },
      });
      if (pedidas.join() !== "Santiago,Santiago,Santiago" || esperas.join() !== `${cola.ESPERA_OCUPADO_MS},${cola.ESPERA_OCUPADO_MS}` || r.perdidas.length) F(`2 · «ocupado» no espera y pide la misma comuna de nuevo: ${pedidas.join()} · esperas ${esperas.join()}`);
      if (avances.join() !== "0/calculando,0/ocupado,0/ocupado,1/calculando") F(`2 · el pop-up no dice que está en cola (o cuenta la comuna antes de que llegue): ${avances.join()}`);
      if (cola.ESPERA_OCUPADO_MS < 1000 || cola.MAX_ESPERAS_POR_COMUNA * cola.ESPERA_OCUPADO_MS < 60_000) F("2 · la cola reintenta tan seguido que martilla, o se rinde antes de que se libere un turno");
    }
    const resp = async (status: number, cuerpo: unknown) => (await cola.respuestaDeComuna<unknown>(new Response(JSON.stringify(cuerpo), { status }))).tipo;
    const tipos = [await resp(503, { error: "ocupado" }), await resp(503, { error: "pausado" }), await resp(500, { error: "interno" }), await resp(200, { universo: [] })];
    if (tipos.join() !== "ocupado,pausado,error,ok") F(`2 · el navegador no lee el 503 del servidor: ${tipos.join()}`);
    if (rc) {
      const html = renderToStaticMarkup(createElement(rc.PopupRecalculo, { texto: "Franco está recalculando con tu tasa de 5 %", hechas: 9, total: 25, estado: "ocupado" }));
      const t = texto(html);
      if (!t.includes("Franco está ocupado con otro cálculo, un momento…") || !t.includes("9 de 25 comunas") || !html.includes('data-explorar="recalculo-spinner"') || /<button/.test(html)) F(`2 · el pop-up en cola no dice «Franco está ocupado con otro cálculo, un momento…» con el avance y el spinner: ${t}`);
      if (po.PORTAL_COPY.recalculoOcupado !== "Franco está ocupado con otro cálculo, un momento…") F("2 · el texto de la cola no es el que pidió Fabrizio");
    }
    // El guardado: en tandas de 100, cada una con tope; una que se corta se reintenta una vez; dos cortes seguidos, para.
    if (sv) {
      if (sv.LOTE_GUARDADO !== 100 || sv.TANDA_GUARDADO_MS !== 10_000) F(`2 · las tandas del guardado no son de 100 con 10 s como mucho (${sv.LOTE_GUARDADO}, ${sv.TANDA_GUARDADO_MS})`);
      const nuevos = Array.from({ length: 250 }, (_, i) => ({ avisoId: `id-${i}`, combo: { v: "COMPRAR", s: 1, f: 1, at: "x" } as never }));
      const tam: number[] = [];
      await sv.guardarCombos(baseFalsa({ explorar_guardar_combos: (p) => { tam.push((p.filas as unknown[]).length); return { data: (p.filas as unknown[]).length, error: null }; } }).admin, "20-30-t5", nuevos);
      if (tam.join() !== "100,100,50") F(`2 · el guardado no va en tandas de 100: ${tam.join()}`);
      // Una tanda que se corta (contesta tarde, a los 3 s, con un error): se corta a su tope, se reintenta una vez y el guardado
      // para, sin bloquear.
      let llamadas = 0;
      const t0 = Date.now();
      const malas: Array<[number, unknown]> = [];
      const tarde = () => new Promise((ok) => setTimeout(() => ok({ data: null, error: { message: "tarde" } }), 3000));
      const g = await sv.guardarCombos(baseFalsa({ explorar_guardar_combos: () => { llamadas++; return tarde(); } }).admin, "20-30-t5", nuevos, { tandaMs: 60, pausaMs: 5, notar: (ms, e) => malas.push([ms, e]) });
      const dura = Date.now() - t0;
      if (g !== 0 || llamadas !== 2 || dura > 1500) F(`2 · una tanda que no contesta no se corta y se reintenta una sola vez (${llamadas} pedidos, ${dura} ms)`);
      if (malas.length !== 2 || malas.some(([, e]) => e == null)) F("2 · los cortes del guardado no llegan al fusible");
      // Se corta una vez y a la segunda entra: sigue con las demás tandas.
      let n = 0;
      const ok = await sv.guardarCombos(baseFalsa({ explorar_guardar_combos: (p) => (++n === 1 ? { data: null, error: { message: "upstream request timeout" } } : { data: (p.filas as unknown[]).length, error: null }) }).admin, "20-30-t5", nuevos, { pausaMs: 1 });
      if (ok !== 250 || n !== 4) F(`2 · una tanda que se corta una vez no se reintenta (guardó ${ok} con ${n} pedidos)`);
      // Con el fusible abierto, el guardado para antes de la tanda siguiente.
      let m2 = 0, abierto = false;
      await sv.guardarCombos(baseFalsa({ explorar_guardar_combos: (p) => { m2++; abierto = true; return { data: (p.filas as unknown[]).length, error: null }; } }).admin, "20-30-t5", nuevos, { seguir: () => !abierto });
      if (m2 !== 1) F(`2 · con el fusible abierto el guardado sigue escribiendo (${m2} tandas)`);
    }
  }

  // ══ §3 · EL FUSIBLE ════════════════════════════════════════════════════════
  {
    let reloj = 5_000_000;
    const { almacen } = almacenEnMemoria();
    const instancia = { hasta: 0 };
    const t = new tr.TurnosRecalculo(almacen, instancia, () => reloj);
    if (tr.LENTO_MS !== 2_000 || tr.FUSIBLE_MS !== 30_000) F(`3 · el fusible no salta a los 2 s o no dura 30 s (${tr.LENTO_MS}, ${tr.FUSIBLE_MS})`);
    t.notar(1_900, null);
    if (t.abierto()) F("3 · una respuesta de 1,9 s abre el fusible");
    t.notar(2_100, null);
    await dormir(5);
    if (!t.abierto() || (await t.pedir("q")) !== "pausado") F("3 · una respuesta de más de 2 s no pausa los recálculos nuevos");
    reloj += tr.FUSIBLE_MS - 1_000;
    if ((await t.pedir("q")) !== "pausado") F("3 · el fusible se cierra antes de los 30 s");
    // Las demás funciones lo ven en `explorar_fusible`, aunque ellas no hayan visto nada lento.
    const otra = new tr.TurnosRecalculo(almacen, { hasta: 0 }, () => reloj);
    if ((await otra.pedir("q")) !== "pausado") F("3 · otra función no ve el fusible que abrió esta (lo pausa una sola)");
    reloj += 2_000;
    if (t.abierto() || !esTurno(await t.pedir("q"))) F("3 · pasados los 30 s el fusible no se cierra");
    // Un error (5xx, corte) también lo abre; y una lectura de los turnos que tarda, o que falla, pausa y lo abre.
    const t2 = new tr.TurnosRecalculo(almacenEnMemoria().almacen, { hasta: 0 }, () => reloj);
    t2.notar(40, { message: "upstream request timeout", code: "504" });
    if (!t2.abierto()) F("3 · un error de la base no abre el fusible");
    let reloj3 = 9_000_000;
    const lenta = almacenEnMemoria();
    const leerLento: tr.AlmacenTurnos = { ...lenta.almacen, leer: async (c) => { reloj3 += 2_500; return lenta.almacen.leer(c); } };
    const t3 = new tr.TurnosRecalculo(leerLento, { hasta: 0 }, () => reloj3);
    if ((await t3.pedir("q")) !== "pausado" || !t3.abierto()) F("3 · si la base tarda en contestar los turnos, el recálculo no se pausa");
    const t4 = new tr.TurnosRecalculo({ ...almacenEnMemoria().almacen, leer: async () => { throw new Error("522"); } }, { hasta: 0 }, () => reloj);
    if ((await t4.pedir("q")) !== "pausado" || !t4.abierto()) F("3 · si la base falla al leer los turnos, el recálculo no se pausa");
    // En el servidor: con el fusible abierto, un recálculo nuevo recibe «pausado»; una lectura lenta del universo lo abre.
    if (srv) {
      const abiertoYa = new tr.TurnosRecalculo(almacenEnMemoria().almacen, { hasta: ahora.getTime() + 10_000 }, () => ahora.getTime());
      const { admin } = baseFalsa({ explorar_universo_liviano: () => ({ data: [fila("A")], error: null }) });
      const r = await srv.universoYCapaCalculados(admin, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: CFG, sondaLtr: SONDA_COMPRAR, turnos: abiertoYa, quien: "u" })
        .then(() => "calculó", (e) => (tr.esRecalculoEnEspera(e) ? e.motivo : String(e)));
      if (r !== "pausado") F(`3 · con el fusible abierto el servidor recalcula igual (${r})`);
      const notadas: number[] = [];
      const espia = { pedir: async () => "ocupado" as const, soltar: async () => {}, notar: (ms: number) => { notadas.push(ms); }, abierto: () => false };
      const { admin: lento } = baseFalsa({ explorar_universo_liviano: async () => { await dormir(30); return { data: [fila("A")], error: null }; } });
      await srv.universoYCapaCalculados(lento, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: CFG, turnos: espia, quien: "u" }).catch(() => null);
      if (!notadas.length || notadas[0] < 25) F("3 · la lectura del universo no se mide para el fusible");
      // Cede el hilo mientras calcula (una comuna grande son segundos de motor seguidos).
      let calculadas = 0, alCeder = -1;
      const muchas = Array.from({ length: 250 }, (_, i) => fila(`M${i}`));
      const { admin: grande } = baseFalsa({ explorar_universo_liviano: () => ({ data: muchas, error: null }), explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map((id) => ({ id })), error: null }), explorar_guardar_combos: (p) => ({ data: (p.filas as unknown[]).length, error: null }) });
      const calc = srv.universoYCapaCalculados(grande, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: CFG, sondaLtr: () => { calculadas++; return SONDA_COMPRAR(); } });
      const espera = (async () => { while (calculadas === 0) await new Promise<void>((ok) => setImmediate(ok)); await new Promise<void>((ok) => setImmediate(ok)); alCeder = calculadas; })();
      await calc; await espera;
      if (!(alCeder > 0 && alCeder < 250)) F(`3 · el cálculo no le cede el hilo a los demás pedidos (otro pedido corrió con ${alCeder} de 250 calculados)`);
    }
    // El navegador: «pausado» para la cola y deja las que faltaban; el pop-up ofrece la tasa del mes en vez de esperar.
    {
      const pedidas: string[] = [], avances: string[] = [];
      const r = await cola.recalcularEnCola<number>({
        comunas: ["A", "B", "C"], pedir: async (c) => { pedidas.push(c); return c === "B" ? { tipo: "pausado" } : { tipo: "ok", datos: 1 }; },
        alListo: () => {}, alAvance: (a) => avances.push(`${a.hechas}/${a.estado}`), esperar: async () => {},
      });
      if (pedidas.join() !== "A,B" || !r.pausado || r.perdidas.join() !== "B,C" || avances[avances.length - 1] !== "1/pausado") F(`3 · «pausado» no para la cola (${pedidas.join()}; ${JSON.stringify(r)}; ${avances.join()})`);
    }
    const f0 = { comunas: [], tipologias: [], ufMin: null, ufMax: null, pie: 20, plazo: 30, tasa: 5, modalidad: "ltr", flujoPositivo: false, publicados: "todos", zona: null, soloComprar: false, negociar: 10 } as unknown as po.FiltrosPortal;
    const casos: Array<[Partial<po.FiltrosPortal>, string | null, Partial<po.FiltrosPortal> | null]> = [
      [{}, "Ver con la tasa del mes", { tasa: null, pie: 20, plazo: 30 }],
      [{ pie: 10 as never }, "Ver con la tasa del mes, pie 20 % y 30 años", { tasa: null, pie: 20, plazo: 30 }],
      [{ tasa: null, plazo: 25 as never }, "Ver con pie 20 % y 30 años", { tasa: null, pie: 20, plazo: 30 }],
      [{ pie: 30 as never }, "Ver con la tasa del mes", { tasa: null, pie: 30, plazo: 30 }],
      [{ modalidad: "str" as never }, null, null],
    ];
    for (const [cambio, etiqueta, espera] of casos) {
      const r = cola.respaldoDelFusible({ ...f0, ...cambio });
      const bien = etiqueta == null ? r == null : !!r && r.etiqueta === etiqueta && Object.entries(espera ?? {}).every(([k, v]) => (r.filtros as unknown as Record<string, unknown>)[k] === v) && r.filtros.comunas === f0.comunas;
      if (!bien) F(`3 · el respaldo del fusible para ${JSON.stringify(cambio)} es ${JSON.stringify(r ? { etiqueta: r.etiqueta, tasa: r.filtros.tasa, pie: r.filtros.pie, plazo: r.filtros.plazo } : null)}, no «${etiqueta}»`);
    }
    if (rc) {
      const html = renderToStaticMarkup(createElement(rc.PopupRecalculo, { texto: "Franco está recalculando con tu tasa de 5 %", hechas: 9, total: 25, estado: "pausado", respaldo: "Ver con la tasa del mes" }));
      const t = texto(html);
      if (!t.includes("Franco pausó los recálculos un momento") || !/data-explorar="recalculo-respaldo"[^>]*>Ver con la tasa del mes</.test(html) || !/data-explorar="recalculo-reintentar"/.test(html) || html.includes("recalculo-spinner") || html.includes("9 de 25 comunas"))
        F(`3 · el pop-up con el fusible no ofrece «Ver con la tasa del mes» en vez de esperar: ${t}`);
      const sin = renderToStaticMarkup(createElement(rc.PopupRecalculo, { texto: "x", hechas: 0, total: 25, estado: "pausado", respaldo: null }));
      if (!/data-explorar="recalculo-cerrar"[^>]*>Ver lo que ya cargó</.test(sin)) F("3 · en renta corta, con el fusible, el pop-up no ofrece ver lo que ya cargó");
      if (/class="[^"]*\b(rojo|signal|wz-cta)\b/.test(html)) F("3 · el respaldo va en rojo (ver el mapa no compra nada)");
    }
    if (!/alRespaldo=\{\(\) => \{ const r = respaldoDelFusible\(filtros\); setProgreso\(null\); setFallidas\(null\); if \(r\) aplicar\(r\.filtros, "fusible"\); \}\}/.test(cli)
      || !/respaldo=\{respaldoDelFusible\(filtros\)\?\.etiqueta \?\? null\}/.test(cli) || !/alReintentar=\{\(\) => \{ setProgreso\(null\); void asegurar\(filtros\); \}\}/.test(cli)
      || (cli.match(/if \(vivo\.current\) \{ if \(pausado\) setFallidas\(\{ clave, comunas: perdidas \}\); else \{ setProgreso\(null\);/g) ?? []).length !== 2)
      F("3 · el botón «Ver con la tasa del mes» no cambia a la tasa del mes (o «pausado» cierra el pop-up solo)");
    // La landing, el login y los correos no pasan por los turnos: solo las dos rutas de Explorar y el cálculo los usan.
    const usan: string[] = [];
    const recorrer = (dir: string) => { for (const n of readdirSync(join(RAIZ, dir))) { const p = `${dir}/${n}`; if (statSync(join(RAIZ, p)).isDirectory()) recorrer(p); else if (/\.(ts|tsx)$/.test(n) && /from ["'](?:@\/lib\/explorar|\.)\/turnos-recalculo["']/.test(codigo(p))) usan.push(p); } };
    recorrer("src");
    const esperados = ["src/app/api/explorar/negociar/route.ts", "src/app/api/explorar/route.ts", "src/lib/explorar/portal-servidor.ts", "src/lib/explorar/servidor.ts"];
    if (usan.sort().join() !== esperados.join()) F(`3 · los turnos los usa algo más que Explorar (la landing, el login y los correos no esperan): ${usan.join(", ")}`);
  }

  for (const m of fallas) console.log(`  ✗ ${m}`);
  console.log(fallas.length === 0 ? "  ✓ EXPLORAR-TURNOS: todo en orden" : `  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runExplorarTurnosTier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (04-nov-2026, meta-runner `mutar-gen.cjs` con `mutaciones-turnos.cjs` del scratchpad de la sesión 087cc148,
// que restaura byte a byte con hash y exige que el texto mutado aparezca UNA vez): 48 de 48 en ROJO, cada una por su invariante.
//   §2 el tope: tope de 3 · tomar un turno ocupado · soltar sin condición · turno más corto que la ruta · lo guardado pide turno ·
//      sin turno igual calcula · la ruta responde 500 · la capa sin turnos · `config` sin escritura condicionada · «ocupado» no
//      espera · la cola no lo dice · el 503 no se lee · el pop-up no dice ocupado · tandas de 200 · tanda sin tope · sin
//      reintento · insiste tras dos cortes · sigue con el fusible · los cortes no llegan al fusible.
//   §1 de a una: guardado de fondo · suelta antes de guardar · la cola adelanta la siguiente · sin avance · vuelven los trabajadores.
//   §3 el fusible: lento a los 4 s · el error no cuenta · fusible de 3 s · no mira el de las demás · no lo comparte · la lectura
//      lenta no pausa · la que falla dice ocupado · no mira el propio · el universo no se mide · no cede el hilo · la pausa no
//      para la cola · otra etiqueta · el respaldo deja el pie · el botón dice otra cosa · spinner en la pausa · el respaldo no
//      aplica · la pausa cierra el pop-up · la landing usa los turnos.
//   Y los predicados reescritos con acta: EXPLORAR §10 (tandas de 200, guardado de fondo, vuelven los trabajadores),
//   EXPLORAR-PORTAL §7 (responde antes de guardar), EXPLORAR-PASADA-0411 §1 (la ruta sin turnos, el pop-up sin estado).
//   Dos se corrigieron al redactarlas, no el tier: «tomar un turno ocupado» salía roja por «un tercero entra con los dos turnos
//   tomados» (la prueba simultánea parte con las filas libres: no ejercita «ocupado»), y «vuelven los trabajadores» no aplicaba
//   por un paréntesis del comentario que se buscaba.
// ─────────────────────────────────────────────────────────────────────────────
