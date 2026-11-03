// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE LA SELECCIÓN, del lado del servidor (24-oct-2026): las coordenadas de los deptos de la selección salen de
// `scraped_properties` (la selección guarda solo lo que las tarjetas muestran), y los demás que convienen con la búsqueda
// de la persona, de la misma RPC que el mapa de Explorar (lib/explorar/servidor.ts › pinesExplorar, con los filtros de su
// perfil). Nada acá escribe. Si algo falla, el mapa sale sin grises (o sin pines) y el dashboard sigue.
// DOS TAMAÑOS (03-nov-2026, la pasada real de Fabrizio): el del teléfono (MAPA_CASA) y el del PC (MAPA_CASA_PC), cada uno con su
// encuadre, su imagen y sus pines: la imagen se pide al tamaño que ocupa y nunca se estira. Cada pin lleva su clase (el color).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { filtrosDeLaCuenta, pinesExplorar } from "@/lib/explorar/servidor";
import { cajaParaComuna } from "@/lib/comuna-bounds";
import type { ClasePin } from "@/lib/explorar/colores-pin";
import { encuadrar, enImagen, MAPA_CASA, MAPA_CASA_PC, urlMapaCasa, type Encuadre, type MedidasMapaCasa } from "./mapa-casa";

const RUTA = "lib/casa/mapa-casa";
/** Hasta cuántos grises se dibujan: más de eso es una mancha. */
const TOPE_GRISES = 400;

/** Una imagen del mapa a un tamaño: su encuadre, su URL (clara y oscura) y los pines puestos en ella. */
export interface ImagenMapaCasa {
  ancho: number;
  alto: number;
  encuadre: Encuadre;
  /** La imagen de fondo; null sin la llave (queda el fondo plano con los pines). */
  url: string | null;
  /** La misma imagen en el estilo oscuro (30-oct-2026): el tema decide cuál se ve. */
  urlOscuro?: string | null;
  /** Los de la selección, numerados en su orden, con su lugar en la imagen y su clase (el color del pin). */
  seleccion: Array<{ n: number; avisoId: string; x: number; y: number; clase: ClasePin }>;
  /** Los demás que convienen con la búsqueda, dentro de la imagen. */
  grises: Array<{ x: number; y: number }>;
}

export interface DatosMapaCasa extends ImagenMapaCasa {
  /** La del PC (03-nov-2026). Falta en los datos guardados de antes: el PC usa la del teléfono. */
  pc?: ImagenMapaCasa;
  nSeleccion: number;
  /** Cuántos convienen con la búsqueda en total (los pines de Explorar), y cuántos de esos no están en la selección. */
  nConvienen: number;
  nOtros: number;
  desdePerfil: boolean;
  /** Las comunas de su perfil: la píldora dice dónde están los grises («11 más en Providencia»). */
  comunas: string[];
}

/** Un depto de la selección para el mapa: el aviso, su comuna y la clase de su pin (por defecto, ✓ Comprar). */
export type DeptoDelMapa = { avisoId: string; comuna: string; clase?: ClasePin };

export async function datosMapaCasa(
  admin: SupabaseClient,
  userId: string,
  seleccion: DeptoDelMapa[],
  apiKey: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  /** `pc`: el tamaño de la imagen del PC (el del dashboard, o el de «Estás dentro», que es más angosta). */
  opts: { grises?: boolean; pc?: MedidasMapaCasa } = {},
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
  const enSel = new Set(ids);
  const otros = explorar.pines.filter((p) => !enSel.has(p.avisoId));

  /** La imagen a un tamaño: el encuadre que hace entrar a la selección (sin coordenadas, el de su primera comuna), la URL y los pines. */
  const imagen = (o: MedidasMapaCasa): ImagenMapaCasa => {
    let encuadre = encuadrar(puntosSel, o);
    if (puntosSel.length === 0 && seleccion[0]) {
      const [s, w, n, e] = cajaParaComuna(seleccion[0].comuna);
      encuadre = { ...encuadrar([{ lat: s, lng: w }, { lat: n, lng: e }], o), lat: (s + n) / 2, lng: (w + e) / 2 };
    }
    const grises: Array<{ x: number; y: number }> = [];
    for (const p of otros) {
      const q = enImagen(p, encuadre, o);
      if (q) grises.push(q);
      if (grises.length >= TOPE_GRISES) break;
    }
    return {
      ancho: o.ancho,
      alto: o.alto,
      encuadre,
      url: urlMapaCasa(encuadre, apiKey, o),
      urlOscuro: urlMapaCasa(encuadre, apiKey, o, "dark"),
      seleccion: seleccion.flatMap((s, i) => { const p = porId.get(s.avisoId); const q = p ? enImagen(p, encuadre, o) : null; return q ? [{ n: i + 1, avisoId: s.avisoId, ...q, clase: s.clase ?? "comprar" }] : []; }),
      grises,
    };
  };

  return {
    ...imagen(MAPA_CASA),
    pc: imagen(opts.pc ?? MAPA_CASA_PC),
    nSeleccion: seleccion.length,
    nConvienen: explorar.pines.length,
    nOtros: otros.length,
    desdePerfil: explorar.desdePerfil,
    comunas: explorar.comunas,
  };
}
