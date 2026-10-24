// ============================================================================
// TIER CARGA — el estándar de carga en todo el sitio (22-oct-2026, decisión de Fabrizio tras el recorrido real).
//
//   · UN CTA QUE LLAMA AL SERVIDOR se ve ocupado hasta la respuesta: `{...botonOcupado(x)}` (lib/carga-global.ts) deja el
//     botón presionado (`data-presionado`, el estilo global) y con el aro que gira al final del texto (`aria-busy`, que
//     globals.css dibuja con ::after). Lo que no es un <button> y también espera —un chip con <select>, una línea que se
//     vuelve a pedir— lleva `{...chipOcupado(x)}` (`data-gira` le da el aro). Un botón de solo ícono (`data-solo-icono`)
//     cambia el ícono por el aro.
//   · LO QUE NAVEGA muestra la barra bajo el header: EnlaceCarga (tier AFFORDANCE), o `iniciarCarga(claveActual())` antes
//     del `router.push` / `window.location` que sigue a una respuesta del servidor.
//   · NUNCA UNA PANTALLA SIN SEÑAL: por eso el PDF que el servidor arma se pide con fetch y el botón queda ocupado
//     (lib/descarga-cliente.ts), en vez de un <a href> que no avisa nada hasta que baja.
//   El recorrido del 22-oct (lo que NO cumplía): en /deptos «Entrar», «Pedir código», «o con Google», los chips de
//   modalidad y «cuándo», «Ir a mi panel», «Sí, agregar»/«No», el reintento del alta y el alta de la vuelta por el enlace;
//   en «Estás dentro» los chips y el «cuándo» (también después de pagar); en el dashboard el perfil de la casa, la
//   bienvenida y sus chips, «Usar nombre» de la invitación, el PDF de las filas y el borrado del informe; en el informe
//   «Analizar este» sin la barra al abrir, el PDF del menú de compartir y «Invita a alguien» mientras carga; en la compra
//   «Pagar» mientras manda o verifica el código, «mándalo de nuevo» y Google (también en /entrar y en el registro del
//   informe); «Entrar con otro correo» en la vuelta. Verificado EN ROJO contra el código de hoy y por mutación (acta al
//   pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/carga-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
type CargaMod = typeof import("../../../src/lib/carga-global");
type DescargaMod = typeof import("../../../src/lib/descarga-cliente");

/** Las etiquetas de apertura (<button …>, <Button …>, <label …>, <p …>) que preceden a cada aparición del marcador: se
 *  cierra en el primer `>` fuera de llaves que no sea el de una flecha (los onClick llevan `=>` y `{}` adentro). */
function etiquetasCon(src: string, marcador: string): string[] {
  const out: string[] = [];
  let desde = 0;
  for (;;) {
    const i = src.indexOf(marcador, desde);
    if (i < 0) return out;
    desde = i + marcador.length;
    const ini = Math.max(src.lastIndexOf("<button", i), src.lastIndexOf("<Button", i), src.lastIndexOf("<label", i), src.lastIndexOf("<p ", i));
    if (ini < 0) { out.push(""); continue; }
    let prof = 0;
    let fin = -1;
    for (let k = ini + 1; k < src.length; k++) {
      const c = src[k];
      if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0 && src[k - 1] !== "=") { fin = k; break; }
    }
    out.push(fin < 0 ? "" : src.slice(ini, fin + 1));
  }
}

