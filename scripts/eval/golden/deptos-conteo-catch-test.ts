// ─────────────────────────────────────────────────────────────────────────────
// Tier DEPTOS-CONTEO (28-oct-2026, 0 tokens; el §4 mide contra la base real) — Sentry JAVASCRIPT-NEXTJS-1K: `deptos_conteo`
// se cortaba por statement_timeout en GET /api/deptos/respuesta (Providencia, 2D, UF 3.000 a 4.000), que es el número de
// /deptos. Como el resumen de la noche: lo cuenta el cron de la evaluación y /deptos solo lo lee.
//
//   1 · CON EL CONTEO GUARDADO, /deptos NO CUENTA: responderDeptos lee la fila de `config` de su búsqueda (tipologías y
//       rango) y no llama a la RPC; la respuesta es la misma que daba la RPC, también con su comuna en cero (las vecinas).
//   2 · LO QUE FALTA SE CUENTA UNA VEZ Y SE GUARDA: sin fila (o sin una comuna), una sola RPC con lo que falta, se guarda, y
//       la siguiente ya no cuenta. Varias tipologías a la vez son su propia fila.
//   3 · EL CRON LO CUENTA DE NOCHE: guardarConteosDeLaNoche guarda las 20 búsquedas de una tipología (5 × 4 rangos) con
//       todas las comunas de la cobertura y sus vecinas, en cero las sin ninguno, y vuelve a contar las de varias tipologías
//       que alguien pidió; el cron evaluar-avisos lo llama después del resumen; la ruta no cuenta por su cuenta.
//   4 · BAJO 300 ms CONTRA LA BASE REAL: la búsqueda del Sentry y tres más, cinco veces cada una, ya con su fila guardada:
//       cada respuesta bajo 300 ms y sin ninguna RPC.
//
// ACTA DE MUTACIONES (28-oct-2026), cada una corrida y devuelta:
//   M1 responderDeptos vuelve a contar con la RPC en cada pedido → ROJO §1 y §4 (§4: «hizo 1 RPC»; el tiempo solo, con la
//      base tranquila, puede quedar bajo 300 ms: por eso el §4 exige también cero RPC).
//   M2 sin guardar lo que contó → ROJO §2 · M3 cuenta todas las comunas en vez de las que faltan → ROJO §2.
//   M4 el cron sin las de varias tipologías → ROJO §3 · M5 el cron no llama a guardarConteosDeLaNoche → ROJO §3.
//   (Se probó también sacar el filtro de las comunas en cero: es una mutación EQUIVALENTE —respuestaDeptos ya ofrece solo
//   vecinas que convienen y los ceros no suman— y el filtro se retiró del código.)
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/deptos-conteo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { claveConteo, conteoGuardado, guardarConteosDeLaNoche, PREFIJO_CONTEO, responderDeptos } from "../../../src/lib/deptos/servidor";
import { RANGOS_UF, TIPOLOGIAS_DEPTOS, validarElecciones } from "../../../src/lib/deptos/respuesta";
import { COMUNAS_DISPONIBLES } from "../../../src/lib/comunas-disponibles";
import { comunasVecinas } from "../../../src/lib/comunas-vecinas";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");
export const TOPE_MS = 300;

type Rpc = { comunas: string[]; dorms: number[]; uf_min: number; uf_max: number };
/** `config` en memoria y una RPC que cuenta por comuna con una tabla dada; registra qué se pidió. */
function baseFalsa(tabla: Record<string, number>) {
  const config = new Map<string, string>();
  const rpcs: Rpc[] = [];
  const guardados: string[] = [];
  const admin = {
    from: (t: string) => {
      if (t !== "config") throw new Error(`tabla inesperada: ${t}`);
      let clave: string | null = null, prefijo: string | null = null;
      const b = {
        select: () => b,
        eq: (_c: string, v: string) => { clave = v; return b; },
        like: (_c: string, v: string) => { prefijo = v.replace(/%$/, ""); return b; },
        limit: () => b,
        maybeSingle: async () => ({ data: clave && config.has(clave) ? { value: config.get(clave) } : null, error: null }),
        upsert: async (v: { key: string; value: string }) => { config.set(v.key, v.value); guardados.push(v.key); return { error: null }; },
        then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: Array.from(config.keys()).filter((k) => prefijo != null && k.startsWith(prefijo)).map((key) => ({ key })), error: null }).then(ok),
      };
      return b;
    },
    rpc: async (nombre: string, a: Rpc) => {
      if (nombre !== "deptos_conteo") throw new Error(`rpc inesperada: ${nombre}`);
      rpcs.push(a);
      // Como la RPC: solo las comunas con alguno.
      return { data: a.comunas.filter((c) => (tabla[c] ?? 0) > 0).map((c) => ({ comuna: c, total: tabla[c], comprar_20: Math.floor(tabla[c] / 2), comprar_30: Math.floor(tabla[c] / 3) })), error: null };
    },
  };
  return { admin: admin as unknown as SupabaseClient, config, rpcs, guardados };
}

