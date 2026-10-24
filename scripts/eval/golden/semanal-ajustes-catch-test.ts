// ─────────────────────────────────────────────────────────────────────────────
// Tier SEMANAL-AJUSTES (14-oct-2026, 0 tokens) — la página semanal y el dashboard después de la prueba con fsm@.
//
// Decisiones de Fabrizio del 14-oct-2026 (segunda tanda del semanal de renta corta). Fija:
//   (3) RENTA CORTA SOLO CON COMPRAR: el bloque se arma solo con Comprar por zona —las vecinas sí, el Ajustar negociable
//       no— y con menos de tres se mandan los que haya; renta larga sigue igual (tres o nada, con negociables);
//   (4) EL PLAN DICE LA VERDAD: solo el Ilimitado es «plan» y analiza sin descontar; el plan 10 y el plan 50 se ven
//       como cualquiera, «con N» o «sin», en el dashboard, en el aviso antes de gastar y en el chequeo previo de la ruta
//       de renta corta (con saldo cero no se consulta al proveedor); el regalo del semanal sigue sin ir a quien paga
//       un plan;
//   (5) MIENTRAS MIDE: el indicador con su texto y el tope de 60 s con «Reintentar»;
//   (6) EL RESULTADO EN UN POP-UP: si no da, el pop-up con el mensaje y los parecidos; la tarjeta original marcada
//       «No da para renta corta · no cobrado», sin botón, también al volver; nada se inserta en la lista;
//   (7) LA SELECCIÓN EN EL DASHBOARD: «Tu selección de esta semana» con los dos bloques resumidos y el enlace a
//       /semanal sin token, que con sesión abre la de esta semana; el saldo o el plan arriba para cualquier cuenta;
//   (8) EL ARCHIVO: los informes que salieron de la selección dicen «Desde tu selección semanal»;
//   (9) LOS PARECIDOS QUE SOBREVIVEN: reevaluados con la tarifa y la ocupación recién medidas, sin consultar al
//       proveedor, se ofrecen solo los que siguen dando Comprar; si ninguno, el mensaje de «ninguno».
// Los puntos 1 y 2 (subtítulo de sección y color del veredicto) se fijan por su CSS.
//
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/semanal-ajustes-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as STR from "../../../src/lib/guia/semanal-str";
import { MINIMO_SEMANAL, REGLA_CORTA, REGLA_LARGA, correspondeReactivacion, elegirSemanal } from "../../../src/lib/guia/semanal";
import { datosSaldoDe, estadoSaldo } from "../../../src/lib/casa-saldo";
import { textoUso } from "../../../src/lib/guia/aviso-analizar";
import { CASA, lineaSaldo } from "../../../src/app/dashboard/casa-copy";
import { SELECCION_CASA, deEstaSemana, esDesdeSemanal, origenDeInforme, resumenSeleccion, textoOrigenArchivo } from "../../../src/lib/guia/seleccion-casa";
import { textoCierre } from "../../../src/lib/cierre-informe";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
// ⚠ ACTA (20-oct-2026) · también los comentarios de JSX, `{/* … */}`: no se dibujan. Hasta hoy quedaban adentro y el de
// 39535f66 en semanal-lista.tsx («la relee antes de cobrar») puso rojo el §6, que mira el texto que la persona LEE.
// El cuerpo no puede contener `*/`: con `[\s\S]*?` un `{` seguido de un jsdoc se comía el código hasta el primer `*/}`.
const sinComentarios = (s: string) => s.replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
/** El cuerpo de una función por su firma, hasta el cierre de su primer nivel (`\n}\n` o `\n  };\n`). */
function cuerpo(s: string, firma: string, cierre = "\n}\n"): string {
  const i = s.indexOf(firma);
  if (i < 0) return "";
  const j = s.indexOf(cierre, i);
  return j < 0 ? "" : s.slice(i, j);
}

type C = { avisoId: string; scoreCron: number | null };
/** Una selección de mentira: cada candidato con su veredicto por zona (y con descuento), todos publicados salvo los que se digan. */
async function elegir(evs: Record<string, string>, regla: typeof REGLA_LARGA, o: { vecinas?: Record<string, string>; conDescuento?: Record<string, string>; sinChequeo?: string[] } = {}) {
  const cands = (m: Record<string, string>): C[] => Object.keys(m).map((avisoId, i) => ({ avisoId, scoreCron: 100 - i }));
  const todos: Record<string, string> = { ...evs, ...(o.vecinas ?? {}) };
  return elegirSemanal<C>(
    cands(evs),
    async (c) => ({ veredicto: todos[c.avisoId], score: 70, flujo: 1 }),
    async (c) => (o.sinChequeo?.includes(c.avisoId) ? "sin-chequeo" : "publicado"),
    {
      vecinas: async () => cands(o.vecinas ?? {}),
      evaluarConDescuento: async (c) => ({ veredicto: o.conDescuento?.[c.avisoId] ?? todos[c.avisoId], score: 72, flujo: 1 }),
    },
    regla,
  );
}

