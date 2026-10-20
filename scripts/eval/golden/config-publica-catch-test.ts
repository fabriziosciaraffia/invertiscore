// ─────────────────────────────────────────────────────────────────────────────
// Tier CONFIG-PUBLICA (13-oct-2026, 0 tokens) — `/api/config` sirve solo una lista cerrada de claves públicas.
//
//   1 · LA LISTA CERRADA: la clave de la lista responde 200 con su valor (o el de respaldo); cualquier otra —las
//       internas que SÍ existen en la tabla (`backfill_toctoc_checkpoint`, `uf_value`), una que no existe, ninguna,
//       una con otra caja o un espacio— responde 404 con EL MISMO cuerpo, sin nombrar la clave y SIN consultar la
//       base (el lector falso cuenta las llamadas).
//   2 · LA LISTA ES LA DEL NAVEGADOR: las claves que el código de `src/` pide por `/api/config?key=` son exactamente
//       las de la lista (si el navegador empieza a leer otra, la lista se amplía a propósito; si deja de leer una,
//       sale). Una clave armada en tiempo de ejecución no se puede auditar: ROJO.
//   3 · LA RUTA DELEGA: el GET pasa por `respuestaConfig` con `getConfig` y no lee la tabla por su cuenta.
//   4 · EL RESPALDO de la tasa es la referencia del motor (`MARKET_AVG_TASA_UF`).
//   5 · LA BASE (13-oct-2026): la última migración que toca la política «Public read config» la restringe a las
//       MISMAS claves de la lista, y anon y authenticated quedan con SELECT y nada más (TRUNCATE no pasa por RLS).
//   6 · NINGÚN LECTOR DE CLAVES INTERNAS usa la anon key ni el cliente de la sesión: ni el archivo que lee la tabla
//       ni —si lee con un cliente recibido— el argumento que le pasan quienes lo llaman, transitivamente.
//   La medida en vivo de la base es `config-rls-sonda.ts` (con la anon key, directo a Supabase).
// La medida en vivo es `config-publica-sonda.ts` (contra un servidor: refranco.ai o `next dev`).
//
// ACTA (13-oct-2026). En la tabla hay tres claves —`backfill_toctoc_checkpoint` (estado interno del backfill, un
// JSON de 579 caracteres), `tasa_hipotecaria` y `uf_value`— y el navegador lee UNA por este endpoint: la tasa, desde
// el wizard (la UF va por `/api/uf`). 10/10 mutaciones en ROJO: M1 la ruta vieja · M2 la lista acepta cualquier clave
// · M3 se lee la base antes de mirar la lista · M4 el 404 nombra la clave · M5 `uf_value` en la lista · M6 la lista
// sin mayúsculas ni espacios · M7 el navegador pide otra clave · M8 una clave armada en ejecución · M9 el respaldo de
// la tasa separado del motor · M10 la ruta lee la tabla aparte. La sonda contra `next dev`: VERDE con la ruta nueva,
// ROJO con la vieja (200 para las internas y para una que no existe, 400 sin clave: cinco cuerpos distintos).
//
// ACTA §5–§6 (13-oct-2026, la política RLS). Antes de migrar, el rol anon veía las tres claves y tenía TODOS los
// permisos (con TRUNCATE y MAINTAIN). Ningún lector de las claves internas usaba la anon key: todos con service
// role; `comunas-seo` caía a la anon key si faltaba la del service role (está en Production, Preview y
// Development: nunca pasó), y se le sacó la caída. Ninguna función, vista ni regla de la base lee `config`. 10/10
// mutaciones de §5–§6 en ROJO: K1 la política vuelve a `using (true)` · K2 lee otra clave · K3 sin quitar los
// permisos · K4 una migración posterior devuelve INSERT · K5 comunas-seo cae a la anon key · K6 /semanal le pasa la
// sesión a `leerConfigGuia` · K7 `createAnonPipelineClient` con la anon key · K8 `getConfig` fuera de /api/config ·
// K9 transitivo: el pago le pasa la sesión a `calcularYGuardarGuia` · K10 uf.ts con el cliente de la sesión.
// Solo:  node --import tsx scripts/eval/golden/config-publica-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as CP from "../../../src/lib/config-publica";
import { MARKET_AVG_TASA_UF } from "../../../src/lib/financing-health";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(ts|tsx|js|jsx)$/.test(n)) out.push(rel);
  }
  return out;
}

