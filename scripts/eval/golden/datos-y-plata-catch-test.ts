// ============================================================================
// GOLDEN · DATOS-Y-PLATA (04-nov-2026) — catch-test
// ============================================================================
//   La auditoría de promesas, parte 1: datos y plata. Decisiones de Fabrizio, 04-nov-2026:
//   1 · `analisis` NO SE LEE CON LA LLAVE PÚBLICA. Lectura anónima REAL contra la base: cero filas (y la de servicio,
//       alguna, para que el cero signifique algo). Las superficies que muestran un informe ajeno o sin sesión leen la
//       fila con la llave de servicio, y la migración que borra la política está en el repo.
//   2 · EL INFORME BLOQUEADO NO SE VE SIN PAGAR: pendiente de pago, cada superficie corta antes de calcular y muestra la
//       portada bloqueada (sin puntaje ni veredicto); la vista previa tampoco los dice.
//   3 · NUNCA UN CRÉDITO GASTADO SIN INFORME: si la creación falla, el cobro vuelve (el candado de «Analizar este», el
//       formulario LTR y STR); el pop-up que agota los «en curso» cierra con el fallo.
//   4 · UN TOQUE, UN ANÁLISIS, EN SU MODALIDAD: la vuelta del pago lleva `m=str` y solo esa lista analiza sola.
//   5 · ACREDITAR NO SE TRAGA ERRORES: grantCredits lanza, payments/confirm no manda «Pago confirmado» y pide reintento,
//       el admin ve «Pagos sin acreditar» y el reconciliador diario los cruza.
//   6 · EL SALDO CUENTA LA BIENVENIDA SIN USAR (lectura real de las cuentas viejas) y /perfil dice cuándo vence el primero.
//   7 · LAS BAJAS SE RESPETAN en el carrito abandonado y el recordatorio del pack; «Pago confirmado», una vez por pago.
//   8 · «Vence en 24 horas.» pasa a la hora real del vencimiento.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Las secciones 1 y 6 leen la base (solo SELECT).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/datos-y-plata-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sinComentarios } from "./lectura-paginada-catch-test";
import { informeBloqueado, algunoBloqueado, rutaPagoBloqueado, INFORME_BLOQUEADO_COPY } from "../../../src/lib/informe-bloqueado";
import { analizarUnaVez, RECLAMO_VIGENTE_MS, type PiezasAnalizar, type Reclamo } from "../../../src/lib/guia/analizar-una-vez";
import { devolucionDesdeModo, type Devolucion } from "../../../src/lib/access-devolucion";
import { autoAnalizarDeLaVuelta, comprasDelDepto, deptoDeVolver, volverAlDepto } from "../../../src/lib/guia/compra-desde-depto";
import { datosSaldoDe, estadoSaldo, leerSaldo } from "../../../src/lib/casa-saldo";
import { bienvenidaVigente } from "../../../src/lib/regalo-alta";
import { TIPOS_CON_BAJA } from "../../../src/lib/correo-baja";
import { TICKET_PACK } from "../../../src/lib/lo-que-sigue/copy";
import { cuandoVence } from "../../../src/lib/lo-que-sigue/oferta-pack";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));

/** El cliente con que se hace cada `.from("analisis")` del archivo: el identificador (o la llamada) justo antes. */
function clientesDeAnalisis(codigo: string): string[] {
  const out: string[] = [];
  const re = /([A-Za-z_][\w]*(?:\(\))?)\s*\.from\("analisis"\)/g;
  for (let m = re.exec(codigo); m; m = re.exec(codigo)) out.push(m[1]);
  return out;
}

/** El cuerpo de la función exportada `nombre` (hasta la siguiente declaración de nivel superior). */
function cuerpo(codigo: string, inicio: RegExp): string {
  const i = codigo.search(inicio);
  if (i < 0) return "";
  const resto = codigo.slice(i + 1);
  const j = resto.search(/\n(?:export |function |async function |const [A-Z_]+ =)/);
  return codigo.slice(i, j < 0 ? undefined : i + 1 + j);
}

// Las superficies que muestran un informe ajeno o sin sesión (la lista de lo que dependía de «Anyone can read analisis»).
const SUPERFICIES_POR_ENLACE = [
  "src/app/analisis/[id]/informe-ltr.tsx",
  "src/app/analisis/renta-corta/[id]/informe-str.tsx",
  "src/app/analisis/[id]/page.tsx",
  "src/app/analisis/renta-corta/[id]/page.tsx",
  "src/app/analisis/[id]/documento/page.tsx",
  "src/app/analisis/renta-corta/[id]/documento/page.tsx",
  "src/app/analisis/comparativa/page.tsx",
  "src/app/api/analisis/[id]/pdf/route.ts",
  "src/app/api/analisis/renta-corta/[id]/pdf/route.ts",
  "src/app/api/analisis/[id]/zone-insight/route.ts",
  "src/app/share/comparativa/[token]/page.tsx",
  "src/app/share/comparativa/[token]/documento/page.tsx",
  "src/app/api/share/comparativa/[token]/pdf/route.ts",
] as const;
/** Escrituras sobre una fila ya leída que siguen yendo por la sesión (el dueño) o por el anónimo con servicio. */
const ESCRITURAS_PERMITIDAS = new Set(["writeClient"]);

