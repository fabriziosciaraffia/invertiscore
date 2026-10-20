// ─────────────────────────────────────────────────────────────────────────────
// Lo que /deptos (y la página del invitado) muestra al entrar (17-oct-2026): el resumen de la noche para la frase de
// arriba y la respuesta de la búsqueda por defecto (Santiago, 2D, UF 3.000 a 4.000), las dos desde el servidor, así el
// número y el correo están desde el primer segundo. Cambian una vez por noche: diez minutos de caché, como la respuesta
// de /api/deptos/respuesta. Una falla no se guarda: la pantalla pide la respuesta al cargar y la frase sale sin cifra.
//
// CON UNA COMUNA ELEGIDA (20-oct-2026): «Ver los deptos de Ñuñoa» de las páginas de comuna llega con `?comuna=`. La
// búsqueda arranca con esa comuna (en vez de Santiago) y su número viene igual del servidor, cacheado por comuna.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { ELECCIONES_POR_DEFECTO, validarElecciones, type RespuestaDeptos } from "./respuesta";
import { responderDeptos, resumenDeLaNoche, type ResumenNoche } from "./servidor";

export interface PortadaDeptos {
  noche: ResumenNoche | null;
  /** La respuesta de la búsqueda inicial; null si falló (la pantalla la pide al cargar). */
  inicial: RespuestaDeptos | null;
  /** Las comunas de la búsqueda inicial: las por defecto, o la de `?comuna=`. */
  comunas: string[];
}

/** Sin tildes, sin mayúsculas y con guiones como espacios: «puente-alto», «Ñuñoa» y «nunoa» se reconocen. */
const plano = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-/g, " ").trim();

/** La comuna de `?comuna=` (nombre o slug), si /deptos la ofrece; si no, null y la búsqueda arranca por defecto. */
export function comunaDeLaUrl(texto: string | string[] | null | undefined): string | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  const p = plano(texto);
  return (COMUNAS_DISPONIBLES as readonly string[]).find((c) => plano(c) === p) ?? null;
}

const cacheada = unstable_cache(
  async (comuna: string): Promise<PortadaDeptos> => {
    const admin = createServiceClient();
    const comunas = comuna ? [comuna] : [...ELECCIONES_POR_DEFECTO.comunas];
    const v = validarElecciones({ ...ELECCIONES_POR_DEFECTO, comunas, tipologias: [...ELECCIONES_POR_DEFECTO.tipologias] });
    if (!v.ok) throw new Error("la búsqueda inicial no valida");
    const [noche, inicial] = await Promise.all([resumenDeLaNoche(admin), responderDeptos(admin, v)]);
    if (!noche) throw new Error("sin resumen de la noche");
    return { noche, inicial, comunas };
  },
  ["deptos-portada-v2"],
  { revalidate: 600 },
);

export async function portadaDeptos(comuna: string | null = null): Promise<PortadaDeptos> {
  try {
    return await cacheada(comuna ?? "");
  } catch {
    return { noche: null, inicial: null, comunas: comuna ? [comuna] : [...ELECCIONES_POR_DEFECTO.comunas] };
  }
}
