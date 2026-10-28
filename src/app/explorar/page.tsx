import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { capturarServidor } from "@/lib/posthog-servidor";
import { MAPA_QUIETO } from "@/lib/explorar/explorar";
import { MAPA_QUIETO_M } from "@/lib/explorar/mapa-quieto";
import { descompactar, filtrar, portalDeUrl, PORTAL_COPY, universoDeLaNoche } from "@/lib/explorar/portal";
import { cuentaPortal, eventoPortalVista } from "@/lib/explorar/portal-servidor";
import { universoDeLaNocheCacheado } from "@/lib/explorar/portal-cache";
import { robotDeVisita } from "@/lib/vista-entrada";
import { ExplorarCliente } from "./explorar-cliente";

// ─────────────────────────────────────────────────────────────────────────────
// /explorar COMO PORTAL (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html; reemplaza el del 23-oct). Con
// sesión. SIN NADA EN LA URL ABRE LA VISTA GLOBAL —todo Gran Santiago, arriendo tradicional, pie 20 % y 25 años, solo los
// Comprar: los supuestos del número de anoche—, NO el perfil de la persona («Mi búsqueda» lo aplica si lo toca). Con
// filtros en la URL (al volver, al recargar) abre con ellos. Sin saldo se explora igual: el cobro sale en «Analizar este».
// EL PRIMER PINTADO ES LIVIANO (LCP en el teléfono): el servidor dibuja la fila de arriba, el número del mapa con sus
// supuestos, la hoja cerrada y el mapa quieto (la foto del mapa de Santiago, incrustada en el teléfono: es el LCP, medido el
// 23-oct-2026); el número sale de la misma caché de diez minutos que después baja al navegador con el mapa interactivo.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = { title: PORTAL_COPY.pestana, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ExplorarPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) if (typeof v === "string") sp.set(k, v);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const consulta = sp.toString();
  if (!user) redirect(hrefEntrar(`/explorar${consulta ? `?${consulta}` : ""}`, "generico"));
  // LA VISTA GLOBAL SIN FILTROS DEL PERFIL: lo que diga la URL, y si no dice nada, la de anoche.
  const { filtros, orden } = portalDeUrl(sp);
  const admin = createServiceClient();
  const noche = universoDeLaNoche(filtros);
  const [cuenta, universo] = await Promise.all([
    cuentaPortal(admin, user),
    noche ? universoDeLaNocheCacheado(filtros.pie, filtros.plazo).catch(() => null) : Promise.resolve(null),
  ]);
  const n = universo ? filtrar(descompactar(universo), filtros).length : null;
  void capturarServidor(eventoPortalVista({ userId: user.id, filtros, orden, n, robot: robotDeVisita(headers().get("user-agent"), headers()) })).catch(() => false);
  const a = sp.get("a");
  return (
    <div className="ex-pagina" data-explorar="pagina">
      <link rel="preload" as="image" href={MAPA_QUIETO.d} media="(min-width: 768px)" fetchPriority="high" />
      {/* Sin «activo»: Explorar es el botón del header, y «Dashboard» no se enciende acá (25-oct-2026). */}
      <HeaderFranco sesion={{ email: user.email ?? "" }} />
      <ExplorarCliente
        inicial={{ filtros, orden, n, cuenta }}
        abrir={a}
        autoAnalizar={sp.get("analizar") === "1" ? a : null}
        mapaQuieto={
          <picture className="ex-mapa-quieto" data-explorar="mapa-quieto">
            <source media="(min-width: 768px)" srcSet={MAPA_QUIETO.d} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MAPA_QUIETO_M} alt="" width={560} height={514} fetchPriority="high" decoding="async" />
          </picture>
        }
      />
    </div>
  );
}
