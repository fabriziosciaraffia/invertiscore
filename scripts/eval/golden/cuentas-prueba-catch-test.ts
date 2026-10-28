// ─────────────────────────────────────────────────────────────────────────────
// Tier CUENTAS-PRUEBA (28-oct-2026, 0 tokens, sin red: una base en memoria) — la regla de Fabrizio después del recorrido con
// fabriziosciaraffia+qaexplorar: EL FILTRO DE CUENTAS DE PRUEBA BLOQUEA SOLO EL ENVÍO DEL CORREO, NUNCA LA FILA, LA SELECCIÓN,
// LOS BOTONES NI EL MAPA. Una cuenta de prueba ve exactamente lo mismo que una real.
//
// La causa del 28-oct: desde el trigger del 26-oct (marcar_cuenta_interna) las cuentas +… nacen en test_accounts, y la
// primera vuelta del correo del día (encolarPrimeraSeleccion) descartaba su fila antes de correr. Sin fila pendiente,
// «Estás dentro» mostraba los de la noche sin el token (sin «Analizar este») y el dashboard no tenía selección con que
// dibujar el mapa. Lo mismo hacían la cola del correo del día, el armado y el envío del semanal, su reintento y el aviso
// inmediato. Ahora el único que mira test_accounts para decidir es enviarCorreo (correo-destino.ts).
//
//   1 · LA CUENTA DE PRUEBA NUEVA POR /deptos VE «ANALIZAR ESTE»: el alta encola la fila del día, la primera vuelta corre y
//       «Estás dentro» (primerosDeLaCuenta) trae cada depto con el botón (puedeAnalizarPrimero) y el token de su fila. Y ve
//       exactamente lo mismo que una cuenta real con el mismo perfil.
//   2 · Y EL DASHBOARD TIENE CON QUÉ DIBUJAR EL MAPA: la selección de esta semana (seleccionDeEstaSemana) es su fila del día
//       con los mismos deptos, en el bloque de renta larga (los pines del mapa).
//   3 · LA REGLA EN UN SOLO LUGAR: `cuentasPruebaSinCorreo` no existe; nada de la cola, los crons ni el alta lee test_accounts;
//       `recibe_correos` lo lee solo quien decide un correo (correo-destino.ts y el correo a quien invitó); y enviarCorreo
//       sigue frenando a la cuenta de prueba sin la marca.
//   4 · EL SEMANAL TAMBIÉN SE LES ARMA, AL FINAL DE LA COLA: personasSemanal trae a las cuentas de prueba, después de todas
//       las reales (las fichas tienen un tope por hora y lo usan primero las personas).
//
// ACTA DE MUTACIONES (28-oct-2026), cada una corrida y devuelta:
//   M1 la línea vieja (descartar la fila de la cuenta de prueba antes de la vuelta) → ROJO §1 y §2 (verificado también
//      ANTES del arreglo: el tier se escribió primero y salió rojo sobre el código del 28-oct).
//   M2 la cola del correo del día vuelve a descartar a las de prueba → ROJO §3.
//   M3 personasSemanal vuelve a sacarlas → ROJO §4 · M4 las ordena por id sin mirar si son de prueba → ROJO §4.
//   M5 destinoBloqueado deja pasar a la cuenta de prueba → ROJO §3.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/cuentas-prueba-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { encolarPrimeraSeleccion } from "../../../src/lib/guia/del-dia-servidor";
import { primerosDeLaCuenta } from "../../../src/lib/deptos/primeros-servidor";
import { personasSemanal, seleccionDeEstaSemana } from "../../../src/lib/guia/semanal-servidor";
import { puedeAnalizarPrimero } from "../../../src/lib/guia/del-dia";
import { destinoBloqueado } from "../../../src/lib/correo-destino";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ── Una base en memoria: lo de supabase-js que usan el alta, «Estás dentro», la selección y el semanal ──────────────────
type Fila = Record<string, unknown>;
function baseFalsa(rpcs: Record<string, (args: Fila) => Fila[]> = {}) {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
  let ids = 0;
  // `.eq("items", "[]")` (rellenarDeLaNoche) compara el JSON, como PostgREST.
  const igual = (a: unknown, b: unknown) => (typeof b === "string" && a != null && typeof a === "object" ? JSON.stringify(a) === b : a === b);
  const from = (t: string) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "upsert" | "delete"; valor?: Fila } = { tipo: "select" };
    let cabeza = false, una = false, devolver = false;
    const b = {
      select(_c?: string, s?: { head?: boolean }) { if (op.tipo === "select") cabeza = !!s?.head; else devolver = true; return b; },
      insert(v: Fila) { op = { tipo: "insert", valor: v }; return b; },
      update(v: Fila) { op = { tipo: "update", valor: v }; return b; },
      upsert(v: Fila) { op = { tipo: "upsert", valor: v }; return b; },
      delete() { op = { tipo: "delete" }; return b; },
      eq(c: string, v: unknown) { filtros.push((f) => igual(f[c], v)); return b; },
      neq(c: string, v: unknown) { filtros.push((f) => !igual(f[c], v)); return b; },
      in(c: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[c])); return b; },
      gte(c: string, v: unknown) { filtros.push((f) => String(f[c]) >= String(v)); return b; },
      gt(c: string, v: unknown) { filtros.push((f) => (typeof v === "number" ? Number(f[c]) > v : String(f[c]) > String(v))); return b; },
      is(c: string, v: unknown) { filtros.push((f) => (f[c] ?? null) === v); return b; },
      not(c: string, _o: string, v: unknown) { filtros.push((f) => (f[c] ?? null) !== v); return b; },
      or() { return b; },
      order() { return b; },
      limit() { return b; },
      range() { return b; },
      maybeSingle() { una = true; return b; },
      single() { una = true; return b; },
      then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) {
        try { return Promise.resolve(correr()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); }
      },
    };
    const correr = () => {
      const filas = tabla(t);
      if (op.tipo === "insert" || op.tipo === "upsert") {
        const v = { ...op.valor } as Fila;
        if (t === "semanal_selecciones" && filas.some((f) => f.user_id === v.user_id && f.semana === v.semana && f.tipo === v.tipo)) return { data: null, error: { code: "23505", message: "duplicada" } };
        if (!("id" in v)) v.id = `id-${++ids}`;
        if (t === "semanal_selecciones") { v.token ??= `tok${ids}abcdef0123456789abcdef`; v.intentos ??= 0; v.enviada_at ??= null; }
        filas.push(v);
        return { data: devolver ? (una ? v : [v]) : null, error: null };
      }
      const elegidas = filas.filter((f) => filtros.every((p) => p(f)));
      if (op.tipo === "update") { for (const f of elegidas) Object.assign(f, op.valor); return { data: devolver ? elegidas : null, error: null }; }
      if (op.tipo === "delete") { for (const f of elegidas) filas.splice(filas.indexOf(f), 1); return { data: null, error: null }; }
      if (cabeza) return { data: null, count: elegidas.length, error: null };
      if (una) return { data: elegidas[0] ?? null, error: null };
      return { data: elegidas, error: null };
    };
    return b;
  };
  const rpc = async (nombre: string, args: Fila) => ({ data: rpcs[nombre] ? rpcs[nombre](args) : [], error: null });
  return { from, rpc, tabla, auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } } };
}

