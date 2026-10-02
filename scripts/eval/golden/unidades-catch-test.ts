// ============================================================================
// GOLDEN · UNIDADES (02-oct-2026) — catch-test
// ============================================================================
//   La fuente retiró el GraphQL que traía cada unidad de obra nueva con su precio. El pase de unidades
//   ahora lee la ficha nueva (api-ficha): los deptos DISPONIBLES —sin precio— y el rango del proyecto.
//   Este tier cuida lo que el pase hace con eso:
//   1 · EL CRUCE: la unidad que sigue en la lista queda vista; la activa que la ficha nueva YA VIO y dejó
//       de listar, vendida (la que nunca apareció en la ficha nueva queda como está: la lista nueva es un
//       subconjunto de la vieja, 78 de 233 en el ensayo del 02-oct);
//       una lista vacía no vende nada; si ninguna de las nuestras aparece, el cruce no es confiable y
//       no se marca nada; el `~` del desempate viejo no rompe el número.
//   2 · LA FICHA: una respuesta real de la fuente (proyecto 723905, 02-oct) da sus dos deptos con
//       número, dormitorios, baños, piso y m², y el proyecto da su rango y su entrega.
//   3 · SIN PRECIOS: el pase no escribe precios ni filas nuevas (el precio espera una decisión).
//   5 · EL ESTIMADO (02-oct, decisión de Fabrizio): cada vista guarda un precio estimado —interpolado
//       entre el «desde» y el «hasta» del proyecto según sus m²— en columnas propias, nunca en `precio`.
//   6 · LA QUE LA FICHA NUEVA NUNCA LISTÓ queda en la base para la zona, pero sale de avisos_evaluados
//       (guía y correo) y la evaluación no la vuelve a tomar: la guía muestra solo lo disponible.
//   7 · LA MEDIANA DE VENTA NUEVA usa el real mientras tenga menos de 90 días y después el estimado,
//       por unidad; nadie más lee el estimado (nunca evalúa una unidad puntual).
//   8 · EL INFORME dice «referencia estimada» cuando la mediana lo usó, y la foto lo guarda; sin
//       estimado, frase y dato quedan idénticos.
//   4 · LA VENDIDA SALE: is_active = false, después cerrar_bajas() (la evaluada sale de avisos_evaluados,
//       de la guía y del correo, con su veredicto en bajas_avisos) y recién después las no evaluadas
//       entran a bajas_avisos sin pisar a las que ya están. El ensayo (?dry=1) no escribe ni late.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/unidades-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  estimarPrecioUnidadUF, etiquetaDeUnidad, marcaFueraDeLaFicha, marcaVistaUnidades, parsearDisponibles, parsearProyecto,
  planDisponibilidad, PREFIJO_FUERA_DE_LA_FICHA, PREFIJO_VISTA_UNIDADES, type FilaUnidad,
} from "../../../src/lib/services/scraper/toctoc-unidades";
import { esFueraDeLaFicha } from "../../../src/lib/avisos/marcas-unidades";
import { avisosEvaluables } from "../../../src/lib/avisos/depurar";
import { getComunaMedianaVentaUF, precioVentaNueva, VIGENCIA_PRECIO_REAL_DIAS } from "../../../src/lib/comuna-stats";
import { buildPrecioVsComuna } from "../../../src/lib/precio-vs-comuna";
import { buildHallazgoSobreprecio, REFERENCIA_ESTIMADA } from "../../../src/lib/sobreprecio-hallazgo";
import { buildMedianaSnapshot } from "../../../src/lib/api-helpers/analisis-pipeline";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

