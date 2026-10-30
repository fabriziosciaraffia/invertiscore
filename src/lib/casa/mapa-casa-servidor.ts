// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE LA SELECCIÓN, del lado del servidor (24-oct-2026): las coordenadas de los deptos de la selección salen de
// `scraped_properties` (la selección guarda solo lo que las tarjetas muestran), y los demás que convienen con la búsqueda
// de la persona, de la misma RPC que el mapa de Explorar (lib/explorar/servidor.ts › pinesExplorar, con los filtros de su
// perfil). Nada acá escribe. Si algo falla, el mapa sale sin grises (o sin pines) y el dashboard sigue.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { filtrosDeLaCuenta, pinesExplorar } from "@/lib/explorar/servidor";
import { cajaParaComuna } from "@/lib/comuna-bounds";
import { encuadrar, enImagen, MAPA_CASA, urlMapaCasa, type Encuadre } from "./mapa-casa";

const RUTA = "lib/casa/mapa-casa";
/** Hasta cuántos grises se dibujan: más de eso es una mancha. */
const TOPE_GRISES = 400;

export interface DatosMapaCasa {
  encuadre: Encuadre;
  /** La imagen de fondo; null sin la llave (queda el fondo plano con los pines). */
  url: string | null;
  /** La misma imagen en el estilo oscuro (30-oct-2026): el tema decide cuál se ve. */
  urlOscuro?: string | null;
  /** Los de la selección, numerados en su orden, con su lugar en la imagen. */
  seleccion: Array<{ n: number; avisoId: string; x: number; y: number }>;
  /** Los demás que convienen con la búsqueda, dentro de la imagen. */
  grises: Array<{ x: number; y: number }>;
  nSeleccion: number;
  /** Cuántos convienen con la búsqueda en total (los pines de Explorar), y cuántos de esos no están en la selección. */
  nConvienen: number;
  nOtros: number;
  desdePerfil: boolean;
  /** Las comunas de su perfil: la píldora dice dónde están los grises («11 más en Providencia»). */
  comunas: string[];
}

export async function datosMapaCasa(
  admin: SupabaseClient,
  userId: string,
  seleccion: Array<{ avisoId: string; comuna: string }>,
  apiKey: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  opts: { grises?: boolean } = {},
): Promise<DatosMapaCasa> {
  // «Estás dentro» (24-oct-2026) lleva solo la selección: sin los grises no se leen los pines de Explorar.
  const conGrises = opts.grises ?? true;
  const ids = seleccion.map((s) => s.avisoId);
  const [coords, explorar] = await Promise.all([
    ids.length > 0
      ? admin.from("scraped_properties").select("id, lat, lng").in("id", ids.slice(0, 50)).order("id").limit(50)
      : Promise.resolve({ data: [] as Array<{ id: string; lat: number | null; lng: number | null }>, error: null }),
    (async () => {
      const nada = (desdePerfil: boolean, comunas: string[] = []) => ({ pines: [] as Array<{ avisoId: string; lat: number; lng: number }>, desdePerfil, comunas });
      if (!conGrises) return nada(false);
      try {
        const { filtros, desdePerfil } = await filtrosDeLaCuenta(admin, userId);
        if (!desdePerfil) return nada(desdePerfil);
        return { pines: await pinesExplorar(admin, filtros), desdePerfil, comunas: [...filtros.comunas] };
      } catch (e) {
        reportarFalloQuery(e instanceof Error ? { message: e.message } : { message: String(e) }, { ruta: RUTA, operacion: "pines", userId });
        return nada(false);
      }
    })(),
  ]);
  reportarFalloQuery(coords.error, { ruta: RUTA, operacion: "coords", userId });
  const porId = new Map<string, { lat: number; lng: number }>();
  for (const r of (coords.data ?? []) as Array<{ id: string; lat: number | null; lng: number | null }>) {
    if (r.lat != null && r.lng != null) porId.set(r.id, { lat: Number(r.lat), lng: Number(r.lng) });
  }
  const puntosSel = seleccion.map((s) => porId.get(s.avisoId)).filter((p): p is { lat: number; lng: number } => !!p);
  // Sin coordenadas de la selección, el encuadre es el de su primera comuna.
  let encuadre = encuadrar(puntosSel);
  if (puntosSel.length === 0 && seleccion[0]) {
    const [s, w, n, e] = cajaParaComuna(seleccion[0].comuna);
    encuadre = { ...encuadrar([{ lat: s, lng: w }, { lat: n, lng: e }]), lat: (s + n) / 2, lng: (w + e) / 2 };
  }
  const enSel = new Set(ids);
  const otros = explorar.pines.filter((p) => !enSel.has(p.avisoId));
  const grises: Array<{ x: number; y: number }> = [];
  for (const p of otros) {
    const q = enImagen(p, encuadre);
    if (q) grises.push(q);
    if (grises.length >= TOPE_GRISES) break;
  }
  return {
    encuadre,
    url: urlMapaCasa(encuadre, apiKey),
    urlOscuro: urlMapaCasa(encuadre, apiKey, MAPA_CASA, "dark"),
    seleccion: seleccion.flatMap((s, i) => { const p = porId.get(s.avisoId); const q = p ? enImagen(p, encuadre) : null; return q ? [{ n: i + 1, avisoId: s.avisoId, ...q }] : []; }),
    grises,
    nSeleccion: seleccion.length,
    nConvienen: explorar.pines.length,
    nOtros: otros.length,
    desdePerfil: explorar.desdePerfil,
    comunas: explorar.comunas,
  };
}
