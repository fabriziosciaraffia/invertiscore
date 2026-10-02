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
//   4 · LA VENDIDA SALE: is_active = false, después cerrar_bajas() (la evaluada sale de avisos_evaluados,
//       de la guía y del correo, con su veredicto en bajas_avisos) y recién después las no evaluadas
//       entran a bajas_avisos sin pisar a las que ya están. El ensayo (?dry=1) no escribe ni late.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red y sin base.
// Solo:  node --import tsx scripts/eval/golden/unidades-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  etiquetaDeUnidad, marcaVistaUnidades, parsearDisponibles, parsearProyecto, planDisponibilidad,
  PREFIJO_VISTA_UNIDADES, type FilaUnidad,
} from "../../../src/lib/services/scraper/toctoc-unidades";

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
  console.log("\n─── TIER UNIDADES (los disponibles de obra nueva, sin precio · 0 tokens) ───");

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
    if (b.vendidas.length !== 0 || b.fuera !== 2) F(`1 · se vende una unidad que la ficha nueva nunca listó (${JSON.stringify(b)})`);
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
  if (/\bprecio\w*\s*:/.test(ruta) || /from\("scraped_properties"\)\s*\.(upsert|insert)\(/.test(ruta) || /propertyToRow/.test(ruta)) F("3 · el pase de unidades escribe precios o filas nuevas (el precio espera una decisión)");

  // ── 4 · la vendida sale, en orden; el ensayo no escribe ──
  {
    const iVendida = ruta.search(/\.update\(\{ is_active: false \}\)\.in\("id", idsVendidas/);
    const iCerrar = ruta.search(/\.rpc\("cerrar_bajas"\)/);
    const iSinEvaluar = ruta.search(/\.from\("bajas_avisos"\)\s*\.upsert\([\s\S]{0,80}?\{ onConflict: "aviso_id", ignoreDuplicates: true/);
    if (iVendida < 0 || iCerrar < 0 || iSinEvaluar < 0 || !(iVendida < iCerrar && iCerrar < iSinEvaluar)) F("4 · la vendida no sale en orden: is_active = false → cerrar_bajas() → las no evaluadas a bajas_avisos sin pisar");
    const iDry = ruta.indexOf("if (!dry) {");
    const iVista = ruta.search(/\.update\(\{ is_active: true, seen_pass_id: marca/);
    if (!/if \(!dry\) await latirCron\(/.test(ruta) || iDry < 0 || [iVista, iVendida, iCerrar, iSinEvaluar].some((i) => i < iDry)) F("4 · el ensayo (?dry=1) escribe o late");
    if ((ruta.match(/\{ registrar: !dry \}\)/g) ?? []).length < 2 || /NextResponse\.json\(\{ success: true/.test(ruta)) F("4 · el ensayo deja resultado o alerta (o responde sin pasar por cerrarCron)");
  }

  if (fallas.length) {
    console.log(`  ✗ UNIDADES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el pase cruza los disponibles de la ficha nueva: vista la que sigue, vendida la que falta (fuera de la guía y medida en bajas_avisos), sin escribir un precio");
  }
  return { hard: fallas.length };
}

// ACTA · verificado EN ROJO
// 02-oct-2026, scratchpad mutar-congelar.py: 13/13 en rojo, restauradas byte a byte.
//   U1  la lista vacía no corta (quedó VERDE al principio: el resguardo del cruce igual evitaba la venta,
//       pero reportaba «sin cruce»; el tier pasó a exigir que la lista vacía no marque nada) ... 1
//   U2  sin el resguardo del cruce ........................................................... 1
//   U3  el `~` del desempate viejo rompe el número ........................................... 1
//   U4  la inactiva que reaparece no vuelve a estar vista .................................... 1
//   U5  «119.65 m2» no se lee como número .................................................... 2
//   U6  un proyecto sin rango inventa uno .................................................... 2
//   U7  el pase escribe un precio ............................................................ 3
//   U8  sin cerrar_bajas() ................................................................... 4
//   U9  las no evaluadas pisan la fila con veredicto ......................................... 4
//   U10 el ensayo late ....................................................................... 4
//   U11 el ensayo deja resultado ............................................................. 4
//   U12 la vendida no se desactiva ........................................................... 4
//   U13 se vende lo que la ficha nueva nunca listó (el subconjunto del ensayo: 78 de 233) .... 1

if (require.main === module) {
  runUnidadesTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