export async function runSemanalAjustesTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER SEMANAL-AJUSTES (solo Comprar, el plan veraz, el pop-up, la selección en el dashboard, los parecidos · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const strSrv = sinComentarios(leer("src/lib/guia/semanal-str-servidor.ts"));
  const ruta = sinComentarios(leer("src/app/api/semanal/analizar-str/route.ts"));
  // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · una sola página para la selección: el dashboard. Lo que
  // hacía /semanal lo hace el cargador compartido (seleccion-pagina-servidor.ts) y lo dibuja seleccion-en-casa.tsx; /semanal
  // redirige ahí (tier PUERTA-B-RECORRIDO §7).
  const pagina = sinComentarios(leer("src/lib/guia/seleccion-pagina-servidor.ts")) + sinComentarios(leer("src/app/dashboard/seleccion-en-casa.tsx"));
  const lista = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
  const popup = sinComentarios(leer("src/components/guia/PopupNoDa.tsx"));
  const dash = sinComentarios(leer("src/app/dashboard/page.tsx"));
  const casa = sinComentarios(leer("src/app/dashboard/casa.tsx"));
  const archivo = sinComentarios(leer("src/app/dashboard/archive.tsx"));
  const css = leer("src/components/guia/guia.css");

  // ── 3 · RENTA CORTA SOLO CON COMPRAR ───────────────────────────────────────────
  {
    // ⚠ ACTA (20-oct-2026, SEMANAL-SIN-MINIMO, 39535f66) · en renta larga el «tres o nada» se derogó por decisión de
    // Fabrizio: con 1 o 2 confirmados sale la selección y, con menos de tres, la completa el relleno «Visto anoche, sin
    // confirmar» (el detalle lo fija SEMANAL-SIN-MINIMO). 2f531b8d puso al día las actas de SEMANAL y dejó éstas: el rojo era
    // del gate. Renta corta no cambia: sin negociables, los que haya y sin relleno.
    if (REGLA_CORTA.conNegociables || !REGLA_CORTA.aceptarMenos || REGLA_CORTA.completarSinConfirmar || !REGLA_LARGA.conNegociables || !REGLA_LARGA.aceptarMenos || !REGLA_LARGA.completarSinConfirmar)
      F("3 · las reglas no son «renta corta: sin negociables, los que haya y sin relleno» / «renta larga: con negociables, los que haya y el relleno sin confirmar»");
    // Dos Comprar y un Ajustar que con descuento daría Comprar: renta corta manda los dos, sin el negociable.
    const corta = await elegir({ a: "COMPRAR", b: "COMPRAR", c: "AJUSTA SUPUESTOS" }, REGLA_CORTA, { conDescuento: { c: "COMPRAR" } });
    if (corta.estado !== "armada" || corta.items.map((x) => x.c.avisoId).join() !== "a,b" || corta.items.some((x) => x.tramo === "negociar"))
      F(`3 · renta corta con dos Comprar no manda esos dos (o mete el negociable): ${corta.estado} ${corta.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join()}`);
    // Las vecinas que dan Comprar sí completan.
    const conVecina = await elegir({ a: "COMPRAR" }, REGLA_CORTA, { vecinas: { v1: "COMPRAR", v2: "AJUSTA SUPUESTOS" }, conDescuento: { v2: "COMPRAR" } });
    if (conVecina.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join() !== "a/propia,v1/vecina") F(`3 · renta corta no completa con las vecinas que dan Comprar (o mete negociables): ${conVecina.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join()}`);
    // Uno solo: se manda. Ninguno: sin coincidencias. Con fichas por chequear: pendiente (puede haber más).
    const uno = await elegir({ a: "COMPRAR", b: "AJUSTA SUPUESTOS" }, REGLA_CORTA);
    if (uno.estado !== "armada" || uno.items.length !== 1) F(`3 · renta corta con un solo Comprar no lo manda (${uno.estado}, ${uno.items.length})`);
    const cero = await elegir({ a: "AJUSTA SUPUESTOS" }, REGLA_CORTA, { conDescuento: { a: "COMPRAR" } });
    if (cero.estado !== "sin_match" || cero.items.length !== 0) F(`3 · renta corta sin Comprar no queda sin coincidencias (${cero.estado})`);
    const espera = await elegir({ a: "COMPRAR", b: "COMPRAR" }, REGLA_CORTA, { sinChequeo: ["b"] });
    if (espera.estado !== "pendiente") F(`3 · renta corta con fichas por chequear se da por armada antes de tiempo (${espera.estado})`);
    // Renta larga: el negociable completa, y con menos de tres sale con los que haya (acta de arriba).
    const larga = await elegir({ a: "COMPRAR", b: "COMPRAR", c: "AJUSTA SUPUESTOS" }, REGLA_LARGA, { conDescuento: { c: "COMPRAR" } });
    if (larga.estado !== "armada" || larga.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join() !== "a/propia,b/propia,c/negociar") F(`3 · renta larga dejó de completar con el negociable: ${larga.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join()}`);
    const largaCorta = await elegir({ a: "COMPRAR", b: "COMPRAR" }, REGLA_LARGA);
    if (largaCorta.estado !== "armada" || largaCorta.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join() !== "a/propia,b/propia" || MINIMO_SEMANAL !== 3)
      F(`3 · renta larga con dos Comprar no los manda (${largaCorta.estado}: ${largaCorta.items.map((x) => `${x.c.avisoId}/${x.tramo}`).join()}), o el relleno ya no apunta a tres`);
    // La regla de cobro: la ruta pasa por el orquestador, que cobra solo si lo fino da Comprar (el detalle, en SEMANAL-STR).
    if (!/if \(!daComprar\(m\.fino\.veredicto\)\) return \{ estado: "no-da", alternativas: await p\.alternativas\(\) \};/.test(sinComentarios(leer("src/lib/guia/semanal-str.ts"))))
      F("3 · la regla de cobro no es «si lo fino no da Comprar, no se cobra»");
  }

  // ── 4 · EL PLAN DICE LA VERDAD ──────────────────────────────────────────────────
  {
    const lote = (n: number) => ({ remaining: n, expires_at: "2027-09-24T11:00:00Z", source: "plan10_mensual" });
    const activo = { credits: 0, is_unlimited: false, subscription_status: "active", grace_ends_at: null, subscription_ends_at: "2026-10-24T11:00:00Z" };
    const casos: Array<[string, ReturnType<typeof datosSaldoDe>, string, number | null, boolean]> = [
      ["plan 10 con 29", datosSaldoDe([lote(9), lote(10), lote(10)], activo), "con", 29, true],
      ["plan 10 sin saldo", datosSaldoDe([], activo), "sin", null, true],
      ["plan 50 en gracia con 4", datosSaldoDe([lote(4)], { ...activo, subscription_status: "past_due", grace_ends_at: "2099-01-01T00:00:00Z" }), "con", 4, true],
      ["Ilimitado", datosSaldoDe([], { ...activo, is_unlimited: true }), "plan", null, true],
      ["sin plan con 3", datosSaldoDe([lote(3)], { ...activo, subscription_status: "none" }), "con", 3, false],
    ];
    for (const [nombre, d, tipo, n, suscripcion] of casos) {
      const e = estadoSaldo(d);
      if (e.tipo !== tipo || (n != null && (e.tipo !== "con" || e.n !== n))) F(`4 · ${nombre}: el saldo dice «${e.tipo}${e.tipo === "con" ? ` ${e.n}` : ""}» y no «${tipo}${n != null ? ` ${n}` : ""}»`);
      if (d.suscripcion !== suscripcion) F(`4 · ${nombre}: «suscripción» ${d.suscripcion} (el regalo del semanal la lee)`);
    }
    // El regalo no va a quien paga un plan, aunque ya no sea «plan».
    // ⚠ ACTA (16-oct-2026, goal «la puerta B») · el regalo del semanal es el de reactivación; sigue sin ir a quien paga un plan.
    if (!/plan: saldo\.suscripcion, regaloVivo: saldo\.regaloRestante > 0,/.test(srv)) F("4 · el regalo del semanal no mira la suscripción (le iría a quien paga el plan 10)");
    if (correspondeReactivacion({ registradoAt: new Date("2026-01-01"), ultimoAnalisisAt: null, ultimaReactivacionAt: null, plan: datosSaldoDe([lote(9)], activo).suscripcion, regaloVivo: false, ahora: new Date("2026-10-14") })) F("4 · con el plan 10 activo (sin compras) igual hay regalo");
    // Lo que se lee: «no descuenta» solo para el Ilimitado; el plan 10 ve sus análisis.
    if (!/Ilimitado/.test(CASA.plan.titulo) || !/Ilimitado/.test(textoUso({ tipo: "plan" }))) F("4 · el «no descuenta» no dice que es el Ilimitado");
    const con29 = estadoSaldo(casos[0][1]);
    if (textoUso(con29) !== "Usa 1 de tus 29 análisis." || lineaSaldo(con29) !== "Te quedan 29 análisis") F(`4 · el plan 10 no ve «Usa 1 de tus N análisis» ni su saldo («${textoUso(con29)}», «${lineaSaldo(con29)}»)`);
    // La ruta de renta corta: «sin» antes de medir; con el saldo real.
    const iSaldo = ruta.indexOf('const saldo = estadoSaldo(await leerSaldo(admin, user.id));'), iSin = ruta.indexOf('if (saldo.tipo === "sin") return { ok: false, status: 402, error: "sin-creditos" };');
    const iGeo = ruta.indexOf("await reverseGeocode("), iMide = ruta.indexOf("await buildShortTermAnalysisRow(");
    if (iSaldo < 0 || iSin < iSaldo || iGeo < iSin || iMide < iSin) F("4 · la ruta de renta corta consulta (dirección o proveedor) antes de saber que no quedan análisis");
    // El dashboard y la bienvenida: el saldo arriba.
    // ⚠ ACTA (17-oct-2026, goal «el dashboard vende») · en la casa, arriba manda el banner según el estado (tier CASA §9) y
    // el saldo o el plan va plano, justo después de «Invita a alguien»; en la bienvenida, igual que antes. Verificado en rojo: SA1 sin el saldo plano.
    // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · el saldo plano recibe además el ticket de la cuenta
    // nueva (el precio del pack en sus 24 horas, tier CASA §4).
    // ⚠ ACTA (22-oct-2026) · y el ticket con saldo (`ticketConSaldo`, tier TICKET-VIVO §2).
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) ·el saldo plano se retiró: en la casa el saldo es la píldora
    // del saludo (lib/casa/reglas.ts › pildoraSaldo; tier PUERTA-B-DASHBOARD §1 y §2); en la bienvenida, igual que antes.
    if (!/const pildora = pildoraSaldo\(saldo\);/.test(dash) || !/data-casa="saldo" data-saldo=\{saldo\.tipo\}/.test(dash) || (dash.match(/saldo=\{lineaSaldo\(saldo\)\}/g) ?? []).length !== 1) F("4·7 · el saldo o el plan no está en el dashboard (la casa y la bienvenida)");
    // EL PIE DE LOS INFORMES (14-oct-2026): «ilimitados» solo al Ilimitado; el 10 y el 50, sus análisis.
    if (textoCierre({ analisis: 0, conSesion: true, ilimitado: false }).enlace !== "Analizar otro depto · $9.990" || /\$/.test(textoCierre({ analisis: 0, conSesion: true, ilimitado: true }).enlace) || textoCierre({ analisis: 29, conSesion: true, ilimitado: false }).saldo !== "Te quedan 29 análisis.")
      F("4 · el cierre del informe no trata al plan 10 como a cualquiera (o al Ilimitado le pone precio)");
    for (const [f, credito] of [["src/app/analisis/[id]/informe-ltr.tsx", "creditsRow"], ["src/app/analisis/renta-corta/[id]/informe-str.tsx", "credits"], ["src/app/analisis/comparativa/page.tsx", "creditsRow"]] as const) {
      const s = sinComentarios(leer(f));
      if (!/let ilimitado = isAdmin;/.test(s) || !/\.select\("welcome_credit_used, is_unlimited"\)/.test(s) || !new RegExp(String.raw`ilimitado = ilimitado \|\| ${credito}\?\.is_unlimited === true;`).test(s) || !/ilimitado(=\{ilimitado\}|,)/.test(s))
        F(`4 · ${f} no sabe si la cuenta es Ilimitado (o no se lo pasa al pie)`);
    }
    for (const f of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) {
      const s = sinComentarios(leer(f));
      if (!/<CierreInforme analisis=\{[^}]+\} conSesion=\{[^}]+\} ilimitado=\{ilimitado\} \/>/.test(s) || /suscriptor=|isSubscriber/.test(s)) F(`4 · el cierre de ${f} no mira si es Ilimitado`);
    }
    const wallet = sinComentarios(leer("src/components/chrome/WalletStatusCTA.tsx"));
    const comp = sinComentarios(leer("src/app/analisis/comparativa/comparativa-client.tsx"));
    if (!/if \(args\.ilimitado\) \{\s*return \{\s*state: "subscriber",\s*message: "Análisis ilimitados con tu plan Ilimitado\.",/.test(wallet) || /isSubscriber|FrancoMensual|FRANCOMENSUAL/.test(wallet)
      || !/ilimitado=\{p\.ilimitado\}/.test(comp) || !/ilimitado: p\.ilimitado,/.test(comp) || /isSubscriber/.test(comp)
      || !/if \(p\.ilimitado\) return "subscriber";/.test(sinComentarios(leer("src/components/analysis/NextAnalysisCTA.tsx"))))
      F("4 · el pie del comparativo le dice «Análisis ilimitados» a cualquier suscriptor");
    const estadoPago = sinComentarios(leer("src/app/api/payments/status/route.ts")), retorno = sinComentarios(leer("src/app/payments/return/page.tsx"));
    if (!/if \(uc\?\.is_unlimited === true\) return \{ saldo: 0, ilimitado: true \};/.test(estadoPago) || /getUserAccessLevel/.test(estadoPago)
      || !/\? ilimitado \? "Tu suscripción Franco está activa\. Análisis ilimitados\." : "Tu suscripción Franco está activa\."/.test(retorno))
      F("4 · al activar la suscripción, el plan 10 lee «Análisis ilimitados»");
  }

  // ── 5 · MIENTRAS MIDE ──────────────────────────────────────────────────────────
  {
    if (STR.MIDIENDO !== "Midiendo con los datos de su dirección, unos 30 segundos" || STR.MIDIENDO_TOPE_MS !== 60_000) F("5 · el texto o el tope de la medición no son los aprobados");
    const acciones = cuerpo(lista, "const acciones = (it: ItemSemanal): JSX.Element => {", "\n  };\n");
    if (!/if \(corta && generando === it\.avisoId\) \{[\s\S]*?<Loader2 className="h-4 w-4 shrink-0 animate-spin[^"]*" aria-hidden \/>\s*<span>\{MIDIENDO\}<\/span>/.test(acciones)) F("5 · al medir, el botón no pasa al indicador giratorio con su texto");
    if (!/const reloj = corta \? window\.setTimeout\(\(\) => control\.abort\(\), MIDIENDO_TOPE_MS\) : null;/.test(lista) || !/signal: control\.signal,/.test(lista) || !/if \(corta && control\.signal\.aborted\) setTardo\(it\.avisoId\);/.test(lista))
      F("5 · la medición no se corta a los 60 s (o no lleva al error con reintentar)");
    if (!/if \(corta && tardo === it\.avisoId\) \{[\s\S]*?\{MIDIENDO_TARDO\}[\s\S]*?onClick=\{\(\) => void analizar\(it\)\}[^>]*>\{REINTENTAR\}/.test(acciones)) F("5 · pasado el tope no aparece el error con «Reintentar»");
  }

  // ── 6 · EL RESULTADO EN UN POP-UP ──────────────────────────────────────────────
  {
    if (STR.mensajeNoDa(2) !== STR.NO_DA || STR.mensajeNoDa(0) !== STR.NINGUNO_DA) F("6·9 · el pop-up no dice NO_DA con parecidos y NINGUNO_DA sin ninguno");
    // EL COPY (15-oct-2026, Fabrizio): los textos aprobados, y ninguno habla del cobro.
    if (STR.MARCA_NO_DA !== "No da con los datos de su dirección") F("6 · la marca de la tarjeta no es la aprobada");
    if (STR.NO_DA !== "Con los datos de su dirección, este depto no da para renta corta. Estos sí dan, con esos mismos datos:"
      || STR.NINGUNO_DA !== "Con los datos de su dirección, ninguno de tu selección da para renta corta esta semana. Seguimos buscando."
      || STR.SEMANAL_STR.zona !== "Estimados con la tarifa y la ocupación típicas de su sector. Al analizar uno, Franco lo mide con los datos de esa dirección.")
      F("6 · los textos del pop-up o del bloque no son los aprobados");
    {
      const { SEMANAL_PAGINA } = await import("../../../src/lib/guia/semanal");
      const { AVISO_ANALIZAR } = await import("../../../src/lib/guia/aviso-analizar");
      const { correoSemanal } = await import("../../../src/lib/email/correo-semanal");
      const valores = (o: Record<string, unknown>) => Object.values(o).map((v) => (typeof v === "function" ? String((v as (...a: unknown[]) => unknown)(2, "1 dormitorio, Providencia", "20", 25)) : String(v)));
      const textos = [
        ...valores(STR.SEMANAL_STR), STR.NO_DA, STR.NINGUNO_DA, STR.MARCA_NO_DA, STR.MARCA_ZONA, STR.MIDIENDO, STR.MIDIENDO_TARDO, STR.REINTENTAR,
        ...valores(SEMANAL_PAGINA as unknown as Record<string, unknown>), ...valores(AVISO_ANALIZAR as unknown as Record<string, unknown>),
        ...(["con", "regalo", "plan"] as const).map((tipo) => textoUso(tipo === "con" ? { tipo, n: 4, noVencen: false } : tipo === "regalo" ? { tipo, vence: null } : { tipo })),
      ];
      const d = (n: number) => ({ comuna: "Providencia", tipologia: "2D2B", m2: 60, precioUF: 3900 + n, veredicto: "COMPRAR", score: 75, flujo: 50000, url: `https://x/${n}` });
      const html = correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "2 dormitorios, Providencia", piePct: 20, plazoAnios: 25, deptos: [d(1)], conRegalo: false, saldo: 2, urlBoton: "https://x/b", urlTres: "https://x/t", urlBaja: "https://x/baja", corto: { deptos: [d(2), d(3)], busca: "2 dormitorios, Providencia", piePct: 20, plazoAnios: 25 } }).html;
      const conCobro = textos.filter((t) => /cobr/i.test(t));
      if (conCobro.length || /cobr/i.test(html) || /cobr/i.test(lista) || /cobr/i.test(popup.replace(/^\s*\/\/.*$/gm, ""))) F(`6 · la página, el correo o los pop-ups todavía hablan del cobro (${JSON.stringify(conCobro)}${/cobr/i.test(html) ? " + correo" : ""})`);
    }
    if (!/role="dialog" aria-modal="true"/.test(popup) || !/\{mensajeNoDa\(parecidos\)\}/.test(popup) || !/\{parecidos > 0 && <div className="guia guia-pop-lista" data-popup="parecidos">\{children\}<\/div>\}/.test(popup))
      F("6 · el pop-up no es un diálogo con el mensaje y los parecidos");
    if (!/\{popup && \(\s*<PopupNoDa parecidos=\{parecidos\.length\} alCerrar=\{\(\) => setPopup\(null\)\}>\s*\{parecidos\.map\(\(p\) => tarjeta\(p, `pop-\$\{p\.avisoId\}`\)\)\}\s*<\/PopupNoDa>\s*\)\}/.test(lista))
      F("6 · la página no muestra los parecidos dentro del pop-up");
    // Nada se inserta en la lista: la lista solo dibuja sus filas (y los reemplazos de los caídos).
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · la lista es `.sel-lista` y cada tarjeta va numerada; «Ver los N que faltan» al final.
    const enLista = lista.slice(lista.indexOf('<div className="sel-lista" data-semanal="tarjetas">'), lista.indexOf("{visibles === 0"));
    if (/NO_DA|parecidos|alternativas|popup/.test(enLista) || !/\) : tarjeta\(f\.item, f\.item\.avisoId, i \+ 1\)\)\)\}/.test(enLista)) F("6 · algo del «no da» se inserta en la lista");
    // La tarjeta original: marcada, sin botón.
    const acciones = cuerpo(lista, "const acciones = (it: ItemSemanal): JSX.Element => {", "\n  };\n");
    if (!/if \(corta && noDa\.has\(it\.avisoId\)\) return <p className="sel-estado" data-semanal="no-da">\{MARCA_NO_DA\}<\/p>;/.test(acciones)) F("6 · la tarjeta que no dio no queda marcada sin botón");
    // También al volver: la página lee las que no dieron y no se cobraron.
    const noDan = cuerpo(srv, "export async function noDanEnRentaCorta(");
    if (!/\.from\("comparaciones_zona_str"\)\.select\("aviso_id"\)\s*\.eq\("user_id", userId\)\.in\("aviso_id", avisoIds\)\.neq\("fino_veredicto", "COMPRAR"\)\.eq\("cobrado", false\);/.test(noDan)) F("6 · al volver a la página no se sabe cuáles no dieron (o se marcan los cobrados)");
    if (!/noDanEnRentaCorta\(admin, userId, idsCortos\)/.test(pagina) || !/noDan=\{sel\.corto\.noDan\}/.test(pagina) || !/const noDa = new Set\(\[\.\.\.noDan, \.\.\.noDanAhora\]\);/.test(lista)) F("6 · la marca no vuelve al recargar la página");
  }

  // ── 7 · LA SELECCIÓN EN EL DASHBOARD ────────────────────────────────────────────
  {
    const r = resumenSeleccion({ conLargo: true, items: [{ veredicto: "COMPRAR" }, { veredicto: "COMPRAR" }, { veredicto: "AJUSTA SUPUESTOS" }], corto: { items: [{ veredicto: "COMPRAR" }] } });
    if (r.length !== 2 || r[0].titulo !== STR.SEMANAL_STR.bloqueLargo || r[0].texto !== "3 deptos · 2 Comprar · 1 Ajustar" || r[1].titulo !== STR.SEMANAL_STR.bloqueCorto || r[1].texto !== `1 depto · 1 Comprar · ${SELECCION_CASA.zona}`)
      F(`7 · el resumen de los dos bloques no es el esperado (${JSON.stringify(r)})`);
    const soloCorto = resumenSeleccion({ conLargo: false, items: [], corto: { items: [] } });
    if (soloCorto.length !== 1 || soloCorto[0].modalidad !== "str" || soloCorto[0].texto !== SELECCION_CASA.ninguno) F(`7 · quien solo tiene renta corta (sin deptos esta semana) no ve solo su bloque (${JSON.stringify(soloCorto)})`);
    // ⚠ ACTA (21-oct-2026) · «Ver tu selección» baja a las tarjetas del mismo dashboard (#seleccion), sin token.
    if (SELECCION_CASA.href !== "#seleccion" || SELECCION_CASA.titulo !== "Tu selección de esta semana") F("7 · el enlace o el título del bloque no son los aprobados (el enlace va sin token)");
    // La de esta semana: la más reciente con algún depto; una semana vacía no tapa a la anterior. En cualquier orden.
    const filasS = [
      { id: "vieja", semana: "2026-10-05", items: [1], items_str: [] },
      { id: "nueva", semana: "2026-10-12", items: [], items_str: [1] },
      { id: "vacia", semana: "2026-10-19", items: [], items_str: [] },
    ];
    const elegida = [deEstaSemana(filasS), deEstaSemana([...filasS].reverse()), deEstaSemana([filasS[1], filasS[2], filasS[0]])].map((x) => x?.id).join();
    if (elegida !== "nueva,nueva,nueva" || deEstaSemana([filasS[2]]) !== null) F(`7 · la selección de esta semana no es la más reciente con deptos (${elegida})`);
    if (!/const fila = deEstaSemana\(/.test(cuerpo(srv, "export async function seleccionDeEstaSemana("))) F("7 · /semanal sin token no elige la más reciente con deptos");
    // ⚠ ACTA (17-oct-2026, goal «el dashboard vende») · «Tu selección de esta semana» es el estado de arriba del banner
    // cuando la hay (casa-arriba.ts), en las dos casas; el detalle de la jerarquía, en el tier CASA §9.
    // Verificado en rojo: SA2 la selección sin su título en el banner · SA3 la casa no le pasa la selección al bloque.
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) ·el banner se retiró: «Tu selección de esta semana» es la sección
    // de la casa, con su mapa y sus tarjetas, leída una vez con cargarSeleccionPagina (tier PUERTA-B-DASHBOARD §2).
    if (!/cargarSeleccionPagina\(admin, user, \{ t: tSel, a: aSel \}\)/.test(dash) || !/\{CASA\.seleccion\.titulo\}/.test(dash) || !/<SeleccionEnCasa sel=\{sel\} autoAnalizar=\{autoAnalizar\}/.test(dash)) F("7 · el dashboard no muestra «Tu selección de esta semana»");
    if (SELECCION_CASA.titulo !== "Tu selección de esta semana" || !/const ancla = \{ id: SELECCION_CASA\.ancla,/.test(sinComentarios(leer("src/app/dashboard/seleccion-en-casa.tsx")))) F("7 · la selección del dashboard perdió su título o su ancla");
    if (!/const t = p\.t && TOKEN\.test\(p\.t\) \? p\.t : null;/.test(pagina) || !/const sel = t \? await seleccionPorToken\(admin, t\) : await seleccionDeEstaSemana\(admin, userId\);/.test(pagina) || /token=\{t\}/.test(pagina))
      F("7 · la selección sin token no abre la de esta semana de quien entró");
    // Con la base real: la de esta semana de alguien que tiene una, con su token; y nadie más la ve por sesión.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) F("7 · NO CORRIÓ: faltan las variables de Supabase");
    else {
      const sb = createClient(url, key);
      const { seleccionDeEstaSemana, origenDeInformes } = await import("../../../src/lib/guia/semanal-servidor");
      const { semanaDelEnvio } = await import("../../../src/lib/guia/semanal");
      const desde = new Date(new Date(`${semanaDelEnvio()}T12:00:00Z`).getTime() - 7 * 864e5).toISOString().slice(0, 10);
      const { data: filas } = await sb.from("semanal_selecciones").select("id, user_id, token, semana, items, items_str").gte("semana", desde).order("semana", { ascending: false }).limit(50);
      const conDeptos = (filas ?? []).filter((f) => ((f.items as unknown[]) ?? []).length + ((f.items_str as unknown[]) ?? []).length > 0);
      if (conDeptos.length === 0) F("7 · NO CORRIÓ: nadie tiene selección esta semana");
      else {
        const f = conDeptos[0];
        const s = await seleccionDeEstaSemana(sb, f.user_id as string);
        const suya = conDeptos.filter((x) => x.user_id === f.user_id).sort((a, b) => String(b.semana).localeCompare(String(a.semana)))[0];
        if (!s || s.id !== suya.id || s.token !== suya.token || s.user_id !== f.user_id) F(`7 · la selección de esta semana por sesión no es la suya más reciente (${s?.id} vs ${suya.id})`);
        if (await seleccionDeEstaSemana(sb, "00000000-0000-0000-0000-000000000000")) F("7 · alguien sin selección recibe una por sesión");
        // El archivo (8): cada informe que salió de un aviso dice de dónde: su selección semanal o la guía del pack.
        const { data: an } = await sb.from("analisis").select("id, user_id, origen:input_data->origenAviso").not("input_data->origenAviso", "is", null).limit(30);
        let probados = 0;
        const vistos = { semanal: 0, guia: 0, explorar: 0 };
        for (const a of an ?? []) {
          const origenes = await origenDeInformes(sb, a.user_id as string, [a.id as string]);
          const { data: sels } = await sb.from("semanal_selecciones").select("items, items_str").eq("user_id", a.user_id as string);
          const enSel = (sels ?? []).some((x) => [...((x.items as Array<{ avisoId: string }>) ?? []), ...((x.items_str as Array<{ avisoId: string }>) ?? [])].some((i) => i.avisoId === (a.origen as { avisoId?: string } | null)?.avisoId));
          const dice = (a.origen as { desde?: string } | null)?.desde;
          // ⚠ ACTA (23-oct-2026, goal Explorar) · un informe hecho desde el mapa dice «explorar» (origenAviso.desde).
          const esperado = dice === "semanal" || dice === "guia" || dice === "explorar" ? dice : enSel ? "semanal" : "guia";
          if (origenes[a.id as string] !== esperado) F(`8 · el informe ${String(a.id).slice(0, 8)} dice «${origenes[a.id as string] ?? "SIN DIRECCIÓN"}» y salió de ${esperado}`);
          vistos[esperado]++;
          probados++;
        }
        if (probados === 0) F("8 · NO CORRIÓ: ningún informe salió de un aviso");
        // La marca «Franco» (17-oct-2026) sale de la vista: cada informe desde un aviso es de_franco; uno del wizard, no.
        const idsAviso = (an ?? []).map((a) => a.id as string);
        const { data: vista } = idsAviso.length ? await sb.from("analisis_dashboard").select("id, de_franco").in("id", idsAviso) : { data: [] };
        const sinMarca = idsAviso.filter((id) => !(vista ?? []).some((v) => v.id === id && v.de_franco === true));
        if (sinMarca.length) F(`8 · la vista no marca de Franco ${sinMarca.length} informe(s) que salieron de un aviso (${sinMarca.map((x) => x.slice(0, 8)).join(", ")})`);
        const { data: delWizard } = await sb.from("analisis").select("id").is("input_data->origenAviso", null).limit(5);
        const idsWizard = (delWizard ?? []).map((a) => a.id as string);
        const { data: vistaW } = idsWizard.length ? await sb.from("analisis_dashboard").select("id, de_franco").in("id", idsWizard) : { data: [] };
        if (idsWizard.length === 0 || (vistaW ?? []).length === 0) F("8 · NO CORRIÓ: no hay informes del wizard para probar la marca");
        else if ((vistaW ?? []).some((v) => v.de_franco !== false)) F("8 · la vista marca de Franco un informe del wizard");
        console.log(`  · archivo: ${probados} informes desde un aviso (${vistos.semanal} de la selección, ${vistos.guia} de la guía)`);
      }
    }
  }

  // ── 8 · EL ARCHIVO ───────────────────────────────────────────────────────────────
  {
    const sels = new Set(["a1"]);
    if (!esDesdeSemanal({ avisoId: "x", desde: "semanal" }, sels) || esDesdeSemanal({ avisoId: "a1", desde: "guia" }, sels) || !esDesdeSemanal({ avisoId: "a1" }, sels) || esDesdeSemanal({ avisoId: "a2" }, sels) || esDesdeSemanal(null, sels))
      F("8 · «desde tu selección semanal» no sale de `desde` (o, en los anteriores, de estar en una selección)");
    // LA GUÍA TAMBIÉN (14-oct-2026): todo informe hecho desde un aviso dice de dónde salió; solo el del wizard sin
    // dirección dice «SIN DIRECCIÓN».
    const casosOrigen: Array<[unknown, string | null]> = [
      [{ avisoId: "x", desde: "semanal" }, "semanal"], [{ avisoId: "a1", desde: "guia" }, "guia"],
      [{ avisoId: "a1" }, "semanal"], [{ avisoId: "a2" }, "guia"], [null, null], [{ desde: "guia" }, null],
    ];
    const malos = casosOrigen.filter(([o, esp]) => origenDeInforme(o, sels) !== esp);
    if (malos.length) F(`8 · el origen de un informe no es «semanal» o «guía» según \`desde\` o su selección (${JSON.stringify(malos.map(([o]) => o))})`);
    if (textoOrigenArchivo("semanal") !== "Desde tu selección semanal" || textoOrigenArchivo("guia") !== "Desde tu guía" || textoOrigenArchivo("explorar") !== "Desde Explorar") F("8 · lo que dice el archivo no es «Desde tu selección semanal» / «Desde tu guía» / «Desde Explorar»");
    // ⚠ ACTA (17-oct-2026, goal «una sola lista») · el origen ya no reemplaza a «SIN DIRECCIÓN»: TODO informe de Franco
    // lleva la marca «Franco» al lado del nombre, y lo que decía el archivo («Desde tu selección semanal» / «Desde tu
    // guía») es su título. El origen se pide para los de Franco a la vista, no para los sin dirección (tier CASA §11).
    // Verificado en rojo: S1 la marca sin decir de dónde salió · S2 el origen no se pide para los de Franco. La marca en
    // la VISTA (§7, con la base real) no se muta: sería escribir en producción; corre sobre los 10 informes desde un aviso.
    if (!/title=\{origen \? textoOrigenArchivo\(origen\) : ARCHIVO_COPY\.desdeAviso\}/.test(archivo) || !/origenDeInformes\(admin, user\.id, francoIds\)/.test(dash) || (archivo.match(/origen=\{origenes\[(item\.row|hijo|row)\.id\] \?\? null\}/g) ?? []).length !== 4)
      F("8 · la marca «Franco» del archivo no dice de dónde salió el informe (la selección o la guía)");
    if (!/if \(o\) out\[a\.id\] = o;/.test(cuerpo(srv, "export async function origenDeInformes("))) F("8 · los informes de la guía no traen su origen al archivo");
    // ⚠ ACTA (23-oct-2026, goal Explorar) · la ruta decide `desde` una vez (semanal · guia · explorar) y lo anota en el informe.
    const rutaGuia = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
    if (!/const desde: "semanal" \| "guia" \| "explorar" = desdeExplorar \? "explorar" : desdeSemanal \? "semanal" : "guia";/.test(rutaGuia) || !/if \(body\?\.origenAviso\) body\.origenAviso\.desde = desde;/.test(rutaGuia)) F("8 · los informes nuevos no anotan de dónde salieron");
  }

  // ── 9 · LOS PARECIDOS QUE SOBREVIVEN ────────────────────────────────────────────
  {
    const items = ["a", "b", "c", "d", "e", "f"].map((avisoId) => ({ avisoId }));
    const vered: Record<string, string> = { c: "COMPRAR", d: "AJUSTA SUPUESTOS", e: "COMPRAR", f: "COMPRAR", a: "COMPRAR" };
    const pedidos: string[] = [];
    const sobreviven = await STR.parecidosQueSobreviven(items, "b", new Set(["f"]), async (i) => { pedidos.push(i.avisoId); return vered[i.avisoId] ?? null; });
    if (sobreviven.map((x) => x.avisoId).join() !== "c,e,a") F(`9 · los parecidos que se ofrecen no son los que siguen dando Comprar, en orden y sin los que ya no dan (${sobreviven.map((x) => x.avisoId).join()})`);
    if (pedidos.includes("b") || pedidos.includes("f")) F("9 · se reevalúa el que no dio o uno que ya se sabe que no da");
    const ninguno = await STR.parecidosQueSobreviven(items, "b", new Set(), async () => "AJUSTA SUPUESTOS");
    const conError = await STR.parecidosQueSobreviven(items, "b", new Set(), async () => { throw new Error("x"); });
    if (ninguno.length !== 0 || conError.length !== 0) F("9 · un parecido que no da Comprar (o que no se pudo reevaluar) se ofrece igual");
    // La ruta: los parecidos pasan por la reevaluación con la medición fina, y esa reevaluación no consulta al proveedor.
    if (!/medida = \{ estimacion: built\.estimacion, cfg \};/.test(ruta) || !/await parecidosQueSobreviven\(vigentes, avisoId, excluir, reevaluadorConMedicion\(admin, o, combo, medida\)\)/.test(ruta) || /alternativasNoDa\(/.test(ruta))
      F("9 · la ruta ofrece los siguientes sin reevaluarlos con la medición fina");
    if (!/\.neq\("fino_veredicto", "COMPRAR"\)/.test(cuerpo(ruta, "async alternativas() {", "\n      },\n"))) F("9 · los que ya se sabe que no dan vuelven a ofrecerse");
    const reev = cuerpo(strSrv, "export function reevaluadorConMedicion(");
    if (!/const body = c \? cuerpoStrDeAviso\(c, o, combo, medida\.cfg\) : null;/.test(reev) || !/evaluarStrCon\(body, medida\.estimacion, medida\.cfg, c\.medianaComuna, asOf\)\.veredicto/.test(reev) || /getAirbnbEstimate|buildShortTermAnalysisRow|fetch\(/.test(reev))
      F("9 · la reevaluación no es el cuerpo de la zona con la medición fina (o consulta al proveedor)");
    // Con la base real: la misma reevaluación que corre la ruta, con la respuesta de la zona en lugar de la fina, da lo
    // mismo que la estimación por zona del semanal (es el mismo cuerpo), y no hace ningún pedido al proveedor.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const sb = createClient(url, key);
      const { prepararSeleccionStr, reevaluadorConMedicion, zonasDeComuna, celdaDormitorios } = await import("../../../src/lib/guia/semanal-str-servidor");
      const { leerPerfilBusqueda } = await import("../../../src/lib/perfil-busqueda-servidor");
      const { leerConfigGuia } = await import("../../../src/lib/guia/guia-servidor");
      const fetchReal = globalThis.fetch;
      let alProveedor = 0;
      globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
        if (String(u).includes("airroi.com")) { alProveedor++; throw new Error("la reevaluación no consulta al proveedor"); }
        return fetchReal(u, init);
      }) as typeof fetch;
      try {
        const cfg = await leerConfigGuia(sb);
        const { data } = await sb.from("analisis").select("user_id").eq("tipo_analisis", "short-term").not("user_id", "is", null).order("created_at", { ascending: false }).limit(40);
        let comparados = 0, distintos = 0;
        for (const u of Array.from(new Set((data ?? []).map((x) => x.user_id as string)))) {
          if (comparados >= 6) break;
          const prep = await prepararSeleccionStr(sb, u, cfg, await leerPerfilBusqueda(sb, u));
          if (prep?.tipo !== "lista") continue;
          for (const c of prep.p.candidatos.slice(0, 3)) {
            const zona = (await zonasDeComuna(sb, c.comuna)).get(celdaDormitorios(c.dormitorios));
            if (!zona) continue;
            const porZona = await prep.p.evaluar(c);
            const reevaluado = await reevaluadorConMedicion(sb, prep.p.origen, prep.p.combo, { estimacion: zona.estimacion, cfg })(c);
            if (porZona == null || reevaluado == null) continue;
            comparados++;
            if (porZona.veredicto !== reevaluado) distintos++;
          }
        }
        if (comparados === 0) F("9 · NO CORRIÓ: ningún candidato de renta corta para comparar la reevaluación");
        if (distintos > 0) F(`9 · con la misma respuesta, la reevaluación de los parecidos da otro veredicto que la estimación por zona en ${distintos} de ${comparados} (no es el mismo cuerpo)`);
        if (alProveedor > 0) F(`9 · reevaluar los parecidos hizo ${alProveedor} pedido(s) al proveedor`);
        console.log(`  · parecidos: ${comparados} reevaluados con la respuesta de su zona, ${distintos} distintos, ${alProveedor} pedidos al proveedor`);
      } finally {
        globalThis.fetch = fetchReal;
      }
    }
  }

  // ── 10 · LO YA MEDIDO, EN LAS SELECCIONES SIGUIENTES (15-oct-2026) ───────────────
  {
    const ev = { veredicto: "COMPRAR", score: 72, flujo: -9000, ingresoMensual: 970000 };
    const ajustar = { ...ev, veredicto: "AJUSTA SUPUESTOS", score: 67 };
    const med = (fino: string | null, analysisId: string | null = null) => ({ fino, finoScore: 81, analysisId });
    const inf = { flujo: 42000, ingresoMensual: 1100000 };
    const r1 = STR.aplicarMedicion(ev, undefined);
    const r2 = STR.aplicarMedicion(ev, med("BUSCAR OTRA"));
    const r3 = STR.aplicarMedicion(ev, med("AJUSTA SUPUESTOS"));
    const r4 = STR.aplicarMedicion(ajustar, med("COMPRAR", "inf-1"), inf);
    const r5 = STR.aplicarMedicion(ev, med("COMPRAR"));
    if (r1 !== ev) F("10 · un depto sin medir deja de valer por su zona");
    if (r2 !== null || r3 !== null) F("10 · un depto que la medición fina no dio Comprar vuelve a entrar en su selección");
    if (!r4 || r4.veredicto !== "COMPRAR" || r4.score !== 81 || r4.flujo !== 42000 || r4.ingresoMensual !== 1100000 || r4.informeId !== "inf-1") F(`10 · uno que dio Comprar y tiene informe no entra como Comprar con su medición y su informe (${JSON.stringify(r4)})`);
    if (r5 !== ev) F("10 · uno medido Comprar sin informe (el cobro no llegó) deja de valer por su zona");
    if (STR.YA_ANALIZADO.texto !== "Ya lo analizaste" || STR.YA_ANALIZADO.enlace !== "Ver informe") F("10 · el texto no es «Ya lo analizaste · Ver informe»");
    const prepStrFn = cuerpo(strSrv, "export async function prepararSeleccionStr(");
    if (!/const mediciones = await medicionesDePersona\(admin, userId\);/.test(prepStrFn) || !/return aplicarMedicion\(evaluarStrCon\(body, zona\.estimacion, cfg, c\.medianaComuna, asOf\), med\?\.m, med\?\.informe\);/.test(prepStrFn))
      F("10 · el armado (y el prechequeo) no aplican lo que la persona ya midió");
    if (!/\.\.\.\(ev\.informeId \? \{ informeId: ev\.informeId \} : \{\}\),/.test(srv)) F("10 · la selección no guarda el informe de lo ya analizado");
    if (!/\.eq\("fino_veredicto", "COMPRAR"\)\.not\("analysis_id", "is", null\);/.test(cuerpo(srv, "export async function informesEnRentaCorta(")) || !/informesEnRentaCorta\(admin, userId, idsCortos\)/.test(pagina) || !/noDan, informes: informesCortos,/.test(pagina) || !/informes=\{sel\.corto\.informes\}/.test(pagina))
      F("10 · la página no sabe cuáles ya analizó");
    const acciones = cuerpo(lista, "const acciones = (it: ItemSemanal): JSX.Element => {", "\n  };\n");
    // ⚠ ACTA (19-oct-2026, «lo ya visto no ocupa lugar») · el informe sale de `informeDe`: en renta corta, el de la medición
    // (o el de la página, en vivo), como antes; en renta larga, el del depto ya analizado, que lleva a /analisis/[id] (SEMANAL §15).
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · el ya analizado es la fila compacta en su posición (filaAnalizada, desde `tarjeta`), no una rama
    // de `acciones` (tier PUERTA-B-DASHBOARD §4).
    const ramaInforme = cuerpo(lista, "const filaAnalizada = (it: ItemSemanal, informe: string, n: number | null): JSX.Element => (", "\n  );\n") + lista.slice(lista.indexOf("const tarjeta = (it: ItemSemanal"), lista.indexOf("const neg = (it.flujo ?? 0) < 0;"));
    // ⚠ ACTA (21-oct-2026) · en renta larga también cuenta lo leído en vivo (`informes`), no solo el del depto ya visto.
    if (!/const informeDe = \(it: ItemSemanal\): string \| undefined => it\.informeId \?\? informes\[it\.avisoId\];/.test(lista)
      || !/const informe = informeDe\(it\);\s*if \(informe\) return filaAnalizada\(it, informe, n\);/.test(ramaInforme) || !/<EnlaceCarga key=\{it\.avisoId\} href=\{corta \? `\/analisis\/renta-corta\/\$\{informe\}` : `\/analisis\/\$\{informe\}`\} className="sel-fila" data-semanal="ya-analizado"/.test(ramaInforme) || !/\{YA_ANALIZADO\.enlace\}/.test(ramaInforme) || /analizar\(|setConfirmar|sel-btn/.test(ramaInforme))
      F("10 · lo ya analizado no muestra «Ya lo analizaste · Ver informe» en lugar de «Analizar este» (o vuelve a analizar)");
    // Con la base real: a quien ya midió, su armado deja fuera lo que no dio y trae lo analizado con su informe.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const sb = createClient(url, key);
      const { prepararSeleccionStr } = await import("../../../src/lib/guia/semanal-str-servidor");
      const { leerPerfilBusqueda } = await import("../../../src/lib/perfil-busqueda-servidor");
      const { leerConfigGuia } = await import("../../../src/lib/guia/guia-servidor");
      const { informesEnRentaCorta } = await import("../../../src/lib/guia/semanal-servidor");
      const cfg = await leerConfigGuia(sb);
      const { data: comps } = await sb.from("comparaciones_zona_str").select("user_id, aviso_id, fino_veredicto, analysis_id").limit(200);
      let vistos = 0;
      for (const u of Array.from(new Set((comps ?? []).map((c) => c.user_id as string))).slice(0, 5)) {
        const prep = await prepararSeleccionStr(sb, u, cfg, await leerPerfilBusqueda(sb, u));
        if (prep?.tipo !== "lista") continue;
        const suyas = (comps ?? []).filter((c) => c.user_id === u);
        const ya = await informesEnRentaCorta(sb, u, suyas.map((c) => c.aviso_id as string));
        for (const c of prep.p.candidatos.filter((x) => suyas.some((s) => s.aviso_id === x.avisoId))) {
          const s = suyas.find((x) => x.aviso_id === c.avisoId)!;
          const e = await prep.p.evaluar(c);
          vistos++;
          if (s.fino_veredicto !== "COMPRAR" && e !== null) F(`10 · ${c.avisoId.slice(0, 8)} no dio con la medición fina y vuelve a la selección`);
          if (s.fino_veredicto === "COMPRAR" && s.analysis_id && (e?.veredicto !== "COMPRAR" || e?.informeId !== s.analysis_id || ya[c.avisoId] !== s.analysis_id)) F(`10 · ${c.avisoId.slice(0, 8)} ya analizado no trae su informe`);
        }
      }
      if (vistos === 0) F("10 · NO CORRIÓ: ningún depto ya medido entre los candidatos de quien lo midió");
      console.log(`  · ya medidos: ${vistos} deptos revisados en la selección de quien los midió`);
    }
  }

  // ── 11 · «QUIERO VERLO» EN EL INFORME DE RENTA CORTA HECHO DESDE UN AVISO (15-oct-2026) ──
  {
    const { datosDeInformeDeAviso } = await import("../../../src/lib/guia/quiero-verlo");
    const str = datosDeInformeDeAviso({ score: 71.6, results: { veredicto: "COMPRAR", escenarios: { base: { flujoCajaMensual: 41234.4 } } }, input_data: { origenAviso: { avisoId: "a1" }, piePct: 20, plazoCredito: 25, tasaInteres: 4.5, estaAmoblado: true } });
    const ltr = datosDeInformeDeAviso({ score: 60, results: { veredicto: "AJUSTA SUPUESTOS", metrics: { flujoNetoMensual: -12000 } }, input_data: { origenAviso: { avisoId: "a2" } } });
    if (!str || str.avisoId !== "a1" || str.flujo !== 41234 || str.veredicto !== "COMPRAR" || str.score !== 72 || !str.perfil.amoblado || !ltr || ltr.flujo !== -12000 || datosDeInformeDeAviso({ results: {}, input_data: {} }) !== null)
      F(`11 · «Quiero verlo» no lee el aviso, el veredicto y el flujo de un informe de renta corta (o de renta larga) (${JSON.stringify(str)})`);
    // ⚠ ACTA (16-oct-2026, goal «la puerta B») · sin informe de origen (la cuenta de /deptos) el origen es null y no va.
    const iOrigen = ruta.indexOf("body.origenAviso = { avisoId, antiguedad: antiguedad.origen, origenAnalysisId: o.analysisId ?? undefined, desde: \"semanal\" };"), iBuild = ruta.indexOf("await buildShortTermAnalysisRow(");
    if (iOrigen < 0 || iBuild < 0 || iOrigen > iBuild) F("11 · el informe de renta corta del semanal no guarda de qué aviso salió");
    const clienteStr = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
    if (!/\{origenAviso && analysisId && \(\s*<SeccionInforme id="origen-aviso" tono="paper">\s*<InformeDeAviso analysisId=\{analysisId\} veredicto=\{veredicto\} antiguedad=\{origenAviso\.antiguedad\} esDueno=\{!!userId && !isSharedView\} modalidad="str" \/>/.test(clienteStr))
      F("11 · el informe de renta corta no muestra «Quiero verlo»");
    const qvRuta = sinComentarios(leer("src/app/api/lo-que-sigue/quiero-verlo/route.ts"));
    if (!/const d = an \? datosDeInformeDeAviso\(an\) : null;\s*if \(!an \|\| an\.user_id !== user\.id \|\| !d\) return NextResponse\.json\(\{ error: "informe" \}, \{ status: 403 \}\);/.test(qvRuta)) F("11 · la ruta de «Quiero verlo» no lee el informe con datosDeInformeDeAviso");
    // Con la base real: todo informe de renta corta hecho desde un aviso del semanal sirve para «Quiero verlo».
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const sb = createClient(url, key);
      const { data: hechos } = await sb.from("semanal_str_analisis").select("aviso_id, analysis_id, user_id").not("analysis_id", "is", null);
      let n = 0;
      for (const h of hechos ?? []) {
        const { data: an } = await sb.from("analisis").select("score, results, input_data, user_id, tipo_analisis").eq("id", h.analysis_id as string).maybeSingle();
        if (!an) continue;
        n++;
        const d = datosDeInformeDeAviso(an);
        if (!d || d.avisoId !== h.aviso_id || an.user_id !== h.user_id || d.flujo == null || !d.veredicto) F(`11 · el informe de renta corta ${String(h.analysis_id).slice(0, 8)}, hecho desde un aviso, no tiene «Quiero verlo» (${d ? `flujo ${d.flujo}, veredicto ${d.veredicto}` : "sin origenAviso"})`);
      }
      if (n === 0) F("11 · NO CORRIÓ: ningún informe de renta corta hecho desde un aviso");
      console.log(`  · quiero verlo: ${n} informe(s) de renta corta hechos desde un aviso`);
    }
  }

  // ── 1 y 2 · LA JERARQUÍA Y LA TRÍADA (CSS) ──────────────────────────────────────
  {
    if (!/\{bloque && <h2 className="guia-bloque" data-semanal="bloque">\{bloque\}<\/h2>\}/.test(lista) || !/\.guia-bloque \{ font-family: var\(--font-ui\)[^}]*font-size: 18px;/.test(css)) F("1 · el título de cada bloque no es un subtítulo de sección (otra fuente y otro tamaño que el título)");
    // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · en las tarjetas .sel-* el veredicto va como texto con su color: Comprar en azul, Buscar otra en
    // rojo y Ajustar en tinta (franco-design-system › color por veredicto), en deptos.css.
    const cssSel = leer("src/app/deptos/deptos.css");
    if (!/<span className="sel-v" data-veredicto=\{it\.veredicto \?\? undefined\}>/.test(lista) || !/\.sel-v\[data-veredicto="COMPRAR"\] \{ color: var\(--verdict-comprar\); \}/.test(cssSel) || !/\.sel-v\[data-veredicto="BUSCAR OTRA"\] \{ color: var\(--verdict-buscar\); \}/.test(cssSel))
      F("2 · Ajustar y Buscar otro no llevan su color de la tríada en la página semanal");
  }

  if (fallas.length) {
    console.log(`  ✗ SEMANAL-AJUSTES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — renta corta solo con Comprar (los que haya); solo el Ilimitado es «plan» y con saldo cero no se mide; el indicador y el tope de 60 s; el «no da» en un pop-up con la tarjeta marcada, sin insertar nada; la selección en el dashboard y /semanal sin token; «Desde tu selección semanal» en el archivo; los parecidos reevaluados con la medición fina, sin consultar");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runSemanalAjustesTier().then((r) => process.exit(r.hard ? 1 : 0));
}
