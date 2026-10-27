// ─────────────────────────────────────────────────────────────────────────────
// Tier SEMANAL-SIN-MINIMO (20-oct-2026, 0 tokens, sin red ni base) — el semanal no manda correos vacíos cuando hay algo
// que mandar. Del diagnóstico de los 17 correos cortos del 19-oct: a 8 se les descartaron deptos que convenían, y una
// persona se dio de baja 17 minutos después del correo vacío.
//
//   1 · SIN MÍNIMO DE TRES EN RENTA LARGA: con 1 o 2 confirmados sale la selección. EL CASO DE aada4a6d (La Florida, 1D,
//       UF 1.300 a 1.400, pie 100 %, 15 años): dos Comprar confirmados y la regla vieja daba «sin_match».
//   2 · EL RELLENO: con menos de tres confirmados, hasta tres con los Comprar que la evaluación de anoche vio publicados
//       sin ficha leída, al final y marcados «Visto anoche, sin confirmar»; nunca más de tres sin confirmar; solo lo
//       nuevo, nunca un negociable. En renta corta, no.
//   3 · EL ASUNTO Y EL CORREO DICEN CUÁNTOS: «Encontré 1 que te conviene».
//   4 · EL VACÍO DICE LA VERDAD: solo cuando no hay nada; nombra los que casi, dice con qué sí y ofrece el ajuste en un
//       toque (pie 30 % o la comuna vecina), que el clic guarda en el perfil.
//   5 · LOS CANDIDATOS SE ORDENAN CON EL PLAZO DE LA PERSONA (la RPC recibe `plazo`; hasta 27 años, la evaluación a 25).
//   6 · LA REPARACIÓN: la ruta admin vuelve la fila a pendiente, arma con la regla nueva y manda solo si hay algo.
//
// ACTA DE MUTACIONES: en el cuerpo de cada sección, abajo.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/semanal-sin-minimo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ajusteDeParametro, asuntoSemanal, elegirSemanal, MARCA_SIN_CONFIRMAR, MINIMO_SEMANAL, parametroDeAjuste, perfilConAjuste, queEnviarSemanal, REGLA_CORTA, REGLA_LARGA,
  SEMANAL_VACIO, TOPE_SIN_CONFIRMAR, type CandidatoSemanal,
} from "../../../src/lib/guia/semanal";
import type { EstadoPublicacion } from "../../../src/lib/guia/publicacion";
import type { Evaluado } from "../../../src/lib/guia/seleccion";
import { correoSemanal, correoSemanalVacio } from "../../../src/lib/email/correo-semanal";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

type C = CandidatoSemanal & { comuna: string };
const ev = (veredicto: string, score: number): Evaluado => ({ veredicto, score, flujo: 20000 } as unknown as Evaluado);

/** El caso de aada4a6d: dos Comprar publicados (fichas leídas), nada más en sus comunas ni en las vecinas. */
function casoAada(opts: { sinChequeo?: number; vecinasSinChequeo?: number } = {}) {
  const propios: C[] = [{ avisoId: "a1", scoreCron: 80, comuna: "La Florida" }, { avisoId: "a2", scoreCron: 75, comuna: "La Florida" }];
  for (let i = 0; i < (opts.sinChequeo ?? 0); i++) propios.push({ avisoId: `s${i}`, scoreCron: 70 - i, comuna: "La Florida" });
  const vecinas: C[] = [];
  for (let i = 0; i < (opts.vecinasSinChequeo ?? 0); i++) vecinas.push({ avisoId: `v${i}`, scoreCron: 60 - i, comuna: "Puente Alto" });
  const evaluar = async (c: C) => ev("COMPRAR", c.scoreCron ?? 0);
  const publicado = async (c: C): Promise<EstadoPublicacion> => (c.avisoId.startsWith("a") ? "publicado" : "sin-chequeo");
  const respaldo = { vecinas: async () => vecinas, evaluarConDescuento: async () => null };
  return { propios, evaluar, publicado, respaldo };
}

