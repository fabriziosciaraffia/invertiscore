// ─────────────────────────────────────────────────────────────────────────────
// PUNTO 1.1 DEL STOP 3 · LAS FICHAS DE USADOS QUE FALTAN PARA LA CURVA POR EDAD (decisión de Fabrizio, 05-nov-2026).
// Lee fichas de usados activos de seis comunas (Ñuñoa, Estación Central, San Miguel, Providencia, Vitacura, La Florida)
// por el MISMO camino del lector del informe: `leerFicha` (publicacion.ts: la ficha vieja y, si redirige, la nueva; dos
// GET por chequeo, sin reintentos) con `bajarFicha` (ficha-servidor.ts: mismos headers, sin seguir redirecciones, 8 s de
// tope, el proxy si PROXY_URL está). El año sale de `parsearAnioFicha` dentro de `leerFicha`.
//   · El almacén es LOCAL: nada se escribe en fichas_leidas, anios_edificio ni publicacion_avisos; los años van a
//     out/9-fichas-usados.json (reanudable). Guardarlos en la base queda para el goal de arreglos.
//   · De a una, con pausa al azar de 5 a 10 s entre chequeos. REGLA DE CORTE: tres respuestas finales seguidas que no sean
//     200, se detiene y reporta.
//   · Objetivo: n ≥ 30 avisos con año por comuna (año por ficha o compartido por edificio, la regla del informe); después,
//     con lo que quede del presupuesto (TOPE_CHEQUEOS), sigue repartido entre las seis para llenar los tramos de edad.
//   · Prioriza edificios sin año conocido (un aviso de un edificio ya conocido no agrega).
//   TOPE_CHEQUEOS=310 por defecto (~620 GET).
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { paginar, fmt, muestraConSemilla, tablaMd } from "./comun";
import { createServiceClient } from "../../../src/lib/supabase/service";
import { leerFicha, type AlmacenPublicacion, type LecturaFicha, type ResultadoLectura } from "../../../src/lib/guia/publicacion";
import { bajarFicha } from "../../../src/lib/guia/ficha-servidor";
import { claveEdificio } from "../../../src/lib/guia/ficha-anio";

const COMUNAS = ["Ñuñoa", "Estación Central", "San Miguel", "Providencia", "Vitacura", "La Florida"];
const OBJETIVO = 30;
const TOPE_CHEQUEOS = Number(process.env.TOPE_CHEQUEOS ?? 310);
const PAUSA_MIN_MS = 5000, PAUSA_MAX_MS = 10000;
const CORTE_SEGUIDAS = 3;
const SALIDA = "scripts/analisis/motor-nuevos/out/9-fichas-usados.json";
const LOG = "scripts/analisis/motor-nuevos/out/9-fichas-usados.log";
const log = (s: string) => { console.log(s); appendFileSync(LOG, s + "\n"); };

export interface LecturaLocal { avisoId: string; comuna: string; edificio: string; codigo: number | null; motivo: string; anio: number | null; gets: number; leidoAt: string }

