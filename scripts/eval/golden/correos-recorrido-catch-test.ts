// ─────────────────────────────────────────────────────────────────────────────
// Tier CORREOS-RECORRIDO (13-oct-2026, 0 tokens) — el recorrido del correo hasta el análisis.
//
//   4 · EL ENLACE DEL CORREO ENTRA SOLO: sin sesión en ese aparato y hasta 7 días después de que salió el correo, el
//       clic deja adentro al dueño de la selección (enlace mágico generado y verificado en el servidor, sin seguir el
//       action_link), ANTES de cualquier destino; con una sesión abierta no toca nada; si la sesión que quedó no es la
//       del dueño, se cierra.
//   5 · AVISO ANTES DE GASTAR: en la página semanal y en la guía, «Analizar este» abre un aviso con el depto (comuna,
//       tipología, precio) y «Usa 1 de tus N análisis.», con Analizar y Cancelar; nada se genera sin el «Analizar» del
//       aviso. Sin análisis, el mismo aviso ofrece el pack, y si el servidor dice «sin créditos» también: se acabó el
//       callejón «Ya usaste tus análisis.».
//   6 · TRES ANÁLISIS POR $19.990 para quien tiene cuenta: en el dashboard, en el aviso y en la página semanal en lugar de
//       «Analizar uno · $9.990»; en el correo semanal, una línea a quien no tiene análisis. 3 créditos sin caducidad, con
//       su boleta; el ticket de $14.990 sigue atado al primer informe. El CHECK de payments.product acepta todo producto
//       del catálogo (lo que le faltó a 'unlock' el 19-jul).
//   7 · «¿Cuándo piensas comprar?» arriba de la página semanal, solo a quien nunca la contestó; se guarda y desaparece.
//   11 · RENTA CORTA, MIENTRAS TANTO: quien solo analizó renta corta tiene perfil, recibe el semanal con los deptos de
//       renta larga de sus comunas y la línea «Estos convienen para arriendo tradicional. Para renta corta, analízalos
//       con tu pack.»; «Analizar este» acepta ese origen solo con el token de su selección.
// ACTA (13-oct-2026). 31/31 mutaciones en ROJO, cada archivo restaurado byte a byte: M1 el enlace vale 14 días · M2 con
// sesión abierta igual entra · M3 el clic no inicia la sesión · M4 la sesión ajena no se cierra · M5 la selección no trae
// cuándo salió · M6 la página semanal genera sin aviso · M7 vuelve el callejón · M8 la guía genera sin aviso · M9 al entrar
// con el código genera de una · M10 el aviso no dice lo que usa · M11 sin análisis no ofrece el pack · M12 la guía del
// dashboard sin el saldo (la primera versión del predicado la dejaba VERDE: lo cumplía el `estado={saldo}` de
// <SaldoCasa>; ahora mira <GuiaBusqueda>) · M13 el pack a otro precio · M14 el pago otorga uno · M15 el pack sin boleta ·
// M16 el CHECK sin el pack · M17 el dashboard vuelve al suelto · M18 la página semanal vuelve al suelto · M19 el correo sin
// la línea del pack · M20 el enlace del pack no va al pack · M21 el pack en cantidad · M22 el checkout del pack con
// selector · M23 la vuelta acepta //sitio · M24 después de pagar no vuelve · M25 sin la pregunta arriba · M26 contestar no
// la quita · M27 renta corta no arma perfil · M28 el semanal se le niega a renta corta · M29 el correo sin la línea ·
// M30 «Analizar este» rechaza el origen corto · M31 la fila corta se lee como larga.
// Solo:  node --import tsx scripts/eval/golden/correos-recorrido-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DIAS_ENTRADA_POR_CORREO, LINEA_RENTA_CORTA, SEMANAL_PAGINA, puedeEntrarPorCorreo } from "../../../src/lib/guia/semanal";
import { AVISO_ANALIZAR, lineaDepto, textoUso, usoDesdeSaldo } from "../../../src/lib/guia/aviso-analizar";
import { PRODUCTO_TRES, TRES_CANTIDAD, TRES_COPY, TRES_PRECIO_CLP, rutaTres, volverSeguro } from "../../../src/lib/tres-analisis";
import { FLOW_PRODUCTS } from "../../../src/lib/flow-products";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { correoSemanal } from "../../../src/lib/email/correo-semanal";
import { enlacesSemanal } from "../../../src/lib/guia/semanal-servidor";
import { filaDesdeInformeStr } from "../../../src/lib/perfil-busqueda-servidor";
import { perfilDeBusqueda } from "../../../src/lib/perfil-busqueda";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
/** El cuerpo de una función flecha anidada: desde su firma hasta su cierre con esa sangría (`fin`). */
const cuerpo = (s: string, firma: string, fin: string) => {
  const i = s.indexOf(firma);
  if (i < 0) return "";
  const resto = s.slice(i + firma.length);
  const j = resto.indexOf(fin);
  return j < 0 ? "" : resto.slice(0, j);
};

