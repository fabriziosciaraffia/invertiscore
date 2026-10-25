// ─────────────────────────────────────────────────────────────────────────────
// TIER ALTA-ORDEN (25-oct-2026, «Estás dentro» en menos de 2 s): el orden de las piezas del alta de /deptos
// (lib/deptos/alta-orden.ts › ordenarAlta), con piezas de mentira que tardan y un reloj de verdad:
//   1 · ANTES de responder solo lo que la pantalla necesita, y EN PARALELO: el perfil, la fila del correo del día y los
//       créditos terminan antes de la respuesta; la tanda arranca junta (la respuesta tarda lo de la pieza más lenta, no la
//       suma);
//   2 · DESPUÉS de responder: la primera vuelta del día, la atribución, Meta, borrar lo elegido y PostHog van a `despues`
//       y la respuesta no los espera (aunque tarden); ninguno empieza antes de que el perfil y la fila estén escritos;
//   3 · el regalo entra en la respuesta si alcanza; si no, `regalo: "pendiente"` y la pantalla lo pide;
//   4 · el espejo del pixel sale en la respuesta (null en prueba o sin permiso), con el id y los datos del servidor;
//   5 · el segundo pedido de un alta ya hecha, y la cuenta que ya existía;
//   6 · el cableado: las dos rutas, el regalo que pierde la carrera, la pantalla que pide el regalo pendiente.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PiezasAlta } from "../../../src/lib/deptos/alta-orden";

