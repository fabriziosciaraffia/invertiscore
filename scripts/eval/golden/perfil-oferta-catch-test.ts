/**
 * TIER PERFIL-OFERTA (26-oct-2026, 0 tokens, sin red ni base) · tres arreglos del perfil de búsqueda, del reporte del 26-oct:
 *
 *   §1 · EL RANGO INFERIDO ES UN CHIP DE /deptos: el que contiene el precio analizado (hasta 3.000, 3.000 a 4.000, 4.000 a
 *        6.000, más de 6.000), igual que lo elige una persona en B. Un precio redondo y uno no redondo del mismo chip dan el
 *        mismo rango, y el semanal busca ese rango sin holgura (hasta el 26-oct, con un precio redondo buscaba desde UF 0).
 *   §2 · SIN OFERTA, DICHO ARRIBA DE LA SELECCIÓN: con sus números no conviene ninguno en sus comunas → «Con tu búsqueda no
 *        hay deptos que convengan esta semana. Con pie 30 %, 14 sí. En Santiago, 810.» y un botón por salida.
 *   §4 · LA TERCERA SALIDA (27-oct-2026): el chip de precio de abajo cuando ahí conviene más de 10 —el caso de Santiago 1D a
 *        UF 3.200: «Hasta UF 3.000, 810 sí.»—; las salidas de mayor a menor, solo la primera con «sí»; el mismo cálculo en el
 *        correo vacío, con un botón por salida.
 *   §3 · DATOS SUCIOS: la inferencia descarta precios fuera de UF 500 a 50.000; «D · orgánico» solo para cuentas creadas
 *        desde el 15-oct-2026, las anteriores quedan «antes de las puertas» (la ruta y la RPC, con el mismo instante).
 *
 * Verificado en rojo por mutación (acta en el commit).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MANUAL_VACIO, perfilDeBusqueda, PRECIO_INFERIBLE_MAX_UF, PRECIO_INFERIBLE_MIN_UF, rangoDelPrecio, validarCambiosPerfil, type FilaPerfilInforme } from "../../../src/lib/perfil-busqueda";
import { ajusteDeParametro, parametroDeAjuste, perfilConAjuste, rangoSemanal } from "../../../src/lib/guia/semanal";
import { correoSemanalVacio, textoBusca } from "../../../src/lib/email/correo-semanal";
import { filtrosDePerfil } from "../../../src/lib/explorar/explorar";
import { avisoSinOferta, cambiosDeAjuste, chipDeAbajo, lineaDeSalidas, MINIMO_SALIDA_PRECIO, queCambio, SIN_OFERTA } from "../../../src/lib/casa/sin-oferta";
import { ANTES_DE_LAS_PUERTAS, esAntesDeLasPuertas, etiquetaPuerta, INICIO_PUERTAS, puertaAdmitida } from "../../../src/lib/atribucion-puerta";
import type { ConteoComuna } from "../../../src/lib/deptos/respuesta";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const fila = (presupuestoUf: number | null, extra: Partial<FilaPerfilInforme> = {}): FilaPerfilInforme => ({
  creadoAt: "2026-10-01T00:00:00Z", tipologia: "1D1B", comuna: "Santiago", modalidad: "ltr", presupuestoUf, piePct: 20, plazoAnios: 25,
  prefTipologia: null, prefComuna: null, prefModalidad: null, horizonte: null, ...extra,
});
const conteo = (comuna: string, total: number, comprar20: number, comprar30: number): ConteoComuna => ({ comuna, total, comprar20, comprar30 });

export function runPerfilOfertaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PERFIL-OFERTA (el rango por chip, el aviso sin oferta, los datos sucios y la puerta D · 0 tokens) ───");
  try {
    // ── §1 · el rango inferido es un chip ──
    {
      const redondo = perfilDeBusqueda([fila(3200)]);
      const noRedondo = perfilDeBusqueda([fila(3157)]);
      for (const [nombre, p] of [["redondo (UF 3.200)", redondo], ["no redondo (UF 3.157)", noRedondo]] as const) {
        if (p.precioMinUf !== 3000 || p.precioMaxUf !== 4000 || !p.completo) F(`1 · un precio ${nombre} no da el chip UF 3.000 a 4.000: ${p.precioMinUf}–${p.precioMaxUf}`);
        const r = rangoSemanal(p);
        if (!r || r.ufMin !== 3000 || r.ufMax !== 4000) F(`1 · el semanal no busca el chip tal cual con un precio ${nombre}: ${JSON.stringify(r)}`);
        if (p.editado.length !== 0) F(`1 · el chip inferido se marca como editado a mano (${nombre})`);
      }
      // El borde va al chip de abajo (deptos_conteo busca con `between`): UF 3.000 es «hasta UF 3.000».
      const borde = perfilDeBusqueda([fila(3000)]);
      if (borde.precioMinUf !== null || borde.precioMaxUf !== 3000 || JSON.stringify(rangoSemanal(borde)) !== '{"ufMin":0,"ufMax":3000}') F(`1 · UF 3.000 no cae en «hasta UF 3.000»: ${borde.precioMinUf}–${borde.precioMaxUf}`);
      if (rangoDelPrecio(4000).id !== "3000-4000" || rangoDelPrecio(4001).id !== "4000-6000" || rangoDelPrecio(6500).id !== "6000-mas" || rangoDelPrecio(1200).id !== "hasta-3000") F("1 · rangoDelPrecio no elige el chip que contiene el precio");
      // Varios informes: del chip del más barato al del más caro.
      const varios = perfilDeBusqueda([fila(2500), fila(5100, { creadoAt: "2026-10-05T00:00:00Z" })]);
      if (varios.precioMinUf !== null || varios.precioMaxUf !== 6000) F(`1 · con varios informes el rango no va del chip del más barato al del más caro: ${varios.precioMinUf}–${varios.precioMaxUf}`);
      // Sin holgura: el piso del perfil es el del semanal.
      const sinHolgura = rangoSemanal({ precioMinUf: 3000, precioMaxUf: 4500 });
      if (!sinHolgura || sinHolgura.ufMin !== 3000) F(`1 · el semanal todavía baja el piso: ${JSON.stringify(sinHolgura)}`);
      // Lo editado manda entero: un tope a mano sin piso busca desde cero, aunque los informes digan otro chip.
      const aMano = perfilDeBusqueda([fila(3200)], { ...MANUAL_VACIO, precioMaxUf: 2500 });
      if (aMano.precioMaxUf !== 2500 || aMano.precioMinUf !== null || rangoSemanal(aMano)?.ufMin !== 0) F(`1 · un tope elegido a mano conserva el piso de los informes: ${aMano.precioMinUf}–${aMano.precioMaxUf}`);
      const aManoRango = perfilDeBusqueda([fila(3200)], { ...MANUAL_VACIO, precioMaxUf: 6000, precioMinUf: 4000 });
      if (aManoRango.precioMinUf !== 4000 || aManoRango.precioMaxUf !== 6000) F("1 · el rango elegido a mano no manda sobre el chip inferido");
      // Lo que se lee: el correo, el dashboard y Explorar dicen el chip.
      if (textoBusca({ dormitorios: [1], comunas: ["Santiago"], precioMinUf: noRedondo.precioMinUf, precioMaxUf: noRedondo.precioMaxUf }) !== "1 dormitorio, Santiago, entre UF 3.000 y 4.000") F("1 · el correo no dice el chip inferido");
      const caro = perfilDeBusqueda([fila(6500)]);
      if (textoBusca({ dormitorios: [1], comunas: ["Santiago"], precioMinUf: caro.precioMinUf, precioMaxUf: caro.precioMaxUf }) !== "1 dormitorio, Santiago, sobre UF 6.000") F("1 · el correo dice «entre UF 6.000 y 60.000» en vez del chip");
      if (filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [1], precioMinUf: 3000, precioMaxUf: 4000, piePct: 20, plazoAnios: 25, editado: [] })?.ufMin !== 3000) F("1 · Explorar abre el perfil inferido desde UF 0");
      for (const ruta of ["src/app/dashboard/page.tsx", "src/app/cuenta/page.tsx"]) {
        const s = sinComentarios(leer(ruta));
        if (!/precioMinUf: pb\.precioMinUf,/.test(s) || /editado\.includes\("precioMin"\)/.test(s)) F(`1 · ${ruta} esconde el piso del chip inferido (solo lo muestra si es editado)`);
      }
    }

    // ── §2 · sin oferta, arriba de la selección ──
    {
      const propias = [conteo("Providencia", 40, 0, 14)];
      const vecinas = [conteo("Santiago", 2600, 810, 1214), conteo("Ñuñoa", 120, 13, 31), conteo("Buenos Aires", 9, 900, 900)];
      const a = avisoSinOferta({ piePct: 20, comunas: ["Providencia"] }, propias, vecinas);
      if (!a) F("2 · sin ningún Comprar en sus comunas no hay aviso");
      else {
        // ⚠ ACTA (27-oct-2026, §4) · las salidas van de mayor a menor y solo la primera lleva «sí»: la vecina con 810 abre.
        if (lineaDeSalidas(a.salidas) !== "En Santiago, 810 sí. Con pie 30 %, 14.") F(`2 · las salidas no dicen lo del correo vacío: «${lineaDeSalidas(a.salidas)}»`);
        if (a.salidas[0]?.boton !== "Sumar Santiago a mi búsqueda" || a.salidas[1]?.boton !== "Buscar con pie 30 %") F(`2 · los botones no son los del correo vacío, en el orden de la línea: ${a.salidas.map((s) => s.boton).join(" | ")}`);
        if (a.revisados !== 40) F("2 · no cuenta cuántos había en sus comunas");
        const sPie = a.salidas.find((s) => s.ajuste.tipo === "pie"), sComuna = a.salidas.find((s) => s.ajuste.tipo === "comuna");
        const pie = sPie ? cambiosDeAjuste(sPie.ajuste, a.comunas) : null, comuna = sComuna ? cambiosDeAjuste(sComuna.ajuste, a.comunas) : null;
        if (JSON.stringify(pie) !== '{"piePct":30}' || JSON.stringify(comuna) !== '{"comunas":["Providencia","Santiago"]}') F(`2 · el ajuste no es el del correo vacío: ${JSON.stringify(pie)} ${JSON.stringify(comuna)}`);
        if (!pie || !comuna || !validarCambiosPerfil(pie).ok || !validarCambiosPerfil(comuna).ok) F("2 · el PUT del perfil rechaza el ajuste en un toque");
        if (!sPie || !sComuna || queCambio(sComuna.ajuste) !== "Santiago quedó en tu búsqueda" || SIN_OFERTA.listo(queCambio(sPie.ajuste)) !== "Listo: tu pie quedó en 30 %. La próxima selección sale con eso.") F("2 · el «Listo» después del toque no dice qué cambió");
      }
      if (SIN_OFERTA.titulo !== "Con tu búsqueda no hay deptos que convengan esta semana.") F("2 · el título no es el pedido");
      // Con alguno que conviene, nada que decir; con su pie de 30 %, la vara es pie 30 y no se le ofrece pie 30.
      if (avisoSinOferta({ piePct: 20, comunas: ["Providencia"] }, [conteo("Providencia", 40, 1, 14)], vecinas) !== null) F("2 · con uno que conviene igual sale el aviso");
      if (avisoSinOferta({ piePct: 30, comunas: ["Providencia"] }, propias, vecinas) !== null) F("2 · con pie 30 % y 14 que convienen a pie 30 sale el aviso");
      const p30 = avisoSinOferta({ piePct: 40, comunas: ["Providencia"] }, [conteo("Providencia", 40, 0, 0)], vecinas);
      if (!p30 || p30.salidas.some((s) => s.ajuste.tipo === "pie") || p30.salidas[0]?.texto !== "En Santiago, 1.214 sí.") F(`2 · con pie 40 % se ofrece pie 30 o la vecina no se cuenta a pie 30: ${JSON.stringify(p30?.salidas)}`);
      // La vecina ya en su búsqueda o fuera del Gran Santiago no se ofrece; sin salidas, cuántos había.
      const ninguna = avisoSinOferta({ piePct: 20, comunas: ["Providencia", "Santiago"] }, [conteo("Providencia", 40, 0, 0), conteo("Santiago", 3, 0, 0)], [conteo("Buenos Aires", 9, 900, 900)]);
      if (!ninguna || ninguna.salidas.length !== 0 || ninguna.revisados !== 43) F(`2 · ofrece una vecina inválida o no cuenta lo revisado: ${JSON.stringify(ninguna)}`);
      if (SIN_OFERTA.revisados(43, false) !== "Anoche había 43 publicados como los que buscas, y ninguno conviene con tu pie, ni con pie 30 % ni en comunas vecinas.") F("2 · sin salidas no dice cuántos había");
      // Cableado: la página lo lee con el perfil de renta larga, salvo que la selección ya traiga uno de sus comunas, y lo dibuja
      // dentro de la sección de la selección, antes del mapa; el componente sobrevive al refresco; el PUT mide el toque.
      const pg = sinComentarios(leer("src/app/dashboard/page.tsx"));
      // ⚠ ACTA (27-oct-2026) · «de sus comunas» se mide contra las comunas de AHORA: una tarjeta sin `tramo` de una comuna que
      // ya no busca (la selección se armó con el perfil del domingo) escondía el aviso. Lo cazó el QA del 27-oct.
      if (!/const comunasLargo = new Set\(\(perfilPersona\.perfilLtr\?\.comunas \?\? \[\]\)\.map\(comunaDeAviso\)\);/.test(pg) || !/const propiaEnSeleccion = itemsSel\.some\(\(i\) => !i\.tramo && comunasLargo\.has\(comunaDeAviso\(i\.comuna\)\)\);/.test(pg) || !/propiaEnSeleccion \? Promise\.resolve\(null\) : leerAvisoSinOferta\(admin, user\.id, perfilPersona\.perfilLtr\)/.test(pg)) F("2 · la página no lee el aviso con el perfil de renta larga (o lo lee aunque la selección traiga uno de sus comunas)");
      const sec = pg.slice(pg.indexOf('data-casa="seleccion"'), pg.indexOf("<SeleccionEnCasa"));
      if (!/<AvisoSinOferta aviso=\{sinOferta\} \/>[\s\S]*\{mapa && <MapaCasa/.test(sec)) F("2 · el aviso no va arriba del mapa y las tarjetas, dentro de la selección");
      const comp = sinComentarios(leer("src/app/dashboard/aviso-sin-oferta.tsx"));
      if (comp.indexOf("if (hecho)") < 0 || comp.indexOf("if (hecho)") > comp.indexOf("if (!aviso) return null;")) F("2 · el «Listo» se pierde cuando el servidor deja de mandar el aviso");
      if (!/body: JSON\.stringify\(\{ \.\.\.cambiosDeAjuste\(a, actual\.comunas\), origen: ORIGEN_SIN_OFERTA \}\)/.test(comp) || !/router\.refresh\(\);/.test(comp)) F("2 · el botón no guarda el ajuste en el perfil o no pide la página de nuevo");
      const srv = sinComentarios(leer("src/lib/casa/sin-oferta-servidor.ts"));
      if (!/const rango = rangoSemanal\(perfil\);/.test(srv) || !/comunas: \[\.\.\.comunas, \.\.\.vecinas\], dorms: perfil\.dormitorios, uf_min: rango\.ufMin, uf_max: rango\.ufMax, desde, plazo: PLAZO_DEPTOS \}\)/.test(srv)) F("2 · el aviso no cuenta con el rango del semanal, sus comunas y las vecinas");
      // ⚠ ACTA (30-oct-2026, goal «financiamiento por defecto a 30 años») · el conteo recibe el plazo del sitio (PLAZO_DEPTOS = 30).
      const put = sinComentarios(leer("src/app/api/perfil-busqueda/route.ts"));
      if (!/if \(body\.origen === ORIGEN_SIN_OFERTA\)/.test(put) || !/event: "casa_ajuste"/.test(put)) F("2 · el toque del aviso no se mide");
    }

    // ── §3 · los datos sucios y la puerta D ──
    {
      if (PRECIO_INFERIBLE_MIN_UF !== 500 || PRECIO_INFERIBLE_MAX_UF !== 50_000) F("3 · el rango aceptado no es UF 500 a 50.000");
      const sucio = perfilDeBusqueda([fila(4_800_000)]);
      if (sucio.precioMaxUf !== null || sucio.completo) F(`3 · un precio de UF 4.800.000 arma rango: ${sucio.precioMinUf}–${sucio.precioMaxUf}`);
      if (perfilDeBusqueda([fila(300)]).precioMaxUf !== null || perfilDeBusqueda([fila(50_001)]).precioMaxUf !== null) F("3 · un precio bajo UF 500 o sobre UF 50.000 arma rango");
      if (perfilDeBusqueda([fila(50_000)]).precioMaxUf !== 60000 || perfilDeBusqueda([fila(500)]).precioMaxUf !== 3000) F("3 · los bordes UF 500 y 50.000 se rechazan");
      const mezcla = perfilDeBusqueda([fila(4_800_000), fila(3157, { creadoAt: "2026-09-01T00:00:00Z" })]);
      if (mezcla.precioMinUf !== 3000 || mezcla.precioMaxUf !== 4000) F(`3 · el precio sucio de un informe arrastra el rango del otro: ${mezcla.precioMinUf}–${mezcla.precioMaxUf}`);
      // La puerta: D solo desde el 15-oct-2026 a medianoche de Chile.
      if (puertaAdmitida("D", "2026-10-15T02:59:59Z") !== null || puertaAdmitida("D", "2026-08-01T00:00:00Z") !== null) F("3 · se guarda una D para una cuenta de antes del 15-oct");
      if (puertaAdmitida("D", "2026-10-15T03:00:00Z") !== "D" || puertaAdmitida("D", null) !== "D") F("3 · una cuenta desde el 15-oct (o sin fecha) pierde su D");
      if (puertaAdmitida("A", "2026-08-01T00:00:00Z") !== "A" || puertaAdmitida("C", "2026-08-01T00:00:00Z") !== "C" || puertaAdmitida("B", "2026-08-01T00:00:00Z") !== "B") F("3 · A, B o C dejan de guardarse en una cuenta vieja");
      if (etiquetaPuerta(null, "2026-08-01T00:00:00Z") !== ANTES_DE_LAS_PUERTAS || ANTES_DE_LAS_PUERTAS !== "antes de las puertas" || etiquetaPuerta("D", "2026-10-20T00:00:00Z") !== "D · orgánico") F("3 · las etiquetas no son «D · orgánico» y «antes de las puertas»");
      if (!esAntesDeLasPuertas("2026-10-14T12:00:00Z") || esAntesDeLasPuertas("2026-10-16T12:00:00Z")) F("3 · el corte no es el 15-oct");
      const ruta = sinComentarios(leer("src/app/api/attribution/route.ts"));
      if (!/const puerta = puertaAdmitida\(saneados\.puerta \?\? null, user\.created_at\);/.test(ruta) || !/guardarAtribucion\(createAdminServiceClient\(\), user\.id, datos\)/.test(ruta) || !/const datos = \{ \.\.\.saneados, puerta, puerta_detalle:/.test(ruta)) F("3 · la sincronización del navegador guarda la D sin mirar cuándo se creó la cuenta");
      // La RPC con el mismo instante: dos literales que se declaran el mismo, atados acá.
      const sql = leer("supabase/migrations/20261026_puerta_d_desde_15oct.sql");
      const instante = (s: string | undefined) => (s ? Date.parse(s.replace(" ", "T").replace("+00", "Z")) : NaN);
      const enRpc = sql.match(/when p_puerta = 'D' and coalesce\(\(select u\.created_at from auth\.users u where u\.id = p_user_id\) >= timestamptz '([^']+)', true\) then 'D'/)?.[1];
      const enLimpieza = sql.match(/and ua\.puerta = 'D'\s+and u\.created_at < timestamptz '([^']+)'/)?.[1];
      if (instante(enRpc) !== Date.parse(INICIO_PUERTAS) || instante(enLimpieza) !== Date.parse(INICIO_PUERTAS)) F(`3 · la RPC o la limpieza cortan en otro instante que INICIO_PUERTAS: ${enRpc} / ${enLimpieza} vs ${INICIO_PUERTAS}`);
      if (!/when p_puerta in \('A', 'B', 'C'\) then p_puerta/.test(sql) || !/admitida\.puerta,/.test(sql)) F("3 · la RPC no pasa la puerta por la regla");
    }
    // ── §4 · la tercera salida: el chip de precio de abajo (27-oct-2026) ──
    {
      // El caso pedido: Santiago 1D analizado a UF 3.200 → su chip es UF 3.000 a 4.000 (cero conviene); el de abajo,
      // «hasta UF 3.000», tiene 810.
      const santiago = perfilDeBusqueda([fila(3200)]);
      const rango = rangoSemanal(santiago);
      const abajo = chipDeAbajo(rango);
      if (abajo?.id !== "hasta-3000") F(`4 · el chip de abajo de Santiago 1D a UF 3.200 no es «hasta UF 3.000»: ${abajo?.id}`);
      if (chipDeAbajo({ ufMin: 0 }) !== null || chipDeAbajo(null) !== null || chipDeAbajo({ ufMin: 4000 })?.id !== "3000-4000" || chipDeAbajo({ ufMin: 6000 })?.id !== "4000-6000") F("4 · el chip de abajo no es el inmediatamente inferior (o hay chip de abajo sin piso)");
      const propias = [conteo("Santiago", 128, 0, 0)];
      const vecinas = [conteo("Providencia", 41, 4, 13)];
      const filasAbajo = (n20: number, n30 = n20) => (abajo ? { rango: abajo, filas: [conteo("Santiago", 2627, n20, n30)] } : null);
      const caso = avisoSinOferta({ piePct: santiago.piePct, comunas: santiago.comunas }, propias, vecinas, filasAbajo(810, 1214));
      if (!caso || lineaDeSalidas(caso.salidas) !== "Hasta UF 3.000, 810 sí. En Providencia, 4.") F(`4 · Santiago 1D a UF 3.200 no ofrece «hasta UF 3.000» primero: «${caso ? lineaDeSalidas(caso.salidas) : "sin aviso"}»`);
      if (caso?.salidas[0]?.boton !== "Buscar hasta UF 3.000" || caso?.salidas[1]?.boton !== "Sumar Providencia a mi búsqueda") F(`4 · los botones no siguen a la línea: ${caso?.salidas.map((s) => s.boton).join(" | ")}`);
      // La frase pedida, con las tres salidas: de mayor a menor y solo la primera con «sí».
      const tres = avisoSinOferta({ piePct: 20, comunas: ["Santiago"] }, [conteo("Santiago", 128, 0, 7)], vecinas, filasAbajo(810));
      if (!tres || lineaDeSalidas(tres.salidas) !== "Hasta UF 3.000, 810 sí. Con pie 30 %, 7. En Providencia, 4.") F(`4 · las tres salidas no dicen la frase pedida: «${tres ? lineaDeSalidas(tres.salidas) : "sin aviso"}»`);
      // El orden es por cantidad, no por tipo; los empates van precio, pie, comuna.
      const orden = avisoSinOferta({ piePct: 20, comunas: ["Santiago"] }, [conteo("Santiago", 128, 0, 7)], [conteo("Providencia", 90, 40, 50)], filasAbajo(12));
      if (!orden || lineaDeSalidas(orden.salidas) !== "En Providencia, 40 sí. Hasta UF 3.000, 12. Con pie 30 %, 7.") F(`4 · las salidas no van de mayor a menor: «${orden ? lineaDeSalidas(orden.salidas) : "sin aviso"}»`);
      const empate = avisoSinOferta({ piePct: 20, comunas: ["Santiago"] }, [conteo("Santiago", 128, 0, 20)], [conteo("Providencia", 90, 20, 50)], filasAbajo(20));
      if (!empate || empate.salidas.map((s) => s.ajuste.tipo).join(",") !== "rango,pie,comuna") F(`4 · el empate no va precio, pie, comuna: ${empate?.salidas.map((s) => s.ajuste.tipo).join(",")}`);
      // El umbral: más de 10.
      if (MINIMO_SALIDA_PRECIO !== 10) F("4 · el mínimo de la salida del precio no es 10");
      const diez = avisoSinOferta({ piePct: 20, comunas: ["Santiago"] }, propias, vecinas, filasAbajo(10));
      const once = avisoSinOferta({ piePct: 20, comunas: ["Santiago"] }, propias, vecinas, filasAbajo(11));
      if (diez?.salidas.some((s) => s.ajuste.tipo === "rango") || !once?.salidas.some((s) => s.ajuste.tipo === "rango")) F("4 · la salida del precio no pide más de 10");
      // Con su pie de 30 % o más, el chip de abajo se cuenta a pie 30.
      const p30 = avisoSinOferta({ piePct: 30, comunas: ["Santiago"] }, propias, vecinas, filasAbajo(5, 40));
      if (p30?.salidas[0]?.texto !== "Hasta UF 3.000, 40 sí.") F(`4 · con pie 30 % el chip de abajo no se cuenta a pie 30: ${p30?.salidas[0]?.texto}`);
      // El ajuste: va y vuelve por el correo, deja el precio en el chip de abajo, y el perfil busca ahí.
      const aj = caso?.salidas[0]?.ajuste;
      if (!aj || parametroDeAjuste(aj) !== "rango:hasta-3000" || JSON.stringify(ajusteDeParametro("rango:hasta-3000", new Set())) !== JSON.stringify(aj) || ajusteDeParametro("rango:inventado", new Set()) !== null) F("4 · el parámetro del ajuste de precio no va y vuelve (o acepta un chip que no existe)");
      if (aj && (JSON.stringify(cambiosDeAjuste(aj, ["Santiago"])) !== '{"precioMinUf":null,"precioMaxUf":3000}' || !validarCambiosPerfil(cambiosDeAjuste(aj, ["Santiago"])).ok || JSON.stringify(perfilConAjuste(aj, { comunas: [] })) !== '{"precio_min_uf":null,"precio_max_uf":3000}')) F("4 · el ajuste de precio no deja el perfil en el chip de abajo");
      if (aj && queCambio(aj) !== "tu precio quedó hasta UF 3.000") F(`4 · el «Listo» del precio no dice el chip: ${aj ? queCambio(aj) : ""}`);
      const ajustado = perfilDeBusqueda([fila(3200)], { ...MANUAL_VACIO, precioMaxUf: 3000, precioMinUf: null });
      if (JSON.stringify(rangoSemanal(ajustado)) !== '{"ufMin":0,"ufMax":3000}') F(`4 · con el ajuste hecho el semanal no busca en «hasta UF 3.000»: ${JSON.stringify(rangoSemanal(ajustado))}`);
      // El correo vacío: la misma línea y un botón por salida, en el mismo orden.
      if (tres) {
        const html = correoSemanalVacio({ nombre: null, urlPerfil: "https://x/p", urlBaja: "https://x/b", salidas: { linea: lineaDeSalidas(tres.salidas), botones: tres.salidas.map((s) => ({ boton: s.boton, url: `https://x/a?que=${parametroDeAjuste(s.ajuste)}` })) } }).html;
        const enOrden = ["Buscar hasta UF 3.000", "Buscar con pie 30 %", "Sumar Providencia a mi búsqueda"].map((b) => html.indexOf(`data-ajuste="1">${b}<`));
        if (!html.includes("Hasta UF 3.000, 810 sí. Con pie 30 %, 7. En Providencia, 4.") || enOrden.some((i) => i < 0) || !(enOrden[0] < enOrden[1] && enOrden[1] < enOrden[2]) || !html.includes('href="https://x/a?que=rango:hasta-3000"')) F("4 · el correo vacío no lleva la línea y los tres botones en orden");
      }
      // Cableado: el servidor cuenta el chip de abajo; el correo usa la MISMA cuenta que el dashboard.
      const srv = sinComentarios(leer("src/lib/casa/sin-oferta-servidor.ts"));
      if (!/const abajo = chipDeAbajo\(rango\);/.test(srv) || !/abajo \? admin\.rpc\("deptos_conteo", \{ comunas, dorms: perfil\.dormitorios, uf_min: abajo\.min \?\? 0, uf_max: abajo\.max, desde, plazo: PLAZO_DEPTOS \}\)/.test(srv) || !/avisoSinOferta\(\{ piePct: perfil\.piePct, comunas \}, propias, filas\.filter\(\(f\) => vecinas\.includes\(f\.comuna\)\), filasAbajo\)/.test(srv)) F("4 · el servidor no cuenta el chip de abajo o no se lo pasa al aviso");
      const sem = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
      if (!/const cuenta = await contarSinOferta\(admin, userId, perfil\);/.test(sem) || !/salidas: cuenta\?\.aviso\?\.salidas \?\? \[\]/.test(sem)) F("4 · el correo vacío no usa la cuenta del dashboard");
      if (!/salidas: verdad && verdad\.salidas\.length > 0\s*\? \{ linea: lineaDeSalidas\(verdad\.salidas\), botones: verdad\.salidas\.map\(\(s\) => \(\{ boton: s\.boton, url: enlaces\.ajuste\(parametroDeAjuste\(s\.ajuste\)\) \}\)\) \}/.test(sem)) F("4 · el envío del vacío no manda las salidas con su ajuste en un toque");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  for (const f of fallas) console.log(`  · ${f}`);
  console.log(fallas.length === 0 ? "  ✓ PERFIL-OFERTA: todo en verde" : `  ✗ PERFIL-OFERTA: ${fallas.length} fallas`);
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exitCode = runPerfilOfertaTier().hard ? 1 : 0;
}

// ACTA DE MUTACIÓN (30-oct-2026, goal «financiamiento por defecto a 30 años»): O1 el aviso sin oferta cuenta sin el plazo y
// O2 el chip de abajo sin el plazo, 2 de 2 en ROJO (runner `mutar-recorrido.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte).