// Respuesta real de floors-units del proyecto 723905 (Las Condes), leída el 02-oct-2026; sin las imágenes.
const FLOORS_723905 = {
  status: "ok", statusCode: 200,
  data: { floors: [
    { id: "3d-·-3b", name: "3D · 3B", title: "Planta 3D - 3B", model: [{ id: "119.65-m2-útiles-|-142.48-m2-totales", name: "119.65 m2 útiles | 142.48 m2 totales", units: [
      { unitIdentifier: "461939ac-b317-4db5-add2-ff8dc9815bd3", floorIdentifier: "84cbe1da-4e80-4f24-b9dc-77fe2634525c", number: "801 B", characteristics: [
        { name: "Dormitorios: ", value: 3, icon: "room" }, { name: "Baños: ", value: 3, icon: "bathrooms" }, { name: "Piso: ", value: 8, icon: "Buildings" },
        { name: "Nº: ", value: "801 B", icon: "" }, { name: "M2 útiles: ", value: "119.65 m2", icon: "meters" }, { name: "M2 totales: ", value: "142.48 m2", icon: "meters" }, { name: "Tipo: ", value: "801 B", icon: "" }] }] }] },
    { id: "2d-·-2b", name: "2D · 2B", title: "Planta 2D - 2B", model: [{ id: "99.17-m2-útiles-|-164.14-m2-totales", name: "99.17 m2 útiles | 164.14 m2 totales", units: [
      { unitIdentifier: "3fb78482-48b8-403d-bbb4-3a1298fbf484", floorIdentifier: "a5ea93fe-742a-4726-91c8-f26351c1fbc7", number: "1002 C", characteristics: [
        { name: "Dormitorios: ", value: 2, icon: "room" }, { name: "Baños: ", value: 2, icon: "bathrooms" }, { name: "Piso: ", value: 10, icon: "Buildings" },
        { name: "Nº: ", value: "1002 C", icon: "" }, { name: "M2 útiles: ", value: "99.17 m2", icon: "meters" }, { name: "M2 totales: ", value: "164.14 m2", icon: "meters" }, { name: "Tipo: ", value: "1002 C", icon: "" }] }] }] },
  ] },
};
const PROYECTO_3976789 = { data: { minimunPricesUF: 2454, maximunPricesUF: 4990, characteristics: [
  { name: "Estado del proyecto: ", value: "Entrega inmediata", icon: "helmet" }, { name: "Fecha de entrega: ", value: "2° Semestre 2025", icon: "calendar" }] } };

