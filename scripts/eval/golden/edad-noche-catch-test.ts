// ============================================================================
// GOLDEN · EDAD-NOCHE (05-nov-2026) — catch-test
// ============================================================================
//   Decisión de Fabrizio, 05-nov-2026: «La evaluación de cada noche usa la edad real del edificio cuando ya se conoce (por una
//   ficha leída de cualquier aviso del mismo edificio, tabla anios_edificio y fichas_leidas), en vez de suponer 25 años para
//   todos. […] El informe y la noche quedan con la misma edad para el mismo depto. Gate en rojo con un aviso cuyo edificio
//   tiene año conocido evaluado a 25.»
//
//   1 · LA REGLA ÚNICA (guia/edad-edificio.ts › edadConocida): su ficha, si no el edificio, si no null; la fuente.
//   2 · LA NOCHE (avisos/edad-conocida.ts): del listado al motor, un usado de un edificio con año entra con su edad real —no
//       con los 25—; la obra nueva y el edificio sin año, como siempre.
//   3 · LA COLA (avisos/depurar.ts): la fila evaluada con otra edad de la que hoy se conoce vuelve a evaluarse (y no dos veces).
//   4 · INFORME = NOCHE: con las mismas fuentes, `antiguedadDelAviso` da los mismos años que la noche.
//   5 · EL CABLEADO: el cron y la carga leen las dos tablas (paginadas) y evalúan con la edad.
//   6 · EN VIVO (lee la base, no escribe): avisos activos reales de edificios con año conocido —el de la ficha y OTRO aviso del
//       mismo edificio— pasan por el camino de la noche y por el del informe: los dos con la edad real, la misma.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. La sección 6 lee la base.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/edad-noche-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sinComentarios } from "./lectura-paginada-catch-test";
import { edadConocida } from "../../../src/lib/guia/edad-edificio";
import { aniosDesde, claveEdificio } from "../../../src/lib/guia/ficha-anio";
import { conEdadConocida, edadDeAviso, edadDistinta, leerEdadesConocidas, type EdadesConocidas } from "../../../src/lib/avisos/edad-conocida";
import { avisosDeOtraVersion, avisosEvaluables, avisosPendientes, type FilaAviso } from "../../../src/lib/avisos/depurar";
import { payloadDeAviso, respuestasDeAviso, ANIOS_ANTIGUEDAD_SUPUESTA } from "../../../src/lib/avisos/evaluar-aviso";
import { candidatoDeEvaluacion } from "../../../src/lib/avisos/estandar-deptos";
import { antiguedadDelAviso } from "../../../src/lib/guia/analizar-servidor";
import type { SubmitContext } from "../../../src/components/formulario-v4/wizardV4Payload";
import type { CandidatoGuia } from "../../../src/lib/guia/guia-servidor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));

const AHORA = new Date("2026-11-05T12:00:00Z");
const ANIO = 2014, EDAD = aniosDesde(ANIO, AHORA); // 12
const CTX: SubmitContext = {
  ufCLP: 39600, tasaMercado: 4.1, arriendoSugerido: 550000, arriendoN: 20, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null,
  precioM2UF: 60, radiusUsed: 800, ggccSugerido: 80000, ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 800,
};
/** Una fila del listado, plausible (UF 3.000, 50 m², Providencia). */
const fila = (id: string, x: Partial<FilaAviso> = {}): FilaAviso => ({
  id, comuna: "Providencia", lat: -33.44328, lng: -70.63067, precio: 3000, moneda: "UF", superficie_m2: 50, dormitorios: 2, banos: 1,
  condicion: "usado", direccion: null, fecha_entrega: null, scraped_at: "2026-11-04T10:00:00Z", seen_pass_id: null, ...x,
});
const EDIF = claveEdificio({ comuna: "Providencia", lat: -33.44328, lng: -70.63067 });

