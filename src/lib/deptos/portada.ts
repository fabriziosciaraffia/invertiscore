// ─────────────────────────────────────────────────────────────────────────────
// Lo que /deptos (y la página del invitado) muestra al entrar (17-oct-2026): el resumen de la noche para la frase de
// arriba y la respuesta de la búsqueda por defecto (Santiago, 2D, UF 3.000 a 4.000), las dos desde el servidor, así el
// número y el correo están desde el primer segundo. Cambian una vez por noche: diez minutos de caché, como la respuesta
// de /api/deptos/respuesta. Una falla no se guarda: la pantalla pide la respuesta al cargar y la frase sale sin cifra.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { ELECCIONES_POR_DEFECTO, validarElecciones, type RespuestaDeptos } from "./respuesta";
import { responderDeptos, resumenDeLaNoche, type ResumenNoche } from "./servidor";

export interface PortadaDeptos {
  noche: ResumenNoche | null;
  /** La respuesta de la búsqueda por defecto; null si falló (la pantalla la pide al cargar). */
  inicial: RespuestaDeptos | null;
}

const cacheada = unstable_cache(
  async (): Promise<PortadaDeptos> => {
    const admin = createServiceClient();
    const v = validarElecciones({ ...ELECCIONES_POR_DEFECTO, comunas: [...ELECCIONES_POR_DEFECTO.comunas], tipologias: [...ELECCIONES_POR_DEFECTO.tipologias] });
    if (!v.ok) throw new Error("la búsqueda por defecto no valida");
    const [noche, inicial] = await Promise.all([resumenDeLaNoche(admin), responderDeptos(admin, v)]);
    if (!noche) throw new Error("sin resumen de la noche");
    return { noche, inicial };
  },
  ["deptos-portada-v1"],
  { revalidate: 600 },
);

export async function portadaDeptos(): Promise<PortadaDeptos> {
  try {
    return await cacheada();
  } catch {
    return { noche: null, inicial: null };
  }
}