export async function runDatosYPlataTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER DATOS-Y-PLATA (la auditoría de promesas, parte 1: datos y plata · 0 tokens, lee la base) ───");

  // ── 1 · analisis no se lee con la llave pública ───────────────────────────
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !servicio) F("1 · NO CORRIÓ: faltan las variables de Supabase (correr con --env-file=.env.local)");
    else {
      const publico = createClient(url, anon, { auth: { persistSession: false } });
      const admin = createClient(url, servicio, { auth: { persistSession: false } });
      // El instrumento: con la llave de servicio la tabla tiene filas. Sin esto, un cero no dice nada.
      const { data: conServicio, error: eServ } = await admin.from("analisis").select("id").limit(1);
      if (eServ || !conServicio?.length) F(`1 · NO CORRIÓ: la llave de servicio no lee filas de analisis (${eServ?.message ?? "0 filas"})`);
      else {
        for (const tabla of ["analisis", "analisis_dashboard"]) {
          const { data, error } = await publico.from(tabla).select("id").limit(5);
          // Cero filas sin error (RLS) o «permission denied» (42501, sin SELECT): las dos cierran. Otro error no es una medición.
          if (error && error.code !== "42501") F(`1 · NO CORRIÓ la lectura anónima de ${tabla}: ${error.code} ${error.message}`);
          else if (!error && (data?.length ?? 0) > 0) F(`1 · la llave pública lee ${data!.length} fila(s) de ${tabla}: la política «Anyone can read analisis» sigue abierta (aplicar 20261104_analisis_sin_lectura_publica.sql)`);
        }
      }
    }
    const migr = leer("supabase/migrations/20261104_analisis_sin_lectura_publica.sql");
    if (!/drop policy if exists "Anyone can read analisis" on public\.analisis;/.test(migr) || !/revoke select on public\.analisis from anon;/.test(migr) || !/revoke select on public\.analisis_dashboard from anon;/.test(migr)) F("1 · la migración no borra la política ni le quita el SELECT a anon");
    for (const f of SUPERFICIES_POR_ENLACE) {
      const codigo = sc(f);
      const clientes = clientesDeAnalisis(codigo).filter((c) => !ESCRITURAS_PERMITIDAS.has(c));
      if (!clientes.length) F(`1 · ${f} ya no lee analisis (¿se movió la lectura?)`);
      for (const c of clientes) if (c !== "informes" && c !== "createServiceClient()") F(`1 · ${f} lee analisis con «${c}», no con la llave de servicio`);
      if (/supabase\s*\.from\("analisis"\)/.test(codigo)) F(`1 · ${f} lee analisis con la sesión`);
    }
  }

  // ── 2 · el informe bloqueado no se ve sin pagar ───────────────────────────
  {
    if (!informeBloqueado({ pending_payment: true }, false) || informeBloqueado({ pending_payment: true }, true) || informeBloqueado({ pending_payment: false }, false) || informeBloqueado(null, false)) F("2 · la regla del bloqueo no es «pendiente de pago y no admin»");
    if (!algunoBloqueado([{ pending_payment: false }, { pending_payment: true }], false) || algunoBloqueado([{ pending_payment: false }, null], false)) F("2 · el comparativo no se bloquea con una de sus dos filas pendiente");
    const ruta = rutaPagoBloqueado({ analysisId: "a1", companionStrId: "s1" });
    if (ruta !== "/checkout?product=single&analysisId=a1&companionStrId=s1" || rutaPagoBloqueado({ analysisId: "a1" }) !== "/checkout?product=single&analysisId=a1") F(`2 · el botón de pagar no lleva al suelto con el informe atado (${ruta})`);
    if (INFORME_BLOQUEADO_COPY.dueno.boton !== "Pagar $9.990 y abrir el informe") F("2 · el botón del dueño no dice el precio del suelto");
    const comp = sc("src/components/analysis/InformeBloqueado.tsx");
    if (/score|veredicto|results|francoScore/i.test(comp)) F("2 · la portada bloqueada recibe o dibuja puntaje, veredicto o resultados");
    // Cada superficie corta ANTES de calcular o dibujar el informe.
    const antes: Array<[string, RegExp, RegExp]> = [
      ["src/app/analisis/[id]/informe-ltr.tsx", /if \(informeBloqueado\(data as \{ pending_payment\?: boolean \| null \}, isAdminUser\(user\?\.email\)\)\) \{\s*return \(\s*<InformeBloqueado/, /recomputeResultsForLegacy\(/],
      ["src/app/analisis/renta-corta/[id]/informe-str.tsx", /if \(informeBloqueado\(data as \{ pending_payment\?: boolean \| null \}, isAdminUser\(user\?\.email\)\)\) \{[\s\S]*?return \(\s*<InformeBloqueado/, /conOcupacionRealizadaDelCache\(/],
      ["src/app/analisis/comparativa/page.tsx", /if \(algunoBloqueado\(\[ltrRow, strRow\] as Array<\{ pending_payment\?: boolean \| null \}>, isAdminUser\(user\?\.email\)\)\) \{[\s\S]*?return \(\s*<InformeBloqueado/, /recomputeShortTermForLegacy\(/],
      ["src/app/analisis/[id]/documento/page.tsx", /if \(informeBloqueado\(data as \{ pending_payment\?: boolean \| null \}, false\)\) redirect\(`\/analisis\/\$\{params\.id\}`\);/, /evaluarAccesoDocumento\(/],
      ["src/app/analisis/renta-corta/[id]/documento/page.tsx", /if \(informeBloqueado\(data as \{ pending_payment\?: boolean \| null \}, false\)\) redirect\(`\/analisis\/renta-corta\/\$\{params\.id\}`\);/, /evaluarAccesoDocumento\(/],
      ["src/app/api/analisis/[id]/pdf/route.ts", /if \(informeBloqueado\(row as \{ pending_payment\?: boolean \| null \}, false\)\) \{\s*return NextResponse\.json\(\{ error: "El informe se abre al pagar\." \}, \{ status: 403 \}\);/, /accesoPdf\(/],
      ["src/app/api/analisis/renta-corta/[id]/pdf/route.ts", /if \(informeBloqueado\(row as \{ pending_payment\?: boolean \| null \}, false\)\) \{\s*return NextResponse\.json\(\{ error: "El informe se abre al pagar\." \}, \{ status: 403 \}\);/, /accesoPdf\(/],
      ["src/app/api/analisis/[id]/zone-insight/route.ts", /if \(informeBloqueado\(row as \{ pending_payment\?: boolean \| null \}, false\)\) \{\s*return NextResponse\.json\(\{ error: "El informe se abre al pagar\." \}, \{ status: 403 \}\);/, /buildZoneInsightForRow\(/],
      ["src/app/share/comparativa/[token]/page.tsx", /if \(algunoBloqueado\(\[ltrRow, strRow\] as Array<\{ pending_payment\?: boolean \| null \}>, false\)\) notFound\(\);/, /recompute[A-Za-z]*\(/],
      ["src/app/share/comparativa/[token]/documento/page.tsx", /if \(algunoBloqueado\(\[ltrRow, strRow\] as Array<\{ pending_payment\?: boolean \| null \}>, false\)\) notFound\(\);/, /recompute[A-Za-z]*\(/],
      ["src/app/api/share/comparativa/[token]/pdf/route.ts", /if \(algunoBloqueado\(\[ltrRow, strRow\] as Array<\{ pending_payment\?: boolean \| null \}>, false\)\) \{\s*return NextResponse\.json/, /return renderPdf\(/],
      ["src/app/analisis/[id]/page.tsx", /if \(informeBloqueado\(data, false\)\) \{\s*return \{ title: [\s\S]{0,120}?, description: INFORME_BLOQUEADO_COPY\.metaDescripcion/, /Franco Score: \$\{data\.score\}/],
      ["src/app/analisis/renta-corta/[id]/page.tsx", /if \(informeBloqueado\(data, false\)\) \{\s*return \{ title: [\s\S]{0,120}?, description: INFORME_BLOQUEADO_COPY\.metaDescripcion/, /recomputeShortTermForLegacy\(/],
    ];
    for (const [f, corte, trabajo] of antes) {
      const codigo = sc(f);
      const i = codigo.search(corte), j = codigo.search(trabajo);
      if (i < 0) F(`2 · ${f} no corta en pendiente de pago`);
      else if (j >= 0 && j < i) F(`2 · ${f} calcula o dibuja el informe antes de cortar en pendiente de pago`);
    }
    for (const f of ["src/app/api/og/route.tsx", "src/app/api/og/veredicto/route.tsx"]) {
      const codigo = sc(f);
      if (!/\.select\("[^"]*pending_payment"\)/.test(codigo) || !/if \(!data \|\| \(data as \{ pending_payment\?: boolean \| null \}\)\.pending_payment === true\) \{\s*return new Response\("Not found", \{ status: 404 \}\);/.test(codigo)) F(`2 · ${f}: la imagen de la vista previa dice el puntaje de un informe sin pagar`);
    }
  }

  // ── 3 · nunca un crédito gastado sin informe ──────────────────────────────
  {
    if (JSON.stringify(devolucionDesdeModo("welcome")) !== JSON.stringify({ tipo: "bienvenida" }) || JSON.stringify(devolucionDesdeModo("paid")) !== JSON.stringify({ tipo: "credito-nuevo" }) || devolucionDesdeModo("subscription").tipo !== "nada" || devolucionDesdeModo(null).tipo !== "nada") F("3 · la devolución por modo no es bienvenida · crédito nuevo · nada");
    type Fila = { analysisId: string | null; cobrado: boolean; mode: string | null; t: number };
    let reloj = 0;
    let fila: Fila | null = null;
    let fallarCrear = false;
    const devueltas: Devolucion[] = [];
    let cobros = 0, creados = 0;
    const piezas = (): PiezasAnalizar => ({
      async reclamar(): Promise<Reclamo> {
        if (!fila) { fila = { analysisId: null, cobrado: false, mode: null, t: reloj }; return { nueva: true }; }
        return { nueva: false, analysisId: fila.analysisId, cobrado: fila.cobrado, chargeMode: fila.mode, reclamadoHaceMs: reloj - fila.t };
      },
      async retomar() { if (!fila || fila.analysisId) return false; fila.t = reloj; return true; },
      async cobrar() { cobros++; return { ok: true, mode: "paid", devolucion: { tipo: "lote", loteId: "L1" } }; },
      async marcarCobrado(mode) { if (fila) { fila.cobrado = true; fila.mode = mode; } },
      async crear() { if (fallarCrear) throw new Error("insert"); creados++; return { id: `inf-${creados}` }; },
      async marcarCreado(id) { if (fila) fila.analysisId = id; },
      async devolver(d) { devueltas.push(d); },
      async soltar() { if (fila && !fila.analysisId) fila = null; },
    });
    fallarCrear = true;
    const r = await analizarUnaVez(piezas());
    if (r.estado !== "fallo" || devueltas.length !== 1 || JSON.stringify(devueltas[0]) !== JSON.stringify({ tipo: "lote", loteId: "L1" }) || fila !== null) F(`3 · una creación que falla no devuelve el crédito a su lote o deja la fila tomada (${r.estado}, ${devueltas.length} devoluciones)`);
    // La fila cobrada de una solicitud cortada a mitad: si el reintento vuelve a fallar, devuelve según el modo guardado.
    fila = { analysisId: null, cobrado: true, mode: "paid", t: reloj }; devueltas.length = 0; cobros = 0;
    reloj += RECLAMO_VIGENTE_MS + 1;
    const r2 = await analizarUnaVez(piezas());
    if (r2.estado !== "fallo" || cobros !== 0 || devueltas[0]?.tipo !== "credito-nuevo") F("3 · la fila cobrada de otra solicitud no se devuelve cuando el reintento falla");
    fallarCrear = false;

    const acceso = sc("src/lib/access.ts");
    const cobro = cuerpo(acceso, /export async function chargeAnalysisCredit\(/);
    if ((cobro.match(/return \{ ok: true, mode: "[a-z]+", devolucion: /g) ?? []).length !== 4) F("3 · chargeAnalysisCredit no dice de dónde salió el crédito en sus cuatro caminos");
    if (!/devolucion: delLedger\.loteId \? \{ tipo: "lote", loteId: delLedger\.loteId \}/.test(cobro)) F("3 · el cobro del ledger no dice de qué lote salió");
    const dev = cuerpo(acceso, /export async function devolverCobro\(/);
    if (!/d\.tipo === "lote"[\s\S]*?devolverLote\(d\.loteId\)/.test(dev) || !/d\.tipo === "bienvenida"[\s\S]*?welcome_credit_used: false/.test(dev) || !/d\.tipo === "credito-nuevo"[\s\S]*?grantCredits\(userId, FUENTE_DEVOLUCION_COBRO, 1, \{ noExpire: true \}\)/.test(dev) || !/credits: credits \+ 1/.test(dev)) F("3 · devolverCobro no devuelve cada origen a su lugar");
    const lote = cuerpo(sc("src/lib/credits-grant.ts"), /export async function devolverLote\(/);
    if (!/remaining >= \(Number\(lote\.amount\) \|\| 0\)\) return false;/.test(lote) || !/\.update\(\{ remaining: remaining \+ 1, consumed: false \}\)\s*\.eq\("id", loteId\)\s*\.eq\("remaining", remaining\)/.test(lote)) F("3 · devolverLote no suma 1 con el UPDATE condicional (o pasa del monto del lote)");
    const ltr = sc("src/app/api/analisis/route.ts");
    if (!/cobro = \{ userId: user\.id, devolucion: charge\.devolucion \};/.test(ltr) || !/extra: \{ comuna: body\.comuna, tipo_analisis: "long-term" \},\s*\}\);\s*if \(cobro\) await devolverCobro\(cobro\.userId, cobro\.devolucion\);/.test(ltr) || !/catch \(error\) \{\s*console\.error\("API error:", error\);\s*if \(cobro && !filaCreada\) await devolverCobro\(cobro\.userId, cobro\.devolucion\);/.test(ltr)) F("3 · el formulario LTR no devuelve el crédito cuando el informe no se crea");
    const str = sc("src/app/api/analisis/short-term/route.ts");
    if (!/if \(!built\.ok\) \{\s*if \(cobro\) await devolverCobro\(cobro\.userId, cobro\.devolucion\);\s*return built\.response;/.test(str) || !/console\.error\("\[short-term\] Supabase insert error:", error\);\s*if \(cobro\) await devolverCobro/.test(str) || !/filaCreada = true;/.test(str) || !/console\.error\("\[short-term\] API error:", error\);\s*if \(cobro && !filaCreada\) await devolverCobro/.test(str)) F("3 · el formulario STR no devuelve el crédito (AirROI caído, el insert o el motor)");
    for (const f of ["src/app/api/lo-que-sigue/guia/analizar/route.ts", "src/app/api/semanal/analizar-str/route.ts"]) {
      const codigo = sc(f);
      if (!/return c\.ok \? \{ ok: true, mode: c\.mode, devolucion: c\.devolucion \}/.test(codigo) || !/async devolver\(d\) \{\s*await devolverCobro\(user\.id, d\);\s*\}/.test(codigo) || !/if \(r\.estado === "fallo"\) \{[\s\S]{0,200}?return salir\(NextResponse\.json\(\{ error: "interno" \}, \{ status: 500 \}\)\);/.test(codigo)) F(`3 · ${f} no devuelve el crédito ni responde el fallo`);
    }
    // Los cuatro pop-ups que esperan «en curso»: en la última vuelta cierran con el fallo (no quedan girando).
    for (const [f, ultima] of [["src/app/semanal/semanal-lista.tsx", /if \(intento >= 7 \+ REINTENTOS_CREDITO\) \{ fallar\("error"\); break; \}/], ["src/components/deptos/PrimeraSeleccion.tsx", /if \(intento === 7\) \{ fallar\("error"\); break; \}/], ["src/components/guia/GuiaBusqueda.tsx", /if \(intento === 7\) \{ fallar\("error"\); break; \}/], ["src/app/explorar/explorar-cliente.tsx", /if \(intento === 7\) \{ fallar\("error"\); break; \}/]] as Array<[string, RegExp]>) {
      const codigo = sc(f);
      const bloque = (codigo.match(/if \(res\.status === 409\) \{[\s\S]*?continue;\s*\}/) ?? [""])[0];
      if (!ultima.test(bloque)) F(`3 · ${f}: agotados los «en curso», el pop-up no cierra con el fallo`);
    }
  }

  // ── 4 · un toque, un análisis, en su modalidad ────────────────────────────
  {
    const t = "a".repeat(40), a = "11111111-2222-3333-4444-555555555555";
    if (volverAlDepto(t, a) !== `/dashboard?t=${t}&a=${a}&analizar=1` || volverAlDepto(t, a, "str") !== `/dashboard?t=${t}&a=${a}&analizar=1&m=str`) F("4 · la vuelta no lleva la modalidad que se tocó");
    if (deptoDeVolver(volverAlDepto(t, a, "str"))?.m !== "str" || deptoDeVolver(volverAlDepto(t, a))?.m !== "ltr") F("4 · la vuelta no se lee con su modalidad");
    const auto = autoAnalizarDeLaVuelta({ analizar: "1", a, m: "str" });
    if (auto?.modalidad !== "str" || autoAnalizarDeLaVuelta({ analizar: "1", a, m: null })?.modalidad !== "ltr" || autoAnalizarDeLaVuelta({ analizar: null, a, m: "str" }) !== null) F("4 · el depto que se analiza solo no trae su modalidad");
    const compras = comprasDelDepto({ token: t, avisoId: a, origen: "semanal", ticket: false, modalidad: "str" });
    if (!decodeURIComponent(compras.suelto.href).includes("&m=str") || !decodeURIComponent(compras.pack.href).includes("&m=str")) F("4 · las compras desde un depto de renta corta vuelven sin `m=str`");
    const lista = sc("src/app/semanal/semanal-lista.tsx");
    if (!/if \(!autoAnalizar \|\| autoAnalizar\.modalidad !== modalidad \|\| autoHecho\.current\) return;/.test(lista) || !/comprasDelDepto\(\{[^}]*modalidad \}\)/.test(lista) || !/ticketConSaldoDelDepto\(\{[^}]*modalidad \}\)/.test(lista)) F("4 · las dos listas analizan el mismo depto, o la compra no lleva la modalidad");
    if (!/const autoAnalizar = autoAnalizarDeLaVuelta\(\{ analizar: uno\("analizar"\), a: aSel, m: uno\("m"\) \}\);/.test(sc("src/app/dashboard/page.tsx"))) F("4 · el dashboard no lee la modalidad de la vuelta");
    const status = cuerpo(sc("src/app/api/payments/status/route.ts"), /async function deptoDelPago\(/);
    if (!/if \(d\.m === "str"\) return null;/.test(status)) F("4 · la vuelta de Flow genera como renta larga un depto tocado en renta corta");
  }

  // ── 5 · acreditar no se traga errores ─────────────────────────────────────
  {
    const grant = cuerpo(sc("src/lib/credits-grant.ts"), /export async function grantCredits\(/);
    if (!/if \(error\.code === "23505"\) \{[\s\S]*?return null;\s*\}\s*console\.error\("\[grantCredits\] insert error:", error\);\s*throw new ErrorAcreditar\(/.test(grant)) F("5 · grantCredits se traga un error real del ledger");
    const confirm = sc("src/app/api/payments/confirm/route.ts");
    const iAcred = confirm.search(/try \{\s*acreditado = await acreditarPagoUnico\(supabase, payment, \{ companionStrId \}\);\s*\} catch \(e\) \{[\s\S]*?return NextResponse\.json\(\{ status: "error", detalle: "no se pudo acreditar" \}, \{ status: 503 \}\);\s*\}/);
    const iCorreo = confirm.search(/await sendPaymentConfirmationEmail\(/);
    if (iAcred < 0) F("5 · payments/confirm no le pide a Flow que reintente cuando no puede acreditar");
    else if (iCorreo < iAcred) F("5 · «Pago confirmado» sale antes de acreditar");
    if (/grantCredits\(/.test(confirm)) F("5 · payments/confirm acredita por fuera de acreditarPagoUnico");
    const acred = sc("src/lib/pagos/acreditar-pago.ts");
    if ((acred.match(/await grantCredits\(userId, [^,]+, [^,]+, \{ paymentId, noExpire: true \}\);/g) ?? []).length !== 3 || /\.catch\(/.test(cuerpo(acred, /export async function acreditarPagoUnico\(/).replace(/capturarServidor\([\s\S]*?\.catch\(\(\) => false\)/g, ""))) F("5 · acreditarPagoUnico no acredita los tres productos sin vencimiento o se traga el error");
    const proc = sc("src/lib/subscriptions/process-charge.ts");
    if (!/\} catch \(e\) \{\s*console\.error\("\[processSubscriptionCharge\] no se pudo acreditar:", e\);\s*return fail\("grant_error", userId\);/.test(proc) || !/"grant_error",\s*\]\);/.test(sc("src/app/api/subscriptions/payment-callback/route.ts"))) F("5 · el cobro de la suscripción se traga el error del ledger o no pide reintento");
    const vercel = JSON.parse(leer("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
    if (!vercel.crons?.some((c) => c.path === "/api/cron/reconciliar-pagos")) F("5 · el reconciliador diario no está programado en vercel.json");
    if (!/nombre: "reconciliar-pagos"/.test(sc("src/lib/cron-heartbeat.ts"))) F("5 · el reconciliador no está en la vigilancia de los crons");
    const rec = sc("src/app/api/cron/reconciliar-pagos/route.ts");
    if (!/flowGet\("payment\/getPayments"/.test(rec) || !/await pagosSinAcreditar\(sb, VENTANA_DIAS, ahora\)/.test(rec) || !/acreditarPagoUnico\(sb, p,/.test(rec) || !/\.delete\(\)\s*\.is\("analysis_id", null\)\s*\.not\("cobrado_at", "is", null\)/.test(rec) || !/devolverCobro\(c\.user_id as string, devolucionDesdeModo\(c\.charge_mode as string \| null\)\)/.test(rec)) F("5 · el reconciliador no cruza Flow, no acredita los pagados sin lote o no devuelve los cobros sin informe");
    const sinAc = cuerpo(sc("src/lib/pagos/sin-acreditar.ts"), /export async function pagosSinAcreditar\(/);
    if (!/\.eq\("status", "paid"\)/.test(sinAc) || !/\.from\("credit_grants"\)\.select\("payment_id"\)\.in\("payment_id", ids\)/.test(sinAc) || !/filas\.filter\(\(p\) => !conLote\.has\(p\.id\)\)/.test(sinAc)) F("5 · «pagos sin acreditar» no son los pagados sin su lote");
    const ops = sc("src/app/admin/operacion/page.tsx");
    if (!/pagosSinAcreditar\(sb, DIAS_SIN_ACREDITAR\)/.test(ops) || !/data-admin="pagos-sin-acreditar"/.test(ops)) F("5 · el admin no ve los pagos sin acreditar");
  }

  // ── 6 · el saldo cuenta la bienvenida sin usar ────────────────────────────
  {
    const sin = datosSaldoDe([], { credits: 0 }), con = datosSaldoDe([], { credits: 0 }, true);
    if (estadoSaldo(sin).tipo !== "sin" || con.disponibles !== 1 || estadoSaldo(con).tipo !== "regalo" || con.proximoRegalo !== true) F("6 · la bienvenida sin usar no cuenta como un análisis de regalo");
    const mezcla = datosSaldoDe([{ remaining: 2, expires_at: "2026-12-01T00:00:00Z", source: "single" }], { credits: 0 }, true);
    if (mezcla.disponibles !== 3 || mezcla.proximoRegalo !== true || mezcla.proximoVence !== "2026-12-01T00:00:00Z") F("6 · con la bienvenida y lotes, el saldo, el próximo o el vencimiento salen mal");
    if (!/const bienvenida = uc\?\.is_unlimited !== true && \(await bienvenidaPendiente\(/.test(sc("src/lib/casa-saldo.ts"))) F("6 · leerSaldo no mira la bienvenida");
    if (!/return ledger \+ \(uc\?\.credits \?\? 0\) \+ \(\(await bienvenidaPendiente\(userId, uc\?\.welcome_credit_used\)\) \? 1 : 0\);/.test(sc("src/lib/credits-grant.ts"))) F("6 · getAvailableCredits no cuenta la bienvenida");
    const perfil = sc("src/app/perfil/page.tsx");
    if (/Úsalos cuando quieras/.test(perfil) || !/const proximoVence = credits > 0 \? await getProximoVencimiento\(user\.id, supabase\) : null;/.test(perfil) || !/El primero vence/.test(perfil)) F("6 · /perfil sigue diciendo «Úsalos cuando quieras» sin decir cuándo vence el primero");
    // Lectura REAL: las cuentas viejas con la bienvenida sin usar ven al menos un análisis.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && servicio) {
      const admin = createClient(url, servicio, { auth: { persistSession: false } });
      const { data: filas, error } = await admin.from("user_credits").select("user_id, is_unlimited").eq("welcome_credit_used", false).order("user_id").limit(40);
      if (error) F(`6 · NO CORRIÓ: ${error.message}`);
      let medidas = 0;
      for (const f of filas ?? []) {
        if (f.is_unlimited) continue;
        const { data: u } = await admin.auth.admin.getUserById(f.user_id as string);
        if (!bienvenidaVigente(u?.user?.created_at ?? null)) continue;
        medidas++;
        const saldo = await leerSaldo(admin, f.user_id as string);
        if (saldo.disponibles < 1 || estadoSaldo(saldo).tipo === "sin") F(`6 · la cuenta ${String(f.user_id).slice(0, 8)} tiene la bienvenida sin usar y el saldo dice «Sin análisis»`);
      }
      if (filas && filas.length && !medidas) console.log("  · 6 · ninguna cuenta vieja con bienvenida sin usar en la muestra (la parte viva no midió)");
    }
  }

  // ── 7 · las bajas y el correo de pago, una vez ────────────────────────────
  {
    if (!TIPOS_CON_BAJA.has("checkout_abandonado") || !TIPOS_CON_BAJA.has("recordatorio_pack")) F("7 · el carrito abandonado o el recordatorio no respetan la baja");
    const ab = sc("src/app/api/cron/abandoned-checkout/route.ts");
    if (!/bajas = await conBajaDeCorreos\(supabase, /.test(ab) || !/&& !bajas\.has\(c\.user_id\),/.test(ab)) F("7 · el carrito abandonado le escribe a quien se dio de baja");
    const rp = sc("src/app/api/cron/recordatorio-pack/route.ts");
    const iBaja = rp.search(/if \(bajas\.has\(p\.user_id as string\)\) \{ deBaja\+\+; continue; \}/), iReclamo = rp.search(/\.update\(\{ recordatorio_pack_enviado_at:/);
    if (!/bajas = await conBajaDeCorreos\(supabase, /.test(rp) || iBaja < 0 || iReclamo < iBaja) F("7 · el recordatorio del pack le escribe a quien se dio de baja (o reclama la fila antes de mirar la baja)");
    const baja = cuerpo(sc("src/lib/correo-baja.ts"), /export async function conBajaDeCorreos\(/);
    if (!/\.from\("perfil_busqueda"\)\.select\("user_id"\)\.in\("user_id", unicos\.slice\(i, i \+ 100\)\)\.not\("semanal_baja_at", "is", null\)/.test(baja)) F("7 · la baja no es perfil_busqueda.semanal_baja_at");
    const email = sc("src/lib/email.ts");
    const envio = cuerpo(email, /async function enviarCorreo\(/);
    if (!/if \(TIPOS_CON_BAJA\.has\(tipo\) && userId\) \{\s*const deBaja = await conBajaDeCorreos\(adminCorreo\(\), \[userId\]\)\.then\(\(s\) => s\.has\(userId\), \(\) => true\);\s*if \(deBaja\) \{[\s\S]*?return \{ data: null, error: null \};/.test(envio)) F("7 · el punto de envío no mira la baja de los correos comerciales");
    if (!/opciones\.idempotencyKey \? \{ idempotencyKey: opciones\.idempotencyKey \} : undefined/.test(envio)) F("7 · el envío no pasa la llave de idempotencia a Resend");
    const confirm = sc("src/app/api/payments/confirm/route.ts");
    if (!/if \(userId && !prePaymentData\?\.confirmacion_enviada_at\) \{/.test(confirm) || !/\.\.\.\(prePaymentData\?\.confirmacion_enviada_at \? \{ confirmacion_enviada_at: prePaymentData\.confirmacion_enviada_at \} : \{\}\),/.test(confirm) || !/idempotencyKey: `pago_confirmado\/\$\{payment\.commerce_order\}`/.test(confirm) || !/\.is\("payment_data->>confirmacion_enviada_at", null\)/.test(confirm)) F("7 · «Pago confirmado» puede salir más de una vez por pago");
  }

  // ── 8 · la hora real del ticket ───────────────────────────────────────────
  {
    // Cuenta creada a las 10:00 de Chile, mirada a las 20:00: vence mañana a las 10:00 (14 horas, no 24).
    const cuando = cuandoVence("2026-11-04T13:00:00Z", new Date("2026-11-04T23:00:00Z"));
    if (TICKET_PACK.despedida(cuando) !== "Vence mañana a las 10:00.") F(`8 · la despedida no dice la hora real («${TICKET_PACK.despedida(cuando)}»)`);
    if (/Vence en 24 horas/.test(sc("src/lib/lo-que-sigue/copy.ts"))) F("8 · queda «Vence en 24 horas.» en el copy");
    if (!/\{TICKET_PACK\.despedida\(cuandoVence\(createdAt\)\)\}/.test(sc("src/components/lo-que-sigue/TicketPack.tsx"))) F("8 · el ticket no dice la hora real del vencimiento");
  }

  if (fallas.length) {
    console.log(`  ✗ DATOS-Y-PLATA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — analisis no se lee con la llave pública; el informe pendiente solo muestra su portada; un informe que no se crea devuelve el crédito; un toque analiza una vez en su modalidad; acreditar no se traga errores y se reconcilia; el saldo cuenta la bienvenida; las bajas se respetan y «Pago confirmado» sale una vez; el ticket dice su hora");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (04-nov-2026) ─────────────────────────────────────────────
// La sección 1 viva nació EN ROJO sin mutar nada: la llave pública leía 5 filas de analisis y de analisis_dashboard
// (la política «Anyone can read analisis» abierta). Se pone en verde al aplicar 20261104_analisis_sin_lectura_publica.sql.
// 49/49 mutaciones en rojo a la primera, restauradas byte a byte (sha256; scratchpad/mutar.js):
//   1 · el informe LTR, el comparativo y el compartido leyendo con la sesión · la migración sin el revoke.
//   2 · LTR y STR sin corte · la regla dejando pasar a todos · la imagen OG y la metadata con el puntaje · la zona de un
//       pendiente · la portada bloqueada dibujando el puntaje · el documento compartido sin corte.
//   3 · el candado sin devolver · la fila de otra solicitud sin devolución · el modo paid sin devolución · el cobro del
//       ledger sin su lote · el contador viejo sin sumar · devolverLote sin UPDATE condicional · el formulario LTR (insert)
//       y STR (AirROI caído) sin devolver · «Analizar este» sin devolver · la primera selección girando tras los 409.
//   4 · la vuelta sin `m=str` · las dos listas analizando · la vuelta de Flow generando renta larga · la vuelta leída
//       siempre como renta larga.
//   5 · grantCredits tragando el error · confirm respondiendo 200 · la suscripción tragando el error · sin el cron en
//       vercel.json · «sin acreditar» con los acreditados · el admin sin la lista · el reconciliador sin devolver.
//   6 · la bienvenida sin contar (puro) · leerSaldo sin pasarla (lo caza la lectura real de las cuentas viejas) ·
//       getAvailableCredits sin ella · /perfil con «Úsalos cuando quieras».
//   7 · el recordatorio fuera de la baja · el carrito y el recordatorio sin filtrar · el envío sin mirar la baja si no
//       puede leerla · sin llave de idempotencia · «Pago confirmado» en cada aviso de Flow.
//   8 · la despedida fija · el ticket sin la hora.
//   Y los dos predicados reescritos con acta en otros tiers: LO-QUE-SIGUE §5 (las dos mutaciones de 8) y GUIA-BUSQUEDA §4
//   (el candado sin devolver; la fila de otra solicitud vuelta a cobrar).
// Segunda tanda, 13/13 en rojo: los predicados de otros tiers que apuntaban a la acreditación DENTRO de payments/confirm
// o a la firma vieja de las compras del depto, reescritos con su acta —LO-QUE-SIGUE §2 (el pack sin noExpire, confirm sin
// acreditar, sin pack_pagado), CORREOS-RECORRIDO §5 y §6, PANEL-ACTIVACION §2, REANALISIS §5, GUIA-BUSQUEDA §6, PUERTA-B
// §5 y §6, TICKET-VIVO §3, CASA §2 (los regalos sin su fuente) y CRONS §2 (el reconciliador sin latir).

if (require.main === module) {
  runDatosYPlataTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
