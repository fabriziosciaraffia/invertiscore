// ─────────────────────────────────────────────────────────────────────────────
// Tier PUERTA-B (16-oct-2026, 0 tokens, sin red ni base) — la puerta B y la primera semana: una persona sin depto en la
// mira se registra en un minuto y ve valor antes de cerrar la pestaña.
//
//   1 · LA CUENTA INSTANTÁNEA: el correo que no tenía cuenta nace con el perfil de los chips (pie 20 %, 25 años); el que
//       ya la tenía no se duplica ni se pisa —se le pregunta si agrega las comunas—.
//   2 · EL CERO CON ALTERNATIVA: la respuesta sale de la evaluación de la noche, y con cero dice con qué sí (pie 30 % o
//       una comuna vecina) y ofrece igual registrarse: «te aviso cuando aparezca uno».
//   3 · EL PERFIL MANUAL SIN INFORMES: la cuenta sin informes entra al semanal, con su rango y el origen sintético (tasa
//       de mercado), y «Analizar este» funciona sin informe de origen.
//   4 · LA COLA DEL CORREO DEL DÍA: espera mientras falta cupo de fichas, sale pasada la hora con lo visto publicado y
//       lo dice con la hora; es el semanal de esa semana: el lunes va solo si hay nuevos.
//   5 · EL REGALO AL REGISTRARSE: uno por cuenta nueva, vigente 30 días, con tope por dispositivo, IP y día; reemplaza a
//       la bienvenida; el aviso antes de gastar dice «usa tu análisis de regalo».
//   6 · LA REACTIVACIÓN: 4 semanas sin analizar, una cada 90 días, con su semanal.
// Más: el «cuándo» renombrado, la medición con la puerta B y el estándar de 25 años en la evaluación de la noche.
//
// ACTA DE MUTACIONES (16-oct-2026): 37/37 en ROJO, restauradas byte a byte (scratchpad mutar-puerta-b.cjs).
//   Cuenta: C1 nueva a una existente · C2 el alta pisa el perfil de una existente · C3 nace con 30 años · C4 sin mirar
//   si tiene cuenta. Cero: Z1 sin el pie · Z2 sin las vecinas · Z3 sin «te aviso» · Z4 calcula en vivo. Perfil manual:
//   P1 sin perfil de renta larga · P2 fuera del semanal · P3 sin origen sintético · P4 el rango con holgura · P5 el
//   botón mudo · P6 otra tasa. Cola: Q1 nunca espera · Q2 sale sin esperar · Q3 sin el cupo · Q4 el lunes vacío · Q5 el
//   lunes toma el del día · Q6 la hora en UTC · Q7 sin la hora · Q8 repite lo del día. Regalo: R1 sin tope por
//   dispositivo · R2 sin apagar la bienvenida · R3 sin la marca de una vez · R4 60 días · R5 el cobro regala la
//   bienvenida · R6 el reclamo sin regalo · R7 el aviso no lo dice · R8 «primero» sin el orden del cobro · R9 la IP topa
//   (CGNAT: les quitaría el regalo a quienes comparten IP).
//   Reactivación: A1 sin los 90 días · A2 con otro regalo vivo · A3 la marca una sola vez. X1 vuelve «Ya» · X2 el Lead
//   sin la puerta B · X3 la noche sin el estándar de 25 años.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/puerta-b-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALTA_COPY, comunasParaAgregar, MAX_COMUNAS_PERFIL, perfilManualDeElecciones, respuestaDeptos, tipoDeAlta, validarElecciones,
  type ConteoComuna,
} from "../../../src/lib/deptos/respuesta";
import { PIE_DEPTOS, PIES_DEPTOS, PLAZO_DEPTOS } from "../../../src/lib/deptos/estandar";
import { MANUAL_VACIO, perfilDeBusqueda, validarCambiosPerfil } from "../../../src/lib/perfil-busqueda";
import { correspondeReactivacion, DIAS_ENTRE_REACTIVACIONES, DIAS_SIN_ANALIZAR_REACTIVACION, queEnviarSemanal, rangoSemanal } from "../../../src/lib/guia/semanal";
import { origenSintetico } from "../../../src/lib/guia/guia-servidor";
import { cuandoSeVio, DEL_DIA, LECTURAS_POR_VUELTA_DEL_DIA, marcaVisto, MINUTOS_CUPO_DEL_DIA, pasoDelDia, REGLA_DEL_DIA, VUELTAS_MAX_DEL_DIA } from "../../../src/lib/guia/del-dia";
import { TOPE_FICHAS_POR_HORA } from "../../../src/lib/guia/publicacion";
import { correoSemanal, correoSemanalVacio, textoBusca } from "../../../src/lib/email/correo-semanal";
import {
  bienvenidaVigente, decidirRegaloAlta, DIAS_VIGENCIA_REGALO_ALTA, FUENTE_REGALO_ALTA, FUENTES_REGALO, REGALO_ALTA_DESDE, TOPE_REGALOS_DIA,
  TOPE_REGALOS_DISPOSITIVO,
} from "../../../src/lib/regalo-alta";
import { asegurarRegaloDeAlta } from "../../../src/lib/regalo-alta-servidor";
import { datosSaldoDe, estadoSaldo } from "../../../src/lib/casa-saldo";
import { textoUso } from "../../../src/lib/guia/aviso-analizar";
import { ESTAS_DENTRO } from "../../../src/lib/lo-que-sigue/copy";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { INMEDIATO } from "../../../src/lib/guia/inmediato";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ── Una base en memoria: lo justo de supabase-js que usa el regalo (select/insert/update/upsert con filtros) ──────
type Fila = Record<string, unknown>;
function baseFalsa(claves: Record<string, string> = {}) {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
  let ids = 0;
  const from = (t: string) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "upsert"; valor?: Fila; opts?: Record<string, unknown> } = { tipo: "select" };
    let cabeza = false, una: "single" | "maybe" | null = null, devolver = false;
    const b = {
      select(_c?: string, o?: { count?: string; head?: boolean }) { if (op.tipo === "select") cabeza = !!o?.head; else devolver = true; return b; },
      insert(v: Fila) { op = { tipo: "insert", valor: v }; return b; },
      update(v: Fila) { op = { tipo: "update", valor: v }; return b; },
      upsert(v: Fila, o?: Record<string, unknown>) { op = { tipo: "upsert", valor: v, opts: o }; return b; },
      eq(c: string, v: unknown) { filtros.push((f) => f[c] === v); return b; },
      gte(c: string, v: string) { filtros.push((f) => String(f[c]) >= v); return b; },
      gt(c: string, v: unknown) { filtros.push((f) => (typeof v === "number" ? Number(f[c]) > v : String(f[c]) > String(v))); return b; },
      is(c: string, v: unknown) { filtros.push((f) => (f[c] ?? null) === v); return b; },
      order() { return b; },
      limit() { return b; },
      maybeSingle() { una = "maybe"; return b; },
      single() { una = "single"; return b; },
      then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) {
        try { return Promise.resolve(correr()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); }
      },
    };
    const correr = () => {
      const filas = tabla(t);
      const clave = claves[t];
      if (op.tipo === "insert") {
        const v = { ...op.valor } as Fila;
        if (clave && filas.some((f) => f[clave] === v[clave])) return { data: null, error: { code: "23505", message: "duplicada" } };
        if (!("id" in v)) v.id = `id-${++ids}`;
        filas.push(v);
        return { data: devolver ? (una ? v : [v]) : null, error: null };
      }
      if (op.tipo === "upsert") {
        const v = op.valor!;
        const i = clave ? filas.findIndex((f) => f[clave] === v[clave]) : -1;
        if (i >= 0) { if (!op.opts?.ignoreDuplicates) filas[i] = { ...filas[i], ...v }; } else filas.push({ ...v });
        return { data: null, error: null };
      }
      const elegidas = filas.filter((f) => filtros.every((p) => p(f)));
      if (op.tipo === "update") {
        for (const f of elegidas) Object.assign(f, op.valor);
        return { data: devolver ? elegidas : null, error: null };
      }
      if (cabeza) return { data: null, count: elegidas.length, error: null };
      if (una) return { data: elegidas[0] ?? null, error: null };
      return { data: elegidas, error: null };
    };
    return b;
  };
  return { from, tablas, tabla };
}