/** [archivo, marcador que identifica al botón, qué es, cuántos tiene que haber] */
const BOTONES: Array<[string, string, string, number?]> = [
  ["src/app/deptos/deptos-cliente.tsx", 'data-deptos="entrar"', "/deptos · «Entrar»"],
  ["src/app/deptos/deptos-cliente.tsx", "{ALTA_COPY.pedir}</button>", "/deptos · «Pedir código»"],
  // ⚠ ACTA (23-oct-2026, goal «puerta B, parte 1», mockups 1b y 2) · /deptos ya no pregunta la modalidad ni el «cuándo» (van al
  // perfil del dashboard) ni tiene «Listo» de «Buscas» (el perfil se edita en el dashboard); «Ir a mi dashboard» es un EnlaceCarga
  // (§4). «o con Google» pasó a «Entrar con Google», el mismo botón.
  ["src/app/deptos/deptos-cliente.tsx", "onClick={() => void conGoogle()}", "/deptos · «Entrar con Google»"],
  ["src/app/deptos/deptos-cliente.tsx", "{ALTA_COPY.agregarSi}</button>", "/deptos · «Sí, agregar»"],
  ["src/app/deptos/deptos-cliente.tsx", "{ALTA_COPY.agregarNo}</button>", "/deptos · «No» de agregar"],
  ["src/app/deptos/deptos-cliente.tsx", "{ENTRAR_COPY.noPudimos}</button>", "/deptos · el reintento del alta"],
  ["src/components/lo-que-sigue/EstasDentro.tsx", "onClick={() => elegir(h.id)}", "«Estás dentro» · el «cuándo»"],
  ["src/components/lo-que-sigue/HorizontePostPago.tsx", "onClick={() => elegir(h.id)}", "después de pagar · el «cuándo»"],
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · el perfil de la casa se guarda entero con «Guardar» (el que se ve ocupado); las dos preguntas
  // son botones con aria-pressed, sin aro propio; la modalidad, el pie y el plazo dejaron de ser chips con autosave.
  ["src/app/dashboard/casa.tsx", "onClick={() => void guardarTodo()}", "la casa · «Guardar» del perfil"],
  ["src/app/dashboard/bienvenida.tsx", 'data-bienvenida="accion"', "la bienvenida · el botón"],
  ["src/components/guia/GuiaBusqueda.tsx", "onClick={() => abrir(it)}", "la guía · «Analizar este»"],
  ["src/components/deptos/PrimeraSeleccion.tsx", 'data-primera="analizar"', "la primera selección · «Analizar este»"],
  ["src/components/deptos/PrimeraSeleccion.tsx", "{PRIMERA_SELECCION.armar}</button>", "la primera selección · armar"],
  ["src/app/semanal/semanal-lista.tsx", "onClick={() => { setError(null); setPopup(null); setConfirmar({ it, sin: false }); }}", "la página semanal · «Analizar este»"],
  ["src/components/formulario-v4/ModalPlausibilidad.tsx", 'className="wz-cta wz-cta-modal"', "el modal de confirmar · el principal"],
  ["src/components/guia/InformeDeAviso.tsx", "onClick={() => void quieroVerlo()}", "el informe · «Quiero verlo»"],
  ["src/components/invitacion/InvitaAlguien.tsx", "{REFERIDO_COPY.usarNombre}</button>", "la invitación · «Usar nombre»", 2],
  ["src/components/lo-que-sigue/TicketPack.tsx", "{TICKET_PACK.boton(precio)}</button>", "el ticket · pagar"],
  ["src/app/checkout/compra-cliente.tsx", "{botonPagar}", "la compra · «Pagar» (con sesión y con el código)", 2],
  ["src/app/checkout/compra-cliente.tsx", "{COMPRA.mandarDeNuevo}</button>", "la compra · «mándalo de nuevo»"],
  ["src/app/checkout/compra-cliente.tsx", "{COMPRA.pagar(product.precio)}", "la compra · «Pagar» que manda el código"],
  ["src/app/checkout/compra-cliente.tsx", 'data-compra="google"', "la compra · Google"],
  ["src/app/checkout/compra-cliente.tsx", "onClick={otraCuenta}", "la compra · «¿No es tu correo?»"],
  ["src/components/entrar/EntrarConCodigo.tsx", "{ENTRAR.entrar}</button>", "/entrar · «Entrar»"],
  ["src/components/entrar/EntrarConCodigo.tsx", "{ENTRAR.mandarDeNuevo}</button>", "/entrar · «mándalo de nuevo»"],
  ["src/components/entrar/EntrarConCodigo.tsx", "{ENTRAR.mandarCodigo}</button>", "/entrar · «Mandar código»"],
  ["src/components/entrar/EntrarConCodigo.tsx", "onClick={e.conGoogle}", "/entrar · Google"],
  ["src/components/guia/RegistroEnTarjeta.tsx", "{GUIA.entrarYAnalizar}</button>", "la tarjeta de la guía · «Entrar y analizar»"],
  ["src/components/guia/RegistroEnTarjeta.tsx", "{REGISTRO_UN_PASO.mandarCodigo}</button>", "la tarjeta de la guía · «Mandar código»"],
  ["src/components/lo-que-sigue/RegistroUnPaso.tsx", "{REGISTRO_UN_PASO.entrar}</button>", "el registro del informe · «Entrar»"],
  ["src/components/lo-que-sigue/RegistroUnPaso.tsx", "{REGISTRO_UN_PASO.mandarCodigo}</button>", "el registro del informe · «Mandar código»"],
  ["src/components/lo-que-sigue/RegistroUnPaso.tsx", "onClick={conGoogle}", "el registro del informe · Google"],
  ["src/app/payments/return/page.tsx", "onClick={entrarConOtroCorreo}", "la vuelta del pago · «Entrar con otro correo»"],
  ["src/app/dashboard/row-actions.tsx", "onClick={descargarPdf}", "las filas del dashboard · el PDF", 2],
  ["src/app/dashboard/row-actions.tsx", "onClick={eliminar}", "las filas del dashboard · eliminar", 2],
  ["src/components/chrome/ShareButton.tsx", "onClick={() => void downloadPDF()}", "compartir · «Descargar PDF»"],
  ["src/components/chrome/ShareButton.tsx", "onClick={() => void invitar()}", "compartir · «Invita a alguien» mientras llega el enlace"],
  ["src/app/analisis/[id]/delete-button.tsx", "onClick={handleDelete}", "el informe · eliminar"],
];

