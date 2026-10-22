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
//   8 · LA PÁGINA QUE CONVIERTE (16-oct-2026, segunda pasada: la única meta es que dejen el correo): ocho comunas a la vista
//       y un buscador con el resto, una sola tipología (2D), cuatro rangos, la modalidad en «Estás dentro»; la respuesta es
//       un número con su detalle chico; el correo pegado debajo, sin nada en medio; el mismo mensaje exista o no la
//       cuenta; serif solo en el titular, de una línea; el pie de los informes.
//   9 · VOLVER DE GOOGLE CON LOS CHIPS (16-oct-2026): lo elegido queda con una clave antes de salir, el callback lo pasa a
//       nombre del correo antes de la bienvenida, y la cuenta nace igual que por código (o, si ya existía, entra y
//       pregunta); el Lead sale al volver.
//
// ACTA DE MUTACIONES (16-oct-2026): 69/69 en ROJO, restauradas byte a byte (scratchpad mutar-puerta-b.cjs): 37 de la
// primera pasada, 18 de la segunda (N1–N17, X4) y 14 de la entrada con Google (G1–G12, y C5–C6: la cuenta con perfil
// nunca es nueva). G12 primero quedó VERDE —el predicado aceptaba «Estás dentro» a 300 caracteres, y un salto al
// dashboard en el medio lo dejaba inalcanzable—: ahora exige que sea lo siguiente. N3 quedó así después de una que no cambiaba nada visible (subir el tope de
// vecinas a 2 no las mostraba: la línea nombra la primera).
//   Cuenta: C1 nueva a una existente · C2 el alta pisa el perfil de una existente · C3 nace con 30 años · C4 sin mirar
//   si tiene cuenta. Cero: Z1 sin el pie · Z2 sin las vecinas · Z3 sin «te aviso» · Z4 calcula en vivo. Perfil manual:
//   P1 sin perfil de renta larga · P2 fuera del semanal · P3 sin origen sintético · P4 el rango con holgura · P5 el
//   botón mudo · P6 otra tasa. Cola: Q1 nunca espera · Q2 sale sin esperar · Q3 sin el cupo · Q4 el lunes vacío · Q5 el
//   lunes toma el del día · Q6 la hora en UTC · Q7 sin la hora · Q8 repite lo del día. Regalo: R1 sin tope por
//   dispositivo · R2 sin apagar la bienvenida · R3 sin la marca de una vez · R4 60 días · R5 el cobro regala la
//   bienvenida · R6 el reclamo sin regalo · R7 el aviso no lo dice · R8 «primero» sin el orden del cobro · R9 la IP topa
//   (CGNAT: les quitaría el regalo a quienes comparten IP).
//   Reactivación: A1 sin los 90 días · A2 con otro regalo vivo · A3 la marca una sola vez. X1 vuelve «Ya» · X2 el Lead
//   sin la puerta B · X3 la noche sin el estándar de 25 años · X4 vuelve «Estoy listo para comprar». Página: N1 el número en
//   frase · N2 el detalle sin pie ni plazo · N3 la alternativa nombra dos vecinas · N4 la alternativa larga · N5 la API dice
//   si existe · N6 la pantalla distingue la cuenta existente · N7 algo entre el número y el correo · N8 sin «Sin
//   contraseña» · N9 la modalidad vuelve a elegir · N10 tipología múltiple · N11 nueve comunas · N12 cinco rangos · N13
//   sin buscador · N14 serif en el número · N15 el titular en dos líneas · N16 el pie con enlaces · N17 sin 2D por defecto.
//
// QUE EL NÚMERO SE ENTIENDA (17-oct-2026): §2, §8 y §10 reescritos (actas en línea). Mutaciones (scratchpad
// mutar-lista.cjs), restauradas byte a byte: P1 el número vuelve a «como inversión» · P2 la etiqueta sin «Si buscas» · P3
// la etiqueta con el pie · P4 otra nota · P5 la frase en dos líneas · P6 el total redondea hacia arriba · P7 el total sin
// «+» · P8 la frase sin «como inversión» · P9 la etiqueta después del número · P10 la etiqueta sale de los chips · P11
// mientras cambia se atenúa solo el número · P12 sin la nota · P13 el título viejo de los chips · P14 el número chico.
// 14/14 ROJO. (P11 dejó deptos.css mutado al fallar la restauración por un bloqueo de Windows; se devolvió a mano y se
// verificó el diff, y el runner reintenta la escritura desde entonces.)
//
// LA PUERTA C (16-oct-2026): la pantalla de /deptos pasó a servir también a la página del invitado (página, puerta y Lead
// por parámetro, B y «seleccion» por defecto) y el alta elige la puerta (B, o C si la cuenta es invitada). Cuatro anclas
// reescritas para esa forma (5 el regalo, 7 la puerta B, 9 Google ×2), dos mutaciones nuevas —X5 /deptos con la C por
// defecto, X6 el alta con la C siempre— y G5, G7, X2 y R6 re-verificadas: 6/6 en ROJO.
//
//  10 · SE EXPLICA SOLA Y PIDE EL CORREO DESDE EL PRINCIPIO (17-oct-2026): arriba, qué es, con las cifras de la noche (las
//       mismas con que se cuenta la respuesta); la búsqueda por defecto (Santiago, 2D, UF 3.000 a 4.000) con su número
//       desde el servidor; justo debajo, la banda del correo —lo único con color—; y «Afina tu búsqueda» con los chips
//       planos. La página del invitado, igual, con su línea arriba. Dieciséis mutaciones nuevas (E1–E16) y cuatro anclas
//       de la sección 8 reescritas para la banda; con N9 al día (su patrón era de la sangría vieja), 87/87 en ROJO. Y E17: la
//       frase dice «deptos EN VENTA» (decisión de Fabrizio, para no chocar con el +40.000 de la landing): 88/88.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/puerta-b-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALTA_COPY, CLAVE_GOOGLE, claveDeDestino, COMUNAS_DESTACADAS, comunasParaAgregar, DEPTOS_COPY, destinoGoogle, ELECCIONES_POR_DEFECTO, masDeMiles, MAX_COMUNAS_PERFIL, perfilManualDeElecciones, RANGOS_UF, respuestaDeptos,
  TIPOLOGIA_POR_DEFECTO, tipoDeAlta, validarElecciones, type ConteoComuna,
} from "../../../src/lib/deptos/respuesta";
import { COMUNAS_DISPONIBLES } from "../../../src/lib/comunas-disponibles";
import { guardarPendienteGoogle, leerPendiente, reclavarPendienteGoogle, resumenDeLaNoche } from "../../../src/lib/deptos/servidor";
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
    let op: { tipo: "select" | "insert" | "update" | "upsert" | "delete"; valor?: Fila; opts?: Record<string, unknown> } = { tipo: "select" };
    let cabeza = false, una: "single" | "maybe" | null = null, devolver = false;
    const b = {
      select(_c?: string, o?: { count?: string; head?: boolean }) { if (op.tipo === "select") cabeza = !!o?.head; else devolver = true; return b; },
      insert(v: Fila) { op = { tipo: "insert", valor: v }; return b; },
      update(v: Fila) { op = { tipo: "update", valor: v }; return b; },
      upsert(v: Fila, o?: Record<string, unknown>) { op = { tipo: "upsert", valor: v, opts: o }; return b; },
      delete() { op = { tipo: "delete" }; return b; },
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
      if (op.tipo === "delete") {
        for (const f of elegidas) filas.splice(filas.indexOf(f), 1);
        return { data: null, error: null };
      }
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
      // Visto en el QA de Google (16-oct-2026): dentro del minuto de holgura, una cuenta con perfil se daba por nueva y se pisaba.
      if (tipoDeAlta({ existiaAlPedir: false, cuentaCreadaAt: "2026-10-16T15:00:30Z", pedidoAt: pedido, yaTienePerfil: true }) !== "existente") F("1 · a una cuenta que ya tiene perfil se la da por nueva (se le pisaría el perfil)");
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
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · el cuerpo del alta se mudó a lib/deptos/alta-servidor.ts (ejecutarAlta), que comparten la ruta del alta y la entrada por código: la regla se lee en los dos archivos.
      const alta = sinComentarios((leer("src/app/api/deptos/alta/route.ts") + "\n" + leer("src/lib/deptos/alta-servidor.ts")));
      const iExist = alta.indexOf(`if (tipo === "existente") {`), iPerfil = alta.indexOf(`from("perfil_busqueda").upsert`);
      if (!/const tipo = tipoDeAlta\(\{ existiaAlPedir: pend\.existe, cuentaCreadaAt: user\.created_at, pedidoAt: pend\.creadoAt, yaTienePerfil \}\);/.test(alta)
        || !/const yaTienePerfil = Array\.isArray\(perfilPrevio\?\.comunas\) && \(perfilPrevio\.comunas as unknown\[\]\)\.length > 0;/.test(alta) || iExist < 0 || iPerfil < iExist
        || /perfil_busqueda/.test(alta.slice(iExist, alta.indexOf("}", alta.indexOf("return NextResponse.json({ estado: \"existente\"")))))
        F("1 · el alta no decide con tipoDeAlta, o a una cuenta existente le escribe el perfil");
      if (!/comunasParaAgregar\(pp\.perfil\.comunas, elegidas\)/.test(alta)) F("1 · a la cuenta existente no se le ofrecen las comunas que le faltan");
      const correo = sinComentarios(leer("src/app/api/deptos/correo/route.ts"));
      if (!/const existe = await correoTieneCuenta\(admin, correo\);/.test(correo) || !/await guardarPendiente\(admin, correo, perfilManualDeElecciones\(v\), existe, esPuertaDeptos\(b\.puerta\) \? b\.puerta : null\);/.test(correo))
        F("1 · el pedido del código no mira si el correo ya tiene cuenta, o no guarda lo elegido");
      // EL MISMO MENSAJE exista o no la cuenta (16-oct-2026, decisión de Fabrizio): si la cuenta existe no vuelve al navegador.
      if (!/return NextResponse\.json\(\{ ok: true \}\);/.test(correo) || /NextResponse\.json\(\{[^}]*existe/.test(correo)) F("1 · el pedido del código le dice al navegador si el correo tiene cuenta");
      const cliente = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (/existe|yaTienes|ya tienes cuenta/i.test(cliente) || !/<p className="dp-registro">\{DEPTOS_COPY\.enviado\(enviado\)\}<\/p>/.test(cliente) || !/shouldCreateUser: true/.test(cliente))
        F("1 · la pantalla dice otra cosa cuando la cuenta existe, o no crea la cuenta con el código");
      const mig = leer("supabase/migrations/20261016_puerta_b_deptos.sql");
      if (!/create or replace function public\.correo_tiene_cuenta[\s\S]{0,200}security definer[\s\S]{0,300}revoke all on function public\.correo_tiene_cuenta\(text\) from public, anon, authenticated;/.test(mig)) F("1 · saber si un correo tiene cuenta queda abierto a cualquiera");
    }

    // ── 2 · EL CERO CON ALTERNATIVA ──
    {
      const v = validarElecciones({ comunas: ["Ñuñoa"], tipologias: ["2"], rango: "3000-4000", modalidad: "ltr" });
      if (!v.ok) throw new Error("validación");
      const c = (comuna: string, total: number, comprar20: number, comprar30: number): ConteoComuna => ({ comuna, total, comprar20, comprar30 });
      // LA RESPUESTA ES UN NÚMERO (16-oct-2026, segunda pasada), con el detalle chico; sin la frase del estándar.
      const con = respuestaDeptos(v, [c("Ñuñoa", 1008, 29, 40)], []);
      // ⚠ ACTA (17-oct-2026, goal «que el número se entienda») · el número es «29 de 1.008 convienen» —«como inversión» pasó
      // a la frase de arriba—, con la búsqueda ANTES como etiqueta («Si buscas …», sin pie ni plazo) y el pie y el plazo en
      // una nota chica debajo («con pie 20 % y 25 años»). El «detalle» de una línea se fue.
      if (con.titular !== "29 de 1.008 convienen" || con.cifra !== "29 de 1.008" || con.alternativa) F(`2 · la respuesta no es el número («29 de 1.008 convienen»): ${con.titular}`);
      if (con.etiqueta !== "Si buscas Ñuñoa · 2D · UF 3.000 a 4.000" || con.nota !== "con pie 20 % y 25 años" || "detalle" in con) F(`2 · la etiqueta no es «Si buscas comuna · tipología · rango» o la nota no es «con pie 20 % y 25 años»: ${con.etiqueta} / ${con.nota}`);
      const tres = respuestaDeptos(validarElecciones({ comunas: ["Ñuñoa", "Macul", "La Reina"], tipologias: ["3"], rango: "4000-5500" }) as Extract<ReturnType<typeof validarElecciones>, { ok: true }>, [c("Ñuñoa", 10, 1, 1)], []);
      if (tres.etiqueta !== "Si buscas Ñuñoa, Macul y La Reina · 3D · UF 4.000 a 5.500") F(`2 · la etiqueta no nombra las comunas, la tipología y el rango elegidos: ${tres.etiqueta}`);
      if (respuestaDeptos(v, [c("Ñuñoa", 143, 1, 1)], []).titular !== "1 de 143 conviene") F("2 · con uno, el número no va en singular");
      if (con.registro !== "Regístrate y te los mando hoy") F("2 · con deptos, la invitación no es «Regístrate y te los mando hoy»");
      if ("estandar" in DEPTOS_COPY || /lo estándar/.test(leer("src/app/deptos/deptos-cliente.tsx") + leer("src/lib/deptos/respuesta.ts"))) F("2 · vuelve la frase del estándar");
      const pie = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 4)], [c("Macul", 171, 0, 17)]);
      if (pie.convienen !== 0 || pie.titular !== "0 de 143 convienen" || pie.alternativa !== "Con pie 30 %, 4 sí convienen.") F(`2 · con cero no dice con qué pie sí: ${pie.alternativa}`);
      if (!/te aviso cuando aparezca uno/i.test(pie.registro)) F("2 · con cero no ofrece registrarse («te aviso cuando aparezca uno»)");
      const vec = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 0)], [c("Macul", 171, 3, 17), c("La Reina", 6, 1, 1), c("Providencia", 7, 5, 7)]);
      if (vec.alternativa !== "En Providencia, comuna vecina, 5 sí convienen.") F(`2 · con cero no dice en qué comuna vecina sí (la que más da, en una línea): ${vec.alternativa}`);
      const nada = respuestaDeptos(v, [c("Ñuñoa", 143, 0, 0)], [c("Macul", 171, 0, 0)]);
      if (nada.alternativa !== "Tampoco con pie 30 % ni en comunas vecinas." || !/te aviso cuando aparezca uno/i.test(nada.registro)) F("2 · sin ninguna alternativa no lo dice o no ofrece registrarse");
      for (const r of [pie, vec, nada]) if ((r.alternativa ?? "").split(/\. /).length !== 1 || (r.alternativa ?? "").length > 60) F(`2 · la alternativa del cero no es una línea corta: ${r.alternativa}`);
      const vacia = respuestaDeptos(v, [], []);
      if (vacia.cifra !== null || vacia.titular !== "Ninguno publicado así esta semana") F("2 · sin avisos en el filtro el número inventa un total");
      if (validarElecciones({ comunas: ["Ñuñoa", "Macul", "La Reina", "Providencia"], tipologias: ["2"], rango: "3000-4000" }).ok) F("2 · se aceptan más de tres comunas");
      const fuera = validarElecciones({ comunas: ["Viña del Mar"], tipologias: ["2"], rango: "3000-4000" });
      if (fuera.ok || fuera.error !== "fuera") F("2 · una comuna fuera del Gran Santiago no responde «por ahora solo Gran Santiago»");
      const srv = sinComentarios(leer("src/lib/deptos/servidor.ts")) + sinComentarios(leer("src/app/api/deptos/respuesta/route.ts")) + sinComentarios(leer("src/lib/deptos/respuesta.ts"));
      if (/sondaConPatch|runAnalysis|evaluarEstandar25|prefetch/.test(srv) || !/admin\.rpc\("deptos_conteo"/.test(srv)) F("2 · la respuesta calcula en vivo en vez de leer la evaluación de la noche");
      const mig = leer("supabase/migrations/20261016_puerta_b_deptos.sql");
      if (!/count\(\*\) filter \(where ae\.veredicto_20_25 = 'COMPRAR'\)::int,\s*count\(\*\) filter \(where ae\.veredicto_30_25 = 'COMPRAR'\)::int/.test(mig)) F("2 · el conteo no cuenta los Comprar a 25 años con pie 20 % y 30 %");
      if (!/fuera: "Por ahora solo Gran Santiago\."/.test(leer("src/lib/deptos/respuesta.ts"))) F("2 · fuera de cobertura no dice «por ahora solo Gran Santiago»");
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
      // Desde el 20-oct-2026 el sintético también cubre a quien tiene informes que no sirven de origen (PRIMERA-SELECCION §11).
      if (!/\(await origenDePersona\(admin, userId\)\) \?\? origenSintetico\(userId, perfil, cfg\)/.test(sem)) F("3 · el semanal sin informes no busca con el origen sintético");
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
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · el cuerpo del alta se mudó a lib/deptos/alta-servidor.ts (ejecutarAlta), que comparten la ruta del alta y la entrada por código: la regla se lee en los dos archivos.
      const alta = sinComentarios((leer("src/app/api/deptos/alta/route.ts") + "\n" + leer("src/lib/deptos/alta-servidor.ts")));
      // Desde el 20-oct-2026 el alta encola por la cola de todas las puertas (encolarPrimeraSeleccion: la fila y la primera vuelta en el momento).
      
      if (!/await encolarPrimeraSeleccion\(admin, user, \{ sitio: SITIO, enSegundoPlano: waitUntil, ruta: p\.ruta \}\);/.test(alta)
        || !/const fila = await encolarDelDia\(admin, user\.id, ahora\);/.test(dds) || !/await procesarDelDia\(admin, fila, await leerConfigGuia\(admin\), deps\.sitio, \{ lecturas: 0, bloqueada: false \}\);/.test(dds))
        F("4 · el alta no encola el correo del día con su primera vuelta");
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
      // Desde la puerta C (16-oct-2026) el alta también sirve a la página del invitado: la puerta es la B salvo que la cuenta
      // sea invitada (la C la fija el cobro del código, tier PUERTA-C).
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · el cuerpo del alta se mudó a lib/deptos/alta-servidor.ts (ejecutarAlta), que comparten la ruta del alta y la entrada por código: la regla se lee en los dos archivos.
      const altaB = sinComentarios((leer("src/app/api/deptos/alta/route.ts") + "\n" + leer("src/lib/deptos/alta-servidor.ts")));
      if (!/const regalo = await asegurarRegaloDeAlta\(admin, \{ userId: user\.id, creadaAt: user\.created_at, huella: huellaDeRequest\(request\), puerta \}\);/.test(altaB)
        || !/const puerta = ref && ref\.estado !== "cuenta_previa" \? "C" : "B";/.test(altaB)) F("5 · /deptos no da el regalo (o no con la puerta B)");
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
      if (textos !== "Quiero comprar ya|En los próximos meses|Solo estoy mirando" || CASA.perfil.horizonte.ya !== "Quiero comprar ya" || INMEDIATO.pregunta.opciones[0].texto !== "Quiero comprar ya")
        F(`7 · el «cuándo» no está renombrado en todos lados: ${textos}`);
      for (const f of ["src/lib/lo-que-sigue/copy.ts", "src/app/dashboard/casa-copy.ts", "src/lib/guia/inmediato.ts", "src/lib/email/catalogo.ts"]) if (/texto: "Ya"|: "Ya",|piensas comprar ya|listo para comprar/.test(leer(f))) F(`7 · ${f} todavía dice «Ya» o «Estoy listo para comprar»`);
      const cliente = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      // La pantalla es la de /deptos y la del invitado (16-oct-2026): la B y el Lead «seleccion» son lo que trae por defecto,
      // y /deptos la monta sin cambiarlos.
      if (!/marcarPuertaCandidata\(puerta\.puerta, puerta\.detalle\);/.test(cliente) || !/void avisarLead\(c, origenLead, puerta\.puerta\);/.test(cliente)
        || !/export function DeptosCliente\(\{ sesion, pagina = "\/deptos", puerta = \{ puerta: "B", detalle: "deptos" \}, origenLead = "seleccion", cabecera, pie, portada \}/.test(cliente)
        || !/<DeptosCliente sesion=\{sesion\} portada=\{portada\} \/>/.test(leer("src/app/deptos/page.tsx"))) F("7 · /deptos no marca la puerta B o no manda el Lead al dejar el correo");
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · el cuerpo del alta se mudó a lib/deptos/alta-servidor.ts (ejecutarAlta), que comparten la ruta del alta y la entrada por código: la regla se lee en los dos archivos.
      if (!/guardarAtribucion\(admin, user\.id, \{ puerta: "B", puerta_detalle: "deptos" \}\)/.test(sinComentarios((leer("src/app/api/deptos/alta/route.ts") + "\n" + leer("src/lib/deptos/alta-servidor.ts"))))) F("7 · el alta no fija la puerta B");
      if (!/datos: \{ cuando, status: "completo", \.\.\.\(atr\?\.puerta \? \{ puerta: atr\.puerta as string \} : \{\}\) \},/.test(leer("src/lib/meta/registro.ts"))) F("7 · CompleteRegistration no lleva la puerta");
      if (!/"\/deptos"/.test(leer("src/middleware.ts"))) F("7 · /deptos no pasa por la medición de llegada (el fbclid del anuncio)");
      if (JSON.stringify(PIES_DEPTOS) !== "[20,30]" || !/const fila = \{ \.\.\.evaluada, \.\.\.\(evaluada\.arriendo \? evaluarEstandar25\(candidatoDeEvaluacion\(a, evaluada\), cfg\) : ESTANDAR25_VACIO\) \};[\s\S]{0,600}\.upsert\(fila, \{ onConflict: "aviso_id" \}\);/.test(leer("src/app/api/cron/evaluar-avisos/route.ts")))
        F("7 · la evaluación de la noche no escribe el estándar de 25 años");
      if (!/plazo: PLAZO_DEPTOS, tasaMercado: cfg\.tasa/.test(leer("src/lib/avisos/estandar-deptos.ts"))) F("7 · el estándar no se evalúa a 25 años");
    }
    // ── 8 · LA PÁGINA QUE CONVIERTE (16-oct-2026, segunda pasada) ──
    {
      const disponibles = COMUNAS_DISPONIBLES as readonly string[];
      if (COMUNAS_DESTACADAS.length !== 8 || COMUNAS_DESTACADAS.some((c) => !disponibles.includes(c))) F("8 · no son ocho comunas del Gran Santiago a la vista");
      if (RANGOS_UF.length !== 4 || RANGOS_UF[0].min !== null || RANGOS_UF.some((r, i) => i > 0 && r.min !== RANGOS_UF[i - 1].max) || RANGOS_UF[3].max < 60000) F("8 · los rangos no son cuatro, contiguos y sin hueco");
      if (TIPOLOGIA_POR_DEFECTO !== "2") F("8 · la tipología no viene en 2D");
      const cli = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (!/const \[tipologia, setTipologia\] = useState<string>\(TIPOLOGIA_POR_DEFECTO\);/.test(cli) || !/onClick=\{\(\) => setTipologia\(t\.id\)\}/.test(cli)) F("8 · la tipología no es una sola, con 2D marcada");
      if (!/\{DESTACADAS\.map\(chipComuna\)\}/.test(cli) || !/const encontradas = busqueda\.trim\(\) \? sinElegir\.filter\(\(c\) => plano\(c\)\.includes\(plano\(busqueda\)\)\) : restantes;/.test(cli) || DEPTOS_COPY.otraComuna !== "Otra comuna…") F("8 · las comunas no son las ocho a la vista más un buscador con el resto");
      const iElegir = cli.indexOf('data-deptos="elegir"'), iModalidad = cli.indexOf("MODALIDADES_DEPTOS.map(");
      if (iModalidad < 0 || iModalidad > iElegir || (cli.match(/MODALIDADES_DEPTOS\.map\(/g) ?? []).length !== 1 || !/data-deptos="modalidad"/.test(cli)) F("8 · la modalidad se pregunta en la pantalla de elegir (va en «Estás dentro»)");
      // El número, el detalle y el correo pegados (17-oct-2026: el correo en la banda, justo debajo de la respuesta): en la
      // respuesta solo el número, el detalle y la alternativa del cero, y lo SIGUIENTE a la respuesta es la banda.
      const sec = cli.slice(cli.indexOf('<section className="dp-respuesta"'));
      // ⚠ ACTA (17-oct-2026, goal «que el número se entienda») · en la respuesta van la etiqueta («Si buscas …») ANTES del
      // número y la nota chica («con pie 20 % y 25 años») después, en lugar del detalle.
      const iSi = sec.indexOf('<p className="dp-si" data-deptos="si">{respuesta.etiqueta}</p>');
      const iNum = sec.indexOf('className="dp-numero"'), iDet = sec.indexOf('<p className="dp-nota-num" data-deptos="nota">'), iFinSec = sec.indexOf("</section>");
      const resto = iFinSec < 0 ? "x" : sec.slice(iDet, iFinSec)
        .replace('<p className="dp-nota-num" data-deptos="nota">{respuesta.nota}</p>', "")
        .replace('{respuesta.alternativa && <p className="dp-alternativa" data-deptos="alternativa">{respuesta.alternativa}</p>}', "");
      if (iSi < 0 || iNum < iSi || iDet < iNum || !/^\s*<\/>\s*\) : \(\s*<p className="dp-numero dp-esperando" aria-hidden="true">…<\/p>\s*\)\}\s*$/.test(resto)
        || !/^<\/section>\s*<div className="dp-banda" data-deptos="banda">\s*\{paso === "codigo" && enviado \? \(/.test(sec.slice(iFinSec))) F("8 · entre la respuesta y el correo hay algo más que la etiqueta, el número, la nota y la alternativa");
      const iForm = sec.indexOf('<form className="dp-form" onSubmit={pedirCodigo}');
      const form = iForm < 0 ? "" : sec.slice(iForm, sec.indexOf("</form>", iForm));
      const orden = ["{respuesta?.registro ?? DEPTOS_COPY.conRegistro}", 'type="email"', "{ALTA_COPY.pedir}", "{DEPTOS_COPY.sinContrasena}"].map((t) => form.indexOf(t));
      if (orden.some((i) => i < 0) || orden.some((i, k) => k > 0 && i < orden[k - 1])) F("8 · el correo no es «Regístrate…», el campo, «Quiero recibirlos» y «Te mandamos un código. Sin contraseña.», en ese orden");
      if (DEPTOS_COPY.sinContrasena !== "Te mandamos un código. Sin contraseña." || DEPTOS_COPY.conRegistro !== "Regístrate y te los mando hoy") F("8 · el copy del correo no es el pedido");
      // Serif solo en dos lugares: la frase de qué es (17-oct-2026) y el titular de «Estás dentro», en una línea.
      const css = leer("src/app/deptos/deptos.css");
      if ((css.match(/font-heading/g) ?? []).length !== 2 || !/\.dp-titulo \{ font-family: var\(--font-heading\), Georgia, serif;[^}]*white-space: nowrap;/.test(css) || !/\.dp-que \{ font-family: var\(--font-heading\), Georgia, serif;/.test(css)) F("8 · hay serif fuera de la frase de arriba y del titular, o el titular puede ir en dos líneas");
      if (!/\.dp-cifra \{ font-size: 30px; font-weight: 700;/.test(css) || /\.dp-(numero|cifra) \{[^}]*font-family/.test(css)) F("8 · el número no va en Inter, grande");
      // ⚠ ACTA (20-oct-2026, LCP en el teléfono) · el pie puede ir `diferido` (su fuente entra con la página quieta,
      // LANDING-RENDIMIENTO §8): sigue siendo el de los informes, sin enlaces.
      if (!/<AppFooter variant="informe"(?: diferido)? \/>/.test(leer("src/app/deptos/page.tsx"))) F("8 · el pie no es el de los informes (con enlaces que sacan de la página)");
    }
    // ── 9 · VOLVER DE GOOGLE CON LOS CHIPS (16-oct-2026) ──
    {
      const v = validarElecciones({ comunas: ["Macul", "Ñuñoa"], tipologias: ["3"], rango: "4000-5500" });
      if (!v.ok) throw new Error("validación");
      const chips = perfilManualDeElecciones(v);
      const db = baseFalsa({ deptos_pendientes: "correo" });
      // Antes de salir: lo elegido, con una clave.
      const clave = await guardarPendienteGoogle(db as never, chips);
      const fila = db.tabla("deptos_pendientes")[0];
      if (!CLAVE_GOOGLE.test(clave) || fila?.correo !== `google:${clave}`) F("9 · lo elegido no queda guardado con la clave antes de irse a Google");
      const destino = destinoGoogle(clave);
      if (destino !== `/deptos?entro=google&p=${clave}` || claveDeDestino(destino) !== clave || claveDeDestino("/deptos?entro=1") !== null
        || claveDeDestino("/deptos?entro=google&p=xyz") !== null || claveDeDestino(`https://otro.cl/deptos?entro=google&p=${clave}`) !== null)
        F("9 · el destino de vuelta no trae la clave (o acepta una cualquiera)");
      // Vuelve: la cuenta nació después de salir. Lo elegido pasa a nombre del correo, con los mismos chips.
      const despues = new Date(Date.parse(String(fila?.creado_at)) + 20_000).toISOString();
      const paso = await reclavarPendienteGoogle(db as never, { clave, correo: "Ana@Correo.cl", cuentaCreadaAt: despues });
      const pend = await leerPendiente(db as never, "ana@correo.cl");
      if (!paso || !pend || db.tabla("deptos_pendientes").some((f) => f.correo === `google:${clave}`)) F("9 · al volver de Google, lo elegido no pasa a nombre del correo");
      else {
        if (JSON.stringify(pend.perfil) !== JSON.stringify(chips)) F("9 · al volver de Google la cuenta no nace con los chips que eligió antes de salir");
        if (tipoDeAlta({ existiaAlPedir: pend.existe, cuentaCreadaAt: despues, pedidoAt: pend.creadoAt }) !== "nueva") F("9 · la cuenta nueva que vuelve de Google no nace como nueva");
      }
      // Una cuenta que ya existía: entra y pregunta si agrega las comunas.
      const clave2 = await guardarPendienteGoogle(db as never, chips);
      await reclavarPendienteGoogle(db as never, { clave: clave2, correo: "viejo@correo.cl", cuentaCreadaAt: "2026-09-01T00:00:00Z" });
      const p2 = await leerPendiente(db as never, "viejo@correo.cl");
      if (!p2 || tipoDeAlta({ existiaAlPedir: p2.existe, cuentaCreadaAt: "2026-09-01T00:00:00Z", pedidoAt: p2.creadoAt }) !== "existente") F("9 · una cuenta que ya existía y vuelve de Google se trata como nueva (se pisaría su perfil)");
      if (await reclavarPendienteGoogle(db as never, { clave: "0".repeat(32), correo: "x@y.cl", cuentaCreadaAt: despues })) F("9 · una clave que no existe pasa algo a nombre del correo");
      // El cableado: el callback pasa lo elegido ANTES del regalo y de la bienvenida (que no sale a la cuenta de /deptos).
      const cb = sinComentarios(leer("src/app/auth/callback/route.ts"));
      const iRe = cb.indexOf("await reclavarPendienteGoogle("), iReg = cb.indexOf("await asegurarRegaloDeAlta("), iWel = cb.indexOf("waitUntil(ensureWelcomeEmail(");
      if (!/const clave = claveDeDestino\(next\);/.test(cb) || iRe < 0 || iReg < iRe || iWel < iRe
        || !/if \(clave && user\?\.email\) await reclavarPendienteGoogle\(createAdminServiceClient\(\), \{ clave, correo: user\.email, cuentaCreadaAt: user\.created_at \}\);/.test(cb))
        F("9 · el callback no pasa lo elegido a nombre del correo antes del regalo y la bienvenida");
      // La pantalla guarda lo elegido ANTES de irse, y se va con la clave en el destino.
      const cli = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      const iPost = cli.indexOf('fetch("/api/deptos/google", {'), iOauth = cli.indexOf("signInWithOAuth(");
      // `pagina` es /deptos por defecto (la página del invitado vuelve a la suya, tier PUERTA-C).
      if (iPost < 0 || iOauth < iPost || !/redirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\$\{encodeURIComponent\(destinoGoogle\(d\.p, pagina\)\)\}`/.test(cli)) F("9 · la pantalla se va a Google sin guardar lo elegido o sin la clave en el destino");
      // Al volver: el Lead (recién se sabe el correo) y el alta, como por código; «Estás dentro» lo pone terminarAlta.
      if (!/if \(entro === "google"\) \{[\s\S]{0,240}void avisarLead\(sesion\.email\.toLowerCase\(\), origenLead, puerta\.puerta\);[\s\S]{0,160}void terminarAlta\(clave, "google"\);/.test(cli)) F("9 · al volver de Google no sale el Lead o no termina el alta");
      // Sin vecindad (la regla de CLAUDE.md): después del alta nueva, lo SIGUIENTE es «Estás dentro», sin un salto en el medio.
      // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · entre el regalo y «Estás dentro» se guarda la búsqueda
      // con que nació la cuenta, para la línea «Buscas: … · Cambiar» (tier PUERTA-B-RECORRIDO §1); sigue sin un salto.
      if (!/if \(d\.estado === "nueva"\) \{\s*setRegaloVence\(d\.regaloVence \?\? null\);\s*setBusca\(d\.busqueda \?\? null\);\s*if \(metodo === "email"\) emitirAuthCompletada\(posthog, "signup", "email"\);\s*setPaso\("dentro"\);\s*return;/.test(cli)) F("9 · después del alta no sigue a «Estás dentro»");
      const gf = sinComentarios(leer("src/app/api/deptos/google/route.ts"));
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · lo elegido guarda además la puerta (B o C), para medir alta_perdida.
      if (!/const p = await guardarPendienteGoogle\(createServiceClient\(\), perfilManualDeElecciones\(v\), esPuertaDeptos\(b\.puerta\) \? b\.puerta : null\);/.test(gf)) F("9 · la ruta de Google no guarda los chips validados");
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · el cuerpo del alta se mudó a lib/deptos/alta-servidor.ts (ejecutarAlta), que comparten la ruta del alta y la entrada por código: la regla se lee en los dos archivos.
      const alta = sinComentarios((leer("src/app/api/deptos/alta/route.ts") + "\n" + leer("src/lib/deptos/alta-servidor.ts")));
      // ⚠ ACTA (22-oct-2026, ENTRADA-ALTA) · la clave llega a ejecutarAlta como \`p.clave\` (la ruta le pasa \`b.p\`).
      if (!/if \(!pend && typeof p\.clave === "string" && CLAVE_GOOGLE\.test\(p\.clave\) && await reclavarPendienteGoogle\(admin, \{ clave: p\.clave, correo: user\.email, cuentaCreadaAt: user\.created_at \}\)\)/.test(alta) || !/ejecutarAlta\(admin, user, request, \{ clave: b\.p, ruta: RUTA \}\)/.test(alta)) F("9 · el alta no cae a la clave si el callback no alcanzó a pasar lo elegido");
      // «o con Google» debajo del campo: después de «Quiero recibirlos», antes de «Sin contraseña».
      const form = cli.slice(cli.indexOf('<form className="dp-form" onSubmit={pedirCodigo}'));
      const og = ['type="email"', "{ALTA_COPY.pedir}", 'className="dp-google"', "{DEPTOS_COPY.sinContrasena}"].map((t) => form.indexOf(t));
      if (ALTA_COPY.google !== "o con Google" || og.some((i) => i < 0) || og.some((i, k) => k > 0 && i < og[k - 1])) F("9 · «o con Google» no está debajo del campo del correo");
    }
    // ── 10 · SE EXPLICA SOLA Y PIDE EL CORREO DESDE EL PRINCIPIO (17-oct-2026) ──
    {
      // Qué es, en una frase, con las cifras de la noche (el total redondeado a miles; los que convenían, exactos).
      // ⚠ ACTA (17-oct-2026, goal «que el número se entienda») · UNA sola frase arriba, con «+» en el total (en miles y hacia
      // abajo: nunca dice más de lo que hay) y «como inversión» en los de anoche. Se fueron la segunda línea («Cada semana
      // te manda…») y «Anoche» como línea aparte.
      if (DEPTOS_COPY.que(21453, 4886) !== "Cada noche Franco revisa los +21.000 deptos en venta publicados en Santiago. Anoche, 4.886 convenían como inversión.")
        F("10 · la frase de arriba no es una sola, con las cifras de la noche");
      if (masDeMiles(21999) !== "+21.000" || masDeMiles(21000) !== "+21.000" || masDeMiles(9876) !== "9.876") F("10 · el total de la frase no va en miles hacia abajo con «+» (o redondea hacia arriba)");
      if (DEPTOS_COPY.que(null, null) !== "Cada noche Franco revisa los deptos en venta publicados en Santiago.") F("10 · sin cifras de la noche, la frase inventa números");
      if ("queB" in DEPTOS_COPY || "anoche" in DEPTOS_COPY) F("10 · vuelve la frase en dos líneas");
      if (DEPTOS_COPY.afina !== "Cambia la búsqueda") F("10 · el título de los chips no es «Cambia la búsqueda»");
      // La búsqueda por defecto: Santiago, 2D, UF 3.000 a 4.000.
      if (JSON.stringify(ELECCIONES_POR_DEFECTO.comunas) !== '["Santiago"]' || ELECCIONES_POR_DEFECTO.tipologias[0] !== "2" || ELECCIONES_POR_DEFECTO.rango !== "3000-4000") F("10 · la página no arranca con Santiago, 2D, UF 3.000 a 4.000");
      // El resumen de la noche cuenta lo mismo que la respuesta: deptos_conteo sobre toda la cobertura, sumado.
      const llamadas: Array<Record<string, unknown>> = [];
      const rpcFalso = { rpc: async (n: string, a: Record<string, unknown>) => { llamadas.push({ n, ...a }); return { data: [{ comuna: "Santiago", total: 600, comprar_20: 4, comprar_30: 9 }, { comuna: "Ñuñoa", total: 400, comprar_20: 17, comprar_30: 30 }], error: null }; } };
      const rn = await resumenDeLaNoche(rpcFalso as never, new Date("2026-10-17T12:00:00Z"));
      const ll = llamadas[0] as { n?: string; comunas?: string[]; uf_min?: number; uf_max?: number; dorms?: number[] } | undefined;
      if (rn?.revisados !== 1000 || rn.convienen !== 21 || ll?.n !== "deptos_conteo" || ll.comunas?.length !== COMUNAS_DISPONIBLES.length || ll.uf_min !== 0 || (ll.uf_max ?? 0) < 1e6 || !ll.dorms?.includes(0) || !ll.dorms?.includes(5))
        F(`10 · el resumen de la noche no cuenta lo mismo que la respuesta (${JSON.stringify(rn)})`);
      // El número y el correo desde el primer segundo: la respuesta por defecto viene del servidor y no se vuelve a pedir.
      // ⚠ ACTA (20-oct-2026, «Ver los deptos de [comuna]» de las páginas de comuna) · la búsqueda inicial puede llegar con
      // `?comuna=`: las comunas iniciales salen de la portada (las por defecto, o esa), y su número igual del servidor.
      // Y el rango inicial también (decisión de Fabrizio): el de más 2D publicados en esa comuna; sin `?comuna=`, el por defecto.
      // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · el perfil es de la persona: sin `?comuna=` la página
      // arranca SIN comuna y sin número —los pide— y el número llega cuando elige una; con `?comuna=`, desde el servidor como
      // antes (tier PUERTA-B-RECORRIDO §1). Sin comuna la búsqueda no está completa y no se pide.
      const cliD = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (!/const \[respuesta, setRespuesta\] = useState<RespuestaDeptos \| null>\(portada\?\.inicial \?\? null\);/.test(cliD)
        || !/const \[comunas, setComunas\] = useState<string\[\]>\(\[\.\.\.\(portada\?\.comunas \?\? \[\]\)\]\);/.test(cliD)
        || !/const completo = comunas\.length > 0 && !!tipologia && !!rango;/.test(cliD) || !/if \(!completo\) \{ setRespuesta\(null\); return; \}/.test(cliD)
        || !/const servida = useRef<string \| null>\(portada\?\.inicial \? claveInicial\(portada\.comunas, portada\.rango\) : null\);/.test(cliD)
        || !/const \[rango, setRango\] = useState<string>\(portada\?\.rango \?\? ELECCIONES_POR_DEFECTO\.rango\);/.test(cliD)
        || !/if \(clave === servida\.current\) return;/.test(cliD)) F("10 · la página no arranca sin comuna, o con `?comuna=` sin el número desde el servidor");
      if (!/const portada = await portadaDeptos\(comunaDeLaUrl\(searchParams\?\.comuna\)\);/.test(leer("src/app/deptos/page.tsx")) || !/const portada = modo === "invitado" \? await portadaDeptos\(\) : undefined;/.test(leer("src/app/i/[codigo]/page.tsx")))
        F("10 · /deptos o la página del invitado no traen la portada del servidor");
      // El orden: la frase, la etiqueta, el número, la nota, la banda del correo y, debajo, «Cambia la búsqueda» con los chips.
      const el = cliD.slice(cliD.indexOf('data-deptos="elegir"'));
      const ord = ['data-deptos="que"', 'data-deptos="respuesta"', 'data-deptos="si"', 'className="dp-numero"', 'data-deptos="nota"', 'data-deptos="banda"', 'data-deptos="afina"', 'data-pregunta="comuna"', 'data-pregunta="rango"'].map((t) => el.indexOf(t));
      if (ord.some((i) => i < 0) || ord.some((i, k) => k > 0 && i < ord[k - 1])) F("10 · el orden no es la frase, la etiqueta, el número, la nota, la banda del correo y «Cambia la búsqueda» con los chips");
      if (!/<h1 className="dp-que" data-deptos="que">\{DEPTOS_COPY\.que\(portada\?\.noche\?\.revisados \?\? null, portada\?\.noche\?\.convienen \?\? null\)\}<\/h1>/.test(cliD) || (cliD.match(/<h1 /g) ?? []).length !== 3) F("10 · arriba no va UNA frase con las dos cifras de la noche");
      // Etiqueta y número cambian juntos: los dos salen de la MISMA respuesta del servidor (no de los chips), y mientras
      // llega la nueva se atenúan juntos.
      if (!/<p className="dp-si" data-deptos="si">\{respuesta\.etiqueta\}<\/p>\s*<p className="dp-numero" data-convienen=\{respuesta\.convienen\}>/.test(cliD) || /DEPTOS_COPY\.si\(/.test(cliD)) F("10 · la etiqueta no sale de la misma respuesta que el número (no cambiarían juntos)");
      if (!/\.dp-respuesta\[data-cargando="1"\] \.dp-si, \.dp-respuesta\[data-cargando="1"\] \.dp-numero, \.dp-respuesta\[data-cargando="1"\] \.dp-nota-num \{ opacity: 0\.55; \}/.test(leer("src/app/deptos/deptos.css"))) F("10 · mientras cambia, la etiqueta y el número no se atenúan juntos");
      if (!/\.dp-nota-num \{[^}]*font-size: 12\.5px;/.test(leer("src/app/deptos/deptos.css")) || !/\.dp-numero \{ font-size: 30px; font-weight: 700;/.test(leer("src/app/deptos/deptos.css"))) F("10 · el número no es grande o la nota no es chica");
      // La banda: el material del banner (degradado), texto en papel, UN botón en papel; es lo único con color.
      const cssD = leer("src/app/deptos/deptos.css");
      // ⚠ ACTA (20-oct-2026, LCP en el teléfono) · el material es el mismo, en dos tiempos: la banda pinta el degradado liso
      // y el fondo con grano y su capa entran encima con la página quieta (`html[data-grano] .dp-banda::before/::after`).
      // Lo que queda es lo de siempre; LANDING-RENDIMIENTO §8 vigila que lo pesado no baje antes. Y «ningún otro fondo» se
      // cuenta por REGLA, no por cantidad de url(): son cinco, todas de la banda.
      if (!/\.dp-banda \{[^}]*color: #FAFAF8;[^}]*background: #1F3D67 url\("\/landing\/hero-liso-m2x\.webp"\)/.test(cssD)
        || !/html\[data-grano\] \.dp-banda::before \{ background-image: url\("\/landing\/hero-m2x\.webp"\); opacity: 1; \}/.test(cssD)
        || !/html\[data-grano\] \.dp-banda::after \{ background-image: url\("\/landing\/grano-256\.png"\);/.test(cssD)
        || !/\.dp-banda \.dp-boton \{ background: #FAFAF8; color: #0F0F0F; \}/.test(cssD))
        F("10 · el correo no va en la banda (degradado, texto blanco, un botón)");
      const conFondo = Array.from(cssD.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g))
        .filter((m) => /url\(|linear-gradient|radial-gradient/.test(m[2])).map((m) => m[1].trim());
      if (!conFondo.length || conFondo.some((sel) => !/^(html\[data-grano\] )?\.dp-banda(::before|::after)?$/.test(sel))) F(`10 · hay otro fondo con color en la página además de la banda (${conFondo.filter((sel) => !/\.dp-banda/.test(sel)).join(", ")})`);
      // Los chips, planos y compactos.
      if (!/\.dp-afina \.dp-chip \{ min-height: 30px;[^}]*border-color: transparent;/.test(cssD)) F("10 · los chips de «Afina tu búsqueda» no son planos y compactos");
      // Siempre hay una comuna: sin ella no habría número.
      if (!/xs\.includes\(c\) \? \(xs\.length === 1 \? xs : xs\.filter\(\(x\) => x !== c\)\)/.test(cliD)) F("10 · se puede soltar la última comuna y quedar sin número");
      // La página del invitado: el mismo tratamiento, con su línea «Te invitaron a Franco» arriba y la dirección al final.
      const invD = sinComentarios(leer("src/app/i/[codigo]/invitacion-cliente.tsx"));
      if (!/portada=\{portada\}\s+cabecera=\{linea\}\s+pie=\{/.test(invD) || !/<b data-invitacion="titular">\{titular\}<\/b>/.test(invD)) F("10 · la página del invitado no tiene el mismo tratamiento con «Te invitaron a Franco» arriba");
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