/** Los archivos de src/ (para la regla en un solo lugar). */
function archivosSrc(dir = join(RAIZ, "src")): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivosSrc(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(relative(RAIZ, p).replace(/\\/g, "/"));
  }
  return out;
}

export async function runCuentasPruebaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CUENTAS-PRUEBA (la cuenta de prueba ve lo mismo que una real: el filtro solo frena el correo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const resend = process.env.RESEND_API_KEY;
  // Nada sale de acá: ni eventos ni correos.
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.RESEND_API_KEY;
  // Un martes, 15:00 en Chile (18:00 UTC).
  const ahora = new Date("2026-10-27T18:00:00Z");
  try {
    // ── 1 y 2 · la cuenta de prueba nueva por /deptos, al lado de una real con el mismo perfil ──
    // Mutaciones: M1 (la línea vieja: descartar la fila de la de prueba antes de la vuelta).
    {
      const deLaNoche = Array.from({ length: 5 }, (_, i) => ({
        id: `aviso-${i + 1}`, comuna: "Providencia", superficie_m2: 58 + i, dormitorios: 2, banos: 2, precio_uf: 4300 + 100 * i,
        score_cron: 90 - i, flujo: 20000 - 1000 * i, pub_estado: "publicado", pub_at: new Date(ahora.getTime() - 3600_000).toISOString(), condicion: "usado",
      }));
      const base = baseFalsa({ deptos_candidatos: () => deLaNoche });
      base.tabla("config").push({ key: "uf_value", value: "39500" }, { key: "tasa_hipotecaria", value: "4.2" });
      base.tabla("test_accounts").push({ user_id: "u-prueba", recibe_correos: false });
      const perfil = { comunas: ["Providencia"], dormitorios: [2], precio_min_uf: 4000, precio_max_uf: 6000, modalidad: null, pie_pct: null, plazo_anios: null, semanal_baja_at: null };
      base.tabla("perfil_busqueda").push({ user_id: "u-prueba", ...perfil }, { user_id: "u-real", ...perfil });
      const admin = base as unknown as Parameters<typeof encolarPrimeraSeleccion>[0];

      const porCuenta = async (id: string) => {
        const pendientes: Promise<unknown>[] = [];
        // La vuelta del correo del día no arma nada acá: lo que se prueba es que no le quite la fila a nadie.
        const fila = await encolarPrimeraSeleccion(admin, { id, created_at: new Date(ahora.getTime() - 60_000).toISOString() }, {
          sitio: "https://x", ruta: "tier", enSegundoPlano: (p) => { pendientes.push(p); }, vuelta: async () => {},
        }, ahora);
        await Promise.all(pendientes);
        const enBase = base.tabla("semanal_selecciones").find((f) => f.user_id === id && f.tipo === "del_dia");
        const datos = await primerosDeLaCuenta(admin, id, ahora);
        const sel = await seleccionDeEstaSemana(admin, id, ahora);
        return { fila, enBase, datos, sel };
      };
      const prueba = await porCuenta("u-prueba");
      const real = await porCuenta("u-real");

      if (!prueba.fila || !prueba.enBase) F("1 · el alta de la cuenta de prueba no deja su fila del día");
      else if (prueba.enBase.estado === "descartada") F("1 · la primera vuelta descarta la fila del día de la cuenta de prueba (se queda sin selección ni botón)");
      const d = prueba.datos;
      if (d.items.length === 0) F(`1 · «Estás dentro» de la cuenta de prueba no trae deptos (fuente ${d.fuente})`);
      else {
        const sinBoton = d.items.filter((it) => !puedeAnalizarPrimero(d, it)).length;
        if (sinBoton > 0) F(`1 · la cuenta de prueba nueva por /deptos no ve «Analizar este» en ${sinBoton} de ${d.items.length} deptos (token ${d.token ? "sí" : "no"})`);
        if (prueba.enBase && d.token !== prueba.enBase.token) F("1 · «Analizar este» de la cuenta de prueba no va con el token de su fila del día");
      }
      // Lo mismo que una real: los mismos deptos, en el mismo orden, con el mismo botón, la misma combinación y la misma fuente.
      const vista = (x: typeof d) => JSON.stringify({ fuente: x.fuente, faltan: x.faltan, combinacion: x.combinacion, revisando: x.revisando, items: x.items.map((it) => [it.avisoId, puedeAnalizarPrimero(x, it)]) });
      if (vista(d) !== vista(real.datos)) F(`1 · la cuenta de prueba no ve lo mismo que una real: ${vista(d)} contra ${vista(real.datos)}`);
      if (real.datos.items.length === 0 || real.datos.items.some((it) => !puedeAnalizarPrimero(real.datos, it))) F("1 · la cuenta real del tier no ve «Analizar este» (el instrumento no corrió)");

      // 2 · el mapa del dashboard se arma con los deptos de la selección de renta larga (page.tsx › itemsSel).
      const s = prueba.sel;
      if (!s || !s.conLargo || s.items.length === 0) F("2 · el dashboard de la cuenta de prueba no tiene selección con que dibujar el mapa");
      else if (s.items.map((i) => i.avisoId).join() !== d.items.map((i) => i.avisoId).join()) F("2 · la selección del dashboard no es la de «Estás dentro»");
      if (!real.sel || real.sel.items.length !== (s?.items.length ?? -1)) F("2 · la cuenta de prueba y la real no tienen la misma selección en el dashboard");
    }

    // ── 3 · la regla en un solo lugar ──
    // Mutaciones: M2 la cola del correo del día descarta a las de prueba · M5 destinoBloqueado las deja pasar.
    {
      const src = archivosSrc();
      const conFiltroViejo = src.filter((p) => /cuentasPruebaSinCorreo/.test(sinComentarios(leer(p))));
      if (conFiltroViejo.length > 0) F(`3 · vuelve el filtro que le quita la fila a la cuenta de prueba (cuentasPruebaSinCorreo): ${conFiltroViejo.join(", ")}`);
      const cola = [
        "src/lib/guia/del-dia-servidor.ts", "src/lib/guia/semanal-servidor.ts", "src/lib/guia/semanal-str-servidor.ts", "src/lib/guia/inmediato-servidor.ts",
        "src/lib/deptos/primeros-servidor.ts", "src/lib/guia/seleccion-pagina-servidor.ts", "src/lib/casa/mapa-casa-servidor.ts",
        "src/app/api/cron/correo-del-dia/route.ts", "src/app/api/cron/semanal-armar/route.ts", "src/app/api/cron/semanal-enviar/route.ts",
        "src/app/api/cron/semanal-reintento/route.ts", "src/app/api/cron/semanal-prechequeo/route.ts", "src/app/api/cron/aviso-inmediato/route.ts",
        "src/app/api/admin/semanal-reparar/route.ts", "src/app/api/deptos/primeros/route.ts", "src/app/dashboard/page.tsx",
      ];
      for (const p of cola) {
        const s = sinComentarios(leer(p));
        // personasSemanal lee test_accounts solo para ORDENAR (las de prueba al final); que no las saque lo prueba el §4.
        const permitido = p === "src/lib/guia/semanal-servidor.ts" ? s.replace(/export async function cuentasDePruebaAlFinal[\s\S]*?\n}\n/, "") : s;
        // `fuera.has(i.avisoId)` (itemsVigentes) son los despublicados: lo que se prohíbe es el conjunto por cuenta.
        if (/test_accounts|recibe_correos|fuera\.has\((?:fila\.user_id|user\.id|userId|u|p\.userId)\)/.test(permitido)) F(`3 · ${p} decide la fila, la selección o el envío por la cuenta de prueba (solo enviarCorreo puede)`);
      }
      const leenMarca = src.filter((p) => /recibe_correos/.test(sinComentarios(leer(p)))).filter((p) => !/^src\/app\/admin\//.test(p));
      const permitidos = ["src/lib/correo-destino.ts", "src/lib/referido-servidor.ts"];
      const otros = leenMarca.filter((p) => !permitidos.includes(p));
      if (otros.length > 0) F(`3 · \`recibe_correos\` lo lee alguien que no decide un correo: ${otros.join(", ")}`);
      if (!leenMarca.includes("src/lib/correo-destino.ts")) F("3 · correo-destino.ts ya no lee `recibe_correos` (¿quién frena el correo?)");
      if (!/const bloqueo = destinoBloqueado\(String\(to \?\? ""\), userId, await cuentasDePruebaSinCorreo\(\)\);\s*if \(bloqueo\) \{/.test(sinComentarios(leer("src/lib/email.ts")))) F("3 · enviarCorreo ya no frena el correo de la cuenta de prueba");
      if (destinoBloqueado("ana@gmail.com", "u-prueba", new Set(["u-prueba"])) !== "cuenta-de-prueba" || destinoBloqueado("ana@gmail.com", "u-real", new Set(["u-prueba"])) !== null) F("3 · destinoBloqueado no frena a la cuenta de prueba, o frena a una real");
    }

    // ── 4 · el semanal también se les arma, al final de la cola ──
    // Mutaciones: M3 personasSemanal las saca · M4 las ordena por id sin mirar si son de prueba.
    {
      const base = baseFalsa();
      base.tabla("test_accounts").push({ user_id: "a-prueba", recibe_correos: false }, { user_id: "b-prueba-marcada", recibe_correos: true });
      base.tabla("perfiles_inversion").push({ id: 1, user_id: "a-prueba" }, { id: 2, user_id: "z-real" });
      base.tabla("analisis").push({ id: 3, user_id: "b-prueba-marcada", tipo_analisis: "long-term" }, { id: 4, user_id: "m-real", tipo_analisis: "short-term" });
      base.tabla("perfil_busqueda").push({ user_id: "c-real", comunas: ["Ñuñoa"], dormitorios: [2], precio_max_uf: 5000, semanal_baja_at: null });
      const personas = (await personasSemanal(base as unknown as Parameters<typeof personasSemanal>[0])).map((p) => p.userId);
      const reales = ["c-real", "m-real", "z-real"], dePrueba = ["a-prueba", "b-prueba-marcada"];
      if ([...reales, ...dePrueba].some((u) => !personas.includes(u)) || personas.length !== 5) F(`4 · el semanal no se le arma a todas (las de prueba también): ${personas.join(", ")}`);
      const ultimaReal = Math.max(...reales.map((u) => personas.indexOf(u))), primeraPrueba = Math.min(...dePrueba.map((u) => personas.indexOf(u)));
      if (!(ultimaReal < primeraPrueba)) F(`4 · las cuentas de prueba no van al final de la cola (el tope de fichas lo usan primero las personas): ${personas.join(", ")}`);
      const pre = sinComentarios(leer("src/app/api/cron/semanal-prechequeo/route.ts"));
      if (!/\(await personasSemanal\(admin\)\)\.sort\(\(a, b\) => Number\(a\.prueba\) - Number\(b\.prueba\) \|\| /.test(pre)) F("4 · el prechequeo no deja a las cuentas de prueba al final de su orden estable");
    }
  } catch (e) {
    F(`no corrió: ${(e as Error).stack ?? (e as Error).message}`);
  } finally {
    if (posthog) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
    if (resend) process.env.RESEND_API_KEY = resend;
  }
  if (fallas.length) {
    console.log(`  ✗ CUENTAS-PRUEBA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la cuenta de prueba nueva por /deptos ve «Analizar este» y la misma selección que una real, el dashboard tiene con qué dibujar el mapa, el semanal se les arma al final de la cola, y solo enviarCorreo las deja sin correo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runCuentasPruebaTier().then((r) => process.exit(r.hard > 0 ? 1 : 0));
}
