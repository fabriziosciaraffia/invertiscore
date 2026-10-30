// ─────────────────────────────────────────────────────────────────────────────
// Tier RESPALDO-MAPA (28-oct-2026, 0 tokens, sin red: una base en memoria) — dos reglas de Fabrizio después del cierre del
// 28-oct:
//   · TODA TARJETA DE UN DEPTO EN EL DASHBOARD TIENE «ANALIZAR ESTE», venga de la selección o del respaldo. Las 11 cuentas
//     reales sin deptos esta semana veían el respaldo de la noche (PrimeraSeleccion) sin el botón: sin fila del día
//     pendiente no había token, y el botón lo exigía.
//   · EL MAPA DIBUJA LOS DEPTOS DEL BLOQUE QUE TENGA LA PERSONA: renta larga, renta corta o los dos, con los pines
//     numerados en el orden de las tarjetas. Las 21 cuentas con selección solo de renta corta no veían mapa (el mapa leía
//     solo el bloque largo).
//
//   1 · LA CUENTA SIN SELECCIÓN Y UN DEPTO DEL RESPALDO: primerosDeLaCuenta trae los de la noche sin token y cada tarjeta
//       tiene «Analizar este», como respaldo (comoAnalizarPrimero); con su fila del día, por el token.
//   2 · EL RESPALDO SE ANALIZA DE VERDAD: la tarjeta pide `respaldo: true` sin token; la ruta lo acepta con la validación de
//       Explorar (las listas del pop-up y el origen sintético) y lo cuenta como la selección; sin saldo, la compra vuelve al
//       depto por Explorar, que lo analiza solo.
//   3 · EL RESPALDO DE LA CASA TIENE SU MAPA: `mapa=casa` arma el del dashboard (con los grises y el total de la noche) y
//       la tarjeta lo dibuja en la variante de la casa.
//   4 · EL MAPA CON EL BLOQUE QUE TENGA: solo renta corta, solo renta larga o los dos, en el orden de las tarjetas (el del
//       depto clicado primero), el reemplazo en su lugar; el segundo bloque sigue la cuenta del primero, en el mapa y en
//       las tarjetas; el dashboard lo dibuja con esos deptos.
//
// ACTA DE MUTACIONES (28-oct-2026): el tier se escribió primero y salió ROJO sobre el código del 28-oct («ve 1 depto(s) del
// respaldo sin "Analizar este"»). Después, cada una corrida y devuelta: M1 el botón exige el token → ROJO §1 · M2 la
// tarjeta del respaldo pide con `semanal` → ROJO §2 · M3 la ruta no acepta el respaldo → ROJO §2 · M4 el respaldo cuenta
// como Explorar → ROJO §2 · M5 la ruta no arma el mapa de la casa → ROJO §3 · M6 el mapa lee solo el bloque largo → ROJO
// §4 · M7 el segundo bloque vuelve a empezar en 1 → ROJO §4 · M8 el depto clicado no manda el orden → ROJO §4.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/respaldo-mapa-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { primerosDeLaCuenta } from "../../../src/lib/deptos/primeros-servidor";
import { comoAnalizarPrimero, puedeAnalizarPrimero } from "../../../src/lib/guia/del-dia";
import { comprasDeExplorar, deptoDeVolverExplorar } from "../../../src/lib/guia/compra-desde-depto";
import { bloquesEnOrden, deptosDelMapa, type SeleccionPagina } from "../../../src/lib/guia/seleccion-pagina-servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));