const RAIZ = join(__dirname, "../../..");
const leer = (r: string) => readFileSync(join(RAIZ, r), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

type Linea = { pieza: string; desde: number; hasta: number | null };

function piezasDeMentira(o: { tiempos?: Partial<Record<string, number>>; pendiente?: unknown; perfil?: "creado" | "ya-estaba"; prueba?: boolean; regaloMs?: number } = {}) {
  const t0 = Date.now();
  const linea: Linea[] = [];
  const ms = (k: string, def: number) => o.tiempos?.[k] ?? def;
  const pieza = <T,>(nombre: string, dur: number, valor: T) => async (): Promise<T> => {
    const l: Linea = { pieza: nombre, desde: Date.now() - t0, hasta: null };
    linea.push(l);
    await new Promise((ok) => setTimeout(ok, dur));
    l.hasta = Date.now() - t0;
    return valor;
  };
  const pend = o.pendiente === undefined ? { existe: false, creadoAt: "2026-10-25T14:00:00Z", perfil: { comunas: ["Providencia"], dormitorios: [2], precio_min_uf: 4000, precio_max_uf: 6000 } } : o.pendiente;
  const piezas: PiezasAlta = {
    pendiente: pieza("pendiente", ms("pendiente", 40), pend as never),
    reclavarGoogle: null,
    repetida: pieza("repetida", 20, { estado: "nueva", repetida: true, regaloVence: "2026-11-24T00:00:00Z" }),
    existente: pieza("existente", 20, { comunasNuevas: ["Ñuñoa"], comunas: ["Providencia"] }),
    perfilSiFalta: async (perfil) => { void perfil; return pieza("perfil", ms("perfil", 60), o.perfil ?? "creado")(); },
    filaDelDia: pieza("fila", ms("fila", 60), undefined),
    creditos: pieza("creditos", ms("creditos", 60), undefined),
    puerta: pieza("puerta", ms("puerta", 30), { puerta: "B" as const, invitacionUsada: false }),
    esPrueba: pieza("prueba", ms("prueba", 30), !!o.prueba),
    regalo: async () => pieza("regalo", o.regaloMs ?? 250, { estado: "otorgar", vence: "2026-11-24T14:00:00Z" })(),
    vueltaDelDia: pieza("vuelta", ms("vuelta", 300), undefined),
    atribucion: async () => pieza("atribucion", 300, undefined)(),
    meta: async () => pieza("meta", 300, undefined)(),
    borrarPendiente: pieza("borrar", 300, undefined),
    posthog: async () => pieza("posthog", 50, undefined)(),
  };
  return { piezas, linea, t0 };
}

export async function runAltaOrdenTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER ALTA-ORDEN (el alta de /deptos: antes de responder solo lo que «Estás dentro» necesita, en paralelo; lo demás después · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const orden = await import("../../../src/lib/deptos/alta-orden");
  const espejoDe = (puerta: "B" | "C", prueba: boolean) => (prueba ? null : { evento: "CompleteRegistration", eventId: "reg-u1", datos: { status: "completo", puerta } });
  const base = { cuentaCreadaAt: "2026-10-25T14:00:10Z", cuentaNueva: true, busquedaDe: () => ({ comunas: ["Providencia"] }), espejoDe };

  // ── 1, 2 y 3 · el caso común, con el regalo lento ──
  try {
    // La fila es la más lenta de la tanda: si la respuesta no la espera, termina después de responder (rojo).
    const m = piezasDeMentira({ tiempos: { fila: 110 } });
    const despues: Array<{ t: number; p: Promise<unknown> }> = [];
    const r = await orden.ordenarAlta(m.piezas, base, (p) => despues.push({ t: Date.now() - m.t0, p }), { esperaRegaloMs: 20 });
    const tResp = Date.now() - m.t0;
    const de = (k: string) => m.linea.find((l) => l.pieza === k);
    // 1 · antes de responder, en paralelo
    for (const k of ["perfil", "fila", "creditos"]) { const l = de(k); if (!l || l.hasta == null || l.hasta > tResp) F(`1 · «${k}» no terminó antes de responder (la pantalla lo necesita)`); }
    const tanda = ["perfil", "fila", "creditos", "puerta", "prueba"].map(de);
    const inicios = tanda.map((l) => l?.desde ?? -1);
    if (tanda.some((l) => !l) || Math.max(...inicios) - Math.min(...inicios) > 15) F(`1 · la tanda no arranca junta: ${tanda.map((l, i) => `${["perfil", "fila", "creditos", "puerta", "prueba"][i]}@${l?.desde}`).join(" ")}`);
    // pendiente 40 + la tanda (la fila, 110) + la espera del regalo (20) ≈ 170; en fila serían más de 350.
    if (tResp > 260) F(`1 · la respuesta tardó ${tResp} ms: suma las piezas en vez de esperar la más lenta (o espera lo de después)`);
    // 2 · después de responder: no los espera, y ninguno arranca antes de que el perfil y la fila estén
    for (const k of ["vuelta", "atribucion", "meta", "borrar"]) {
      const l = de(k);
      if (l && l.hasta != null && l.hasta <= tResp) F(`2 · «${k}» terminó antes de responder: la respuesta lo esperó`);
    }
    await Promise.all(despues.map((d) => d.p));
    for (const k of ["vuelta", "atribucion", "meta", "borrar", "posthog"]) {
      const l = de(k);
      if (!l) F(`2 · «${k}» no corrió después de responder`);
      else if (l.desde < (de("perfil")?.hasta ?? Infinity) || l.desde < (de("fila")?.hasta ?? Infinity)) F(`2 · «${k}» arrancó antes de que el perfil y la fila estuvieran escritos`);
    }
    if (despues.length < 6) F(`2 · lo de después no pasa por despues (${despues.length} promesas)`);
    // 3 · el regalo lento sale «pendiente»
    if (r.cuerpo.estado !== "nueva" || r.cuerpo.regalo !== "pendiente" || r.cuerpo.regaloVence !== null) F(`3 · con el regalo lento la respuesta no dice «pendiente»: ${JSON.stringify(r.cuerpo)}`);
    if (!(r.cuerpo.busqueda as { comunas?: string[] } | undefined)?.comunas) F("3 · la respuesta no trae la búsqueda");
    // 4 · el espejo
    if (r.espejos.length !== 1 || r.espejos[0].eventId !== "reg-u1" || (r.espejos[0].datos as { puerta?: string } | undefined)?.puerta !== "B") F(`4 · el espejo del pixel no sale en la respuesta: ${JSON.stringify(r.espejos)}`);
  } catch (e) {
    F(`1 · no corrió: ${(e as Error).message}`);
  }
  // 3 · el regalo rápido entra en la respuesta; 4 · en prueba, sin espejo
  try {
    const m = piezasDeMentira({ regaloMs: 5, prueba: true });
    const r = await orden.ordenarAlta(m.piezas, base, () => {}, { esperaRegaloMs: 60 });
    if (r.cuerpo.regaloVence !== "2026-11-24T14:00:00Z" || "regalo" in r.cuerpo) F(`3 · el regalo que alcanza no entra en la respuesta: ${JSON.stringify(r.cuerpo)}`);
    if (r.espejos.length !== 0) F("4 · una cuenta de prueba lleva espejo (el pixel la contaría)");
  } catch (e) {
    F(`3 · no corrió: ${(e as Error).message}`);
  }
  // ── 5 · el segundo pedido y la cuenta que ya existía ──
  try {
    const sinPend = piezasDeMentira({ pendiente: null });
    const r1 = await orden.ordenarAlta(sinPend.piezas, base, () => {});
    if (r1.cuerpo.estado !== "nueva" || r1.cuerpo.repetida !== true) F(`5 · sin lo elegido, una cuenta de recién no es «nueva» (iría al dashboard): ${JSON.stringify(r1.cuerpo)}`);
    const vieja = piezasDeMentira({ pendiente: null });
    const r2 = await orden.ordenarAlta(vieja.piezas, { ...base, cuentaNueva: false }, () => {});
    if (r2.cuerpo.estado !== "sin-pendiente") F("5 · una cuenta vieja sin nada pendiente entra como nueva");
    const yaEstaba = piezasDeMentira({ perfil: "ya-estaba" });
    const despues2: Promise<unknown>[] = [];
    const r3 = await orden.ordenarAlta(yaEstaba.piezas, base, (p) => despues2.push(p), { esperaRegaloMs: 10 });
    await Promise.all(despues2);
    if (r3.cuerpo.repetida !== true || yaEstaba.linea.some((l) => ["vuelta", "meta", "atribucion"].includes(l.pieza))) F(`5 · el segundo pedido (el perfil ya estaba) repite el alta o no responde lo mismo: ${JSON.stringify(r3.cuerpo)}`);
    const existia = piezasDeMentira({ pendiente: { existe: true, creadoAt: "2026-10-25T14:00:00Z", perfil: { comunas: ["Ñuñoa"] } } });
    const r4 = await orden.ordenarAlta(existia.piezas, base, () => {});
    if (r4.cuerpo.estado !== "existente" || !(r4.cuerpo.comunasNuevas as string[] | undefined)?.length || existia.linea.some((l) => l.pieza === "perfil")) F(`5 · la cuenta que ya existía no pregunta por las comunas, o le pisa el perfil: ${JSON.stringify(r4.cuerpo)}`);
  } catch (e) {
    F(`5 · no corrió: ${(e as Error).message}`);
  }
  // ── 6 · el cableado ──
  try {
    const alta = sinComentarios(leer("src/lib/deptos/alta-servidor.ts"));
    if (!/const r = await ordenarAlta\(piezas, \{/.test(alta)) F("6 · el alta no usa el orden (ordenarAlta)");
    if (!/upsert\(\{ user_id: user\.id, \.\.\.perfil, actualizado_at: new Date\(\)\.toISOString\(\) \}, \{ onConflict: "user_id", ignoreDuplicates: true \}\)\.select\("user_id"\)/.test(alta)) F("6 · el perfil pisa uno que ya estaba (sin ignoreDuplicates)");
    if (!/filaDelDia: \(\) => c\.medir\("fila-del-dia", encolarPrimeraSeleccion\(admin, user, \{ sitio: SITIO, enSegundoPlano: despues, ruta: p\.ruta, antes: permisoVuelta \}\)\)/.test(alta) || !/vueltaDelDia: async \(\) => \{ soltarVuelta\(\); \}/.test(alta)) F("6 · la primera vuelta del correo del día no espera a después de responder");
    if (!/if \(deps\.antes\) await deps\.antes;\s*const fuera = await cuentasPruebaSinCorreo\(admin\);/.test(sinComentarios(leer("src/lib/guia/del-dia-servidor.ts")))) F("6 · encolarPrimeraSeleccion no espera el permiso antes de la vuelta");
    // El espejo con las reglas de emitirEventoMeta: sin espejo en prueba o sin el «sí» de las cookies.
    const srv = await import("../../../src/lib/deptos/alta-servidor");
    const e1 = srv.espejoDeRegistro({ userId: "u1", puerta: "C", prueba: false, consentimiento: true });
    if (e1?.evento !== "CompleteRegistration" || e1.eventId !== "reg-u1" || (e1.datos as { puerta?: string; status?: string } | undefined)?.puerta !== "C" || (e1.datos as { status?: string } | undefined)?.status !== "completo"
      || srv.espejoDeRegistro({ userId: "u1", puerta: "B", prueba: true, consentimiento: true }) !== null || srv.espejoDeRegistro({ userId: "u1", puerta: "B", prueba: false, consentimiento: false }) !== null) F(`6 · el espejo no sigue las reglas del servidor: ${JSON.stringify(e1)}`);
    const entrar = sinComentarios(leer("src/app/api/deptos/entrar/route.ts"));
    const iPend = entrar.indexOf("const pendientePrevia = leerPendiente(admin, correo)"), iEntrar = entrar.indexOf("await entrarConCodigo(");
    if (iPend < 0 || iEntrar < 0 || iPend > iEntrar || !/ejecutarAlta\(admin, user, request, \{ ruta: RUTA, crono, pendiente: pendientePrevia, despues: waitUntil \}\)/.test(entrar) || !/const user = cuenta \?\? /.test(entrar) || !/despues: waitUntil,/.test(entrar)) F("6 · la ruta del código no pide lo elegido junto con verificar, pide la cuenta otra vez, o marca la entrada antes de responder");
    const rutaAlta = sinComentarios(leer("src/app/api/deptos/alta/route.ts"));
    if (!/ejecutarAlta\(admin, user, request, \{ clave: b\.p, ruta: RUTA, crono, despues: waitUntil, \.\.\.\(mismaCuenta && pendientePrevia \? \{ pendiente: pendientePrevia \} : \{\}\) \}\)/.test(rutaAlta) || !/waitUntil\(marcarAlta\(/.test(rutaAlta)) F("6 · la ruta del alta (Google) espera lo que va después");
    const entradaPura = sinComentarios(leer("src/lib/deptos/entrada.ts"));
    if (!/const \[r\] = await Promise\.all\(\[d\.alta\(usuario\), registro\]\);/.test(entradaPura) || !/if \(d\.despues\) d\.despues\(marca\.catch\(\(\) => undefined\)\); else await marca;/.test(entradaPura)) F("6 · la entrada registra antes del alta (en fila) o marca antes de responder");
    // El regalo que pierde la carrera devuelve el vencimiento de la decisión ganadora (no un «ya» sin fecha).
    const regalo = sinComentarios(leer("src/lib/regalo-alta-servidor.ts"));
    if (!/code === "23505"\) \{\s*const \{ data: ganadora \} = await admin\.from\("regalos_alta"\)\.select\("motivo, vence_at"\)/.test(regalo)) F("6 · el regalo que pierde la carrera responde sin fecha (Estás dentro quedaría sin la tarjeta)");
    if (!/c\.medir\("regalo-previo-y-topes", Promise\.all\(\[/.test(regalo)) F("6 · la decisión previa y los topes del regalo van en fila");
    // La pantalla pide el regalo pendiente y lo dibuja al llegar.
    const cli = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
    if (!/setRegaloPendiente\(!d\.regaloVence && d\.regalo === "pendiente"\);/.test(cli) || !/const r = await fetch\("\/api\/deptos\/regalo", \{ cache: "no-store" \}\);/.test(cli) || !/if \(d\.vence\) setRegaloVence\(d\.vence\);/.test(cli)) F("6 · «Estás dentro» no pide el regalo pendiente (la tarjeta no aparecería)");
    if (orden.ESPERA_REGALO_MS > 300 || orden.PASO_REGALO_MS > 1000) F("6 · la respuesta espera demasiado al regalo, o la pantalla pregunta muy de vez en cuando");
  } catch (e) {
    F(`6 · no corrió: ${(e as Error).message}`);
  }

  if (fallas.length) {
    console.log(`  ✗ ALTA-ORDEN · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — antes de responder, solo el perfil, la fila del día, los créditos, la puerta y la prueba, en una tanda; lo demás después y sin esperarlo; el regalo entra si alcanza o sale «pendiente» y la pantalla lo pide; el espejo con las reglas del servidor; el segundo pedido responde lo mismo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runAltaOrdenTier().then((r) => process.exit(r.hard ? 1 : 0));
}