async function main() {
  mkdirSync("scripts/analisis/motor-nuevos/out", { recursive: true });
  const sb = createServiceClient();
  const previas: LecturaLocal[] = existsSync(SALIDA) ? (JSON.parse(readFileSync(SALIDA, "utf8")) as { lecturas: LecturaLocal[] }).lecturas : [];
  const yaLeidas = new Set(previas.map((l) => l.avisoId));

  type U = { aviso_id: string; comuna: string; scraped_properties: { id: string; url: string | null; lat: number | string; lng: number | string } };
  const usados = await paginar<U>((a, b) => sb.from("avisos_evaluados").select("aviso_id, comuna, scraped_properties!inner(id, url, lat, lng)")
    .eq("condicion", "usado").in("comuna", COMUNAS).eq("scraped_properties.is_active", true).eq("scraped_properties.type", "venta").order("aviso_id").range(a, b) as never);
  const fichas = await paginar<{ aviso_id: string; anio: number | null; edificio: string | null }>((a, b) => sb.from("fichas_leidas").select("aviso_id, anio, edificio").order("aviso_id").range(a, b));
  const edificios = await paginar<{ edificio: string; anio: number }>((a, b) => sb.from("anios_edificio").select("edificio, anio").order("edificio").range(a, b));
  const anioEdificio = new Map<string, number>(edificios.map((e) => [e.edificio, e.anio]));
  for (const f of fichas) if (f.anio && f.edificio && !anioEdificio.has(f.edificio)) anioEdificio.set(f.edificio, f.anio);
  for (const l of previas) if (l.anio) anioEdificio.set(l.edificio, l.anio);
  const leidasEnBase = new Set(fichas.map((f) => f.aviso_id));

  const porComuna = new Map<string, Array<{ id: string; url: string | null; edificio: string }>>();
  for (const u of usados) {
    const sp = u.scraped_properties;
    porComuna.set(u.comuna, [...(porComuna.get(u.comuna) ?? []), { id: u.aviso_id, url: sp.url, edificio: claveEdificio({ comuna: u.comuna, lat: Number(sp.lat), lng: Number(sp.lng) }) }]);
  }
  const conAnio = (c: string) => (porComuna.get(c) ?? []).filter((u) => anioEdificio.has(u.edificio)).length;
  log(`usados activos en las seis comunas: ${fmt(usados.length)} · edificios con año conocidos: ${fmt(anioEdificio.size)} · lecturas locales previas: ${previas.length}`);
  log("con año hoy (ficha o edificio): " + COMUNAS.map((c) => `${c} ${conAnio(c)}`).join(" · "));

  // Candidatos por comuna: sin ficha leída, con URL, de edificio sin año; al azar con semilla.
  const candidatos = new Map(COMUNAS.map((c) => [c, muestraConSemilla((porComuna.get(c) ?? []).filter((u) => u.url && !leidasEnBase.has(u.id) && !yaLeidas.has(u.id) && !anioEdificio.has(u.edificio)), 10000, 20261105)]));

  // El almacén local: nada a la base. Cuenta los GET de la última hora solo para el log.
  const lecturas: LecturaLocal[] = [...previas];
  const gets: number[] = [];
  let actual: Partial<LecturaLocal> = {};
  const almacen: AlmacenPublicacion = {
    publicacion: async () => null,
    lecturasUltimaHora: async () => 0,
    anotar: async (l: LecturaFicha) => { gets.push(Date.now()); actual = { ...actual, avisoId: l.avisoId, edificio: l.edificio, codigo: l.codigo, motivo: l.motivo }; },
    cerrar: async () => {},
    guardarPublicacion: async () => {},
    despublicar: async () => {},
    alertarBloqueo: async () => {},
  };
  const guardar = () => writeFileSync(SALIDA, JSON.stringify({ calculadoAt: new Date().toISOString(), lecturas }, null, 1));

  let chequeos = 0, seguidasNo200 = 0, corte = false;
  const pasada = async (objetivoPorComuna: (c: string) => boolean) => {
    let avanzo = true;
    while (avanzo && chequeos < TOPE_CHEQUEOS && !corte) {
      avanzo = false;
      for (const c of COMUNAS) {
        if (chequeos >= TOPE_CHEQUEOS || corte) break;
        if (objetivoPorComuna(c)) continue;
        const u = candidatos.get(c)!.shift();
        if (!u) continue;
        avanzo = true;
        actual = {};
        const r: ResultadoLectura = await leerFicha({ id: u.id, url: u.url, edificio: u.edificio }, "clic", almacen, bajarFicha);
        chequeos++;
        const codigo = r.leida ? r.codigo : null;
        const l: LecturaLocal = { avisoId: u.id, comuna: c, edificio: u.edificio, codigo, motivo: r.leida ? r.motivo : r.razon, anio: r.leida ? r.anio : null, gets: r.gets, leidoAt: new Date().toISOString() };
        lecturas.push(l);
        if (l.anio) anioEdificio.set(u.edificio, l.anio);
        seguidasNo200 = codigo === 200 ? 0 : seguidasNo200 + 1;
        const ultimaHora = gets.filter((t) => Date.now() - t < 3600e3).length;
        log(`${chequeos}. ${c} · ${u.id.slice(0, 8)} · ${l.motivo} ${codigo ?? "-"} · año ${l.anio ?? "—"} · con año ${conAnio(c)} · GET última hora ${ultimaHora}`);
        guardar();
        if (seguidasNo200 >= CORTE_SEGUIDAS) { corte = true; log(`CORTE: ${CORTE_SEGUIDAS} respuestas seguidas que no son 200. Se detiene.`); break; }
        await new Promise((res) => setTimeout(res, PAUSA_MIN_MS + Math.random() * (PAUSA_MAX_MS - PAUSA_MIN_MS)));
      }
    }
  };
  // Primera pasada: hasta n ≥ 30 por comuna. Segunda: el resto del presupuesto, repartido.
  await pasada((c) => conAnio(c) >= OBJETIVO);
  if (!corte) await pasada(() => false);
  guardar();

  const nuevas = lecturas.slice(previas.length);
  log(`\nlisto: ${nuevas.length} chequeos, ${nuevas.reduce((s, l) => s + l.gets, 0)} GET · 200: ${nuevas.filter((l) => l.codigo === 200).length} · con año: ${nuevas.filter((l) => l.anio).length} · despublicados: ${nuevas.filter((l) => l.motivo === "despublicado").length} · bloqueo: ${nuevas.filter((l) => l.motivo === "bloqueo").length} · error/tiempo: ${nuevas.filter((l) => l.motivo === "error" || l.motivo === "tiempo").length}${corte ? " · CORTADO" : ""}`);
  console.log(tablaMd(["comuna", "usados activos", "con año antes", "chequeos", "200", "con año leído", "con año ahora (ficha o edificio)"], COMUNAS.map((c) => {
    const xs = nuevas.filter((l) => l.comuna === c);
    return [c, (porComuna.get(c) ?? []).length, (porComuna.get(c) ?? []).filter((u) => anioEdificio.has(u.edificio) && !xs.some((l) => l.edificio === u.edificio && l.anio)).length, xs.length, xs.filter((l) => l.codigo === 200).length, xs.filter((l) => l.anio).length, conAnio(c)];
  })));
}

main().catch((e) => { console.error(e); process.exit(1); });
