// ─────────────────────────────────────────────────────────────────────────────
// Tier PRIMERA-SELECCION (20-oct-2026, 0 tokens, sin red ni base) — la regla de producto de Fabrizio, para todas las
// puertas: quien se registra ve sus deptos ahí mismo y es llevado a analizar uno. No espera.
//
//   1 · LA CUENTA NUEVA: nació hace menos de una hora (esCuentaNueva); una de antes que entra por el mismo camino no
//       vuelve a nacer.
//   2 · TODA PUERTA ENCOLA EL CORREO DEL DÍA: el reclamo después del código (banner, guía, /entrar), el callback (Google y
//       el enlace del correo, salvo la vuelta a /deptos, que encola el alta con los chips), el ticket y /deptos, por la
//       misma cola (encolarPrimeraSeleccion) y con las mismas reglas; el cron corre cada 10 minutos.
//   3 · ESE CORREO ES SU BIENVENIDA: con una fila del día, la bienvenida de siempre no sale.
//   4 · EL ENCOLADO (con una base en memoria): la cuenta nueva deja su fila del día, con el día de hoy, y la primera vuelta
//       sale en el momento; la de antes no deja nada; dos puertas en el mismo registro no duplican la fila ni la vuelta.
//   5 · LA VUELTA POR GOOGLE O POR EL ENLACE: el callback manda a la cuenta nueva a su informe con `?dentro=1`, y el
//       informe deja la marca de recién dentro —el banner queda en «Estás dentro», como por código—.
//   6 · LA PANTALLA, POR PUERTA: en el informe, una hoja SOBRE el informe (fuera de la cinta, que fija position relative),
//       una vez por informe y pestaña, con «Ver mis primeros deptos» para reabrirla; en /deptos y en la página del
//       invitado, en la misma pantalla de «Estás dentro», sin esperar a que conteste el «cuándo».
//   7 · «TIENES UN ANÁLISIS DE REGALO: ELIGE UNO» arriba (sin regalo, «Tus primeros deptos: elige uno»), y cada depto con
//       «Analizar este»: el mismo aviso antes de gastar y la misma ruta que la página semanal, validada por el token.
//   8 · ANALIZAR DESDE YA: los de la noche quedan escritos en la fila pendiente del día (solo si sigue pendiente, sin
//       enviar y vacía), y la pantalla solo ofrece el botón cuando el aviso quedó en la selección.
//   9 · SI EL PERFIL NO ALCANZA, los chips que faltan en un toque (faltanDelPerfil) y se arma.
//  10 · LA MEDICIÓN: `primera_seleccion_vista` una vez por cuenta, con la puerta; el panel de activación lee las
//       ventanas de 1 hora, 1 día y 30 días por puerta (docs/posthog-activacion-por-puerta.md).
//  11 · EL REGISTRO DESDE EL BANNER UN MARTES: la fila del día lleva el martes; armada, sale en el momento; sin cupo, sale
//       igual dentro de la hora con lo visto; y el lunes siguiente no repite lo mandado.
//
// ACTA DE MUTACIONES: en el cuerpo de cada sección, abajo.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/primera-seleccion-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinoRecienDentro, esCuentaNueva, faltanDelPerfil, MINUTOS_CUENTA_NUEVA, MINUTOS_CUPO_DEL_DIA, PARAM_RECIEN_DENTRO, pasoDelDia, PRIMERA_SELECCION,
} from "../../../src/lib/guia/del-dia";
import { encolarPrimeraSeleccion, rellenarDeLaNoche } from "../../../src/lib/guia/del-dia-servidor";
import { queEnviarSemanal } from "../../../src/lib/guia/semanal";
import { diaChile } from "../../../src/lib/regalo-alta";
import { correoDelTicket } from "../../../src/lib/lo-que-sigue/oferta-informe";
import { hojaYaVista, marcarHojaVista } from "../../../src/lib/lo-que-sigue/hoja-primera-seleccion";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ── Una base en memoria: lo justo de supabase-js que usa el encolado y el relleno (insert/update/select con filtros,
// la unicidad (user_id, semana)); cualquier otro método encadena y devuelve vacío. ──
type Fila = Record<string, unknown>;
function baseFalsa() {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
  let ids = 0;
  const from = (t: string) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; valor?: Fila } = { tipo: "select" };
    let una = false, devolver = false;
    const correr = () => {
      const filas = tabla(t);
      if (op.tipo === "insert") {
        const v = { ...op.valor } as Fila;
        if (t === "semanal_selecciones" && filas.some((f) => f.user_id === v.user_id && f.semana === v.semana)) return { data: null, error: { code: "23505", message: "duplicada" } };
        if (!("id" in v)) v.id = `id-${++ids}`;
        if (t === "semanal_selecciones") { v.token ??= `tok${ids}abcdef0123456789abcdef`; v.intentos ??= 0; v.enviada_at ??= null; }
        filas.push(v);
        return { data: devolver ? (una ? v : [v]) : null, error: null };
      }
      const elegidas = filas.filter((f) => filtros.every((p) => p(f)));
      if (op.tipo === "update") { for (const f of elegidas) Object.assign(f, op.valor); return { data: devolver ? elegidas : null, error: null }; }
      if (op.tipo === "delete") { for (const f of elegidas) filas.splice(filas.indexOf(f), 1); return { data: null, error: null }; }
      if (una) return { data: elegidas[0] ?? null, error: null };
      return { data: elegidas, error: null };
    };
    const b: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
      get(_o, nombre: string) {
        if (nombre === "then") return (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve().then(correr).then(ok, ko);
        if (nombre === "select") return () => { if (op.tipo !== "select") devolver = true; return b; };
        if (nombre === "insert") return (v: Fila) => { op = { tipo: "insert", valor: v }; return b; };
        if (nombre === "update") return (v: Fila) => { op = { tipo: "update", valor: v }; return b; };
        if (nombre === "delete") return () => { op = { tipo: "delete" }; return b; };
        if (nombre === "eq") return (c: string, v: unknown) => { filtros.push((f) => (c === "items" ? JSON.stringify(f[c] ?? []) === String(v) : f[c] === v)); return b; };
        if (nombre === "is") return (c: string, v: unknown) => { filtros.push((f) => (f[c] ?? null) === v); return b; };
        if (nombre === "maybeSingle" || nombre === "single") return () => { una = true; return b; };
        return () => b;
      },
    });
    return b;
  };
  return { from, tabla, rpc: () => Promise.resolve({ data: [], error: null }), auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } };
}