/** Lo que no es un botón y espera: lleva chipOcupado. */
const CHIPS: Array<[string, string, string, number?]> = [
  ["src/components/lo-que-sigue/EstasDentro.tsx", 'aria-label="Tipología"', "«Estás dentro» · tipología"],
  ["src/components/lo-que-sigue/EstasDentro.tsx", 'aria-label="Comuna"', "«Estás dentro» · comuna"],
  ["src/components/lo-que-sigue/EstasDentro.tsx", 'aria-label="Modalidad"', "«Estás dentro» · modalidad"],
  // ⚠ ACTA (23-oct-2026, goal «puerta B, parte 1») · la comuna, los dormitorios y el rango del perfil de la casa se editan con los
  // tres campos de /deptos (CamposBusqueda): el nombre del campo que se guarda lleva el aro (`ocupado`, que la casa deriva de
  // `guardando`, §3). Se fueron «+ dormitorios», «+ comuna», el rango y el tope como chips.
  ["src/components/deptos/CamposBusqueda.tsx", "{DEPTOS_COPY.comuna}</label>", "los tres campos · la comuna"],
  ["src/components/deptos/CamposBusqueda.tsx", "{DEPTOS_COPY.tipologia}</label>", "los tres campos · la tipología"],
  ["src/components/deptos/CamposBusqueda.tsx", "{DEPTOS_COPY.rango}</label>", "los tres campos · el rango"],
  ["src/app/dashboard/bienvenida.tsx", '{pref.tipologia || "Tipología"}', "la bienvenida · tipología"],
  ["src/app/dashboard/bienvenida.tsx", '{pref.comuna || "Comuna"}', "la bienvenida · comuna"],
  ["src/app/dashboard/bienvenida.tsx", "{ESTAS_DENTRO.modalidad[pref.modalidad]}", "la bienvenida · modalidad"],
  ["src/components/invitacion/InvitaAlguien.tsx", 'data-invitar="enlace"', "la invitación · el enlace mientras se rehace", 2],
];

/** Los archivos auditados: en ellos el presionado no se escribe a mano (lo escribe el helper), y cuántas navegaciones
 *  por código tiene cada uno (una nueva sin la barra pone esto en rojo a propósito). */