export async function runUnidadesTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER UNIDADES (los disponibles de obra nueva y el precio estimado · 0 tokens) ───");

  // ── 1 · el cruce ──
  const url = "https://www.toctoc.com/propiedades/compranuevo/departamento/las-condes/parque/723905";
  const vista = marcaVistaUnidades(new Date("2026-10-03T14:00:00Z"));
  const fila = (id: string, n: string, is_active: boolean | null = true, seen_pass_id: string | null = vista): FilaUnidad => ({ id, source_id: `${url}#${n}`, is_active, seen_pass_id });
  const disp = (...ns: string[]) => ns.map((numero) => ({ numero, dormitorios: 2, banos: 2, piso: 1, m2Utiles: 50, m2Totales: 55 }));
  {
    const p = planDisponibilidad([fila("a", "101"), fila("b", "102"), fila("c", "103", false)], disp("101", "103", "104"));
    if (p.vistas.join() !== "a,c" || p.vendidas.join() !== "b" || p.nuevas !== 1 || p.sinCruce) F(`1 · el cruce no separa vistas, vendidas y nuevas (${JSON.stringify(p)})`);
    const v = planDisponibilidad([fila("a", "101"), fila("b", "102")], []);
    if (v.vendidas.length || v.vistas.length || v.sinCruce) F("1 · una lista vacía vende unidades o se reporta como cruce fallido (un agotado y una respuesta incompleta se ven igual: no se marca nada)");
    const s = planDisponibilidad([fila("a", "101"), fila("b", "102")], disp("A1", "A2"));
    if (!s.sinCruce || s.vendidas.length) F("1 · sin una sola de las nuestras en la lista, el cruce marca ventas igual");
    const b = planDisponibilidad([fila("a", "101"), fila("b", "102", true, null), fila("c", "103", true, "pase-usados-x")], disp("101"));
    if (b.vendidas.length !== 0 || b.fuera.join() !== "b,c") F(`1 · se vende una unidad que la ficha nueva nunca listó (${JSON.stringify(b)})`);
    if (etiquetaDeUnidad(`${url}#801 B~`) !== "801 B" || planDisponibilidad([fila("a", "801 B~")], disp("801 B")).vistas.join() !== "a") F("1 · el `~` del desempate viejo rompe el número de la unidad");
  }

  // ── 2 · la ficha ──
  {
    const d = parsearDisponibles(FLOORS_723905);
    const a = d.find((x) => x.numero === "801 B"), b = d.find((x) => x.numero === "1002 C");
    if (d.length !== 2 || !a || !b || a.dormitorios !== 3 || a.banos !== 3 || a.piso !== 8 || a.m2Utiles !== 119.65 || a.m2Totales !== 142.48 || b.m2Utiles !== 99.17 || b.dormitorios !== 2)
      F(`2 · la respuesta real de la ficha no da sus dos deptos con sus datos (${JSON.stringify(d)})`);
    const p = parsearProyecto(PROYECTO_3976789);
    if (p.rango?.desdeUF !== 2454 || p.rango?.hastaUF !== 4990 || p.fechaEntrega !== "2° Semestre 2025") F(`2 · el proyecto no da su rango y su entrega (${JSON.stringify(p)})`);
    if (parsearProyecto({ data: { characteristics: [] } }).rango !== null) F("2 · un proyecto sin rango inventa uno");
    if (!marcaVistaUnidades(new Date("2026-10-03T14:00:00Z")).startsWith(PREFIJO_VISTA_UNIDADES)) F("2 · la marca de vista no lleva su prefijo");
  }

  // ── 3 · sin precios, sin filas nuevas ──
  const ruta = sinComentarios(leer("src/app/api/data/scrape-unidades-nuevas/route.ts"));
  const upserts = (ruta.match(/\.upsert\(/g) ?? []).length;
  const upsertsDeBajas = (ruta.match(/\.from\("bajas_avisos"\)\s*\.upsert\(/g) ?? []).length;
  if (/\bprecio\w*\s*:/.test(ruta) || /\.insert\(/.test(ruta) || upserts !== upsertsDeBajas || /propertyToRow/.test(ruta)) F("3 · el pase de unidades escribe precios o filas nuevas (el precio espera una decisión)");

  // ── 4 · la vendida sale, en orden; el ensayo no escribe ──
  {
    const iVendida = ruta.search(/\.update\(\{ is_active: false \}\)\.in\("id", idsVendidas/);
    const iCerrar = ruta.search(/\.rpc\("cerrar_bajas"\)/);
    const iSinEvaluar = ruta.search(/\.from\("bajas_avisos"\)\s*\.upsert\([\s\S]{0,80}?\{ onConflict: "aviso_id", ignoreDuplicates: true/);
    if (iVendida < 0 || iCerrar < 0 || iSinEvaluar < 0 || !(iVendida < iCerrar && iCerrar < iSinEvaluar)) F("4 · la vendida no sale en orden: is_active = false → cerrar_bajas() → las no evaluadas a bajas_avisos sin pisar");
    const iDry = ruta.indexOf("if (!dry) {");
    const iVista = ruta.search(/\.rpc\("marcar_unidades_vistas"/);
    if (!/if \(!dry\) await latirCron\(/.test(ruta) || iDry < 0 || [iVista, iVendida, iCerrar, iSinEvaluar].some((i) => i < iDry)) F("4 · el ensayo (?dry=1) escribe o late");
    if ((ruta.match(/\{ registrar: !dry \}\)/g) ?? []).length < 2 || /NextResponse\.json\(\{ success: true/.test(ruta)) F("4 · el ensayo deja resultado o alerta (o responde sin pasar por cerrarCron)");
  }

  // ── 5 · el estimado: interpolado entre el «desde» y el «hasta» según los m² ──
  {
    const r = { desdeUF: 3000, hastaUF: 4200 };
    if (estimarPrecioUnidadUF(r, 50, 50, 70) !== 3000 || estimarPrecioUnidadUF(r, 70, 50, 70) !== 4200 || estimarPrecioUnidadUF(r, 60, 50, 70) !== 3600) F("5 · el estimado no interpola entre el «desde» (el más chico) y el «hasta» (el más grande)");
    if (estimarPrecioUnidadUF(r, 60, 60, 60) !== 3600 || estimarPrecioUnidadUF(null, 60, 50, 70) !== null || estimarPrecioUnidadUF(r, null, 50, 70) !== null) F("5 · sin rango o sin m² el estimado no es null (o un solo tamaño no da el punto medio)");
    if (!/vistasFilas\.push\(\{ id: f\.id, estimado_uf: estimarPrecioUnidadUF\(r\.rango, d\?\.m2Utiles \?\? null, m2Min, m2Max\), fecha_entrega: r\.fechaEntrega \}\)/.test(ruta)
      || !/\.rpc\("marcar_unidades_vistas", \{ p_filas: vistasFilas\.slice\(i, i \+ 500\), p_marca: marca \}\)/.test(ruta)) F("5 · el pase no guarda el estimado de cada vista (ni su entrega) en la llamada de las vistas");
    // Los m² extremos, de todas las unidades conocidas: el rango de la ficha cubre también las que no lista.
    if (!/const m2s = \[\.\.\.r\.disponibles\.map\(\(d\) => d\.m2Utiles\), \.\.\.filas\.map\(\(f\) => Number\(f\.superficie_m2\)\)\]/.test(ruta) || !/seen_pass_id, superficie_m2"\)/.test(ruta)) F("5 · los m² extremos del estimado salen solo de las listadas (el error sube de p90 10% a 22%)");
    const mig = leer("supabase/migrations/20261002_unidades_precio_estimado.sql");
    if (!/precio_estimado_uf = coalesce\(f\.estimado_uf, s\.precio_estimado_uf\)/.test(mig) || /\bprecio = /.test(mig)) F("5 · la función de las vistas toca el precio real (o borra el estimado anterior)");
  }

  // ── 6 · las que la ficha nueva nunca listó: quedan en la base, salen de la guía ──
  {
    const iDry = ruta.indexOf("if (!dry) {");
    const iFuera = ruta.search(/\.update\(\{ seen_pass_id: marcaFueraDeLaFicha\(ahoraCorrida\) \}\)\.in\("id", ids\)/);
    const iSaca = ruta.search(/\.from\("avisos_evaluados"\)\.delete\(\{ count: "exact" \}\)\.in\("aviso_id", ids\)/);
    if (!/fueraIds\.push\(\.\.\.plan\.fuera\);/.test(ruta) || iFuera < 0 || iSaca < 0 || iFuera > iSaca || iFuera < iDry || /fueraIds[\s\S]{0,200}is_active: false/.test(ruta)) F("6 · la que la ficha nueva nunca listó no se marca y sale de avisos_evaluados (o se desactiva: tiene que quedar para la zona)");
    if (!marcaFueraDeLaFicha(new Date()).startsWith(PREFIJO_FUERA_DE_LA_FICHA) || !esFueraDeLaFicha("fuera@2026-10-03T14:00:00.000Z") || esFueraDeLaFicha("unidades@x") || esFueraDeLaFicha(null)) F("6 · la marca «fuera de la ficha» no se reconoce");
    const base = { id: "u1", comuna: "Ñuñoa", lat: -33.45, lng: -70.6, precio: 4000, moneda: "UF", superficie_m2: 55, dormitorios: 2, banos: 2, condicion: "nuevo", direccion: null, fecha_entrega: null, scraped_at: "2026-10-01T10:00:00" };
    const ev = avisosEvaluables([base, { ...base, id: "u2", precio: 4100, seen_pass_id: "fuera@2026-10-03T14:00:00.000Z" }, { ...base, id: "u3", precio: 4200, seen_pass_id: "unidades@2026-10-03T14:00:00.000Z" }], 39000);
    if (ev.map((a) => a.id).join() !== "u1,u3") F(`6 · la evaluación toma una unidad que la ficha nueva nunca listó (${ev.map((a) => a.id).join()})`);
    for (const p of ["src/app/api/cron/evaluar-avisos/route.ts", "scripts/cargar-avisos-evaluados.ts"]) {
      if (!/\.select\("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at, seen_pass_id"\)/.test(leer(p))) F(`6 · ${p} no lee la marca: evaluaría lo que la guía no muestra`);
    }
  }

  // ── 7 · la mediana de venta nueva: el real mientras tenga menos de 90 días, después el estimado ──
  {
    const ahora = Date.parse("2026-12-30T12:00:00Z");
    const desde90 = ahora - 90 * 864e5;
    const u = (o: Record<string, unknown>) => ({ precio: 3000, moneda: "UF", source_id: "https://x/compranuevo/departamento/a/b/1#101", scraped_at: "2026-12-01T10:00:00", precio_estimado_uf: 3300, precio_estimado_at: "2026-12-29T14:00:00+00:00", ...o });
    const vig = precioVentaNueva(u({}), desde90, ahora);
    const vieja = precioVentaNueva(u({ scraped_at: "2026-09-30T10:00:00" }), Date.parse("2026-07-01T00:00:00Z"), ahora);
    const sinEst = precioVentaNueva(u({ scraped_at: "2026-09-30T10:00:00", precio_estimado_uf: null }), Date.parse("2026-07-01T00:00:00Z"), ahora);
    const proyecto = precioVentaNueva(u({ scraped_at: "2026-09-30T10:00:00", source_id: "https://x/compranuevo/departamento/a/b/1" }), desde90, ahora);
    if (VIGENCIA_PRECIO_REAL_DIAS !== 90 || vig?.estimado !== false || vig.precio !== 3000) F("7 · el precio real con menos de 90 días no manda");
    if (vieja?.estimado !== true || vieja.precio !== 3300 || vieja.moneda !== "UF") F("7 · pasados los 90 días, el estimado fresco no reemplaza al real");
    if (sinEst?.estimado !== false || sinEst.precio !== 3000) F("7 · sin estimado, el real viejo que cae en la ventana se pierde");
    if (proyecto !== null) F("7 · una fila-proyecto entra con un estimado (es de las unidades)");
    // Extremo a extremo con un doble de la base: 20 unidades con el real de 100 días y estimado fresco.
    const filas = (o: Record<string, unknown>) => Array.from({ length: 20 }, (_, i) => u({ superficie_m2: 50, dormitorios: 2, condicion: "nuevo", precio: 3000 + i * 10, precio_estimado_uf: 3300 + i * 10, scraped_at: new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 19), precio_estimado_at: new Date(Date.now() - 864e5).toISOString(), ...o }));
    const doble = (rows: Array<Record<string, unknown>>) => ({ from: () => {
      const q: Record<string, unknown> = {};
      let off = 0;
      for (const m of ["select", "eq", "gte", "lte", "order", "or"]) q[m] = () => q;
      q.range = (a: number) => { off = a; return q; };
      q.then = (ok: (v: unknown) => unknown) => ok({ data: off === 0 ? rows : [], error: null });
      return q;
    } });
    const conEst = await getComunaMedianaVentaUF(doble(filas({})), "Ñuñoa", 50, 2, 39000, "nuevo");
    const conReal = await getComunaMedianaVentaUF(doble(filas({ scraped_at: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 19) })), "Ñuñoa", 50, 2, 39000, "nuevo");
    if (conEst.estimada !== true || conEst.nEstimados !== 20 || !(conEst.mediana && conEst.mediana > 66)) F(`7 · la mediana con reales de más de 90 días no usa el estimado ni lo declara (${JSON.stringify(conEst)})`);
    if (conReal.estimada !== undefined || !(conReal.mediana && conReal.mediana < 65)) F(`7 · la mediana con reales vigentes se declara estimada o usa el estimado (${JSON.stringify(conReal)})`);
    const cs = sinComentarios(leer("src/lib/comuna-stats.ts"));
    if (!/q\.eq\("condicion", "nuevo"\)\.or\(`scraped_at\.gte\.\$\{desde\},precio_estimado_at\.gte\.\$\{desde\}`\)/.test(cs) || !/\.gte\("scraped_at", desde\)/.test(cs)) F("7 · la query no trae la unidad con estimado fresco (o el usado perdió su ventana)");
    // El estimado NUNCA evalúa una unidad: fuera de la mediana, nadie lo lee.
    const fuente = (d: string): string[] => readdirSync(join(RAIZ, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fuente(join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(d, e.name)] : []);
    const lectores = fuente("src").filter((p) => /precio_estimado/.test(sinComentarios(leer(p)))).map((p) => p.replace(/\\/g, "/"));
    if (lectores.join() !== "src/lib/comuna-stats.ts") F(`7 · el precio estimado se lee fuera de la mediana de venta nueva: ${lectores.join(", ")}`);
  }

  // ── 8 · el informe dice «referencia estimada» cuando la usa ──
  {
    const pvc = buildPrecioVsComuna({ sujetoUfM2: 70, medianaComunaUfM2: 66, confiable: true, n: 40, universo: "nuevo", estimada: true });
    const h = buildHallazgoSobreprecio(pvc, 0.5, 0.5, "Ñuñoa");
    const sin = buildHallazgoSobreprecio(buildPrecioVsComuna({ sujetoUfM2: 70, medianaComunaUfM2: 66, confiable: true, n: 40, universo: "nuevo" }), 0.5, 0.5, "Ñuñoa");
    if (REFERENCIA_ESTIMADA !== "referencia estimada" || !h || !h.fraseCanonica.includes("(referencia estimada)") || h.valor.estimada !== true) F("8 · la frase del sobreprecio no dice «referencia estimada» cuando la mediana la usa");
    if (!sin || sin.fraseCanonica.includes("estimada") || "estimada" in sin.valor || "estimada" in buildPrecioVsComuna({ sujetoUfM2: 70, medianaComunaUfM2: 66, confiable: true, n: 40, universo: "nuevo" })) F("8 · sin estimado, la frase o el dato cambian (tienen que quedar idénticos)");
    if (buildMedianaSnapshot({ mediana: 66, n: 40, universo: "nuevo", estimada: true }).estimada !== true || "estimada" in buildMedianaSnapshot({ mediana: 66, n: 40 })) F("8 · la foto de la mediana no guarda que fue estimada");
    for (const p of ["src/app/analisis/[id]/documento/page.tsx", "src/app/analisis/[id]/informe-ltr.tsx"]) {
      if (!/\.\.\.\(medianaSnapshot\.estimada \? \{ estimada: true \} : \{\}\)/.test(leer(p))) F(`8 · ${p} relee la foto sin «estimada»: el informe la olvida`);
    }
    if (!/estimada: medianaComunaVentaUF\?\.estimada/.test(sinComentarios(leer("src/lib/analysis.ts")))) F("8 · el motor no pasa «estimada» a precioVsComuna");
    const zona = sinComentarios(leer("src/components/analysis/zona/ZonaLtr.tsx"));
    if ((zona.match(/m2\.estimada \? ` · \$\{REFERENCIA_ESTIMADA\}` : ""/g) ?? []).length !== 2) F("8 · la zona del informe no dice «referencia estimada» en la fuente y en la glosa del m²");
  }

  if (fallas.length) {
    console.log(`  ✗ UNIDADES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el pase cruza los disponibles de la ficha nueva: vista la que sigue (con su estimado aparte), vendida la que falta, fuera de la guía la que nunca listó; la mediana nueva pasa al estimado a los 90 días y el informe dice «referencia estimada»");
  }
  return { hard: fallas.length };
}

// ACTA · verificado EN ROJO (scratchpad mutar-congelar.py, restauradas byte a byte)
// 02-oct-2026, primera versión (cruce y bajas): 13/13. U1 quedó VERDE al principio (el resguardo del
// cruce igual evitaba la venta, pero reportaba «sin cruce»); el tier pasó a exigir que la lista vacía no
// marque nada. Re-corridas sobre la versión con el estimado: 12/12.
//   U1  la lista vacía no corta ............................................. 1
//   U2  sin el resguardo del cruce .......................................... 1
//   U3  el `~` del desempate viejo rompe el número .......................... 1
//   U5  «119.65 m2» no se lee como número ................................... 2
//   U6  un proyecto sin rango inventa uno ................................... 2
//   U7  el pase escribe un precio ........................................... 3
//   U8  sin cerrar_bajas() .................................................. 4
//   U9  las no evaluadas pisan la fila con veredicto ........................ 4
//   U10 el ensayo late ...................................................... 4
//   U11 el ensayo deja resultado ............................................ 4
//   U12 la vendida no se desactiva .......................................... 4
//   U13 se vende lo que la ficha nueva nunca listó (78 de 233 en el ensayo) . 1
//   U14 el pase escribe filas (un upsert fuera de bajas_avisos; 1/1) ......... 3
// 02-oct-2026, el estimado, las «fuera» y la mediana: 19/19. E4 quedó VERDE al principio (el tier
// miraba la marca y el borrado, no que las «fuera» se juntaran); el tier pasó a exigir el push.
//   E1  el estimado invertido (el «hasta» al más chico) ..................... 5
//   E2  las vistas sin estimado ............................................. 5
//   E3  la función de las vistas pisa el precio real ........................ 5
//   E4  las «fuera» no se juntan ............................................ 6
//   E5  las «fuera» se desactivan (se perderían para la zona) ............... 6
//   E6  las «fuera» siguen en avisos_evaluados .............................. 6
//   E7  la evaluación las vuelve a tomar .................................... 6
//   E8  el cron no lee la marca ............................................. 6
//   E9  el estimado manda antes de los 90 días .............................. 7
//   E10 nunca el estimado ................................................... 7
//   E11 la fila-proyecto entra con estimado ................................. 7
//   E12 la query no trae la unidad con estimado fresco ...................... 7
//   E13 la mediana no lo declara ............................................ 7
//   E14 la frase del sobreprecio no lo dice ................................. 8
//   E15 la foto de la mediana lo olvida ..................................... 8
//   E16 el informe relee la foto sin «estimada» ............................. 8
//   E17 el motor no pasa «estimada» ......................................... 8
//   E18 la zona no lo dice .................................................. 8
//   E19 otro archivo lee el estimado (una unidad evaluada con él) ........... 7
//   E20 los m² extremos solo de las listadas (1/1) ......................... 5

if (require.main === module) {
  runUnidadesTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