export async function runSemanalSinMinimoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER SEMANAL-SIN-MINIMO (sin mínimo de tres, el relleno sin confirmar, el asunto con el número, el vacío que dice la verdad · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  try {
    // ── 1 · EL CASO DE aada4a6d: dos confirmados, la regla vieja descartaba ──
    // Mutaciones: M1 REGLA_LARGA vuelve a aceptarMenos: false · M2 el mínimo baja a 1 (los tres de siempre se vuelven uno).
    {
      const k = casoAada();
      const g = await elegirSemanal<C>(k.propios, k.evaluar, k.publicado, k.respaldo, REGLA_LARGA);
      if (g.estado !== "armada" || g.items.length !== 2) F(`1 · aada4a6d: dos Comprar confirmados y la selección no sale (${g.estado}, ${g.items.length})`);
      if (g.items.some((x) => (x as { sinConfirmar?: boolean }).sinConfirmar)) F("1 · los confirmados salen marcados como sin confirmar");
      if (MINIMO_SEMANAL !== 3) F("1 · el «hasta tres» del respaldo cambió: el relleno y las vecinas dependen de él");
      if (!REGLA_LARGA.aceptarMenos || !REGLA_LARGA.completarSinConfirmar) F("1 · la regla de renta larga no acepta menos de tres o no completa sin confirmar");
      if (queEnviarSemanal(1) !== "seleccion" || queEnviarSemanal(2) !== "seleccion") F("1 · con 1 o 2 el envío no manda la selección");
      // Con un solo confirmado también sale.
      const uno = casoAada();
      const g1 = await elegirSemanal<C>(uno.propios.slice(0, 1), uno.evaluar, uno.publicado, uno.respaldo, REGLA_LARGA);
      if (g1.estado !== "armada" || g1.items.length !== 1) F(`1 · con un confirmado no sale (${g1.estado})`);
    }

    // ── 2 · EL RELLENO: visto anoche, sin confirmar ──
    // Mutaciones: M3 el relleno no se devuelve · M4 pasa de tres · M5 completa más allá de tres (con 2 confirmados mete 3)
    // · M6 un negociable entra al relleno · M7 lo visto entra al relleno · M8 renta corta también rellena · M9 el envío no
    // marca sinConfirmar · M10 el envío no corta en tres.
    {
      if (TOPE_SIN_CONFIRMAR !== 3) F("2 · el tope de sin confirmar no es tres");
      const k = casoAada({ sinChequeo: 4 });
      const g = await elegirSemanal<C>(k.propios, k.evaluar, k.publicado, k.respaldo, REGLA_LARGA);
      // Con dos confirmados y cuatro sin chequeo: pendiente (puede que la cola los confirme), con el relleno de UNO (hasta tres).
      if (g.estado !== "pendiente") F(`2 · con sin chequeo la selección no queda pendiente para la cola (${g.estado})`);
      if (!g.relleno || g.relleno.length !== 1 || g.relleno[0].c.avisoId !== "s0") F(`2 · el relleno no completa hasta tres con el mejor sin chequeo: ${JSON.stringify(g.relleno?.map((x) => x.c.avisoId))}`);
      // Sin ningún confirmado: tres de relleno, de los cinco sin chequeo; de las vecinas si en las suyas no hay.
      const cero = casoAada({ sinChequeo: 5 });
      const g0 = await elegirSemanal<C>(cero.propios.filter((c) => !c.avisoId.startsWith("a")), cero.evaluar, cero.publicado, cero.respaldo, REGLA_LARGA);
      if (g0.estado !== "pendiente" || (g0.relleno?.length ?? 0) !== 3) F(`2 · sin confirmados el relleno no son tres (${g0.relleno?.length})`);
      const vec = casoAada({ vecinasSinChequeo: 2 });
      const gv = await elegirSemanal<C>([], vec.evaluar, vec.publicado, vec.respaldo, REGLA_LARGA);
      if ((gv.relleno?.length ?? 0) !== 2 || !gv.relleno!.every((x) => x.tramo === "vecina")) F("2 · las vecinas vistas anoche no entran al relleno cuando en las suyas no hay");
      // Un negociable y lo ya visto no entran.
      const neg = casoAada();
      const negC: C[] = [{ avisoId: "n1", scoreCron: 50, comuna: "La Florida" }];
      const gn = await elegirSemanal<C>(negC, async () => ev("AJUSTA SUPUESTOS", 50), async () => "sin-chequeo", { vecinas: async () => [], evaluarConDescuento: async () => ev("COMPRAR", 60) }, REGLA_LARGA);
      if ((gn.relleno?.length ?? 0) !== 0) F("2 · un negociable sin chequeo entra al relleno");
      const gvisto = await elegirSemanal<C>(neg.propios.filter((c) => !c.avisoId.startsWith("a")).concat([{ avisoId: "s9", scoreCron: 70, comuna: "La Florida" }]), neg.evaluar, async () => "sin-chequeo", neg.respaldo, REGLA_LARGA, () => "mandado");
      if ((gvisto.relleno?.length ?? 0) !== 0) F("2 · lo ya visto entra al relleno");
      const gc = await elegirSemanal<C>(k.propios, k.evaluar, k.publicado, k.respaldo, REGLA_CORTA);
      if (gc.relleno !== undefined) F("2 · renta corta también rellena");
      // El envío: los confirmados primero, el relleno al final marcado, hasta tres, y nunca uno que ya está.
      const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/const deptos = conLargo \? await completarConRelleno\(admin, confirmados, fila\.relleno \?\? \[\]\) : confirmados;/.test(srv)) F("2 · el envío no completa con el relleno");
      if (!/const extra = vigentes\.slice\(0, Math\.min\(TOPE_SIN_CONFIRMAR, MINIMO_SEMANAL - confirmados\.length\)\)\.map\(\(d\): ItemSemanal => \(\{ \.\.\.d, sinConfirmar: true \}\)\);\s*return \[\.\.\.confirmados, \.\.\.extra\];/.test(srv))
        F("2 · el relleno del envío no va al final marcado, o pasa de tres");
      if (!/if \(confirmados\.length >= MINIMO_SEMANAL \|\| relleno\.length === 0\) return confirmados;/.test(srv)) F("2 · con tres confirmados el envío igual mete relleno");
      if (!/relleno: aItems\(\{ items: g\.relleno \?\? \[\] \}\)/.test(srv)) F("2 · el armado no guarda el relleno en la fila");
      if (!/relleno jsonb not null default/.test(leer("supabase/migrations/20261020_semanal_sin_minimo.sql"))) F("2 · falta la columna relleno");
    }

    // ── 3 · EL ASUNTO Y EL CORREO DICEN CUÁNTOS ──
    // Mutaciones: M11 el asunto vuelve al fijo · M12 la marca del relleno no se imprime · M13 el singular mal.
    {
      if (asuntoSemanal(1) !== "Encontré 1 que te conviene" || asuntoSemanal(2) !== "Encontré 2 que te convienen") F(`3 · el asunto no dice cuántos: ${asuntoSemanal(1)} / ${asuntoSemanal(2)}`);
      // Los negociables aparte (ajuste de Fabrizio, 20-oct-2026). Mutaciones: M29 los negociables cuentan como confirmados · M30 el
      // «solo negociables» vuelve a «te conviene» · M31 el correo no cuenta los negociables.
      if (asuntoSemanal(1, 1) !== "Encontré 1 que conviene si negocias" || asuntoSemanal(2, 2) !== "Encontré 2 que convienen si negocias") F(`3 · solo negociables, el asunto no dice «si negocias»: ${asuntoSemanal(1, 1)}`);
      if (asuntoSemanal(3, 1) !== "Encontré 2 que te convienen" || asuntoSemanal(2, 1) !== "Encontré 1 que te conviene") F(`3 · con mezcla, el asunto no cuenta solo los confirmados: ${asuntoSemanal(3, 1)}`);
      const base = {
        variante: "tarjetas" as const, nombre: "Ana", busca: "1 dormitorio, La Florida, hasta UF 1.400", piePct: 100, plazoAnios: 15, saldo: 1, conRegalo: false,
        urlBoton: "https://x/b", urlTres: "https://x/t", urlBaja: "https://x/baja",
      };
      const d = (id: string, extra: Record<string, unknown> = {}) => ({ comuna: "La Florida", tipologia: "1D1B", m2: 40, precioUF: 1350, veredicto: "COMPRAR", score: 80, flujo: 15000, url: `https://x/${id}`, ...extra });
      const uno = correoSemanal({ ...base, deptos: [d("a")] });
      if (uno.subject !== "Encontré 1 que te conviene" || !uno.html.includes("Encontré 1 que te conviene")) F(`3 · con un depto el asunto o el titular no dicen «Encontré 1 que te conviene»: ${uno.subject}`);
      const tres = correoSemanal({ ...base, deptos: [d("a"), d("b"), d("c", { sinConfirmar: true })] });
      if (tres.subject !== "Encontré 3 que te convienen") F(`3 · con tres el asunto no dice tres: ${tres.subject}`);
      const soloNeg = correoSemanal({ ...base, deptos: [d("n", { tramo: "negociar" })] });
      if (soloNeg.subject !== "Encontré 1 que conviene si negocias" || !soloNeg.html.includes("Encontré 1 que conviene si negocias") || (soloNeg.html.match(/Conviene si lo negocias/g) ?? []).length !== 1)
        F(`3 · solo un negociable: el asunto o el titular no dicen «si negocias», o la tarjeta no lleva la marca: ${soloNeg.subject}`);
      const mezcla = correoSemanal({ ...base, deptos: [d("a"), d("b"), d("n", { tramo: "negociar" })] });
      if (mezcla.subject !== "Encontré 2 que te convienen" || (mezcla.html.match(/Conviene si lo negocias/g) ?? []).length !== 1 || !mezcla.html.includes("uno de ellos si lo negocias"))
        F(`3 · mezcla de confirmados y un negociable: el asunto no cuenta solo los dos, o el cuerpo no marca el negociable: ${mezcla.subject}`);
      if ((tres.html.match(new RegExp(MARCA_SIN_CONFIRMAR, "g")) ?? []).length !== 1 || !/data-marca="sin-confirmar"/.test(tres.html)) F("3 · la tarjeta del relleno no lleva «Visto anoche, sin confirmar»");
      if (!tres.html.includes("no alcanzó a revisar su ficha") || uno.html.includes("sin confirmar")) F("3 · el correo no explica el relleno (o lo explica cuando no hay)");
      if (MARCA_SIN_CONFIRMAR !== "Visto anoche, sin confirmar") F("3 · la marca cambió");
      if (!/data-semanal="sin-confirmar">\{MARCA_SIN_CONFIRMAR\}/.test(sinComentarios(leer("src/app/semanal/semanal-lista.tsx")))) F("3 · la página /semanal no marca el relleno");
    }

    // ── 4 · EL VACÍO DICE LA VERDAD ──
    // Mutaciones: M14 el vacío sin los que casi · M15 sin el botón del ajuste · M16 el clic no guarda el ajuste · M17 el ajuste
    // acepta una comuna cualquiera · M18 el envío del vacío no busca la verdad · M19 «no apareció ninguno» a secas con casi.
    {
      const v = correoSemanalVacio({
        nombre: null, urlPerfil: "https://x/p", urlBaja: "https://x/b",
        casi: [{ comuna: "La Florida", tipologia: "1D1B", m2: 40, precioUF: 1350, score: 62, flujo: -5000 }],
        // ⚠ ACTA (27-oct-2026, PERFIL-OFERTA §4) · «con qué sí» ya no es una alternativa suelta: son las salidas del aviso del
        // dashboard (la línea y un botón por salida, con la misma cuenta). La regla de las salidas la fija PERFIL-OFERTA.
        salidas: { linea: "Con pie 30 %, 4 sí.", botones: [{ boton: SEMANAL_VACIO.ajustarPie(30), url: "https://x/ajuste" }] },
      });
      if (!v.html.includes("Hubo 1 que casi") || !/data-casi="1"/.test(v.html) || !v.html.includes("UF 1.350")) F("4 · el vacío no nombra los que casi");
      if (!v.html.includes("Con pie 30 %, 4 sí.") || !v.html.includes('data-ajuste="1">Buscar con pie 30 %<')) F("4 · el vacío no dice con qué sí ni ofrece el ajuste");
      if (!/href="https:\/\/x\/ajuste"/.test(v.html)) F("4 · el botón del ajuste no lleva al enlace de un toque");
      const vacio = correoSemanalVacio({ nombre: null, urlPerfil: "https://x/p", urlBaja: "https://x/b" });
      if (vacio.html.includes("que casi") || vacio.html.includes('data-ajuste')) F("4 · sin casi ni alternativa el vacío igual los imprime");
      // Mutación M28: sin casi ni alternativa, con el conteo, el cuerpo dice cuántos había (nunca «no apareció ninguno» a secas).
      const nada = correoSemanalVacio({ nombre: null, urlPerfil: "https://x/p", urlBaja: "https://x/b", revisados: 5 });
      if (!nada.html.includes("5 publicados como los que buscas") || nada.html.includes("ninguno que te convenga con tu pie")) F("4 · sin casi ni alternativa el vacío sale «no apareció ninguno» a secas");
      if (!/revisados: verdad\?\.revisados \?\? null,/.test(sinComentarios(leer("src/lib/guia/semanal-servidor.ts")))) F("4 · el envío del vacío no manda cuántos había");
      if (ajusteDeParametro("pie30", new Set(["Macul"]))?.tipo !== "pie" || ajusteDeParametro("comuna:Macul", new Set(["Macul"]))?.tipo !== "comuna" || ajusteDeParametro("comuna:Narnia", new Set(["Macul"])) !== null || ajusteDeParametro("pie50", new Set()) !== null)
        F("4 · el ajuste acepta cualquier cosa, o no acepta lo suyo");
      if (parametroDeAjuste({ tipo: "comuna", comuna: "Macul" }) !== "comuna:Macul" || parametroDeAjuste({ tipo: "pie", pie: 30 }) !== "pie30") F("4 · el parámetro del ajuste no va y vuelve");
      if (JSON.stringify(perfilConAjuste({ tipo: "comuna", comuna: "Macul" }, { comunas: ["Ñuñoa", "Macul"] })) !== '{"comunas":["Ñuñoa","Macul"]}' || JSON.stringify(perfilConAjuste({ tipo: "pie", pie: 30 }, { comunas: [] })) !== '{"pie_pct":30}')
        F("4 · el ajuste no deja el perfil como debe (sin repetir la comuna)");
      const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
      if (!/if \(ir === "ajustar"\) \{[\s\S]{0,1500}from\("perfil_busqueda"\)\.upsert\(\{ user_id: sel\.user_id, \.\.\.perfilConAjuste\(ajuste, \{ comunas: actuales \}\), actualizado_at/.test(clic)) F("4 · el clic del ajuste no guarda el perfil");
      if (!/ajusteDeParametro\(url\.searchParams\.get\("que"\), new Set\(COMUNAS_DISPONIBLES as readonly string\[\]\)\)/.test(clic)) F("4 · el clic acepta una comuna fuera de la cobertura");
      const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/const verdad = await verdadDelVacio\(admin, fila\.user_id\)\.catch\(\(\) => null\);/.test(srv) || !/casi: verdad\?\.casi \?\? \[\],/.test(srv) || !/url: enlaces\.ajuste\(parametroDeAjuste\(s\.ajuste\)\)/.test(srv))
        F("4 · el envío del vacío no busca la verdad (los que casi y con qué sí)");
      // ⚠ ACTA (27-oct-2026, PERFIL-OFERTA §4) · con qué sí lo cuenta `contarSinOferta` (pie 30 %, la vecina y el chip de abajo,
      // con la cuenta de /deptos), la misma del dashboard; antes, `responderDeptos` y un `if` por salida.
      if (!/const cuenta = await contarSinOferta\(admin, userId, perfil\);/.test(srv)) F("4 · con qué sí no sale de la cuenta del dashboard (pie 30 %, vecina y chip de abajo)");
    }

    // ── 5 · LOS CANDIDATOS SE ORDENAN CON EL PLAZO DE LA PERSONA ──
    // Mutaciones: M20 la RPC se llama sin el plazo · M21 la migración ordena a 30 años siempre.
    {
      const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/await admin\.rpc\("semanal_candidatos", \{\s*comunas, dorms: perfil\.dormitorios, uf_min: rango\.ufMin, uf_max: rango\.ufMax, desde, max_filas: MAX_CANDIDATOS_SEMANAL, plazo: combo\.plazoAnios,/.test(srv))
        F("5 · los candidatos no se piden con el plazo de la persona");
      const mig = leer("supabase/migrations/20261020_semanal_sin_minimo.sql");
      if (!/plazo integer default 30/.test(mig) || (mig.match(/case when plazo <= 27\s+then greatest\(coalesce\(ae\.score_20_25, 0\), coalesce\(ae\.score_30_25, 0\)\)/g) ?? []).length !== 2)
        F("5 · la RPC no ordena por la evaluación a 25 años cuando el plazo es de hasta 27");
      if (!/drop function if exists public\.semanal_candidatos\(text\[\], integer\[\], numeric, numeric, timestamp, integer\);/.test(mig)) F("5 · la firma vieja de la RPC se queda (dos funciones, llamada ambigua)");
    }

    // ── 6 · LA REPARACIÓN ──
    // Mutaciones: M22 manda aunque no haya deptos · M23 no vuelve la fila a como estaba · M24 sin secreto.
    {
      const rep = sinComentarios(leer("src/app/api/admin/semanal-reparar/route.ts"));
      if (!/if \(!f \|\| n === 0 \|\| soloArmar\) \{/.test(rep) || !/if \(!soloArmar \|\| n === 0\) await admin\.from\("semanal_selecciones"\)\.update\(antes\)\.eq\("id", fila\.id\);/.test(rep)) F("6 · la reparación manda sin deptos, o no devuelve la fila a como estaba");
      if (!/const n = \(f\?\.items\?\.length \?\? 0\) \+ \(f\?\.relleno\?\.length \?\? 0\) \+ \(f\?\.items_str\?\.length \?\? 0\);/.test(rep)) F("6 · la reparación no cuenta el relleno como algo que mandar");
      if (!/request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/.test(rep)) F("6 · la reparación sin el secreto");
      if (!/update\(\{ estado: "pendiente", enviada_at: null, resend_id: null, items: \[\], relleno: \[\] \}\)/.test(rep)) F("6 · la fila no vuelve a pendiente antes de armar");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (fallas.length) {
    console.log(`  ✗ SEMANAL-SIN-MINIMO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — con 1 o 2 confirmados sale; el relleno completa hasta tres, marcado y al final; el asunto dice cuántos; el vacío nombra los que casi y ofrece el ajuste en un toque; los candidatos van con el plazo de la persona; la reparación manda solo si hay algo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runSemanalSinMinimoTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
