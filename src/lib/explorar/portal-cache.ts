// El universo de la noche, en caché diez minutos (28-oct-2026): es el mismo para todas las cuentas y cambia una vez por
// noche, como el número de /deptos (lib/deptos/portada.ts). La página lo usa para el número del primer pintado y la API
// para el mapa: los dos leen la MISMA entrada, así el número no salta cuando llegan los pines. Una falla no se guarda.
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { compactar, type UniversoCompacto } from "./portal";
import { universoDeLaNoche } from "./portal-servidor";

const cacheado = unstable_cache(
  async (pie: number, plazo: number): Promise<UniversoCompacto> => compactar(await universoDeLaNoche(createServiceClient(), pie, plazo)),
  ["explorar-mapa-v1"],
  { revalidate: 600 },
);

export function universoDeLaNocheCacheado(pie: number, plazo: number): Promise<UniversoCompacto> {
  return cacheado(pie >= 30 ? 30 : 20, plazo >= 30 ? 30 : 25);
}