type Fila = Record<string, unknown>;
function baseFalsa(rpcs: Record<string, (args: Fila) => Fila[]> = {}) {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
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
      or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, like() { return b; },
      maybeSingle() { una = true; return b; },
      single() { una = true; return b; },
      then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) {
        try { return Promise.resolve(correr()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); }
      },
    };
    const correr = () => {
      const filas = tabla(t);
      if (op.tipo === "insert" || op.tipo === "upsert") { filas.push({ ...op.valor }); return { data: devolver ? (una ? op.valor : [op.valor]) : null, error: null }; }
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

export async function runRespaldoMapaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER RESPALDO-MAPA (toda tarjeta del dashboard con «Analizar este»; el mapa con el bloque que tenga la persona · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const ahora = new Date("2026-10-28T15:00:00Z");
  try {
    // ── 1 · la cuenta sin selección y un depto del respaldo ──
    // Mutación: M1 el botón exige el token.
    {
      const deLaNoche = [{ id: "r1", comuna: "Ñuñoa", superficie_m2: 55, dormitorios: 2, banos: 1, precio_uf: 4100, score_cron: 81, flujo: 15000, pub_estado: "publicado", pub_at: new Date(ahora.getTime() - 3600_000).toISOString(), condicion: "usado" }];
      const base = baseFalsa({ deptos_candidatos: () => deLaNoche });
      base.tabla("config").push({ key: "uf_value", value: "39500" }, { key: "tasa_hipotecaria", value: "4.2" });
      // Una cuenta de antes (agosto): sin fila del día ni selección de esta semana, con su perfil.
      base.tabla("perfil_busqueda").push({ user_id: "u-vieja", comunas: ["Ñuñoa"], dormitorios: [2], precio_min_uf: 4000, precio_max_uf: 6000, modalidad: null, semanal_baja_at: null });
      const admin = base as unknown as Parameters<typeof primerosDeLaCuenta>[0];
      const d = await primerosDeLaCuenta(admin, "u-vieja", ahora);
      if (d.fuente !== "noche" || d.items.length !== 1 || d.token !== null) F(`1 · el fixture no es el respaldo sin fila del día (fuente ${d.fuente}, ${d.items.length} deptos, token ${d.token})`);
      const sinBoton = d.items.filter((it) => !puedeAnalizarPrimero(d, it));
      if (sinBoton.length > 0) F(`1 · la cuenta sin selección ve ${sinBoton.length} depto(s) del respaldo sin «Analizar este»`);
      if (d.items.some((it) => comoAnalizarPrimero(d, it) !== "respaldo")) F("1 · un depto del respaldo no se analiza como respaldo");
      const combo = { piePct: 20, plazoAnios: 25 };
      if (comoAnalizarPrimero({ token: "t", combinacion: combo }, { enSeleccion: true }) !== "seleccion" || comoAnalizarPrimero({ token: null, combinacion: combo }, { enSeleccion: false }) !== "respaldo"
        || comoAnalizarPrimero({ token: "t", combinacion: combo }, { enSeleccion: false }) !== "respaldo" || comoAnalizarPrimero({ token: "t", combinacion: null }, { enSeleccion: true }) !== null)
        F("1 · cómo se analiza una tarjeta: por el token si quedó en la fila del día, si no como respaldo; sin combinación, nada");
      const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
      if (!/const puede = puedeAnalizarPrimero\(datos, it\);/.test(ps)) F("1 · la tarjeta no decide el botón con puedeAnalizarPrimero");
    }

    // ── 2 · el respaldo se analiza de verdad ──
    // Mutaciones: M2 la tarjeta pide con `semanal` · M3 la ruta no lo acepta · M4 cuenta como Explorar.
    {
      const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
      const an = ps.slice(ps.indexOf("async function analizar("), ps.indexOf("const comprasDeLaTarjeta"));
      if (!/const como = datos \? comoAnalizarPrimero\(datos, it\) : null;\s*if \(!datos\?\.combinacion \|\| !como \|\| generando\) return;/.test(an)) F("2 · la tarjeta todavía exige el token para analizar");
      // ⚠ ACTA (30-oct-2026, goal «la tasa editable en Filtros») · los dos pedidos llevan la tasa elegida (null = la de hoy).
      if (!/como === "seleccion"\s*\? \{ origenId: datos\.origenId, avisoId: it\.avisoId, piePct: combo\.piePct, plazoAnios: combo\.plazoAnios, tasaPct: combo\.tasaPct \?\? null, semanal: datos\.token \}\s*: \{ origenId: null, avisoId: it\.avisoId, piePct: combo\.piePct, plazoAnios: combo\.plazoAnios, tasaPct: combo\.tasaPct \?\? null, respaldo: true \}/.test(an)) F("2 · la tarjeta del respaldo no pide el análisis como respaldo");
      const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
      if (!/const desdeRespaldo = b\.respaldo === true && !desdeExplorar && b\.origenId == null && typeof b\.semanal !== "string";/.test(ruta) || !/if \(\(!sinOrigen && !desdeExplorar && !desdeRespaldo && /.test(ruta)) F("2 · la ruta no acepta el respaldo");
      if (!/if \(desdeExplorar \|\| desdeRespaldo\) \{[\s\S]{0,200}?if \(!esPiePopup\(b\.piePct\) \|\| !esPlazoPopup\(b\.plazoAnios\)\) return NextResponse\.json\(\{ error: "combinacion" \}, \{ status: 400 \}\);[\s\S]{0,400}?o = origenSintetico\(/.test(ruta)) F("2 · el respaldo no se valida como Explorar (las listas del pop-up, el origen sintético)");
      if (!/const desdeSemanal = typeof b\.semanal === "string" \|\| desdeRespaldo;/.test(ruta) || !/desdeExplorar \? "explorar" : desdeSemanal \? "semanal" : "guia"/.test(ruta)) F("2 · el respaldo no cuenta como la selección");
      const aviso = "11111111-2222-3333-4444-555555555555";
      const c = comprasDeExplorar({ filtros: "", avisoId: aviso, ticket: false });
      if (deptoDeVolverExplorar(new URL(c.suelto.href, "https://x").searchParams.get("volver")) !== aviso) F("2 · sin saldo, la compra del respaldo no vuelve al depto");
      if (!/: comprasDeExplorar\(\{ filtros: "", avisoId: it\.avisoId, ticket: !!datos\.ticket \}\);/.test(ps) || !/compras=\{comprasDeLaTarjeta\(confirmar\.it\)\}/.test(ps)) F("2 · el pop-up del respaldo no ofrece la compra que vuelve al depto");
    }

    // ── 3 · el respaldo de la casa tiene su mapa ──
    // Mutación: M5 la ruta no arma el mapa de la casa.
    {
      const ruta = codigo("src/app/api/deptos/primeros/route.ts");
      if (!/const conMapa = \(pideMapa === "1" \|\| pideMapa === "casa"\)/.test(ruta) || !/\{ grises: pideMapa === "casa" \}/.test(ruta) || !/conMapa && pideMapa === "casa" \? portadaDeptos\(\)/.test(ruta)) F("3 · la ruta no arma el mapa de la casa para el respaldo");
      const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
      if (!/qs\.set\("mapa", encabezado === "dentro" \? "1" : "casa"\);/.test(ps) || !/<MapaCasa datos=\{datos\.mapa\} variante=\{encabezado === "casa" \? "casa" : "seleccion"\} totalNoche=\{datos\.totalNoche \?\? null\} \/>/.test(ps)) F("3 · el respaldo de la casa no dibuja el mapa del dashboard");
    }

    // ── 4 · el mapa con el bloque que tenga, numerado como las tarjetas ──
    // Mutaciones: M6 solo el bloque largo · M7 el segundo bloque desde 1 · M8 el clicado no manda el orden.
    {
      const it = (avisoId: string) => ({ avisoId, comuna: "Ñuñoa", tipologia: "2D1B", m2: 55, precioUF: 4100, veredicto: "COMPRAR", score: 80, flujo: 1000 });
      const bloque = (ids: string[], reemplazo?: [number, string]) => ({
        origenId: null, combinacion: { piePct: 20, plazoAnios: 25 }, noDan: [], informes: {}, finanzas: { tasa: 4.2, uf: 39500, arriendos: {} },
        filas: ids.map((id, i) => ({ item: it(id), ...(reemplazo && reemplazo[0] === i ? { caido: true, reemplazo: it(reemplazo[1]) } : {}) })),
      });
      const sel = (largo: ReturnType<typeof bloque> | null, corto: ReturnType<typeof bloque> | null, cortoPrimero = false) =>
        ({ otraCuenta: false, token: "t", fuente: "semanal", variante: "tarjetas", saldo: { tipo: "sin" }, ticket: false, cuentaCreadaAt: null, destacado: null, largo, corto, cortoPrimero }) as unknown as SeleccionPagina;
      const ids = (s: SeleccionPagina) => deptosDelMapa(s).map((d) => d.avisoId).join();
      const soloCorta = sel(null, bloque(["c1", "c2", "c3"]));
      if (ids(soloCorta) !== "c1,c2,c3") F(`4 · con solo renta corta el mapa no trae sus deptos: «${ids(soloCorta)}»`);
      if (ids(sel(bloque(["l1", "l2"]), null)) !== "l1,l2") F("4 · con solo renta larga el mapa no trae sus deptos");
      const dos = sel(bloque(["l1", "l2"], [1, "l9"]), bloque(["c1"]));
      if (ids(dos) !== "l1,l9,c1") F(`4 · con los dos, el mapa no va en el orden de las tarjetas (el reemplazo en su lugar): «${ids(dos)}»`);
      const dosC = sel(bloque(["l1", "l2"]), bloque(["c1"]), true);
      if (ids(dosC) !== "c1,l1,l2") F(`4 · con el depto clicado en renta corta, el mapa no empieza por ese bloque: «${ids(dosC)}»`);
      const nums = (s: SeleccionPagina) => bloquesEnOrden(s).map((b) => `${b.bloque}:${b.desde}`).join();
      if (nums(dos) !== "largo:1,corto:3" || nums(dosC) !== "corto:1,largo:2" || nums(sel(bloque([]), bloque(["c1"]))) !== "corto:1") F(`4 · el segundo bloque no sigue la cuenta del primero (${nums(dos)} · ${nums(dosC)})`);
      const pag = codigo("src/app/dashboard/page.tsx");
      if (!/const enElMapa = deptosDelMapa\(sel\);/.test(pag) || !/enElMapa\.length > 0 \? datosMapaCasa\(admin, user\.id, enElMapa\) : Promise\.resolve\(null\),/.test(pag)) F("4 · el dashboard no dibuja el mapa con los deptos de los dos bloques");
      const enCasa = codigo("src/app/dashboard/seleccion-en-casa.tsx");
      if (!/const desde = \(b: "largo" \| "corto"\) => bloquesEnOrden\(sel\)\.find\(\(x\) => x\.bloque === b\)\?\.desde \?\? 1;/.test(enCasa) || !/filas=\{sel\.largo\.filas\}\s*desdeN=\{desde\("largo"\)\}/.test(enCasa) || !/filas=\{sel\.corto\.filas\}\s*desdeN=\{desde\("corto"\)\}/.test(enCasa)) F("4 · las tarjetas no se numeran como el mapa");
      const sl = codigo("src/app/semanal/semanal-lista.tsx");
      if (!/tarjeta\(f\.reemplazo, f\.reemplazo\.avisoId, i \+ desdeN\)/.test(sl) || !/\) : tarjeta\(f\.item, f\.item\.avisoId, i \+ desdeN\)\)\)\}/.test(sl)) F("4 · la lista no numera desde el número de su bloque");
    }
  } catch (e) {
    F(`no corrió: ${(e as Error).stack ?? (e as Error).message}`);
  } finally {
    if (posthog) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }
  if (fallas.length) {
    console.log(`  ✗ RESPALDO-MAPA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — toda tarjeta del dashboard tiene «Analizar este», también las del respaldo (que se analiza como un aviso evaluado y cuenta como la selección); el respaldo de la casa trae su mapa; el mapa dibuja el bloque que tenga la persona, numerado como las tarjetas");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runRespaldoMapaTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ACTA DE MUTACIÓN (30-oct-2026, goal «la tasa editable en Filtros»): X5 —el respaldo no manda la tasa—, en ROJO (runner `mutar-tasa.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte).