export async function runPuertaBTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PUERTA-B (la cuenta instantánea, el cero con alternativa, el perfil manual, el correo del día, los regalos · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try {
    // ── 1 · LA CUENTA INSTANTÁNEA ──
    {
      const pedido = "2026-10-16T15:00:00Z";
      if (tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: "2026-10-16T15:00:30Z", pedidoAt: pedido }) !== "nueva") F("1 · el correo sin cuenta que la crea con el código no es una cuenta nueva");
      if (tipoDeAlta({ existiaAlPedir: true, cuentaCreadaAt: "2026-10-16T15:00:30Z", pedidoAt: pedido }) !== "existente") F("1 · un correo que ya tenía cuenta se trata como nuevo (se duplicaría su perfil)");
      if (tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: "2026-09-01T12:00:00Z", pedidoAt: pedido }) !== "existente") F("1 · una cuenta creada antes del pedido se trata como nueva");
      if (tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: null, pedidoAt: pedido }) !== "existente") F("1 · sin fecha de la cuenta se da por nueva");
      const v = validarElecciones({ comunas: ["Ñuñoa"], tipologias: ["2"], rango: "3000-4000", modalidad: "ltr" });
      if (!v.ok) F("1 · una elección válida no valida");
      else {
        const p = perfilManualDeElecciones(v);
        if (p.pie_pct !== 20 || p.plazo_anios !== 25 || p.precio_min_uf !== 3000 || p.precio_max_uf !== 4000 || JSON.stringify(p.comunas) !== '["Ñuñoa"]' || JSON.stringify(p.dormitorios) !== "[2]" || p.modalidad !== "ltr")
          F(`1 · la cuenta no nace con el perfil de los chips (pie 20 %, 25 años, el rango): ${JSON.stringify(p)}`);
      }
      if (PIE_DEPTOS !== 20 || PLAZO_DEPTOS !== 25) F("1 · el estándar no es pie 20 % y 25 años");
      if (JSON.stringify(comunasParaAgregar(["Ñuñoa", "Macul"], ["Ñuñoa", "La Reina"])) !== '["La Reina"]') F("1 · al entrar, las comunas a agregar repiten las que ya tiene");
      if (comunasParaAgregar(["a", "b", "c", "d", "e", "f", "g", "h"], ["x"]).length !== 0 || MAX_COMUNAS_PERFIL !== 8) F("1 · agregar comunas pasa el tope del perfil");
      if (!/ya tienes cuenta, te mandamos el código para entrar/i.test(ALTA_COPY.yaTienes)) F("1 · el aviso de la cuenta existente no es el de Fabrizio");
      const alta = sinComentarios(leer("src/app/api/deptos/alta/route.ts"));
      const iExist = alta.indexOf(`if (tipo === "existente") {`), iPerfil = alta.indexOf(`from("perfil_busqueda").upsert`);
      if (!/const tipo = tipoDeAlta\(\{ existiaAlPedir: pend\.existe, cuentaCreadaAt: user\.created_at, pedidoAt: pend\.creadoAt \}\);/.test(alta) || iExist < 0 || iPerfil < iExist
        || /perfil_busqueda/.test(alta.slice(iExist, alta.indexOf("}", alta.indexOf("return NextResponse.json({ estado: \"existente\"")))))
        F("1 · el alta no decide con tipoDeAlta, o a una cuenta existente le escribe el perfil");
      if (!/comunasParaAgregar\(pp\.perfil\.comunas, elegidas\)/.test(alta)) F("1 · a la cuenta existente no se le ofrecen las comunas que le faltan");
      const correo = sinComentarios(leer("src/app/api/deptos/correo/route.ts"));
      if (!/const existe = await correoTieneCuenta\(admin, correo\);/.test(correo) || !/await guardarPendiente\(admin, correo, perfilManualDeElecciones\(v\), existe\);/.test(correo))
        F("1 · el pedido del código no mira si el correo ya tiene cuenta, o no guarda lo elegido");
      const cliente = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (!/\{enviado\.existe \? ALTA_COPY\.yaTienes : ALTA_COPY\.nueva\}/.test(cliente) || !/shouldCreateUser: true/.test(cliente)) F("1 · la pantalla no dice «ya tienes cuenta» o no crea la cuenta con el código");
      const mig = leer("supabase/migrations/20261016_puerta_b_deptos.sql");
      if (!/create or replace function public\.correo_tiene_cuenta[\s\S]{0,200}security definer[\s\S]{0,300}revoke all on function public\.correo_tiene_cuenta\(text\) from public, anon, authenticated;/.test(mig)) F("1 · saber si un correo tiene cuenta queda abierto a cualquiera");
    }

    // ── 2 · EL CERO CON ALTERNATIVA ──
    {
      const v = validarElecciones({ comunas: ["Ñuñoa"], tipologias: ["2"], rango: "3000-4000", modalidad: "ltr" });
      if (!v.ok) throw new Error("validación");
      const c = (comuna: string, total: number, comprar20: number, comprar30: number): ConteoComuna => ({ comuna, total, comprar20, comprar30 });
      const con = respuestaDeptos(v, [c("Ñuñoa", 412, 9, 20)], []);
      if (con.frase !== "En Ñuñoa, de 412 deptos 2D entre UF 3.000 y 4.000, 9 convienen como inversión con pie 20 % y 25 años." || con.alternativa) F(`2 · la respuesta no es la frase de Fabrizio: ${con.frase}`);
      if (!/te los mando hoy/i.test(con.registro)) F("2 · con deptos, la invitación no promete los de hoy");
      const pie = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 4)], [c("Macul", 171, 0, 17)]);
      if (pie.convienen !== 0 || pie.alternativa !== "Con pie 30 %, 4 sí convienen." || !/ninguno conviene hoy/.test(pie.frase)) F(`2 · con cero no dice con qué pie sí: ${pie.alternativa}`);
      if (!/te aviso cuando aparezca uno/i.test(pie.registro)) F("2 · con cero no ofrece registrarse («te aviso cuando aparezca uno»)");
      const vec = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 0)], [c("Macul", 171, 3, 17), c("La Reina", 6, 1, 1), c("Providencia", 7, 5, 7)]);
      if (vec.alternativa !== "En Providencia, comuna vecina, 5 convienen con pie 20 %. En Macul, comuna vecina, 3 convienen con pie 20 %.") F(`2 · con cero no dice en qué comuna vecina sí (las dos que más dan): ${vec.alternativa}`);
      const nada = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 0)], [c("Macul", 171, 0, 0)]);
      if (nada.alternativa !== "Tampoco con pie 30 % ni en las comunas vecinas." || !/te aviso cuando aparezca uno/i.test(nada.registro)) F("2 · sin ninguna alternativa no lo dice o no ofrece registrarse");
      const vacia = respuestaDeptos(v, [], []);
      if (!/no vimos deptos 2D entre UF 3\.000 y 4\.000 esta semana/.test(vacia.frase)) F("2 · sin avisos en el filtro la frase inventa un total");
      if (validarElecciones({ comunas: ["Ñuñoa", "Macul", "La Reina", "Providencia"], tipologias: ["2"], rango: "3000-4000" }).ok) F("2 · se aceptan más de tres comunas");
      const fuera = validarElecciones({ comunas: ["Viña del Mar"], tipologias: ["2"], rango: "3000-4000" });
      if (fuera.ok || fuera.error !== "fuera") F("2 · una comuna fuera del Gran Santiago no responde «por ahora solo Gran Santiago»");
      const srv = sinComentarios(leer("src/lib/deptos/servidor.ts")) + sinComentarios(leer("src/app/api/deptos/respuesta/route.ts")) + sinComentarios(leer("src/lib/deptos/respuesta.ts"));
      if (/sondaConPatch|runAnalysis|evaluarEstandar25|prefetch/.test(srv) || !/admin\.rpc\("deptos_conteo"/.test(srv)) F("2 · la respuesta calcula en vivo en vez de leer la evaluación de la noche");
      const mig = leer("supabase/migrations/20261016_puerta_b_deptos.sql");
      if (!/count\(\*\) filter \(where ae\.veredicto_20_25 = 'COMPRAR'\)::int,\s*count\(\*\) filter \(where ae\.veredicto_30_25 = 'COMPRAR'\)::int/.test(mig)) F("2 · el conteo no cuenta los Comprar a 25 años con pie 20 % y 30 %");
      if (!/fuera: "Por ahora solo Gran Santiago:"/.test(leer("src/lib/deptos/respuesta.ts"))) F("2 · fuera de cobertura no dice «por ahora solo Gran Santiago»");
    }

    // ── 3 · EL PERFIL MANUAL SIN INFORMES ──
    {
      const manual = { ...MANUAL_VACIO, comunas: ["Ñuñoa"], dormitorios: [2], precioMaxUf: 4000, precioMinUf: 3000, piePct: 20, plazoAnios: 25, modalidad: "ltr" as const };
      const p = perfilDeBusqueda([], manual);
      if (!p.completo || p.precioMinUf !== 3000 || !p.editado.includes("precioMin")) F("3 · sin informes, el perfil manual no tiene con qué buscar o pierde el piso");
      const r = rangoSemanal(p);
      if (!r || r.ufMin !== 3000 || r.ufMax !== 4000) F(`3 · el rango elegido a mano se busca con holgura: ${JSON.stringify(r)}`);
      const inferido = rangoSemanal({ precioMinUf: 3000, precioMaxUf: 4000 });
      if (!inferido || inferido.ufMin !== 2700) F("3 · el piso inferido de los informes perdió su holgura");
      if (textoBusca(p) !== "2 dormitorios, Ñuñoa, entre UF 3.000 y 4.000") F(`3 · el correo no dice el rango: ${textoBusca(p)}`);
      if (!validarCambiosPerfil({ precioMinUf: 3000, precioMaxUf: 4000 }).ok || validarCambiosPerfil({ precioMinUf: 4000, precioMaxUf: 3000 }).ok) F("3 · el piso del perfil no se valida contra el tope");
      const o = origenSintetico("u1", { piePct: null, plazoAnios: null, comunas: ["Ñuñoa"], dormitorios: [2] }, { tasa: 4.07 });
      if (o.analysisId !== null || o.tasa !== 4.07 || o.piePct !== 20 || o.plazoAnios !== 25 || !o.sintetico) F("3 · el origen sintético no es pie 20 %, 25 años y la tasa de mercado, sin informe");
      const sem = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/from\("perfil_busqueda"\)\.select\("user_id"\)\s*\.not\("comunas", "is", null\)\.not\("dormitorios", "is", null\)\.not\("precio_max_uf", "is", null\)\.is\("semanal_baja_at", null\)/.test(sem)) F("3 · quien solo tiene su perfil a mano no entra al semanal");
      if (!/\(await origenDePersona\(admin, userId\)\) \?\? \(pp\.soloManual \? origenSintetico\(userId, perfil, cfg\) : null\)/.test(sem)) F("3 · el semanal sin informes no busca con el origen sintético");
      const pbs = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
      if (!/const soloManual = informes\.length === 0 && filasStr\.length === 0 && m != null;/.test(pbs) || !/: soloManual && manual\.modalidad !== "str" \? perfilDeBusqueda\(\[\], manual\) : null,/.test(pbs) || !/precioMinUf: num\(m\.precio_min_uf\),/.test(pbs))
        F("3 · el perfil de renta larga de una cuenta sin informes no sale de lo editado a mano (o pierde el piso)");
      const an = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
      if (!/const sinOrigen = typeof b\.semanal === "string" && b\.origenId == null;/.test(an) || !/combo = await combinacionSemanal\(admin, b\.semanal!, user\.id, null, b\.avisoId\);/.test(an)) F("3 · «Analizar este» no funciona sin informe de origen");
      if (/if \(generando \|\| !origenId \|\| !combinacion\) return;/.test(leer("src/app/semanal/semanal-lista.tsx"))) F("3 · el botón «Analizar este» sigue mudo sin informe de origen");
    }

    // ── 4 · LA COLA DEL CORREO DEL DÍA ──
    {
      if (pasoDelDia({ estado: "armada", minutos: 2, vueltas: 1 }) !== "enviar" || pasoDelDia({ estado: "sin_match", minutos: 2, vueltas: 1 }) !== "enviar") F("4 · lo armado (o sin coincidencias) no sale");
      if (pasoDelDia({ estado: "pendiente", minutos: 12, vueltas: 2 }) !== "esperar") F("4 · sin cupo, la cola no espera la vuelta siguiente (rompería el tope por hora)");
      if (pasoDelDia({ estado: "pendiente", minutos: MINUTOS_CUPO_DEL_DIA, vueltas: 3 }) !== "enviar_lo_visto" || pasoDelDia({ estado: "pendiente", minutos: 5, vueltas: VUELTAS_MAX_DEL_DIA }) !== "enviar_lo_visto") F("4 · pasada la hora sin cupo no sale con lo visto publicado");
      if (MINUTOS_CUPO_DEL_DIA > 60 || LECTURAS_POR_VUELTA_DEL_DIA > TOPE_FICHAS_POR_HORA || !REGLA_DEL_DIA.aceptarMenos) F("4 · el correo del día no promete la hora, o una vuelta puede gastar más que el tope por hora");
      const ahora = new Date("2026-10-16T18:00:00Z");
      if (cuandoSeVio("2026-10-16T06:12:00Z", ahora) !== "hoy a las 03:12" || marcaVisto("2026-10-16T06:12:00Z", ahora) !== "Visto publicado hoy a las 03:12" || cuandoSeVio("2026-10-15T23:40:00Z", ahora) !== "ayer a las 20:40")
        F(`4 · la hora en que se vio publicado no es la de Chile: ${cuandoSeVio("2026-10-16T06:12:00Z", ahora)}`);
      if (queEnviarSemanal(0, { delDiaReciente: true }) !== "nada" || queEnviarSemanal(0) !== "vacio" || queEnviarSemanal(2, { delDiaReciente: true }) !== "seleccion") F("4 · el lunes después del correo del día no va solo si hay nuevos");
      const base = { variante: "tarjetas" as const, nombre: "Ana", busca: "2 dormitorios, Ñuñoa", piePct: 20, plazoAnios: 25, deptos: [{ comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 3980, veredicto: "COMPRAR", score: 80, flujo: 20000, url: "x" }], saldo: 1, conRegalo: false, urlBoton: "b", urlTres: "t", urlBaja: "z" };
      const dd = correoSemanal({ ...base, delDia: { publicadosAl: "hoy a las 14:32" }, regaloAltaVence: "2026-11-15T15:00:00Z", presentacion: true });
      if (dd.subject !== DEL_DIA.asunto || !dd.html.includes("Franco los vio publicados hoy a las 14:32") || !dd.html.includes('data-regalo="alta"')) F("4 · el correo del día no dice cuándo se vieron publicados o no dice el regalo");
      const ddv = correoSemanalVacio({ nombre: "Ana", urlPerfil: "p", urlBaja: "z", delDia: true, regaloAltaVence: "2026-11-15T15:00:00Z", presentacion: true });
      if (ddv.subject !== "Te aviso cuando aparezca uno" || !ddv.html.includes(DEL_DIA.regalo)) F("4 · el correo del día sin deptos no avisa ni dice el regalo");
      const dds = sinComentarios(leer("src/lib/guia/del-dia-servidor.ts"));
      if (!/sinLeer: soloMemoria \|\| presupuesto\.bloqueada \|\| presupuesto\.lecturas >= LECTURAS_POR_VUELTA_DEL_DIA,/.test(dds)) F("4 · el correo del día lee fichas sin el cupo de su vuelta");
      const iEsperar = dds.indexOf(`if (paso === "esperar") {`), iEnviar = dds.indexOf("return enviarDelDia(");
      if (iEsperar < 0 || iEnviar < iEsperar || !/return "espera";/.test(dds.slice(iEsperar, iEnviar))) F("4 · sin cupo, el correo del día sale igual en vez de esperar");
      if (!/if \(paso === "enviar_lo_visto"\) g = await elegir\(true\);/.test(dds)) F("4 · pasada la hora no se arma con lo ya visto publicado");
      if (!/\.update\(\{ \.\.\.guardar, estado: "enviada", enviada_at: ahora\.toISOString\(\), intentos: fila\.intentos \+ 1 \}\)\s*\.eq\("id", fila\.id\)\.is\("enviada_at", null\)\.select\("id"\);\s*if \(\(tomada\?\.length \?\? 0\) !== 1\) return "ya";/.test(dds))
        F("4 · el correo del día no se toma antes de mandarse (podría salir dos veces)");
      if (!/delDia: \{ publicadosAl: cuandoSeVio\(masAntiguo, ahora\) \}/.test(dds)) F("4 · el correo del día no lleva la hora del chequeo más antiguo");
      const vj = JSON.parse(leer("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
      if (!vj.crons.some((x) => x.path === "/api/cron/correo-del-dia" && x.schedule === "*/10 * * * *")) F("4 · la cola del correo del día no corre cada 10 minutos");
      if (!/eq\("tipo", "semanal"\)/.test(leer("src/app/api/cron/semanal-enviar/route.ts")) || !/eq\("tipo", "semanal"\)/.test(leer("src/app/api/cron/semanal-reintento/route.ts"))) F("4 · el envío del lunes podría tomar un correo del día");
      const sem = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/if \(que === "nada"\) return descartar\(\);/.test(sem) || !/\.\.\.Array\.from\(\(await delDiaReciente\(admin, userId\)\)\.avisos\)/.test(sem)) F("4 · el semanal repite lo del correo del día o sale vacío después de él");
      const alta = sinComentarios(leer("src/app/api/deptos/alta/route.ts"));
      if (!/const fila = await encolarDelDia\(admin, user\.id\);/.test(alta) || !/await procesarDelDia\(admin, fila, await leerConfigGuia\(admin\), SITIO, \{ lecturas: 0, bloqueada: false \}\);/.test(alta)) F("4 · el alta no encola el correo del día con su primera vuelta");
    }

    // ── 5 · EL REGALO AL REGISTRARSE ──
    {
      const nueva = "2026-10-20T12:00:00Z";
      if (decidirRegaloAlta({ creadaAt: "2026-09-01T00:00:00Z", porDispositivo: 0, totalHoy: 0 }) !== "vieja") F("5 · una cuenta de antes del corte recibe el regalo");
      if (decidirRegaloAlta({ creadaAt: nueva, porDispositivo: 0, totalHoy: 0 }) !== "otorgar") F("5 · una cuenta nueva no recibe su regalo");
      if (decidirRegaloAlta({ creadaAt: nueva, porDispositivo: TOPE_REGALOS_DISPOSITIVO, totalHoy: 0 }) !== "tope_dispositivo") F("5 · sin tope por dispositivo");
      if (decidirRegaloAlta({ creadaAt: nueva, porDispositivo: null, totalHoy: TOPE_REGALOS_DIA }) !== "tope_dia") F("5 · sin tope por día");
      if (decidirRegaloAlta({ creadaAt: nueva, porDispositivo: null, totalHoy: 0 }) !== "otorgar") F("5 · sin cookie la cuenta nueva no recibe regalo");
      // La IP no topa (CGNAT: los celulares comparten IP): dos cuentas de la misma IP y distinto dispositivo reciben las dos.
      if (/porIpHoy|tope_ip|TOPE_REGALOS_IP/.test(sinComentarios(leer("src/lib/regalo-alta.ts")) + sinComentarios(leer("src/lib/regalo-alta-servidor.ts")))) F("5 · la IP topa el regalo (les quitaría el regalo a quienes comparten IP)");
      if (bienvenidaVigente(nueva) || !bienvenidaVigente("2026-10-01T00:00:00Z") || REGALO_ALTA_DESDE !== "2026-10-16T00:00:00Z") F("5 · la bienvenida sigue para las cuentas nuevas (serían dos gratis)");
      if (DIAS_VIGENCIA_REGALO_ALTA !== 30) F("5 · el regalo no vence a los 30 días");

      // El camino entero, con la base en memoria: una vez, vence en 30 días, apaga la bienvenida, topa el dispositivo.
      const db = baseFalsa({ regalos_alta: "user_id", user_credits: "user_id" });
      const ahora = new Date("2026-10-20T12:00:00Z");
      const huella = { dispositivo: "d1", ip: "i1" };
      db.tabla("user_credits").push({ user_id: "u1", welcome_credit_used: false });
      const r1 = await asegurarRegaloDeAlta(db as never, { userId: "u1", creadaAt: nueva, huella }, ahora);
      const r2 = await asegurarRegaloDeAlta(db as never, { userId: "u1", creadaAt: nueva, huella }, ahora);
      const grants = db.tabla("credit_grants");
      if (r1.estado !== "otorgar" || r2.estado !== "ya" || grants.length !== 1) F(`5 · el regalo no es uno por cuenta (${r1.estado}, ${r2.estado}, ${grants.length} lotes)`);
      const g = grants[0];
      if (g?.source !== FUENTE_REGALO_ALTA || g.amount !== 1 || g.remaining !== 1 || g.expires_at !== new Date(ahora.getTime() + 30 * 864e5).toISOString()) F(`5 · el lote del regalo no es 1 análisis de regalo que vence a los 30 días: ${JSON.stringify(g)}`);
      if (db.tabla("user_credits").find((f) => f.user_id === "u1")?.welcome_credit_used !== true) F("5 · el regalo no apaga la bienvenida (serían dos gratis)");
      const r3 = await asegurarRegaloDeAlta(db as never, { userId: "u2", creadaAt: nueva, huella }, ahora);
      if (r3.estado !== "tope_dispositivo" || grants.length !== 1) F("5 · un segundo regalo en el mismo dispositivo se otorga");
      const r5 = await asegurarRegaloDeAlta(db as never, { userId: "u4", creadaAt: nueva, huella: { dispositivo: "d2", ip: "i1" } }, ahora);
      if (r5.estado !== "otorgar" || grants.length !== 2) F("5 · la misma IP con otro dispositivo se queda sin regalo");
      const r4 = await asegurarRegaloDeAlta(db as never, { userId: "u3", creadaAt: "2026-09-01T00:00:00Z", huella: { dispositivo: "d9", ip: "i9" } }, ahora);
      if (r4.estado !== "vieja" || grants.length !== 2) F("5 · una cuenta vieja recibe regalo");

      // Por cualquier puerta: el reclamo después del código, el enlace o Google, el dashboard, el cobro, /deptos.
      const claim = sinComentarios(leer("src/app/api/analisis/claim/route.ts"));
      if (!/await asegurarRegaloDeAlta\(createAdminServiceClient\(\), \{/.test(claim) || claim.indexOf("asegurarRegaloDeAlta(") > claim.indexOf("ensureWelcomeEmail(")) F("5 · el reclamo después del código no da el regalo (o lo da después de la bienvenida)");
      if (!/await asegurarRegaloDeAlta\(createAdminServiceClient\(\), \{/.test(sinComentarios(leer("src/app/auth/callback/route.ts")))) F("5 · el enlace del correo o Google no dan el regalo");
      if (!/await asegurarRegaloDeAlta\(createServiceClient\(\), \{/.test(sinComentarios(leer("src/app/dashboard/page.tsx")))) F("5 · el dashboard no es red del regalo");
      const acc = sinComentarios(leer("src/lib/access.ts"));
      if (!/if \(!bienvenidaVigente\(creadaAt\)\) \{\s*bienvenida = false;\s*await asegurarRegaloDeAlta\(supabase, \{ userId, creadaAt, huella: \{ dispositivo: null, ip: null \} \}\);/.test(acc)) F("5 · el cobro todavía regala la bienvenida a una cuenta nueva");
      if (!/const regalo = await asegurarRegaloDeAlta\(admin, \{ userId: user\.id, creadaAt: user\.created_at, huella: huellaDeRequest\(request\), puerta: "B" \}\);/.test(sinComentarios(leer("src/app/api/deptos/alta/route.ts")))) F("5 · /deptos no da el regalo");
      if (!/res\.cookies\.set\(COOKIE_DISPOSITIVO, crypto\.randomUUID\(\),/.test(leer("src/middleware.ts"))) F("5 · sin la cookie del dispositivo, el tope por dispositivo no existe");

      // El aviso antes de gastar: «usa tu análisis de regalo» y «usa 1 de tus N».
      const año = "2027-10-01T00:00:00Z", pronto = "2026-11-15T00:00:00Z";
      const mixto = datosSaldoDe([{ remaining: 1, expires_at: pronto, source: FUENTE_REGALO_ALTA }, { remaining: 3, expires_at: año, source: "pack3" }], null);
      const e1 = estadoSaldo(mixto);
      if (!mixto.proximoRegalo || e1.tipo !== "con" || textoUso(e1) !== "Usa tu análisis de regalo.") F(`5 · con un regalo que se gasta primero, el aviso no dice «usa tu análisis de regalo»: ${textoUso(e1)}`);
      const otro = datosSaldoDe([{ remaining: 1, expires_at: año, source: FUENTE_REGALO_ALTA }, { remaining: 3, expires_at: pronto, source: "plan10" }], null);
      if (otro.proximoRegalo || textoUso(estadoSaldo(otro)) !== "Usa 1 de tus 4 análisis.") F(`5 · el aviso dice regalo cuando se gasta otro lote primero: ${textoUso(estadoSaldo(otro))}`);
      const solo = estadoSaldo(datosSaldoDe([{ remaining: 1, expires_at: pronto, source: FUENTE_REGALO_ALTA }], null));
      if (solo.tipo !== "regalo" || textoUso(solo) !== "Usa tu análisis de regalo." || !FUENTES_REGALO.has("regalo_semanal")) F("5 · con solo el regalo, el aviso no lo dice (o el regalo viejo dejó de contarse)");
      if (!/if \(tier\?\.proximoRegalo\) return "Esto usa tu análisis de regalo\.";/.test(leer("src/components/formulario-v4/screenResumen.tsx"))) F("5 · el wizard no dice que usa el regalo");
    }

    // ── 6 · LA REACTIVACIÓN ──
    {
      const ahora = new Date("2026-12-31T12:00:00Z");
      const hace = (d: number) => new Date(ahora.getTime() - d * 864e5);
      const base = { registradoAt: hace(200), ultimoAnalisisAt: hace(DIAS_SIN_ANALIZAR_REACTIVACION), ultimaReactivacionAt: null, plan: false, regaloVivo: false, ahora };
      if (!correspondeReactivacion(base)) F("6 · 4 semanas sin analizar no reactivan");
      if (correspondeReactivacion({ ...base, ultimoAnalisisAt: hace(DIAS_SIN_ANALIZAR_REACTIVACION - 1) })) F("6 · se reactiva antes de las 4 semanas");
      if (correspondeReactivacion({ ...base, ultimaReactivacionAt: hace(DIAS_ENTRE_REACTIVACIONES - 1).toISOString() })) F("6 · se reactiva dos veces en 90 días");
      if (!correspondeReactivacion({ ...base, ultimaReactivacionAt: hace(DIAS_ENTRE_REACTIVACIONES).toISOString() })) F("6 · pasados 90 días no vuelve a reactivar");
      if (correspondeReactivacion({ ...base, plan: true }) || correspondeReactivacion({ ...base, regaloVivo: true })) F("6 · se reactiva con plan o con otro regalo vivo");
      if (!correspondeReactivacion({ ...base, ultimoAnalisisAt: null, registradoAt: hace(28) }) || correspondeReactivacion({ ...base, ultimoAnalisisAt: null, registradoAt: hace(20) })) F("6 · quien nunca analizó no cuenta las 4 semanas desde que se registró");
      if (DIAS_SIN_ANALIZAR_REACTIVACION !== 28 || DIAS_ENTRE_REACTIVACIONES !== 90) F("6 · la reactivación no es 4 semanas y 90 días");
      const sem = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/const regaloVence = correspondeReactivacion\(\{[\s\S]{0,400}\}\)\s*\? await otorgarReactivacion\(admin, fila\.user_id\)/.test(sem) || /correspondeRegalo|DIAS_REGALO\b/.test(sem)) F("6 · el semanal todavía regala a los 14 días");
      if (!/\.or\(`regalo_otorgado_at\.is\.null,regalo_otorgado_at\.lt\.\$\{antes\}`\)/.test(sem) || !/source: FUENTE_REGALO_REACTIVACION,/.test(sem)) F("6 · la reactivación no se marca una cada 90 días o no lleva su fuente");
    }

    // ── 7 · el «cuándo» renombrado, la medición con la puerta B, el estándar de 25 años ──
    {
      const textos = ESTAS_DENTRO.horizontes.map((h) => h.texto).join("|");
      if (textos !== "Estoy listo para comprar|En los próximos meses|Solo estoy mirando" || CASA.perfil.horizonte.ya !== "Estoy listo para comprar" || INMEDIATO.pregunta.opciones[0].texto !== "Estoy listo para comprar")
        F(`7 · el «cuándo» no está renombrado en todos lados: ${textos}`);
      for (const f of ["src/lib/lo-que-sigue/copy.ts", "src/app/dashboard/casa-copy.ts", "src/lib/guia/inmediato.ts"]) if (/texto: "Ya"|: "Ya",|piensas comprar ya/.test(leer(f))) F(`7 · ${f} todavía dice «Ya»`);
      const cliente = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (!/marcarPuertaCandidata\("B", "deptos"\);/.test(cliente) || !/void avisarLead\(c, "seleccion", "B"\);/.test(cliente)) F("7 · /deptos no marca la puerta B o no manda el Lead al dejar el correo");
      if (!/guardarAtribucion\(admin, user\.id, \{ puerta: "B", puerta_detalle: "deptos" \}\)/.test(sinComentarios(leer("src/app/api/deptos/alta/route.ts")))) F("7 · el alta no fija la puerta B");
      if (!/datos: \{ cuando, status: "completo", \.\.\.\(atr\?\.puerta \? \{ puerta: atr\.puerta as string \} : \{\}\) \},/.test(leer("src/lib/meta/registro.ts"))) F("7 · CompleteRegistration no lleva la puerta");
      if (!/"\/deptos"/.test(leer("src/middleware.ts"))) F("7 · /deptos no pasa por la medición de llegada (el fbclid del anuncio)");
      if (JSON.stringify(PIES_DEPTOS) !== "[20,30]" || !/const fila = \{ \.\.\.evaluada, \.\.\.\(evaluada\.arriendo \? evaluarEstandar25\(candidatoDeEvaluacion\(a, evaluada\), cfg\) : ESTANDAR25_VACIO\) \};[\s\S]{0,600}\.upsert\(fila, \{ onConflict: "aviso_id" \}\);/.test(leer("src/app/api/cron/evaluar-avisos/route.ts")))
        F("7 · la evaluación de la noche no escribe el estándar de 25 años");
      if (!/plazo: PLAZO_DEPTOS, tasaMercado: cfg\.tasa/.test(leer("src/lib/avisos/estandar-deptos.ts"))) F("7 · el estándar no se evalúa a 25 años");
    }
  } finally {
    if (posthog === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY; else process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }

  if (fallas.length) {
    console.log(`  ✗ PUERTA-B · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la cuenta nace con su perfil y no se duplica; el cero dice con qué sí; la cuenta sin informes entra al semanal y analiza; el correo del día espera el cupo y dice la hora; el regalo es uno por cuenta, con topes, y reemplaza a la bienvenida; la reactivación es cada 90 días");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runPuertaBTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