const AUDITADOS: Array<[string, number]> = [
  ["src/app/deptos/deptos-cliente.tsx", 2],
  ["src/components/deptos/CamposBusqueda.tsx", 0],
  ["src/components/guia/AvisoAntesDeAnalizar.tsx", 1],
  ["src/components/lo-que-sigue/EstasDentro.tsx", 0],
  ["src/components/lo-que-sigue/HorizontePostPago.tsx", 0],
  ["src/app/dashboard/casa.tsx", 0],
  ["src/app/dashboard/bienvenida.tsx", 1],
  ["src/components/guia/GuiaBusqueda.tsx", 1],
  ["src/components/deptos/PrimeraSeleccion.tsx", 1],
  ["src/app/semanal/semanal-lista.tsx", 1],
  ["src/components/formulario-v4/ModalPlausibilidad.tsx", 0],
  ["src/components/guia/InformeDeAviso.tsx", 0],
  ["src/components/invitacion/InvitaAlguien.tsx", 0],
  ["src/components/lo-que-sigue/TicketPack.tsx", 1],
  ["src/app/checkout/compra-cliente.tsx", 2],
  ["src/components/entrar/EntrarConCodigo.tsx", 1],
  ["src/components/guia/RegistroEnTarjeta.tsx", 0],
  ["src/components/lo-que-sigue/RegistroUnPaso.tsx", 0],
  ["src/app/analisis/[id]/delete-button.tsx", 1],
];