/** Un cliente real que cuenta las RPC que se le piden. */
function contandoRpc(sb: SupabaseClient) {
  const llamadas: string[] = [];
  const envuelto = new Proxy(sb, {
    get(o, k, r) {
      if (k === "rpc") return (nombre: string, ...a: unknown[]) => { llamadas.push(nombre); return (o.rpc as (...x: unknown[]) => unknown)(nombre, ...a); };
      return Reflect.get(o, k, r);
    },
  });
  return { sb: envuelto as SupabaseClient, llamadas };
}

export async function runDeptosConteoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER DEPTOS-CONTEO (el número de /deptos se lee del conteo de la noche, bajo 300 ms · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const K = (resto: string) => `${PREFIJO_CONTEO}${resto}`;
  const ahora = new Date("2026-10-28T12:00:00Z");
  const v = validarElecciones({ comunas: ["Providencia"], tipologias: ["2"], rango: "3000-4000", modalidad: "ltr" });
  try {
    if (!v.ok) throw new Error("la búsqueda del Sentry no valida");
    const vecinas = comunasVecinas(["Providencia"]);
    const tabla: Record<string, number> = { Providencia: 5, [vecinas[0]]: 12 };
    // ── 1 · con el conteo guardado, /deptos no cuenta ──
    // Mutación: M1 vuelve la RPC en cada pedido.
    {
      const enVivo = baseFalsa(tabla);
      const esperado = await responderDeptos(enVivo.admin, v, ahora);
      const b = baseFalsa(tabla);
      const comunas: Record<string, [number, number, number]> = {};
      for (const c of ["Providencia", ...vecinas]) comunas[c] = [tabla[c] ?? 0, Math.floor((tabla[c] ?? 0) / 2), Math.floor((tabla[c] ?? 0) / 3)];
      b.config.set(claveConteo(v.tipologias, v.rango), JSON.stringify({ comunas, calculadoAt: ahora.toISOString() }));
      const r = await responderDeptos(b.admin, v, ahora);
      if (b.rpcs.length > 0) F(`1 · con el conteo guardado, /deptos igual cuenta con la RPC (${b.rpcs.length} llamada(s))`);
      if (JSON.stringify(r) !== JSON.stringify(esperado)) F(`1 · lo guardado no responde lo mismo que la RPC: ${JSON.stringify(r)} contra ${JSON.stringify(esperado)}`);
      if (r.total !== 5 || r.convienen !== 2) F(`1 · la respuesta no es la de Providencia (${r.total} publicados, ${r.convienen} convienen)`);
      // ⚠ ACTA (30-oct-2026, goal «financiamiento por defecto a 30 años») · la clave lleva el plazo («deptos_conteo_p30:»): un conteo
      // guardado a 25 años nunca se sirve como si fuera de 30, y el cron no vuelve a contar las claves viejas.
      if (claveConteo(v.tipologias, v.rango) !== "deptos_conteo_p30:2|3000-4000" || PREFIJO_CONTEO !== "deptos_conteo_p30:") F("1 · la clave del conteo cambió");
      // Con su comuna en cero, la respuesta ofrece la vecina que da: igual desde lo guardado que desde la RPC.
      const sinPropia = { ...tabla, Providencia: 0 };
      const vivo0 = await responderDeptos(baseFalsa(sinPropia).admin, v, ahora);
      const b0 = baseFalsa(sinPropia);
      await responderDeptos(b0.admin, v, ahora);
      const guardado0 = await responderDeptos(b0.admin, v, ahora);
      if (JSON.stringify(guardado0) !== JSON.stringify(vivo0) || !vivo0.alternativa?.includes(vecinas[0])) F(`1 · con la comuna en cero, lo guardado no ofrece la misma vecina que la RPC: ${JSON.stringify(guardado0.vecinas)} contra ${JSON.stringify(vivo0.vecinas)}`);
      if (conteoGuardado("no-json") !== null || conteoGuardado(JSON.stringify({ comunas: { A: [1, 2] } }))?.A) F("1 · un conteo guardado inválido se lee como bueno");
    }
    // ── 2 · lo que falta se cuenta una vez y se guarda ──
    // Mutaciones: M2 sin guardar · M3 cuenta todas las comunas en vez de las que faltan.
    {
      const b = baseFalsa(tabla);
      await responderDeptos(b.admin, v, ahora);
      const pedidas = ["Providencia", ...vecinas].sort().join();
      if (b.rpcs.length !== 1 || [...b.rpcs[0].comunas].sort().join() !== pedidas) F(`2 · sin fila guardada no se cuenta una sola vez lo que falta (${b.rpcs.length} RPC, comunas ${b.rpcs.map((x) => x.comunas.join("+")).join(" / ")})`);
      if (!b.guardados.includes(K("2|3000-4000"))) F("2 · lo contado no se guarda");
      const antes = b.rpcs.length;
      await responderDeptos(b.admin, v, ahora);
      if (b.rpcs.length !== antes) F("2 · la segunda vez vuelve a contar");
      // Otra comuna con la misma búsqueda: solo lo que falta.
      const v2 = validarElecciones({ comunas: ["Ñuñoa"], tipologias: ["2"], rango: "3000-4000", modalidad: "ltr" });
      if (v2.ok) {
        await responderDeptos(b.admin, v2, ahora);
        const ultima = b.rpcs[b.rpcs.length - 1];
        if (b.rpcs.length !== antes + 1 || ultima.comunas.includes("Providencia")) F("2 · con otra comuna se vuelve a contar lo que ya estaba");
      }
      const multi = validarElecciones({ comunas: ["Providencia"], tipologias: ["1", "2"], rango: "3000-4000", modalidad: "ltr" });
      if (multi.ok && claveConteo(multi.tipologias, multi.rango) !== K("1,2|3000-4000")) F("2 · varias tipologías no son su propia fila");
    }
    // ── 3 · el cron lo cuenta de noche ──
    // Mutaciones: M4 sin las de varias tipologías · M5 el cron no lo llama.
    {
      const b = baseFalsa(tabla);
      b.config.set(K("0,1|hasta-3000"), JSON.stringify({ comunas: {}, calculadoAt: "2026-10-01T00:00:00Z" }));
      const r = await guardarConteosDeLaNoche(b.admin, ahora);
      const base = TIPOLOGIAS_DEPTOS.flatMap((t) => RANGOS_UF.map((rg) => claveConteo([t], rg)));
      const faltan = base.filter((k) => !b.guardados.includes(k));
      if (base.length !== 20 || faltan.length > 0) F(`3 · el cron no guarda las ${base.length} búsquedas de una tipología (faltan ${faltan.join(", ")})`);
      if (!b.guardados.includes(K("0,1|hasta-3000"))) F("3 · el cron no vuelve a contar las de varias tipologías que alguien pidió");
      if (r.guardados !== 21 || r.fallidos !== 0) F(`3 · el cron no cuenta lo que guardó (${r.guardados} guardados, ${r.fallidos} fallidos)`);
      const todas = new Set([...COMUNAS_DISPONIBLES, ...comunasVecinas([...COMUNAS_DISPONIBLES])]);
      const guardado = conteoGuardado(b.config.get(K("2|3000-4000")));
      const sinComuna = Array.from(todas).filter((c) => !guardado || !(c in guardado));
      if (sinComuna.length > 0) F(`3 · el conteo de la noche no trae todas las comunas (faltan ${sinComuna.slice(0, 5).join(", ")})`);
      if (guardado && guardado.Providencia?.[0] !== 5) F("3 · el conteo de la noche no es el de la RPC");
      const dorms4 = b.rpcs.find((x) => x.dorms.join() === "4,5");
      if (!dorms4 || b.rpcs.some((x) => x.comunas.length !== todas.size)) F("3 · el cron no cuenta cada tipología con sus dormitorios sobre todas las comunas");
      const cron = sinComentarios(leer("src/app/api/cron/evaluar-avisos/route.ts"));
      if (!/const conteos = dry \? null : await guardarConteosDeLaNoche\(sb\)\.catch\(\(\) => null\);/.test(cron)) F("3 · el cron de la evaluación no guarda el conteo de /deptos");
      const ruta = sinComentarios(leer("src/app/api/deptos/respuesta/route.ts"));
      if (/\.rpc\(/.test(ruta) || !/await responderDeptos\(createServiceClient\(\), v\)/.test(ruta)) F("3 · la ruta cuenta por su cuenta en vez de leer el conteo");
      const srv = sinComentarios(leer("src/lib/deptos/servidor.ts"));
      const resp = srv.slice(srv.indexOf("export async function responderDeptos"), srv.indexOf("export const PREFIJO_CONTEO"));
      if (/\.rpc\(/.test(resp) || !/await conteoDeptos\(admin, v, \[\.\.\.v\.comunas, \.\.\.vecinas\], ahora\)/.test(resp)) F("3 · responderDeptos no lee el conteo guardado");
    }

    // ── 4 · bajo 300 ms contra la base real ──
    // Mutación: M1 (la RPC en cada pedido: «hizo 1 RPC»).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !llave) F("4 · NO CORRIÓ la medición: faltan las variables de Supabase (el tier mide contra la base real)");
    else {
      const busquedas = [
        { comunas: ["Providencia"], tipologias: ["2"], rango: "3000-4000" },
        { comunas: ["Santiago"], tipologias: ["2"], rango: "3000-4000" },
        { comunas: ["Las Condes"], tipologias: ["3"], rango: "6000-mas" },
        { comunas: ["Ñuñoa", "Macul"], tipologias: ["1"], rango: "hasta-3000" },
      ];
      const tiempos: string[] = [];
      for (const q of busquedas) {
        const vq = validarElecciones({ ...q, modalidad: "ltr" });
        if (!vq.ok) { F(`4 · la búsqueda ${q.comunas.join("+")} no valida`); continue; }
        // La primera vez puede contar y guardar lo que falte (lo mismo que haría el primer pedido en producción).
        await responderDeptos(createClient(url, llave, { auth: { persistSession: false } }), vq);
        const ms: number[] = [];
        let rpcs = 0;
        for (let i = 0; i < 5; i++) {
          const { sb, llamadas } = contandoRpc(createClient(url, llave, { auth: { persistSession: false } }));
          const t0 = performance.now();
          await responderDeptos(sb, vq);
          ms.push(Math.round(performance.now() - t0));
          rpcs += llamadas.filter((n) => n === "deptos_conteo").length;
        }
        const peor = Math.max(...ms);
        tiempos.push(`${q.comunas.join("+")} ${q.tipologias.join(",")}D ${q.rango}: ${ms.join("/")} ms`);
        if (rpcs > 0) F(`4 · ${q.comunas.join("+")}: con la fila ya guardada, /deptos hizo ${rpcs} RPC de conteo`);
        if (peor >= TOPE_MS) F(`4 · ${q.comunas.join("+")} ${q.rango}: la respuesta tardó ${peor} ms (el tope es ${TOPE_MS} ms)`);
      }
      console.log(`  · medido contra la base: ${tiempos.join(" · ")}`);
    }
  } catch (e) {
    F(`no corrió: ${(e as Error).stack ?? (e as Error).message}`);
  }
  if (fallas.length) {
    console.log(`  ✗ DEPTOS-CONTEO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — /deptos lee el conteo de la noche sin contar (lo que falta se cuenta una vez y se guarda), el cron guarda las 20 búsquedas con todas las comunas, y la respuesta queda bajo 300 ms contra la base");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runDeptosConteoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ACTA DE MUTACIÓN (30-oct-2026, goal «financiamiento por defecto a 30 años»): D1 la clave del conteo sin el plazo, en ROJO
// (runner `mutar-recorrido.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte).