/** La tabla como está en producción (13-oct-2026): dos claves internas y la pública. */
const TABLA: Record<string, { value: string; updated_at: string }> = {
  tasa_hipotecaria: { value: "4.32", updated_at: "2026-10-13T10:00:43Z" },
  uf_value: { value: "39512", updated_at: "2026-10-13T10:00:47Z" },
  backfill_toctoc_checkpoint: { value: '{"pagina":12,"usuario":"x"}', updated_at: "2026-10-13T03:03:17Z" },
};

export async function runConfigPublicaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CONFIG-PUBLICA (/api/config sirve solo la lista cerrada · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la lista cerrada ─────────────────────────────────────────────────────
  const pedidas: string[] = [];
  const lector: CP.LectorConfig = async (k) => { pedidas.push(k); return TABLA[k] ?? null; };
  const ok = await CP.respuestaConfig("tasa_hipotecaria", lector);
  if (ok.status !== 200 || (ok.body as { value?: string }).value !== "4.32" || (ok.body as { updated_at?: string }).updated_at !== TABLA.tasa_hipotecaria.updated_at)
    F(`1 · la clave pública no responde 200 con su valor y su fecha (${ok.status} ${JSON.stringify(ok.body)})`);
  const sinFila = await CP.respuestaConfig("tasa_hipotecaria", async () => null);
  if (sinFila.status !== 200 || (sinFila.body as { value?: string }).value !== CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria) F("1 · sin la fila, la clave pública no cae a su valor de respaldo");
  pedidas.length = 0;
  const fuera: Array<string | null> = ["backfill_toctoc_checkpoint", "uf_value", "no_existe_xyz", null, "", "TASA_HIPOTECARIA", "tasa_hipotecaria ", "constructor", "__proto__", "toString"];
  const cuerpos = new Set<string>();
  for (const k of fuera) {
    const r = await CP.respuestaConfig(k, lector);
    const cuerpo = JSON.stringify(r.body);
    cuerpos.add(cuerpo);
    if (r.status !== 404) F(`1 · la clave ${JSON.stringify(k)} responde ${r.status}, no 404${k && TABLA[k] ? " (es interna y existe en la tabla)" : ""}`);
    if (k && k.length > 2 && cuerpo.includes(k.trim())) F(`1 · el 404 de ${JSON.stringify(k)} nombra la clave`);
  }
  if (cuerpos.size !== 1) F(`1 · el 404 no es el mismo para todas las claves fuera de la lista (${cuerpos.size} cuerpos distintos: revela cuáles existen)`);
  if (pedidas.length) F(`1 · se consulta la base con claves fuera de la lista (${pedidas.join(", ")}): el tiempo de respuesta revela si existen`);

  // ── 2 · la lista es exactamente la del navegador ─────────────────────────────
  const fuentes = archivos("src").filter((p) => !p.startsWith("src/app/api/config/"));
  const leidas = new Set<string>();
  let dinamicas = 0;
  for (const p of fuentes) {
    const s = sinComentarios(leer(p));
    for (const m of s.matchAll(/\/api\/config\?key=([A-Za-z0-9_]*)/g)) {
      if (m[1]) leidas.add(m[1]);
      else { dinamicas++; F(`2 · ${p} pide /api/config con una clave armada en ejecución: no se puede auditar contra la lista`); }
    }
  }
  if (!leidas.size && !dinamicas) F("2 · el censo no encontró ningún lector de /api/config (¿corrió?)");
  const lista = new Set<string>(CP.CLAVES_CONFIG_PUBLICAS);
  for (const k of leidas) if (!lista.has(k)) F(`2 · el navegador pide «${k}», que no está en la lista: recibirá 404`);
  for (const k of lista) if (!leidas.has(k)) F(`2 · la lista sirve «${k}» y ningún código la pide: sobra en la lista pública`);

  // ── 3 · la ruta delega en la lista ───────────────────────────────────────────
  const ruta = sinComentarios(leer("src/app/api/config/route.ts"));
  if (!/const r = await respuestaConfig\(key, getConfig\);\s*return NextResponse\.json\(r\.body, \{ status: r\.status \}\);/.test(ruta)) F("3 · el GET de /api/config no pasa por la lista cerrada");
  if (/from\(["']config["']\)|supabase|getConfig\((?!\))/i.test(ruta.replace(/respuestaConfig\(key, getConfig\)/, "")) || (ruta.match(/getConfig/g) ?? []).length !== 2) F("3 · la ruta lee la tabla por su cuenta, fuera de la lista");
  if (/export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(ruta)) F("3 · /api/config expone otro método además de GET");

  // ── 4 · el respaldo de la tasa es la referencia del motor ────────────────────
  if (Number(CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria) !== MARKET_AVG_TASA_UF) F(`4 · el respaldo de la tasa (${CP.DEFAULTS_CONFIG_PUBLICA.tasa_hipotecaria}) no es la referencia del motor (${MARKET_AVG_TASA_UF}): el wizard prellenaría una tasa y el motor juzgaría contra otra`);

  // ── 5 · la base: la política de lectura pública es la misma lista; anon y authenticated, solo SELECT ─────────
  // (13-oct-2026) La política «Public read config» era `using (true)`: la anon key leía la tabla entera directo de
  // Supabase. La ÚLTIMA migración que la toca fija sus claves, y tienen que ser exactamente las de la lista: si la
  // lista crece sin migración, `/api/config` serviría el respaldo; si la política se abre, vuelve el agujero.
  const migraciones = readdirSync(join(RAIZ, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort();
  const sql = (n: string) => leer(`supabase/migrations/${n}`).replace(/--.*$/gm, "");
  const conPolitica = migraciones.filter((n) => /"Public read config"/.test(sql(n)));
  const ultima = conPolitica[conPolitica.length - 1];
  const politica = ultima ? /"Public read config"\s+on\s+public\.config\s+using\s*\(\s*key\s*(=\s*'([a-z_]+)'|in\s*\(([^)]*)\))\s*\)/i.exec(sql(ultima)) : null;
  const enPolitica = new Set(politica ? (politica[2] ? [politica[2]] : (politica[3] ?? "").split(",").map((s) => s.trim().replace(/^'|'$/g, ""))) : []);
  if (!politica) F(`5 · la última migración que toca «Public read config» (${ultima ?? "ninguna"}) no la restringe por clave: la anon key lee la tabla entera`);
  else if ([...lista].sort().join() !== [...enPolitica].sort().join()) F(`5 · la política RLS deja leer ${[...enPolitica].join(", ")} y la lista sirve ${[...lista].join(", ")}: tienen que ser las mismas`);
  const conPermisos = migraciones.filter((n) => /revoke\s+all\s+on\s+table\s+public\.config\s+from\s+anon,\s*authenticated\s*;/i.test(sql(n)));
  const revoca = conPermisos[conPermisos.length - 1];
  if (!revoca || !/revoke\s+all\s+on\s+table\s+public\.config\s+from\s+anon,\s*authenticated\s*;\s*grant\s+select\s+on\s+table\s+public\.config\s+to\s+anon,\s*authenticated\s*;/i.test(sql(revoca)))
    F("5 · ninguna migración les quita a anon y authenticated los permisos que no usan sobre `config` (TRUNCATE no pasa por RLS)");
  for (const n of migraciones.filter((m) => revoca && m > revoca)) {
    if (/grant\s+(?!select\s+on)[^;]*\bon\s+(table\s+)?public\.config\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i.test(sql(n))) F(`5 · ${n} les devuelve a anon o authenticated un permiso que no es SELECT sobre \`config\``);
  }

  // ── 6 · ningún lector de las claves internas usa la anon key ni el cliente de la sesión ─────────────────────
  // Con la política del §5, la anon key —y el cliente de la sesión, que corre como anon o authenticated— solo ve
  // la lista: un lector de `uf_value` o del checkpoint con ese cliente recibiría vacío y caería a su respaldo sin
  // avisar. El único que lee con la sesión es `getConfig`, detrás de `/api/config` (§3). Se mira el archivo que
  // lee la tabla y, si lee con un cliente que recibe por parámetro, también a quienes lo llaman.
  const fuentesTodas = [...archivos("src"), ...archivos("scripts").filter((p) => !p.startsWith("scripts/_archivo/") && !p.startsWith("scripts/eval/golden/"))];
  const usaSesionOAnon = (s: string) => /NEXT_PUBLIC_SUPABASE_ANON_KEY|@\/lib\/supabase\/(server|client)["']|supabase\/(server|client)["']/.test(s);
  const lectores = fuentesTodas.filter((p) => /\.from\(["']config["']\)/.test(sinComentarios(leer(p))));
  if (lectores.length < 5) F(`6 · el censo de lectores de \`config\` no corrió (${lectores.length} archivos)`);
  // Un AYUDANTE es una función que recibe el cliente por parámetro y con él lee `config` (o se lo pasa a otro
  // ayudante: se sigue de forma transitiva más abajo). Su cuerpo es el tramo hasta la siguiente definición de
  // primer nivel.
  const tramo = (s: string, i: number) => {
    const r = /\n(?:export |async function |function |const |let |type |interface )/g;
    r.lastIndex = i + 1;
    const m = r.exec(s);
    return s.slice(i, m ? m.index : s.length);
  };
  const ayudantes: string[] = [];
  for (const p of lectores) {
    const s = sinComentarios(leer(p));
    if (p === "src/lib/config-store.ts") continue;
    if (usaSesionOAnon(s)) F(`6 · ${p} lee \`config\` y usa la anon key o el cliente de la sesión: con la política nueva vería solo la lista`);
    for (const m of s.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(\s*(\w+)\s*:\s*SupabaseClient/g)) {
      if (new RegExp(`\\b${m[2]}\\.from\\(["']config["']\\)`).test(tramo(s, m.index!))) ayudantes.push(m[1]);
    }
  }
  // A quien llama a un ayudante se le mira el ARGUMENTO, no el archivo: muchas rutas usan el cliente de la sesión
  // para saber quién es la persona y le pasan al ayudante otro, de service role. El argumento tiene que venir de un
  // constructor con la clave de service role (los de la biblioteca se verifican en su fuente; los locales, en el
  // archivo) o de `requireAdminPage`.
  const DE_SERVICIO: Record<string, string> = {
    createServiceClient: "src/lib/supabase/service.ts",
    createAnonPipelineClient: "src/lib/api-helpers/anon-cap.ts",
    createAdminServiceClient: "src/lib/admin-auth.ts",
  };
  for (const [fn, p] of Object.entries(DE_SERVICIO)) {
    const def = new RegExp(`export function ${fn}\\(\\)[^{]*\\{([^}]*)\\}`).exec(sinComentarios(leer(p)));
    if (!def || !/SUPABASE_SERVICE_ROLE_KEY!/.test(def[1]) || /ANON_KEY/.test(def[1])) F(`6 · \`${fn}\` (${p}) no construye un cliente con la clave de service role`);
  }
  /** ¿`fn` construye un cliente con la clave de service role? Uno de la biblioteca (verificado arriba) o uno local. */
  const esConstructorDeServicio = (s: string, fn: string) => {
    if (DE_SERVICIO[fn]) return true;
    const local = new RegExp(`function ${fn}\\(\\)[^{]*\\{([^}]*)\\}`).exec(s);
    return !!local && /SUPABASE_SERVICE_ROLE_KEY!/.test(local[1]) && !/ANON_KEY/.test(local[1]);
  };
  const conServicio = (s: string, arg: string) => {
    if (new RegExp(`const\\s*\\{[^}]*\\b${arg}\\b[^}]*\\}\\s*=\\s*await\\s+requireAdminPage\\(`).test(s)) return true;
    const ligado = new RegExp(`const\\s+${arg}\\s*=\\s*(\\w+)\\(\\)`).exec(s);
    return !!ligado && esConstructorDeServicio(s, ligado[1]);
  };
  // Si el argumento es a su vez el parámetro de la función que llama, esa función pasa a ser ayudante y se miran
  // SUS llamadas (transitivo, con una cola).
  const textos = new Map(fuentesTodas.map((p) => [p, sinComentarios(leer(p))]));
  const cola = [...ayudantes];
  let llamadas = 0;
  while (cola.length) {
    const fn = cola.shift()!;
    for (const [p, s] of textos) {
      for (const m of s.matchAll(new RegExp(`(?<!function\\s)\\b${fn}\\(\\s*(\\w+)`, "g"))) {
        llamadas++;
        const arg = m[1];
        // ⚠ ACTA (20-oct-2026) · el cliente también llega CONSTRUIDO EN LÍNEA —`encolarPrimeraSeleccion(createAdminServiceClient(),
        // …)`, 804fca08—, y el censo solo reconocía una variable ligada a un constructor: daba por ajeno un cliente de service
        // role. Se acepta el constructor en línea con la misma vara (de la biblioteca o local, con la clave de service role);
        // cualquier otra llamada en línea sigue siendo falla.
        const enLinea = s.startsWith("()", m.index! + m[0].length);
        if (enLinea ? esConstructorDeServicio(s, arg) : conServicio(s, arg)) continue;
        const antes = [...s.slice(0, m.index).matchAll(/(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)].pop();
        if (antes && new RegExp(`\\b${arg}\\s*:\\s*SupabaseClient\\b`).test(antes[2])) {
          if (!ayudantes.includes(antes[1])) { ayudantes.push(antes[1]); cola.push(antes[1]); }
          continue;
        }
        F(`6 · ${p} le pasa a \`${fn}\` (lee \`config\`) el cliente \`${arg}\`, que no sale de un constructor de service role`);
      }
    }
  }
  if (llamadas < 5) F(`6 · el censo de llamadas a los ayudantes que leen \`config\` no corrió (${llamadas})`);
  for (const esperado of ["leerConfigGuia", "leerCheckpointBackfill", "calcularYGuardarGuia"]) if (!ayudantes.includes(esperado)) F(`6 · el censo no encontró a \`${esperado}\` entre los que leen \`config\` con un cliente recibido (¿corrió?)`);
  const usanGetConfig = fuentesTodas.filter((p) => p !== "src/lib/config-store.ts" && /\bgetConfig\b/.test(sinComentarios(leer(p))));
  if (usanGetConfig.join() !== "src/app/api/config/route.ts") F(`6 · \`getConfig\` (lee con el cliente de la sesión) se usa fuera de /api/config: ${usanGetConfig.join(", ")}`);

  if (fallas.length) {
    console.log(`  ✗ CONFIG-PUBLICA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — /api/config sirve solo ${[...lista].join(", ")} (lo que pide el navegador); toda otra clave, exista o no, recibe el mismo 404 sin consultar la base; el respaldo de la tasa es la referencia del motor; la política RLS lee la misma lista y anon/authenticated solo SELECT; ningún lector de claves internas usa la anon key ni la sesión (censo: ${lectores.length} lectores, ayudantes ${ayudantes.join(", ")}, ${llamadas} llamadas)`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runConfigPublicaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