export function runCargaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CARGA (el botón que llama al servidor gira; lo que navega enciende la barra; nunca una pantalla sin señal · 0 tokens) ───");

  // ── 1 · el estándar ──
  const carga = cargar<CargaMod>("src/lib/carga-global.ts");
  if (!carga?.botonOcupado || !carga.chipOcupado) F("1 · faltan botonOcupado / chipOcupado en lib/carga-global.ts");
  else {
    const on = carga.botonOcupado(true), off = carga.botonOcupado(false);
    if (on["aria-busy"] !== true || on["data-presionado"] !== "1") F(`1 · botonOcupado(true) no es ocupado y presionado: ${JSON.stringify(on)}`);
    if (off["aria-busy"] !== undefined || off["data-presionado"] !== undefined) F(`1 · botonOcupado(false) deja marcas: ${JSON.stringify(off)}`);
    const chip = carga.chipOcupado(true);
    if (chip["aria-busy"] !== true || chip["data-presionado"] !== "1" || chip["data-gira"] !== "") F(`1 · chipOcupado(true) no es el botón más data-gira: ${JSON.stringify(chip)}`);
    const html = renderToStaticMarkup(createElement("button", { type: "button", ...carga.botonOcupado(true) }, "Pagar"));
    if (html !== '<button type="button" aria-busy="true" data-presionado="1">Pagar</button>') F(`1 · el botón ocupado no se dibuja con aria-busy y data-presionado: ${html}`);
    if (renderToStaticMarkup(createElement("button", { type: "button", ...carga.botonOcupado(false) }, "Pagar")) !== '<button type="button">Pagar</button>') F("1 · el botón libre lleva marcas");
    if (!/aria-busy="true" data-presionado="1" data-gira=""/.test(renderToStaticMarkup(createElement("label", carga.chipOcupado(true), "x")))) F("1 · el chip ocupado no se dibuja con data-gira");
  }
  const css = leer("src/app/globals.css");
  if (!/button\[aria-busy="true"\]::after, \[data-gira\]\[aria-busy="true"\]::after \{ content: ""; display: inline-block;[^}]*border: 2px solid currentColor; border-right-color: transparent; animation: franco-gira [\d.]+s linear infinite; \}/.test(css)) F("1 · globals.css no dibuja el aro en el botón ocupado (ni en lo que lleva data-gira)");
  if (!/@keyframes franco-gira \{ to \{ transform: rotate\(360deg\); \} \}/.test(css)) F("1 · el aro no gira (falta @keyframes franco-gira)");
  if (!/button\[aria-busy="true"\]\[data-solo-icono\] > svg \{ display: none; \}/.test(css) || !/button\[aria-busy="true"\]\[data-solo-icono\]::after \{ margin-left: 0; \}/.test(css)) F("1 · en el botón de solo ícono el aro no reemplaza al ícono");
  if (!/@media \(prefers-reduced-motion: reduce\) \{ button\[aria-busy="true"\]::after, \[data-gira\]\[aria-busy="true"\]::after \{ animation-duration: [\d.]+s; \} \}/.test(css)) F("1 · el aro no respeta prefers-reduced-motion");
  if (!/\[data-presionado="1"\] \{ opacity: 0\.72;/.test(css)) F("1 · el estado presionado perdió su estilo global");

  // ── 2 · los botones que llaman al servidor ──
  for (const [archivo, marcador, que, n = 1] of BOTONES) {
    const tags = etiquetasCon(codigo(archivo), marcador);
    if (tags.length !== n) { F(`2 · ${que}: ${tags.length} botón(es) con «${marcador.slice(0, 40)}» (esperaba ${n})`); continue; }
    for (const t of tags) if (!/\{\.\.\.botonOcupado\(/.test(t)) F(`2 · ${que} no se ve ocupado mientras espera al servidor (falta {...botonOcupado(…)}): ${t.slice(0, 120)}`);
  }

  // ── 3 · lo que no es un botón y también espera ──
  for (const [archivo, marcador, que, n = 1] of CHIPS) {
    const tags = etiquetasCon(codigo(archivo), marcador);
    if (tags.length !== n) { F(`3 · ${que}: ${tags.length} elemento(s) con «${marcador.slice(0, 40)}» (esperaba ${n})`); continue; }
    for (const t of tags) if (!/\{\.\.\.chipOcupado\(/.test(t)) F(`3 · ${que} no se ve guardándose (falta {...chipOcupado(…)}): ${t.slice(0, 120)}`);
  }
  // El estado que gobierna a cada chip lo pone y lo saca quien llama al servidor.
  const dentro = codigo("src/components/lo-que-sigue/EstasDentro.tsx");
  if (!/setGuardando\(campo\);\s*const ok = await guardar\(ctx\.analysisId, \{ \[campo\]: valor \}\);\s*setGuardando\(null\);/.test(dentro) || !/setGuardando\("horizonte"\);\s*const ok = await guardar\(ctx\.analysisId, \{ horizonte: h \}\);\s*setGuardando\(null\);/.test(dentro)) F("3 · «Estás dentro» no marca el chip que se guarda alrededor del fetch");
  const casa = codigo("src/app/dashboard/casa.tsx");
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · «Guardar» se marca ocupado alrededor del único PUT del perfil.
  if (!/setEstado\("guardando"\);\s*const ok = await guardar\(cambios\);\s*if \(!ok\) \{ setEstado\("error"\); return; \}/.test(casa)) F("3 · el perfil de la casa no marca «Guardar» alrededor del fetch");
  const bienvenida = codigo("src/app/dashboard/bienvenida.tsx");
  if (!/setGuardando\(campo\);\s*setError\(!\(await guardar\(perfil\.analysisId, \{ \[campo\]: valor \}\)\)\);\s*setGuardando\(null\);/.test(bienvenida)) F("3 · los chips de la bienvenida no marcan el que se guarda");
  const deptos = codigo("src/app/deptos/deptos-cliente.tsx");
  // ⚠ ACTA (23-oct-2026) · los tres campos del perfil de la casa: el que se guarda se marca con `ocupado`, derivado del mismo
  // `guardando` que marcan los chips, y el componente lo pone en el nombre del campo (chipOcupado).
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockups 3b y 4) · los tres campos ya no se guardan solos: el ocupado es «Guardar»; los campos no llevan aro.
  if (/ocupado=\{campoOcupado\}|campoOcupado/.test(casa) || !/<CamposBusqueda multiple [^>]*onChange=\{cambiarCampo\} ids="casa" \/>/.test(casa)) F("3 · los tres campos del perfil de la casa volvieron a guardarse solos");
  const campos = codigo("src/components/deptos/CamposBusqueda.tsx");
  if (!/\{\.\.\.chipOcupado\(ocupado === "comuna"\)\}/.test(campos) || !/\{\.\.\.chipOcupado\(ocupado === "tipologia"\)\}/.test(campos) || !/\{\.\.\.chipOcupado\(ocupado === "rango"\)\}/.test(campos)) F("3 · los tres campos no marcan el que se guarda con su nombre");
  const post = codigo("src/components/lo-que-sigue/HorizontePostPago.tsx");
  if (!/setGuardando\(true\);\s*capturarLqs\([^\n]*\n\s*try \{/.test(post) || !/\} finally \{\s*setGuardando\(false\);\s*\}/.test(post)) F("3 · el «cuándo» de después de pagar no marca el chip mientras guarda");

  // ── 4 · lo que navega después del servidor enciende la barra ──
  const cuenta = (s: string, re: RegExp) => (s.match(re) ?? []).length;
  // ⚠ ACTA (23-oct-2026, mockup 2) · «Ir a mi dashboard» es un enlace (EnlaceCarga: la barra la enciende él); quedan dos idas por
  // código: el alta de una cuenta existente sin comunas nuevas y «Sí, agregar»/«No».
  if (cuenta(deptos, /router\.push\("\/dashboard"\)/g) !== 2 || cuenta(deptos, /iniciarCarga\(claveActual\(\)\);\s*router\.push\("\/dashboard"\);/g) !== 2) F("4 · en /deptos alguna ida al dashboard (el alta, sumar comunas) no enciende la barra");
  if (!/<EnlaceCarga href=\{ESTAS_DENTRO_DEPTOS\.hrefDashboard\} className="dp-boton-contorno" data-deptos="ir-panel">/.test(deptos)) F("4 · «Ir a mi dashboard» no es un EnlaceCarga (se iría sin la barra)");
  if (!/setAltaEnCurso\(true\);\s*const soltar = iniciarCarga\(claveActual\(\)\);\s*try \{/.test(deptos) || !/\} finally \{\s*soltar\(\);\s*setAltaEnCurso\(false\);\s*\}/.test(deptos)) F("4 · el alta de la vuelta por el enlace o por Google no enciende la barra mientras corre (ni la suelta)");
  if (!/setYendo\(si \? "si" : "no"\);/.test(deptos)) F("4 · «Sí, agregar» no se marca yéndose");
  const guia = codigo("src/components/guia/GuiaBusqueda.tsx");
  if (!/setGenerando\(it\.avisoId\);\s*const soltar = iniciarCarga\(claveActual\(\)\);/.test(guia) || !/abrio = true;\s*router\.push\(`\/analisis\/\$\{d\.id\}`\);/.test(guia) || !/\} finally \{\s*if \(!abrio\) soltar\(\);\s*\}/.test(guia)) F("4 · «Analizar este» de la guía no enciende la barra hasta abrir el informe (o no la suelta si no abre)");
  if (!/const soltar = iniciarCarga\(claveActual\(\)\);/.test(codigo("src/components/deptos/PrimeraSeleccion.tsx"))) F("4 · «Analizar este» de la primera selección no enciende la barra");
  if (!/iniciarCarga\(claveActual\(\)\);\s*router\.push\(href\);/.test(bienvenida)) F("4 · el botón de la bienvenida no enciende la barra al irse al wizard");
  if (!/iniciarCarga\(claveActual\(\)\);\s*router\.push\(e\.destino\);/.test(codigo("src/components/entrar/EntrarConCodigo.tsx"))) F("4 · /entrar no enciende la barra al irse a su destino");
  if (!/iniciarCarga\(claveActual\(\)\);\s*router\.push\("\/dashboard"\);/.test(codigo("src/app/analisis/[id]/delete-button.tsx"))) F("4 · eliminar el informe no enciende la barra al irse al dashboard");
  if (!/iniciarCarga\(claveActual\(\)\);\s*window\.location\.href = data\.url;/.test(codigo("src/components/lo-que-sigue/TicketPack.tsx"))) F("4 · el ticket no enciende la barra al irse a Flow");
  if (!/iniciarCarga\(claveActual\(\)\);\s*window\.location\.assign\(hrefEntrar\(volverAca, "pack"\)\);/.test(codigo("src/app/payments/return/page.tsx"))) F("4 · «Entrar con otro correo» no enciende la barra al irse");
  const compra = codigo("src/app/checkout/compra-cliente.tsx");
  if (!/const soltar = iniciarCarga\(claveActual\(\)\);/.test(compra) || !/setSaliendo\(true\);[\s\S]{0,120}iniciarCarga\(claveActual\(\)\);\s*window\.location\.assign\(urlCompra\(estaCompra\)\);/.test(compra)) F("4 · la compra no enciende la barra al pedir el pago o al cambiar de cuenta");
  for (const [archivo, n] of AUDITADOS) {
    const s = codigo(archivo);
    const idas = cuenta(s, /router\.push\(|window\.location\.href = |window\.location\.assign\(/g);
    if (idas !== n) F(`4 · ${archivo} tiene ${idas} navegación(es) por código y el tier conoce ${n}: si es nueva, va con iniciarCarga(claveActual()) antes y se suma acá`);
    if (/data-presionado=\{/.test(s)) F(`4 · ${archivo} escribe data-presionado a mano: va por botonOcupado/chipOcupado`);
  }

  // ── 5 · lo que se retiró o se cambió por el estándar ──
  const qv = codigo("src/components/guia/InformeDeAviso.tsx");
  if (/qv-gira/.test(qv) || /\.qv-gira \{/.test(leer("src/components/guia/guia.css"))) F("5 · «Quiero verlo» sigue con su propio aro (qv-gira) en vez del global");
  const modal = codigo("src/components/formulario-v4/ModalPlausibilidad.tsx");
  if (/Loader2/.test(modal) || !/\{submitting \? labelGenerando : labelConfirmar\}/.test(modal)) F("5 · el modal de confirmar sigue con Loader2 en vez del aro global");
  const filas = codigo("src/app/dashboard/row-actions.tsx");
  if (/href=\{hrefPdf\}/.test(filas) || cuenta(filas, /descargarArchivo\(hrefPdf\)/g) !== 1 || !/if \(!\(await descargarArchivo\(hrefPdf\)\)\) window\.location\.assign\(hrefPdf\);/.test(filas)) F("5 · el PDF de las filas sigue siendo un <a href> sin señal (o no cae a la URL si falla)");
  if (cuenta(filas, /data-solo-icono/g) !== 2) F("5 · los botones de solo ícono de la fila (PDF, eliminar) no cambian el ícono por el aro");
  const share = codigo("src/components/chrome/ShareButton.tsx");
  if (/window\.location\.href = pdfUrl/.test(share) || !/if \(!\(await descargarArchivo\(pdfUrl\)\)\) window\.location\.assign\(pdfUrl\);/.test(share) || !/\} finally \{\s*setDescargando\(false\);\s*setOpen\(false\);\s*\}/.test(share)) F("5 · «Descargar PDF» del menú sigue navegando sin señal (o no suelta el botón)");
  const hook = codigo("src/components/entrar/useEntradaPorCodigo.ts");
  if (!/useState<"enviar" \| "reenviar" \| "verificar" \| "google" \| null>\(null\)/.test(hook) || !/const ocupado = ocupadoEn !== null;/.test(hook)) F("5 · la entrada por código no dice QUÉ está esperando (ocupadoEn)");
  for (const [accion, ancla] of [["enviar", /setOcupadoEn\("enviar"\);\s*const ok = await mandar\(c\);\s*setOcupadoEn\(null\);/], ["reenviar", /setOcupadoEn\("reenviar"\);\s*const ok = await mandar\(enviado\);\s*setOcupadoEn\(null\);/], ["verificar", /setOcupadoEn\("verificar"\);\s*const \{ data, error: err \} = await createClient\(\)\.auth\.verifyOtp\(/], ["google", /setOcupadoEn\("google"\);\s*marcarOAuthPendiente\("login"\);\s*const \{ error: err \} = await createClient\(\)\.auth\.signInWithOAuth\([^\n]*\n[^\n]*\n\s*if \(err\) \{ setOcupadoEn\(null\);/]] as const) {
    if (!ancla.test(hook)) F(`5 · la entrada por código no marca «${accion}» alrededor de su espera`);
  }
  if (!/ocupado, ocupadoEn, setOcupado,/.test(hook)) F("5 · el hook no expone ocupadoEn");
  const unPaso = codigo("src/components/lo-que-sigue/RegistroUnPaso.tsx");
  if (!/setConGoogleEnCurso\(true\);/.test(unPaso) || !/if \(err\) setConGoogleEnCurso\(false\);/.test(unPaso)) F("5 · «o con Google» del registro del informe no queda ocupado hasta redirigir (o no vuelve si falla)");

  // ── 6 · la descarga con señal ──
  const descarga = cargar<DescargaMod>("src/lib/descarga-cliente.ts");
  if (!descarga?.descargarArchivo || !descarga.nombreDeDisposition) F("6 · falta lib/descarga-cliente.ts");
  else {
    const n = descarga.nombreDeDisposition;
    if (n('attachment; filename="franco-Providencia-a1b2c3d4.pdf"', "x.pdf") !== "franco-Providencia-a1b2c3d4.pdf") F("6 · no lee el nombre del Content-Disposition");
    if (n("attachment; filename=franco.pdf", "x.pdf") !== "franco.pdf") F("6 · no lee el nombre sin comillas");
    if (n(null, "x.pdf") !== "x.pdf" || n("inline", "x.pdf") !== "x.pdf") F("6 · sin nombre no cae al de reserva");
    if (n("attachment; filename*=UTF-8''franco%20renta.pdf", "x.pdf") !== "franco renta.pdf") F("6 · no decodifica filename*");
  }

  if (fallas.length) {
    console.log(`  ✗ CARGA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${BOTONES.length} botones que llaman al servidor giran, ${CHIPS.length} chips se ven guardándose, toda ida por código tras el servidor enciende la barra, el PDF se pide con señal`);
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD fa71c3ba, los 24 archivos de src/ del punto 8 de vuelta a HEAD
// y descarga-cliente.ts apartado): 100 fallas —sin el helper ni el aro, 40 botones y 14 chips sin señal, 10 idas sin la
// barra, 7 archivos con el presionado a mano, el PDF por <a href>, la entrada por código sin saber qué espera—. Y 12
// mutaciones, cada una restaurada byte a byte, todas ROJAS: C1 el helper sin aria-busy · C2 el aro no gira · C3 «Entrar»
// de /deptos sin el estándar · C4 un chip de «Estás dentro» sin chipOcupado · C5 «Ir a mi panel» sin la barra · C6 la guía
// suelta la barra antes de abrir · C7 el PDF de la fila vuelve a <a href> · C8 Google sin marcar en la entrada por código ·
// C9 el modal de confirmar sin el estándar · C10 «¿No es tu correo?» sin la barra · C11 la descarga ignora el nombre del
// servidor · C12 el perfil de la casa no suelta el chip. Reescritos con su acta: AFFORDANCE §3 (checkout), ENTRADA-ALTA §1
// (dos botones), GUIA-BUSQUEDA §14 (el aro global), PUERTA-B-RECORRIDO §1·2 (las idas con la barra), RETIRO-IA §4 (el PDF
// es un botón), CASA §10 (invitar ocupado), PAGO-SIN-SESION §3 (otro correo con señal).
// ACTA (23-oct-2026, goal «puerta B, parte 1»). /deptos perdió los chips de modalidad y «cuándo» y «Listo» (van al perfil del
// dashboard, parte 2); «Ir a mi dashboard» es un EnlaceCarga (2 idas por código en vez de 3); los tres campos (CamposBusqueda)
// reemplazan en la casa a «+ dormitorios», «+ comuna», el rango y el tope, y marcan con el aro el nombre del campo que se
// guarda; AvisoAntesDeAnalizar entra a los auditados con su única ida (comprar). Mutaciones, todas ROJAS: D1 un campo sin
// chipOcupado · D2 la casa sin `ocupado` · D3 «Ir a mi dashboard» como <a> sin EnlaceCarga.

if (require.main === module) {
  process.exit(runCargaTier().hard ? 1 : 0);
}