export async function runPrimeraSeleccionTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PRIMERA-SELECCION (quien se registra ve sus deptos ahí mismo, por cualquier puerta, y el correo del día dentro de la hora · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  // Un martes, 15:00 en Chile (18:00 UTC).
  const martes = new Date("2026-10-20T18:00:00Z");
  try {
    // ── 1 · LA CUENTA NUEVA ──
    // Mutaciones: M1 la ventana en 24 horas · M2 sin fecha se da por nueva · M3 una cuenta de ayer es nueva.
    {
      if (MINUTOS_CUENTA_NUEVA !== 60) F(`1 · la ventana de cuenta nueva no es una hora: ${MINUTOS_CUENTA_NUEVA}`);
      if (!esCuentaNueva("2026-10-20T17:55:00Z", martes)) F("1 · una cuenta de hace 5 minutos no es nueva");
      if (esCuentaNueva("2026-10-20T15:00:00Z", martes)) F("1 · una cuenta de hace 3 horas se da por nueva (volvería a nacer al entrar por el banner)");
      if (esCuentaNueva(null, martes) || esCuentaNueva("ayer", martes)) F("1 · sin fecha, o con una fecha rota, se da por nueva");
      if (!esCuentaNueva("2026-10-20T18:00:30Z", martes)) F("1 · medio minuto de desfase de reloj deja fuera a la cuenta recién creada");
    }

    // ── 2 · TODA PUERTA ENCOLA ──
    // Mutaciones: M4 el reclamo deja de encolar · M5 el reclamo encola DESPUÉS de la bienvenida (saldrían las dos) · M6 el
    // callback deja de encolar · M7 el callback encola también la vuelta a /deptos (fila doble) · M8 el ticket deja de
    // encolar · M9 /deptos vuelve a su encolado propio · M10 el cron cada hora.
    {
      const claim = sinComentarios(leer("src/app/api/analisis/claim/route.ts"));
      const iEnc = claim.indexOf("await encolarPrimeraSeleccion("), iBienv = claim.indexOf("ensureWelcomeEmail(user.id");
      if (iEnc < 0) F("2 · el reclamo después del código (banner, guía, /entrar) no encola el correo del día");
      else if (iBienv >= 0 && iBienv < iEnc) F("2 · el reclamo encola DESPUÉS de mandar la bienvenida: saldrían la bienvenida y el correo del día");
      // Visto en el QA del 20-oct-2026: encolado antes de adoptar el informe, la primera vuelta buscaba sin perfil y mandaba el correo vacío.
      const iClaim = claim.indexOf("await claimAnalisisAnonimos(");
      if (iClaim < 0 || iClaim > iEnc) F("2 · el reclamo encola ANTES de adoptar el informe: la primera vuelta sale sin perfil (correo vacío)");
      const cb = sinComentarios(leer("src/app/auth/callback/route.ts"));
      if (!/if \(user\?\.id && !claveDeDestino\(next\)\) \{\s*await encolarPrimeraSeleccion\(/.test(cb)) F("2 · el callback (Google, el enlace del correo) no encola, o encola también la vuelta a /deptos (que encola el alta con los chips)");
      const iEncCb = cb.indexOf("await encolarPrimeraSeleccion("), iBienvCb = cb.indexOf("ensureWelcomeEmail(user.id");
      if (iEncCb >= 0 && iBienvCb >= 0 && iBienvCb < iEncCb) F("2 · el callback encola después de la bienvenida");
      if (!/await encolarPrimeraSeleccion\(admin, user, \{ sitio: SITE_URL/.test(sinComentarios(leer("src/app/api/lo-que-sigue/pack/route.ts")))) F("2 · la cuenta que nace con el ticket no encola el correo del día");
      const alta = sinComentarios(leer("src/app/api/deptos/alta/route.ts"));
      if (!/await encolarPrimeraSeleccion\(admin, user, \{ sitio: SITIO/.test(alta) || /encolarDelDia\(/.test(alta)) F("2 · /deptos no encola por la misma cola de todas las puertas");
      const crons = JSON.parse(leer("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
      if (crons.crons.find((c) => c.path === "/api/cron/correo-del-dia")?.schedule !== "*/10 * * * *") F("2 · la cola del correo del día no corre cada 10 minutos: «dentro de la hora» no se cumple");
    }

    // ── 3 · ESE CORREO ES SU BIENVENIDA ──
    // Mutaciones: M11 la bienvenida ignora la fila del día · M12 mira otra tabla.
    {
      const w = sinComentarios(leer("src/lib/welcome.ts"));
      if (!/from\("semanal_selecciones"\)\.select\("id"\)\.eq\("user_id", userId\)\.eq\("tipo", "del_dia"\)/.test(w) || !/if \(pendiente \|\| delDia\) return;/.test(w))
        F("3 · la bienvenida de siempre sale aunque la cuenta tenga su correo del día en cola (dos correos)");
    }

    // ── 4 · EL ENCOLADO, CON UNA BASE EN MEMORIA ──
    // Mutaciones: M13 encola a la cuenta vieja · M14 la fila sin tipo del día · M15 la primera vuelta no sale en el
    // momento · M16 la segunda puerta repite la vuelta · M17 la fila con otro día.
    {
      const base = baseFalsa();
      let vueltas = 0;
      const deps = { sitio: "https://x", enSegundoPlano: (p: Promise<unknown>) => { vueltas++; void p.catch(() => {}); }, ruta: "tier" };
      const admin = base as unknown as Parameters<typeof encolarPrimeraSeleccion>[0];
      const nueva = { id: "u-nueva", created_at: "2026-10-20T17:58:00Z" };
      const fila = await encolarPrimeraSeleccion(admin, nueva, deps, martes);
      const filas = base.tabla("semanal_selecciones");
      if (!fila || filas.length !== 1) F(`4 · la cuenta nueva no deja su fila del día (${filas.length} filas)`);
      else {
        if (filas[0].tipo !== "del_dia" || filas[0].estado !== "pendiente" || filas[0].user_id !== "u-nueva") F(`4 · la fila no es la del correo del día pendiente: ${JSON.stringify(filas[0])}`);
        if (filas[0].semana !== diaChile(martes) || filas[0].semana !== "2026-10-20") F(`4 · la fila no lleva el día del registro (el martes): ${filas[0].semana}`);
      }
      if (vueltas !== 1) F(`4 · la primera vuelta no sale en el momento (${vueltas} vueltas)`);
      // La misma cuenta por una segunda puerta en el mismo registro (el callback y después el alta): ni fila ni vuelta de más.
      if (filas[0]) filas[0].intentos = 1;
      const otra = await encolarPrimeraSeleccion(admin, nueva, deps, martes);
      if (!otra || filas.length !== 1 || vueltas !== 1) F(`4 · una segunda puerta en el mismo registro duplica la fila o repite la vuelta (${filas.length} filas, ${vueltas} vueltas)`);
      const vieja = await encolarPrimeraSeleccion(admin, { id: "u-vieja", created_at: "2026-10-01T12:00:00Z" }, deps, martes);
      if (vieja !== null || filas.length !== 1) F("4 · una cuenta de antes que entra por el mismo camino vuelve a nacer (se le encola un correo del día)");
      // Y nunca lanza: una base rota se reporta, no rompe el registro.
      const rota = { from: () => { throw new Error("base caída"); } } as unknown as Parameters<typeof encolarPrimeraSeleccion>[0];
      if (await encolarPrimeraSeleccion(rota, nueva, deps, martes) !== null) F("4 · con la base caída no devuelve null");
    }

    // ── 5 · LA VUELTA POR GOOGLE O POR EL ENLACE ──
    // Mutaciones: M18 el callback manda sin `?dentro=1` · M19 lo manda a la cuenta vieja · M20 lo manda al dashboard · M21 el
    // informe no deja la marca · M22 el parámetro no se saca de la barra · M23 un correo vacío se usa en el ticket.
    {
      if (PARAM_RECIEN_DENTRO !== "dentro") F("5 · el parámetro no es `dentro`");
      const id = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
      if (destinoRecienDentro(`/analisis/${id}`, true) !== `/analisis/${id}?dentro=1`) F(`5 · la cuenta nueva no vuelve a su informe con ?dentro=1: ${destinoRecienDentro(`/analisis/${id}`, true)}`);
      if (destinoRecienDentro(`/analisis/${id}?x=1#top`, true) !== `/analisis/${id}?x=1&dentro=1#top`) F("5 · se pierde la query o el ancla del informe");
      if (destinoRecienDentro(`/analisis/${id}`, false) !== `/analisis/${id}`) F("5 · la cuenta de antes vuelve con ?dentro=1 (vería «Estás dentro» sin haberse registrado)");
      if (destinoRecienDentro("/dashboard", true) !== "/dashboard" || destinoRecienDentro("/deptos?entro=google&p=abc", true) !== "/deptos?entro=google&p=abc") F("5 · un destino que no es un informe lleva ?dentro=1");
      const cb = sinComentarios(leer("src/app/auth/callback/route.ts"));
      if (!/if \(user\?\.id\) recienDentro = esCuentaNueva\(user\.created_at\);/.test(cb) || !/destinoRecienDentro\(dest, recienDentro\)/.test(cb)) F("5 · el callback no manda a la cuenta nueva con ?dentro=1");
      const rc = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
      if (!/url\.searchParams\.get\(PARAM_RECIEN_DENTRO\) !== "1"\) return;\s*marcarRecienDentro\(almacenSesion\(\), analysisId, correoOferta \?\? ""\);\s*url\.searchParams\.delete\(PARAM_RECIEN_DENTRO\);\s*window\.history\.replaceState/.test(rc))
        F("5 · el informe no deja la marca de recién dentro con ?dentro=1, o no saca el parámetro de la barra");
      if (correoDelTicket({ recienDentro: "", correoConocido: "a@b.cl" }) !== "a@b.cl" || correoDelTicket({ recienDentro: "", correoConocido: null }) !== null) F("5 · la marca sin correo (Google) se usa como el correo del ticket");
    }

    // ── 6 · LA PANTALLA, POR PUERTA ──
    // Mutaciones: M24 el banner no monta la hoja · M25 la hoja dentro de la cinta (position relative la rompe) · M26 se abre
    // en cada render · M27 sin «Ver mis primeros deptos» · M28 /deptos la deja detrás del «cuándo» · M29 /deptos con el paso
    // «primeros» de vuelta · M30 la demo abre la hoja.
    {
      const banner = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
      if (!/<HojaPrimeraSeleccion abierta=\{hoja\}/.test(banner)) F("6 · el banner no monta la hoja con la primera selección");
      else if (!/<HojaPrimeraSeleccion abierta=\{hoja\}[^\n]*\/>\}\s*<\/>\s*\);/.test(banner)) F("6 · la hoja está dentro de la cinta (.lqs-mat > * fija position: relative y el velo deja de ser fixed): tiene que ser lo último del fragmento");
      if (!/\{paso === "dentro" && !demo && <HojaPrimeraSeleccion/.test(banner)) F("6 · la hoja se monta fuera de «Estás dentro», o la demo la monta");
      if (!/if \(hojaYaVista\(almacenSesion\(\), ctx\.analysisId\)\) return;\s*marcarHojaVista\(almacenSesion\(\), ctx\.analysisId\);\s*setHoja\(true\);/.test(banner)) F("6 · la hoja no se abre sola una vez por informe y pestaña");
      if (!/onVerDeptos=\{demo \? undefined : \(\) => setHoja\(true\)\}/.test(banner)) F("6 · «Estás dentro» no puede reabrir la hoja");
      const dentro = sinComentarios(leer("src/components/lo-que-sigue/EstasDentro.tsx"));
      if (!/<button type="button" className="lqs-btn lqs-ver-deptos" onClick=\{onVerDeptos\}[^>]*data-lqs="ver-deptos">\{PRIMERA_SELECCION\.verDeNuevo\}<\/button>/.test(dentro)) F("6 · «Ver mis primeros deptos» no está en «Estás dentro»");
      const almacen = new Map<string, string>();
      const shim = { getItem: (k: string) => almacen.get(k) ?? null, setItem: (k: string, v: string) => { almacen.set(k, v); } };
      if (hojaYaVista(shim, "a")) F("6 · la hoja se da por vista antes de abrirse");
      marcarHojaVista(shim, "a");
      if (!hojaYaVista(shim, "a") || hojaYaVista(shim, "b")) F("6 · la marca de la hoja no es por informe");
      if (hojaYaVista(null, "a")) F("6 · sin storage se da por vista");
      const hoja = sinComentarios(leer("src/components/lo-que-sigue/HojaPrimeraSeleccion.tsx"));
      if (!/className="lqs-velo doc-tokens"/.test(hoja) || !/\{abierta && <PrimeraSeleccion volver=\{`\/analisis\/\$\{analysisId\}`\} \/>\}/.test(hoja) || !/data-lqs="seguir-leyendo">\{PRIMERA_SELECCION\.seguirLeyendo\}/.test(hoja))
        F("6 · la hoja no es el velo del ticket con la selección y «Seguir leyendo el informe»");
      const dp = sinComentarios(leer("src/app/deptos/deptos-cliente.tsx"));
      if (/"primeros"/.test(dp.slice(dp.indexOf("type Paso"), dp.indexOf("\n", dp.indexOf("type Paso")))) || /setPaso\("primeros"\)/.test(dp)) F("6 · /deptos vuelve a esconder los deptos detrás del «cuándo» (el paso «primeros»)");
      const iDentro = dp.indexOf('if (paso === "dentro") {'), iPS = dp.indexOf("<PrimeraSeleccion volver={pagina} />"), iCuando = dp.indexOf('data-deptos="cuando"');
      if (iDentro < 0 || iPS < iDentro || iCuando < 0 || iPS < iCuando) F("6 · /deptos (y la página del invitado) no muestra la primera selección en la misma pantalla de «Estás dentro», debajo del «cuándo»");
      // Sin condición en el medio: ni el «cuándo» ni nada la esconde.
      if (!/<div className="dp-bloque" data-deptos="primeros">\s*<PrimeraSeleccion volver=\{pagina\} \/>\s*<\/div>/.test(dp)) F("6 · en /deptos la primera selección queda detrás de una condición (se vuelve a esperar)");
      if (!/<DeptosCliente/.test(leer("src/app/i/[codigo]/invitacion-cliente.tsx"))) F("6 · la página del invitado dejó de usar la pantalla de /deptos");
    }

    // ── 7 · EL TÍTULO Y «ANALIZAR ESTE» ──
    // Mutaciones: M31 otro título · M32 el título sin mirar el regalo · M33 el botón sin el token · M34 analiza por otra ruta
    // o sin el token · M35 sin el aviso antes de gastar · M36 el botón aunque el aviso no quedó en la selección.
    {
      if (PRIMERA_SELECCION.tituloRegalo !== "Tienes un análisis de regalo: elige uno") F(`7 · el título con regalo no es el pedido: ${PRIMERA_SELECCION.tituloRegalo}`);
      const ps = sinComentarios(leer("src/components/deptos/PrimeraSeleccion.tsx"));
      if (!/\{datos\?\.regaloVence \? PRIMERA_SELECCION\.tituloRegalo : PRIMERA_SELECCION\.titulo\}/.test(ps)) F("7 · el título no dice el regalo cuando lo hay");
      if (!/const puede = !!datos\.token && !!it\.enSeleccion && !!datos\.combinacion;/.test(ps) || !/\{puede && \(\s*<div className="guia-acc">\s*<button type="button" className="guia-an" onClick=\{\(\) => \{ setError\(null\); setConfirmar\(\{ it, sin: false \}\); \}\}[^\n]*data-primera="analizar"/.test(ps))
        F("7 · «Analizar este» no está en cada depto, o sale sin el token de la selección");
      if (!/fetch\("\/api\/lo-que-sigue\/guia\/analizar", \{\s*method: "POST",[\s\S]{0,300}semanal: datos\.token \}\)/.test(ps)) F("7 · «Analizar este» no va por la ruta de la guía con el token de la selección");
      if (!/<AvisoAntesDeAnalizar\s/.test(ps) || !/\{generando === it\.avisoId \? GUIA\.analizando : GUIA\.analizar\}/.test(ps)) F("7 · falta el aviso antes de gastar, o el botón no dice «Analizar este»");
      if (!/router\.push\(`\/analisis\/\$\{d\.id\}`\)/.test(ps)) F("7 · al analizar no lleva al informe");
    }

    // ── 8 · ANALIZAR DESDE YA: los de la noche quedan en la fila pendiente ──
    // Mutaciones: M37 el relleno pisa una fila enviada · M38 pisa una fila ya llena · M39 la pantalla no rellena · M40 da el
    // token aunque no rellenó · M41 el relleno sin la combinación.
    {
      const base = baseFalsa();
      const admin = base as unknown as Parameters<typeof rellenarDeLaNoche>[0];
      const filas = base.tabla("semanal_selecciones");
      filas.push({ id: "p", estado: "pendiente", enviada_at: null, items: [], intentos: 0 });
      filas.push({ id: "e", estado: "enviada", enviada_at: "2026-10-20T18:10:00Z", items: [{ avisoId: "ya" }], intentos: 1 });
      filas.push({ id: "l", estado: "pendiente", enviada_at: null, items: [{ avisoId: "cola" }], intentos: 1 });
      const item = { avisoId: "n1", comuna: "Ñuñoa", tipologia: "2D1B", m2: 50, precioUF: 3200, veredicto: "COMPRAR", score: 80, flujo: 10000 };
      const col = { items: [item], combinacion: { piePct: 20, plazoAnios: 25 }, perfil: { comunas: ["Ñuñoa"] }, origenAnalysisId: null };
      if (!(await rellenarDeLaNoche(admin, { id: "p", intentos: 0 }, col)) || JSON.stringify(filas[0].items) !== JSON.stringify([item]) || JSON.stringify(filas[0].combinacion) !== '{"piePct":20,"plazoAnios":25}')
        F("8 · la fila pendiente y vacía no queda con los deptos de la noche y su combinación");
      if (await rellenarDeLaNoche(admin, { id: "e", intentos: 1 }, col) || (filas[1].items as unknown[]).length !== 1 || (filas[1].items as Array<{ avisoId: string }>)[0].avisoId !== "ya") F("8 · el relleno pisa una selección ya enviada");
      if (await rellenarDeLaNoche(admin, { id: "l", intentos: 1 }, col) || (filas[2].items as Array<{ avisoId: string }>)[0].avisoId !== "cola") F("8 · el relleno pisa lo que la cola ya armó");
      filas.push({ id: "v", estado: "pendiente", enviada_at: null, items: [], intentos: 0 });
      if (await rellenarDeLaNoche(admin, { id: "v", intentos: 0 }, { ...col, items: [] }) || JSON.stringify(filas[3].combinacion ?? null) !== "null") F("8 · sin deptos escribe igual");
      const srv = sinComentarios(leer("src/lib/deptos/primeros-servidor.ts"));
      if (!/enSeleccion = await rellenarDeLaNoche\(admin, fila, \{ items: comoItems, combinacion, perfil, origenAnalysisId: origenId \}\);/.test(srv)) F("8 · la pantalla no deja los de la noche en la fila del día");
      if (!/token: enSeleccion \? token : null/.test(srv) || !/items: elegidos\.map\(\(d\) => \(\{ \.\.\.d, enSeleccion \}\)\)/.test(srv)) F("8 · la pantalla da el token (y el botón) aunque el aviso no quedó en la selección");
      const ds = sinComentarios(leer("src/lib/guia/del-dia-servidor.ts"));
      if (!/\.eq\("id", fila\.id\)\.eq\("estado", "pendiente"\)\.eq\("intentos", fila\.intentos\)\.is\("enviada_at", null\)\.eq\("items", "\[\]"\)/.test(ds)) F("8 · el relleno no se limita a la fila pendiente, sin enviar y vacía");
    }

    // ── 9 · SI EL PERFIL NO ALCANZA ──
    // Mutaciones: M42 falta comuna no se pide · M43 el tope cero pasa · M44 la pantalla no pide los chips · M45 arma sin
    // guardar el perfil.
    {
      if (JSON.stringify(faltanDelPerfil({ comunas: [], dormitorios: [], precioMaxUf: null })) !== '["comuna","tipologia","rango"]') F("9 · con el perfil vacío no pide los tres chips");
      if (faltanDelPerfil({ comunas: ["Ñuñoa"], dormitorios: [2], precioMaxUf: 4000 }).length !== 0) F("9 · con comuna, dormitorios y tope pide chips");
      if (JSON.stringify(faltanDelPerfil({ comunas: ["Ñuñoa"], dormitorios: [2], precioMaxUf: 0 })) !== '["rango"]') F("9 · un tope en cero pasa como rango");
      const ps = sinComentarios(leer("src/components/deptos/PrimeraSeleccion.tsx"));
      if (!/\{datos && datos\.faltan\.length > 0 && \(\s*<div className="mt-3" data-primera="faltan">/.test(ps) || !/data-primera="falta-comuna"/.test(ps) || !/data-primera="falta-tipologia"/.test(ps) || !/data-primera="falta-rango"/.test(ps))
        F("9 · la pantalla no pide los chips que faltan");
      if (!/fetch\("\/api\/perfil-busqueda", \{ method: "PUT"/.test(ps) || !/setDatos\(null\);\s*await leer\(\);/.test(ps)) F("9 · los chips elegidos no se guardan en el perfil, o no se vuelve a armar");
    }

    // ── 10 · LA MEDICIÓN ──
    // Mutaciones: M46 el evento sin la puerta · M47 sin el uuid determinista (uno por vista) · M48 el navegador no manda la
    // candidata.
    {
      const ruta = sinComentarios(leer("src/app/api/deptos/primeros/route.ts"));
      if (!/event: "primera_seleccion_vista", distinctId: user\.id, uuid: uuidDeterminista\(`primera_seleccion:\$\{user\.id\}`\),/.test(ruta)) F("10 · «primera selección vista» no sale una vez por cuenta");
      if (!/const puerta = esPuerta\(atr\?\.puerta\) \? atr\.puerta : esPuerta\(candidata\) \? candidata : null;/.test(ruta) || !/properties: \{ puerta, n: r\.items\.length, fuente: r\.fuente/.test(ruta)) F("10 · el evento no lleva la puerta (la del servidor, o la candidata del navegador)");
      const ps = sinComentarios(leer("src/components/deptos/PrimeraSeleccion.tsx"));
      if (!/const candidata = leerPuertaCandidata\(\);\s*const res = await fetch\(`\/api\/deptos\/primeros\$\{candidata \? `\?puerta=\$\{candidata\.puerta\}` : ""\}`/.test(ps)) F("10 · el navegador no manda su puerta candidata");
      if (!/Activación por puerta/.test(leer("docs/posthog-activacion-por-puerta.md"))) F("10 · falta la nota del panel de activación por puerta");
    }

    // ── 11 · EL REGISTRO DESDE EL BANNER UN MARTES ──
    // Mutaciones: M49 el correo espera más de una hora · M50 el lunes repite lo del martes · M51 armada no sale en el momento.
    {
      if (pasoDelDia({ estado: "armada", minutos: 2, vueltas: 1 }) !== "enviar") F("11 · armada en el momento, el correo no sale");
      if (pasoDelDia({ estado: "pendiente", minutos: MINUTOS_CUPO_DEL_DIA, vueltas: 5 }) !== "enviar_lo_visto" || MINUTOS_CUPO_DEL_DIA + 15 > 60) F("11 · sin cupo, el correo del martes no sale dentro de la hora con lo visto");
      if (pasoDelDia({ estado: "pendiente", minutos: 10, vueltas: 2 }) !== "esperar") F("11 · con tiempo y sin cupo no espera la vuelta siguiente");
      if (queEnviarSemanal(3, { delDiaReciente: true, nuevos: 0 }) !== "nada") F("11 · el lunes siguiente repite lo que el correo del martes ya mandó: no es el semanal de esa semana");
      if (queEnviarSemanal(3, { delDiaReciente: true, nuevos: 2 }) !== "seleccion") F("11 · con nuevos, el lunes no sale");
      // Visto en el QA del 20-oct-2026: con el informe sin coordenadas, el origen era null y el correo salía vacío con el perfil completo.
      if (!/\(await origenDePersona\(admin, userId\)\) \?\? origenSintetico\(userId, perfil, cfg\)/.test(sinComentarios(leer("src/lib/guia/semanal-servidor.ts"))))
        F("11 · con un informe que no sirve de origen (sin coordenadas), la cuenta de la puerta A se queda sin selección: el correo sale vacío");
    }
  } finally {
    if (posthog === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY; else process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }

  if (fallas.length) {
    console.log(`  ✗ PRIMERA-SELECCION · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — toda puerta encola el correo del día en el momento; la cuenta nueva ve su primera selección ahí mismo (sobre el informe, o en «Estás dentro»), con «Analizar este» en cada depto y el regalo arriba; los de la noche quedan en la fila del día; faltan chips, se piden; se mide por puerta");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runPrimeraSeleccionTier().then((r) => process.exit(r.hard ? 1 : 0));
}