/** Una base de juguete: `fichas_leidas` y `anios_edificio`, cada tabla con lo suyo. */
function baseDe(e: EdadesConocidas) {
  return {
    from: (tabla: string) => ({
      select: () => ({
        eq: (_c: string, valor: string) => ({
          maybeSingle: async () => {
            if (tabla === "fichas_leidas") { const a = e.propias.get(valor); return { data: a != null ? { anio: a } : null, error: null }; }
            const ed = e.edificios.get(valor);
            return { data: ed ? { anio: ed.anio, aviso_id: ed.avisoId } : null, error: null };
          },
        }),
      }),
    }),
  } as never;
}
const candidatoDe = (a: { id: string; comuna: string; lat: number; lng: number; condicion: "usado" | "nuevo" }): CandidatoGuia => ({
  avisoId: a.id, distanciaM: 0, comuna: a.comuna, lat: a.lat, lng: a.lng, m2: 50, dormitorios: 2, banos: 1, condicion: a.condicion, direccion: null,
  fechaEntrega: null, url: null, precioUF: 3000, antiguedadAnios: null, antiguedadOrigen: "supuesta", arriendo: null, venta: null as never, gastosComunes: null, medianaComuna: null,
});

export async function runEdadNocheTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EDAD-NOCHE (la noche evalúa con la edad real del edificio cuando se conoce; el informe y la noche, la misma edad · 0 tokens, lee la base) ───");

  // ── 1 · la regla única ─────────────────────────────────────────────────────
  const r = (anioPropio: number | null, edificio: { anio: number; avisoId: string | null } | null) => edadConocida({ avisoId: "a1", anioPropio, edificio }, AHORA);
  if (EDAD !== 12) F(`1 · un edificio de 2014 no tiene 12 años el 05-nov-2026 (${EDAD})`);
  if (r(ANIO, { anio: 1990, avisoId: "otro" })?.anios !== EDAD || r(ANIO, null)?.edad.fuente !== "ficha") F("1 · el año de su propia ficha no manda sobre el del edificio");
  if (r(null, { anio: ANIO, avisoId: "otro" })?.anios !== EDAD || r(null, { anio: ANIO, avisoId: "otro" })?.edad.fuente !== "edificio") F("1 · con el año de otro aviso del edificio no son sus años, o no dice «edificio»");
  if (r(null, { anio: ANIO, avisoId: "a1" })?.edad.fuente !== "ficha") F("1 · el año que dio la ficha de ESTE aviso (guardado en el edificio) se rotula como de otro aviso");
  if (r(null, null) !== null) F("1 · sin año inventa una edad");

  // ── 2 · la noche ───────────────────────────────────────────────────────────
  const edades: EdadesConocidas = { propias: new Map([["p1", 1990]]), edificios: new Map([[EDIF, { anio: ANIO, avisoId: "origen" }]]) };
  const filas = [
    fila("u1"), // usado del edificio con año (lo dio OTRO aviso)
    fila("p1", { lat: -33.45, superficie_m2: 51 }), // usado con el año de su propia ficha, en un edificio sin año
    fila("s1", { lat: -33.46, superficie_m2: 52 }), // usado sin año
    fila("n1", { lat: -33.47, superficie_m2: 53, condicion: "nuevo" }), // obra nueva
  ];
  const ev = conEdadConocida(avisosEvaluables(filas, 39600), edades, AHORA);
  const de = (id: string) => ev.find((a) => a.id === id);
  if (ev.length !== 4) F(`2 · los evaluables de la fixture no son 4 (${ev.length}): la fixture no prueba nada`);
  if (de("u1")?.antiguedadAnios !== EDAD) F(`2 · UN AVISO CUYO EDIFICIO TIENE AÑO CONOCIDO NO ENTRA CON SU EDAD (${de("u1")?.antiguedadAnios ?? "null → 25"})`);
  if (de("p1")?.antiguedadAnios !== aniosDesde(1990, AHORA)) F("2 · el año de la ficha propia no llega a la noche");
  if (de("s1")?.antiguedadAnios !== null || de("n1")?.antiguedadAnios !== null) F("2 · el usado sin año o la obra nueva salen con una edad");
  for (const id of ["u1", "p1"]) {
    const a = de(id);
    if (!a) continue;
    const body = payloadDeAviso(respuestasDeAviso(a, 20, 4.1, 550000, { plazo: 30, tasaMercado: 4.1 }), CTX) as { antiguedad?: number };
    if (body.antiguedad !== a.antiguedadAnios || body.antiguedad === ANIOS_ANTIGUEDAD_SUPUESTA) F(`2 · ${id}: EL MOTOR LO EVALÚA A ${body.antiguedad} AÑOS, no con los ${a.antiguedadAnios} de su edificio`);
    // Las columnas de 25 años y la de negociar salen del candidato de la fila: llevan la misma edad.
    const cand = candidatoDeEvaluacion(a, { precio_uf: 3000, antiguedad_anios: a.antiguedadAnios ?? 25, antiguedad_origen: a.antiguedadAnios != null ? "ficha" : "supuesta", arriendo: null, venta: null as never, gastos_comunes: null, mediana_comuna: null });
    if (cand.antiguedadAnios !== a.antiguedadAnios) F(`2 · ${id}: la sonda de las columnas de 25 años no recibe la edad de la fila`);
  }
  const base25 = payloadDeAviso(respuestasDeAviso(de("s1")!, 20, 4.1, 550000, { plazo: 30, tasaMercado: 4.1 }), CTX) as { antiguedad?: number };
  if (base25.antiguedad !== ANIOS_ANTIGUEDAD_SUPUESTA) F("2 · el usado sin año ya no entra con los 25 supuestos");

  // ── 3 · la cola ────────────────────────────────────────────────────────────
  const g = (id: string, x: Record<string, unknown> = {}) => ({ aviso_id: id, precio_uf: 3000, evaluado_at: "2026-11-03T04:00:00Z", motor_version: "v", antiguedad_anios: 25, antiguedad_origen: "supuesta", ...x });
  const pend = avisosPendientes(ev, [g("u1"), g("p1", { antiguedad_anios: aniosDesde(1990, AHORA), antiguedad_origen: "ficha" }), g("s1"), g("n1", { antiguedad_anios: 0, antiguedad_origen: "nuevo" })], AHORA).map((a) => a.id);
  if (pend.join(",") !== "u1") F(`3 · la fila evaluada a 25 de un edificio con año no vuelve a la cola, o vuelve la que ya tiene su edad (${pend.join(",") || "nada"})`);
  const pend2 = avisosPendientes(ev, [g("u1", { antiguedad_anios: EDAD, antiguedad_origen: "ficha" }), g("p1", { antiguedad_anios: 30, antiguedad_origen: "ficha" }), g("s1", { antiguedad_anios: 12, antiguedad_origen: "ficha" }), g("n1", { antiguedad_anios: 0, antiguedad_origen: "nuevo" })], AHORA).map((a) => a.id);
  if (pend2.join(",") !== "p1,s1") F(`3 · la fila con otra edad (o con «ficha» sin año conocido) no vuelve a la cola (${pend2.join(",") || "nada"})`);
  const otra = avisosDeOtraVersion(ev, [g("u1", { motor_version: "viejo" }), g("p1", { motor_version: "viejo", antiguedad_anios: aniosDesde(1990, AHORA), antiguedad_origen: "ficha" })], "v", AHORA).map((a) => a.id);
  if (otra.join(",") !== "p1") F(`3 · la de edad distinta también va en «otra versión» (se evaluaría dos veces) o falta la que sí (${otra.join(",")})`);
  if (edadDistinta({ condicion: "usado", antiguedadAnios: EDAD }, { antiguedad_anios: 25 }) || edadDistinta({ condicion: "nuevo", antiguedadAnios: null }, { antiguedad_anios: 0, antiguedad_origen: "ficha" })) F("3 · se compara sin la columna leída, o la obra nueva entra a la comparación");

  // ── 4 · informe = noche ────────────────────────────────────────────────────
  try {
    const admin = baseDe(edades);
    for (const id of ["u1", "p1", "s1"]) {
      const a = de(id)!;
      const informe = await antiguedadDelAviso(admin, candidatoDe(a), { leida: false, anio: null }, AHORA);
      const noche = edadDeAviso(a, edades, AHORA);
      if (informe.anios !== noche) F(`4 · ${id}: el informe sale con ${informe.anios ?? "25"} años y la noche con ${noche ?? "25"}`);
    }
    const otroAviso = await antiguedadDelAviso(admin, candidatoDe(de("u1")!), { leida: false, anio: null }, AHORA);
    if (otroAviso.edad?.fuente !== "edificio") F("4 · el informe del aviso que tomó el año de otro aviso no dice «según otro aviso del edificio»");
  } catch (e) {
    F(`4 · el informe revienta con la base de juguete: ${(e as Error).message}`);
  }

  // ── 5 · el cableado ────────────────────────────────────────────────────────
  const cron = sc("src/app/api/cron/evaluar-avisos/route.ts");
  if (!/select\("aviso_id, precio_uf, evaluado_at, motor_version, antiguedad_anios, antiguedad_origen"\)/.test(cron)) F("5 · el cron no lee con qué edad se evaluó cada fila (la cola no ve la edad desfasada)");
  if (!/const conEdad = conEdadConocida\(evaluables, await leerEdadesConocidas\(sb\)\);\s*pendientes = avisosPendientes\(conEdad, guardadas\);/.test(cron)) F("5 · el cron no evalúa los pendientes con la edad conocida");
  if (!/otraVersion = avisosDeOtraVersion\(conEdad, guardadas, VERSION_EVALUACION\);/.test(cron) || /avisosPendientes\(evaluables|avisosDeOtraVersion\(evaluables/.test(cron)) F("5 · alguna cola del cron sale de los evaluables SIN la edad");
  const lec = sc("src/lib/avisos/edad-conocida.ts");
  for (const tabla of ["fichas_leidas", "anios_edificio"]) {
    const re = new RegExp(`from\\("${tabla}"\\)[^;]*\\.order\\("[a-z_]+"\\)\\.range\\(off, off \\+ PAGINA - 1\\)`);
    if (!re.test(lec)) F(`5 · ${tabla} no se lee paginada (PostgREST corta en 1.000 sin avisar)`);
  }
  const carga = sc("scripts/cargar-avisos-evaluados.ts");
  if (!/conEdadConocida\(sinDespublicados\(avisosEvaluables\(filas, cfg\.uf\)[^;]*await leerEdadesConocidas\(sb\)\)/.test(carga) || !/antiguedad_anios, antiguedad_origen"\)/.test(carga)) F("5 · la carga de una vez no evalúa con la edad conocida");
  const ev2 = sc("src/lib/avisos/evaluar-aviso.ts");
  if (!/antiguedad_anios: a\.condicion === "nuevo" \? 0 : a\.antiguedadAnios \?\? ANIOS_ANTIGUEDAD_SUPUESTA,/.test(ev2) || !/antiguedad_origen: \(a\.condicion === "nuevo" \? "nuevo" : a\.antiguedadAnios != null \? "ficha" : "supuesta"\)/.test(ev2)) F("5 · la fila evaluada no guarda la edad con que se evaluó");

  // ── 6 · en vivo ────────────────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    F("6 · sin las variables de la base: la parte en vivo NO CORRIÓ (corre con --env-file=.env.local)");
  } else {
    try {
      const sb = createClient(url, llave, { auth: { persistSession: false } });
      const reales = await leerEdadesConocidas(sb);
      if (reales.edificios.size < 100) F(`6 · anios_edificio trae ${reales.edificios.size} edificios: menos de los 264 medidos el 05-nov (¿se cortó la lectura?)`);
      // Los avisos cuya ficha dio el año de su edificio, activos y usados; y otro aviso activo del mismo edificio.
      const origenes = Array.from(reales.edificios.values()).map((x) => x.avisoId).filter((x): x is string => !!x).slice(0, 200);
      const { data: vivos, error } = await sb.from("scraped_properties").select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at, seen_pass_id")
        .in("id", origenes).eq("type", "venta").eq("is_active", true).or("condicion.is.null,condicion.neq.nuevo").order("id").limit(40);
      if (error) throw new Error(error.message);
      const casos: FilaAviso[] = [];
      for (const v of (vivos ?? []) as FilaAviso[]) {
        if (casos.length >= 3) break;
        const { data: otros } = await sb.from("scraped_properties").select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at, seen_pass_id")
          .eq("lat", v.lat as number).eq("lng", v.lng as number).eq("type", "venta").eq("is_active", true).neq("id", v.id).order("id").limit(3);
        const otro = ((otros ?? []) as FilaAviso[]).find((o) => o.condicion !== "nuevo" && o.comuna === v.comuna);
        casos.push(v);
        if (otro) casos.push(otro);
      }
      if (casos.length < 2) F(`6 · no hay avisos activos reales de edificios con año (${casos.length}): la parte en vivo no prueba nada`);
      let probados = 0, deOtro = 0;
      for (const f of casos) {
        const [a] = conEdadConocida(avisosEvaluables([f], 39600), reales);
        if (!a) continue; // no pasa el filtro de evaluables (precio o m² fuera de rango): la noche no lo evalúa
        probados++;
        const ed = reales.edificios.get(claveEdificio(a));
        // El oráculo NO usa la regla que vigila (si la regla se rompe, un oráculo con la regla rota da lo mismo): el año de su
        // ficha o el del edificio, contados a mano.
        const anioReal = reales.propias.get(a.id) ?? ed?.anio ?? null;
        const esperado = anioReal != null ? new Date().getFullYear() - anioReal : null;
        if (esperado == null) { F(`6 · ${a.id.slice(0, 8)}: el aviso de prueba no tiene año conocido (la muestra está mal armada)`); continue; }
        if (ed && ed.avisoId !== a.id && !reales.propias.has(a.id)) deOtro++;
        if (a.antiguedadAnios !== esperado) F(`6 · ${a.id.slice(0, 8)} (${a.comuna}): SU EDIFICIO TIENE AÑO CONOCIDO (${anioReal}: ${esperado} años) Y LA NOCHE LO EVALÚA A ${a.antiguedadAnios ?? ANIOS_ANTIGUEDAD_SUPUESTA}`);
        const informe = await antiguedadDelAviso(sb, candidatoDe(a), { leida: false, anio: null });
        if (informe.anios !== a.antiguedadAnios) F(`6 · ${a.id.slice(0, 8)}: el informe sale con ${informe.anios ?? "25"} años y la noche con ${a.antiguedadAnios ?? "25"}`);
      }
      if (probados < 2) F(`6 · solo ${probados} aviso(s) real(es) pasaron por la noche: la parte en vivo no prueba nada`);
      console.log(`  · en vivo: ${reales.edificios.size} edificios con año, ${probados} avisos reales por la noche y el informe (${deOtro} con el año de OTRO aviso del edificio)`);
    } catch (e) {
      F(`6 · la parte en vivo revienta: ${(e as Error).message}`);
    }
  }

  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length === 0 ? "  ✓ EDAD-NOCHE: la regla única, la noche con la edad real, la cola, informe = noche, el cableado y en vivo" : `  ${fallas.length} falla(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runEdadNocheTier().then((r) => { process.exitCode = r.hard > 0 ? 1 : 0; });
}

// ============================================================================
// ACTA — verificado EN ROJO por mutación (05-nov-2026)
// ============================================================================
//   Runner `mutar.js` del scratchpad de la sesión e82e757c (aplica, corre el tier, exige la falla nombrada, restaura por sha256).
//   M1  el cron arma la cola de pendientes sin la edad ........................ ROJO (§5)
//   M2  conEdadConocida no pone la edad (todos a 25) .......................... ROJO (§2 «NO ENTRA CON SU EDAD»; y §6 en vivo)
//   M3  la regla ignora el año del edificio ................................... ROJO (§1)
//   M4  la regla pone el edificio antes que la ficha propia ................... ROJO (§1)
//   M5  la cola no mira la edad ............................................... ROJO (§3)
//   M6  la de edad distinta también va en «otra versión» ...................... ROJO (§3)
//   M7  el informe vuelve a la cadena vieja (sin fichas_leidas) ............... ROJO (§4)
//   M8  el cron no lee con qué edad se evaluó cada fila ....................... ROJO (§5)
//   M9  anios_edificio sin paginar (.limit) ................................... ROJO (§5) — la primera corrida dio VERDE sin
//       medir (el runner se cortó a mitad, sin salida); el predicado da falso a mano y la corrida aislada salió ROJO
//   M10 la regla cuenta 25 años siempre ....................................... ROJO (§1, §2 y §6). La primera vez §6 lo
//       dejaba pasar: su oráculo usaba la MISMA regla que se mutaba, así que esperado y obtenido daban 25 los dos. El oráculo
//       en vivo ahora cuenta los años a mano (año de la ficha o del edificio), sin la regla
//   M11 las respuestas del aviso sueltan la edad real (el motor a 25) ......... ROJO (§2 «EL MOTOR LO EVALÚA A 25»)
//   M12 la carga de una vez sin la edad ....................................... ROJO (§5)
//   M13 el informe rotula el año de otro aviso como «de la ficha» ............. ROJO (§4)
//   15/15 en rojo (M2 y M10 también por §6, en vivo). Los dos tiers que fijaban el cableado viejo, reescritos con acta y
//   verificados en rojo: AVISOS §5 (la otra versión sale de `conEdad`) y EDAD-EDIFICIO §3 (la base de juguete responde por
//   tabla; la ficha propia ya leída manda sobre el edificio).
// ============================================================================