const DEPTO = { comuna: "Ñuñoa", tipologia: "2D1B", m2: 52, precioUF: 3980, veredicto: "COMPRAR", score: 79, flujo: 21000, url: "https://x/depto" };

export async function runCorreosRecorridoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CORREOS-RECORRIDO (entrar por el enlace, el aviso antes de gastar, el pack, el «cuándo», renta corta · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 4 · el enlace del correo entra solo ─────────────────────────────────────
  const ahora = new Date("2026-10-13T15:00:00Z");
  const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString();
  const dia = 864e5;
  if (DIAS_ENTRADA_POR_CORREO !== 7) F("4 · el enlace no vale 7 días");
  if (!puedeEntrarPorCorreo({ conSesion: false, enviadaAt: hace(dia), ahora }) || !puedeEntrarPorCorreo({ conSesion: false, enviadaAt: hace(7 * dia - 60_000), ahora })) F("4 · dentro de los 7 días el enlace no entra solo");
  if (puedeEntrarPorCorreo({ conSesion: false, enviadaAt: hace(7 * dia + 60_000), ahora })) F("4 · pasados los 7 días el enlace sigue entrando");
  if (puedeEntrarPorCorreo({ conSesion: true, enviadaAt: hace(dia), ahora })) F("4 · con una sesión abierta en el aparato, el enlace la pisa");
  if (puedeEntrarPorCorreo({ conSesion: false, enviadaAt: null, ahora }) || puedeEntrarPorCorreo({ conSesion: false, enviadaAt: hace(-60 * 60_000), ahora })) F("4 · entra un correo que no salió (o con fecha futura)");
  const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
  const iEntrar = clic.search(/if \(puedeEntrarPorCorreo\(\{ conSesion: !!actual, enviadaAt: sel\.enviadaAt \}\)\) \{\s*const entro = await entrarConCorreo\(admin, sesion, sel\.user_id\);/);
  const iPrimerDestino = clic.search(/if \(ir === "(perfil|tres|comprar)"/);
  if (iEntrar < 0 || !/const \{ data: \{ user: actual \} \} = await sesion\.auth\.getUser\(\);/.test(clic)) F("4 · el clic no inicia la sesión del dueño de la selección");
  else if (iPrimerDestino < 0 || iEntrar > iPrimerDestino) F("4 · el clic redirige antes de iniciar la sesión (algún destino sale sin entrar)");
  const entrada = sinComentarios(leer("src/lib/guia/entrada-correo.ts"));
  if (!/generateLink\(\{ type: "magiclink", email \}\)/.test(entrada) || !/sesion\.auth\.verifyOtp\(\{ token_hash: hash, type: tipo \}\)/.test(entrada) || /action_link/.test(entrada)) F("4 · la entrada no verifica el enlace mágico en el servidor (o sigue el action_link)");
  if (!/if \(eV \|\| v\?\.user\?\.id !== userId\) \{\s*if \(v\?\.user && v\.user\.id !== userId\) await sesion\.auth\.signOut\(\);/.test(entrada)) F("4 · si la sesión que quedó no es la del dueño, no se cierra");
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  if (!/select\("id, user_id, semana, items, combinacion, origen_analysis_id, variante, enviada_at, perfil"\)/.test(srv) || !/enviadaAt: \(s\.enviada_at as string \| null\) \?\? null/.test(srv) || !/enviadaAt: \(a\.enviado_at as string \| null\) \?\? null/.test(srv)) F("4 · la selección no trae cuándo salió el correo (el enlace no sabría si vence)");

  // ── 5 · el aviso antes de gastar un análisis ────────────────────────────────
  if (textoUso({ tipo: "con", n: 3, noVencen: true }) !== "Usa 1 de tus 3 análisis." || textoUso({ tipo: "con", n: 1, noVencen: true }) !== "Usa tu último análisis.") F("5 · el aviso no dice «Usa 1 de tus N análisis.»");
  if (textoUso({ tipo: "regalo", vence: null }) !== "Usa el análisis que va por cuenta de Franco." || !/no descuenta/.test(textoUso({ tipo: "plan" }))) F("5 · el aviso no distingue el regalo o el plan");
  if (textoUso({ tipo: "sin" }) !== `Para analizar este depto: 3 análisis por $19.990, sin caducidad.` || AVISO_ANALIZAR.comprar !== TRES_COPY.boton) F("5 · sin análisis, el aviso no ofrece el pack");
  if (lineaDepto(DEPTO) !== "Ñuñoa · 2D1B · UF 3.980") F(`5 · el aviso no dice comuna, tipología y precio (${lineaDepto(DEPTO)})`);
  if (usoDesdeSaldo(0).tipo !== "sin" || usoDesdeSaldo(null).tipo !== "desconocido" || usoDesdeSaldo(2).tipo !== "con") F("5 · el saldo de la guía no se traduce al aviso (cero sigue ofreciendo analizar)");
  const aviso = sinComentarios(leer("src/components/guia/AvisoAntesDeAnalizar.tsx"));
  if (!/\{sin \? \(\s*<EnlaceCarga href=\{rutaCompra\}[^>]*data-aviso="comprar">\{AVISO_ANALIZAR\.comprar\}<\/EnlaceCarga>\s*\) : \(\s*<button type="button" className="guia-aviso-si" onClick=\{alAnalizar\} data-aviso="analizar">\{AVISO_ANALIZAR\.analizar\}<\/button>/.test(aviso)) F("5 · el aviso no tiene Analizar (con análisis) o comprar el pack (sin)");
  if (!/onClick=\{alCancelar\} data-aviso="cancelar">\{AVISO_ANALIZAR\.cancelar\}/.test(aviso) || !/\{lineaDepto\(depto\)\}/.test(aviso) || !/\{textoUso\(uso\)\}/.test(aviso)) F("5 · el aviso no tiene Cancelar, el depto o lo que usa");
  // La página semanal: el botón abre el aviso (no genera), está también sin saldo, y «sin créditos» abre el aviso con el pack.
  const lista = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
  const tarjetaSemanal = cuerpo(lista, "const tarjeta = (it: ItemSemanal) => {", "\n  };\n");
  if (!tarjetaSemanal || !/className="guia-an" onClick=\{\(\) => \{ setError\(null\); setConfirmar\(\{ it, sin: false \}\); \}\}/.test(tarjetaSemanal) || /analizar\(it\)/.test(tarjetaSemanal)) F("5 · en la página semanal «Analizar este» genera sin el aviso");
  if (/\{conSaldo && \(\s*<div className="guia-acc">/.test(tarjetaSemanal)) F("5 · en la página semanal sin saldo no hay «Analizar este» (el aviso con el pack no se puede abrir)");
  if (!/if \(d\.error === "sin-creditos"\) \{ setConfirmar\(\{ it, sin: true \}\); break; \}/.test(lista) || /sinCreditos/.test(lista)) F("5 · en la página semanal «sin créditos» sigue siendo un callejón");
  if (!/<AvisoAntesDeAnalizar\s+depto=\{confirmar\.it\}\s+uso=\{confirmar\.sin \? \{ tipo: "sin" \} : saldo\}\s+rutaCompra=\{rutaCompra\(confirmar\.it\.avisoId\)\}\s+alAnalizar=\{\(\) => \{ const it = confirmar\.it; setConfirmar\(null\); void analizar\(it\); \}\}/.test(lista)) F("5 · la página semanal no monta el aviso con su saldo y su compra");
  // La guía: lo mismo, y el registro en la tarjeta termina en el aviso, no en un informe.
  const guia = sinComentarios(leer("src/components/guia/GuiaBusqueda.tsx"));
  if (!/className="guia-an" onClick=\{\(\) => abrir\(it\)\}/.test(guia) || !/if \(!conSesion\) \{ void analizar\(it\); return; \}\s*setError\(null\);\s*setConfirmar\(\{ it, sin: false \}\);/.test(guia)) F("5 · en la guía «Analizar este» genera sin el aviso");
  if (!/alEntrar=\{\(\) => \{ setConSesion\(true\); setRegistrando\(null\); setConfirmar\(\{ it, sin: false \}\); \}\}/.test(guia)) F("5 · en la guía, al entrar con el código se genera sin el aviso");
  if (!/if \(d\.error === "sin-creditos"\) \{ setConfirmar\(\{ it, sin: true \}\); setGenerando\(null\); return; \}/.test(guia) || /GUIA\.sinCreditos/.test(guia)) F("5 · en la guía sigue el callejón «Ya usaste tus análisis.»");
  if (!/<AvisoAntesDeAnalizar\s+depto=\{confirmar\.it\}\s+uso=\{confirmar\.sin \? \{ tipo: "sin" \} : uso\}\s+rutaCompra=\{rutaCompra\(\)\}/.test(guia) || !/const uso = estado \?\? usoDesdeSaldo\(saldo\);/.test(guia)) F("5 · la guía no monta el aviso con su saldo y su compra");
  if (!/<GuiaBusqueda [^>]*\bestado=\{saldo\}/.test(leer("src/app/dashboard/page.tsx"))) F("5 · la guía del dashboard no le pasa el saldo al aviso (con cero diría «Usa 1 de tus análisis.»)");

  // ── 6 · tres análisis por $19.990 ───────────────────────────────────────────
  const tres = FLOW_PRODUCTS.tres_analisis;
  if (PRODUCTO_TRES !== "tres_analisis" || tres?.amount !== TRES_PRECIO_CLP || TRES_PRECIO_CLP !== 19_990 || tres.capacity !== TRES_CANTIDAD || TRES_CANTIDAD !== 3 || tres.kind !== "one_time") F("6 · el catálogo no cobra 3 análisis por $19.990");
  if (FLOW_PRODUCTS.pack3.amount !== 14_990) F("6 · el ticket de $14.990 cambió de precio");
  if (TRES_COPY.boton !== "3 análisis · $19.990") F("6 · el botón del pack no dice «3 análisis · $19.990»");
  if (rutaTres("semanal", { variante: "banda", volver: "/semanal?t=abc" }) !== "/checkout?product=tres_analisis&origen=semanal&variante=banda&volver=%2Fsemanal%3Ft%3Dabc") F("6 · la ruta del pack no lleva su origen y su vuelta");
  if (volverSeguro("//evil.com") !== null || volverSeguro("https://evil.com") !== null || volverSeguro("/\\evil.com") !== null || volverSeguro("/semanal?t=a") !== "/semanal?t=a") F("6 · la vuelta después de pagar acepta un sitio ajeno");
  const crear = sinComentarios(leer("src/app/api/payments/create/route.ts"));
  if (!/\[PRODUCTO_TRES\]: \{ amount: FLOW_PRODUCTS\.tres_analisis\.amount, subject: FLOW_PRODUCTS\.tres_analisis\.subject \}/.test(crear)) F("6 · payments/create no vende el pack de tres");
  if (!/if \(product === PRODUCTO_PACK && !analysisId\) \{\s*return NextResponse\.json\(\{ error: "El pack va con tu informe" \}/.test(crear) || !/if \(!ofertaPackVigente\(analysis\.created_at as string\)\)/.test(crear)) F("6 · el ticket de $14.990 se puede comprar fuera de las 24 horas del primer informe");
  if (!/if \(analysisId \|\| product !== "single"\) \{\s*quantity = 1;/.test(crear)) F("6 · el pack se puede comprar en cantidad (cobraría N × $19.990)");
  const confirmar = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/\} else if \(userId && product === PRODUCTO_TRES\) \{\s*await grantCredits\(userId, PRODUCTO_TRES, TRES_CANTIDAD, \{ paymentId, noExpire: true \}\);/.test(confirmar)) F("6 · el pago del pack no otorga 3 análisis sin caducidad");
  if (!/\(product === "single" \|\| product === PRODUCTO_PACK \|\| product === PRODUCTO_TRES\) && process\.env\.OPENFACTURA_ENABLED === "true"/.test(confirmar) || !/product === PRODUCTO_TRES \? TRES_CANTIDAD/.test(confirmar)) F("6 · el pack no emite su boleta (o con cantidad equivocada)");
  // El CHECK de payments.product: la última migración que lo arma tiene que aceptar todo producto del catálogo.
  const migraciones = readdirSync(join(RAIZ, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  const conCheck = migraciones.filter((f) => /ADD CONSTRAINT payments_product_check/i.test(leer(`supabase/migrations/${f}`)));
  const ultima = conCheck.length ? leer(`supabase/migrations/${conCheck[conCheck.length - 1]}`) : "";
  const aceptados = new Set(Array.from((ultima.match(/payments_product_check CHECK \(product IN \(([\s\S]*?)\)\);/i)?.[1] ?? "").matchAll(/'([a-z0-9_]+)'/g)).map((m) => m[1]));
  const faltan = Object.keys(FLOW_PRODUCTS).filter((k) => !aceptados.has(k));
  if (faltan.length) F(`6 · el CHECK de payments.product no acepta ${faltan.join(", ")} (el INSERT del pago fallaría)`);
  const casa = sinComentarios(leer("src/app/dashboard/casa.tsx"));
  if (!/export const RUTA_TRES_CASA = rutaTres\("dashboard", \{ volver: "\/dashboard" \}\);/.test(casa) || !/<EnlaceCarga href=\{RUTA_TRES_CASA\}[^>]*data-casa="comprar-tres">\s*\{CASA\.sin\.boton\}/.test(casa) || CASA.sin.boton !== TRES_COPY.boton) F("6 · el dashboard sin análisis no ofrece el pack de tres");
  if (SEMANAL_PAGINA.comprar !== TRES_COPY.boton || !/<EnlaceCarga href=\{rutaCompra\(\)\}/.test(lista) || /rutaSueltoSemanal|RUTA_SUELTO_INMEDIATO/.test(lista)) F("6 · la página semanal sigue ofreciendo «Analizar uno · $9.990»");
  if (!/rutaTres\(inmediato \? "inmediato" : "semanal", \{ variante: inmediato \? null : variante, volver:/.test(lista)) F("6 · la compra de la página semanal pierde su origen o su vuelta");
  const enl = enlacesSemanal("https://refranco.ai", "abc123");
  const base = { variante: "tarjetas" as const, nombre: "Ana", busca: "2 dormitorios, Ñuñoa", piePct: 20, plazoAnios: 25, deptos: [DEPTO], conRegalo: false, urlBoton: enl.boton, urlTres: enl.tres, urlBaja: enl.baja };
  const sinAnalisis = correoSemanal({ ...base, saldo: 0 }).html;
  if (enl.tres !== "https://refranco.ai/api/semanal/clic?t=abc123&ir=tres" || !sinAnalisis.includes(`${TRES_COPY.lineaCorreo.antes}<a href="${enl.tres}"`) || !sinAnalisis.includes(`>${TRES_COPY.lineaCorreo.enlace}</a>${TRES_COPY.lineaCorreo.despues}`)) F("6 · el correo semanal no le menciona el pack a quien no tiene análisis");
  if (/\$9\.990/.test(sinAnalisis)) F("6 · el correo semanal sigue ofreciendo el suelto de $9.990");
  if (correoSemanal({ ...base, saldo: 2 }).html.includes("19.990") || correoSemanal({ ...base, saldo: null }).html.includes("19.990")) F("6 · el pack se le ofrece en el correo a quien tiene análisis o plan");
  if (!/if \(ir === "tres"\) return volver\(rutaTres\(sel\.fuente === "inmediato" \? "inmediato" : "semanal", \{ variante: sel\.variante, volver: `\/semanal\?t=\$\{t\}` \}\)\);/.test(clic)) F("6 · el enlace del pack en el correo no lleva al checkout del pack");
  const checkout = sinComentarios(leer("src/app/checkout/page.tsx"));
  if ((checkout.match(/product\.oneTime && !analysisId && !esTres && \(/g) ?? []).length !== 2) F("6 · el checkout del pack muestra el selector de cantidad");
  if (!/\$\{origen \? `&origen=\$\{origen\}` : ""\}\$\{varianteCorreo \? `&variante=\$\{varianteCorreo\}` : ""\}\$\{volver \? `&volver=\$\{encodeURIComponent\(volver\)\}` : ""\}/.test(checkout)) F("6 · al pedir el código, el checkout pierde el origen o la vuelta");
  const retorno = sinComentarios(leer("src/app/payments/return/page.tsx"));
  if (!/producto === PRODUCTO_TRES\s*\? TRES_COPY\.listo/.test(retorno) || !/\{producto === PRODUCTO_TRES && volver && \(\s*<Link\s+href=\{volver\}/.test(retorno)) F("6 · después de pagar el pack no dice cuántos tiene ni vuelve adonde estaba");

  // ── 7 · «¿Cuándo piensas comprar?» arriba de la página semanal ──────────────
  const pagina = sinComentarios(leer("src/app/semanal/page.tsx"));
  if (!/const preguntarCuando = perfilPersona != null && perfilPersona\.perfil\.horizonte == null;/.test(pagina) || !/\{preguntarCuando && <PreguntaCuando \/>\}\s*<SemanalLista/.test(pagina)) F("7 · la página semanal no pregunta «¿Cuándo piensas comprar?» arriba a quien nunca contestó");
  const pregunta = sinComentarios(leer("src/app/semanal/pregunta-cuando.tsx"));
  if (!/fetch\("\/api\/perfil-busqueda", \{ method: "PUT"[^)]*body: JSON\.stringify\(\{ horizonte: h \}\) \}\)/.test(pregunta) || !/if \(res\.ok\) setListo\(true\);/.test(pregunta) || !/if \(listo\) return null;/.test(pregunta)) F("7 · contestar no guarda en el perfil o la pregunta no desaparece");
  if (sinAnalisis.includes("¿Cuándo piensas comprar?")) F("7 · la pregunta va en el correo");

  // ── 11 · renta corta, mientras tanto ────────────────────────────────────────
  if (LINEA_RENTA_CORTA !== "Estos convienen para arriendo tradicional. Para renta corta, analízalos con tu pack.") F("11 · la línea de renta corta no es la aprobada");
  const soloCorta = perfilDeBusqueda([filaDesdeInformeStr({ created_at: "2026-10-01T00:00:00Z", comuna: "Santiago", input_data: { comuna: "Santiago", dormitorios: 1, banos: 1, precioCompraUF: 3000, piePct: 20, plazoCredito: 25 } })]);
  if (!soloCorta.completo || soloCorta.modalidad !== "str" || soloCorta.precioMaxUf !== 3000 || soloCorta.comunas.join() !== "Santiago") F("11 · un informe de renta corta no le arma perfil a quien solo analizó renta corta");
  const perfilSrv = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
  if (!/if \(\(ltr \?\? \[\]\)\.length === 0 && !informes\.some\(\(f\) => f\.modalidad === "ltr"\)\) \{\s*for \(const a of str \?\? \[\]\)/.test(perfilSrv)) F("11 · los informes de renta corta no cuentan, o cuentan también para quien tiene renta larga");
  if (/perfil\.modalidad === "ltr" && rango/.test(srv) || !/await origenDePersona\(admin, userId, \{ rentaCorta \}\)/.test(srv)) F("11 · el semanal se le niega a un perfil de renta corta");
  if (!/q = q\.in\("tipo_analisis", \["long-term", "short-term"\]\)/.test(srv)) F("11 · quien solo analizó renta corta no está en la lista del semanal");
  const origen = sinComentarios(leer("src/lib/guia/guia-servidor.ts"));
  if (!/const corta = data\?\.tipo_analisis === "short-term" && !!opts\.rentaCorta;/.test(origen) || !/corta \? num\(i\.superficieUtil\) : num\(i\.superficie\), precioUF = corta \? num\(i\.precioCompraUF\) : num\(i\.precio\)/.test(origen)) F("11 · un informe de renta corta no sirve de origen (o sirve también fuera del semanal)");
  if (!/leerOrigenGuia\(admin, b\.origenId, \{ rentaCorta: typeof b\.semanal === "string" \}\)/.test(sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts")))) F("11 · «Analizar este» rechaza la selección de quien solo analizó renta corta");
  const corto = correoSemanal({ ...base, saldo: 1, rentaCorta: true }).html;
  if (!corto.includes(LINEA_RENTA_CORTA) || correoSemanal({ ...base, saldo: 1 }).html.includes(LINEA_RENTA_CORTA)) F("11 · el correo no dice que los deptos son para arriendo tradicional (o se lo dice a quien busca renta larga)");
  if (!/rentaCorta: fila\.perfil\.modalidad === "str",/.test(srv) || !/\{rentaCorta && <p className="guia-txt" data-semanal="renta-corta"><b>\{LINEA_RENTA_CORTA\}<\/b><\/p>\}/.test(lista)) F("11 · el envío o la página no dicen la línea de renta corta");

  if (fallas.length) {
    console.log(`  ✗ CORREOS-RECORRIDO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el enlace entra solo 7 días; «Analizar este» avisa antes de gastar y sin análisis ofrece el pack; el pack de tres se vende, se otorga y se factura; el «cuándo» se pregunta una vez; renta corta recibe renta larga con su línea");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runCorreosRecorridoTier().then((r) => process.exit(r.hard ? 1 : 0));
}
