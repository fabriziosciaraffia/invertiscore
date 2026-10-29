import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { capturarServidor } from "@/lib/posthog-servidor";
import { MAPA_QUIETO } from "@/lib/explorar/explorar";
import { MAPA_QUIETO_M } from "@/lib/explorar/mapa-quieto";
import { descompactar, filtrar, portalDeUrl, PORTAL_COPY, universoDeLaNoche } from "@/lib/explorar/portal";
import { cuentaPortal, eventoPortalVista } from "@/lib/explorar/portal-servidor";
import { convienenHoy, tasaDelMotor, universoDeLaNocheCacheado } from "@/lib/explorar/portal-cache";
import { robotDeVisita } from "@/lib/vista-entrada";
import { filtrosAbiertos, ordenAbierto, origenDeLlegada, PIE_ABIERTO, PLAZO_ABIERTO } from "@/lib/explorar/abierto";
import { ExplorarCliente } from "./explorar-cliente";
import { EsqueletoExplorar } from "./esqueleto";

// ─────────────────────────────────────────────────────────────────────────────
// /explorar COMO PORTAL (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html; reemplaza el del 23-oct).
// ABIERTO SIN CUENTA desde el 29-oct-2026 (la puerta E, mockup 6-puerta-e.html): sin sesión no redirige; el mapa, los grupos,
// los filtros y la lista se ven con pie 20 % y 25 años, sin cifras (abierto.ts), y registrarse sale de la hoja sobre el mapa.
// SIN NADA EN LA URL ABRE LA VISTA GLOBAL —todo Gran Santiago, arriendo tradicional, pie 20 % y 25 años, solo los
// Comprar: los supuestos del número de anoche—, NO el perfil de la persona («Mi búsqueda» lo aplica si lo toca). Con
// filtros en la URL (al volver, al recargar) abre con ellos. Sin saldo se explora igual: el cobro sale en «Analizar este».
// EL PRIMER PINTADO ES LIVIANO (LCP en el teléfono): el mapa quieto (la foto del mapa de Santiago, incrustada en el teléfono:
// es el LCP, medido el 23-oct-2026) sale con el ESQUELETO apenas se valida la sesión; la cuenta y el número llegan después
// en el mismo pedido (Suspense). Medido en producción el 28-oct-2026: esperando la cuenta antes de mandar el HTML, el LCP daba
// 2,53 s de mediana (1,3 s de «load delay»). El número sale de la misma caché de diez minutos que después baja al navegador.
// UNA SOLA IMAGEN, PRIMERA EN EL HTML (28-oct-2026, candidatos a LCP medidos en Chromium): con el mapa quieto dentro del
// esqueleto y del cliente, el navegador a veces pintaba antes el wordmark del header (el primer pintado) y el mapa quieto un
// cuadro después, o lo pintaba en el esqueleto y lo quitaba al llegar el cliente; Lighthouse le sumaba al LCP el JS que corría
// entremedio. Ahora es una capa de la página, antes del header en el HTML y en la fila de abajo de él (explorar.css): todo
// pintado que muestre el header ya la muestra, y nunca se reemplaza. Se desvanece cuando el mapa real dibujó sus teselas.
// Y no cubre la pantalla entera: una imagen del tamaño del viewport Chrome la toma por fondo y no la cuenta como LCP.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = { title: PORTAL_COPY.pestana, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// DECODIFICACIÓN SINCRÓNICA (28-oct-2026, medido en producción): con `decoding="async"` el mapa quieto se pintaba un cuadro
// DESPUÉS del primer pintado (observado: FCP 820 ms, LCP 831 ms) y la simulación de Lighthouse le sumaba al LCP todo el JS que
// arrancaba en esos 11 ms: 2,54 s de mediana, y el /explorar viejo daba 2,68 el 26-oct por lo mismo. Son 11 kB incrustados:
// decodificarlos en el mismo cuadro no cuesta nada.
const mapaQuieto = (
  <picture className="ex-mapa-quieto" data-explorar="mapa-quieto">
    <source media="(min-width: 768px)" srcSet={MAPA_QUIETO.d} />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={MAPA_QUIETO_M} alt="" width={560} height={426} fetchPriority="high" decoding="sync" />
  </picture>
);

export default async function ExplorarPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) if (typeof v === "string") sp.set(k, v);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const consulta = sp.toString();
  return (
    <div className="ex-pagina" data-explorar="pagina" data-cuenta={user ? undefined : "no"}>
      <link rel="preload" as="image" href={MAPA_QUIETO.d} media="(min-width: 768px)" fetchPriority="high" />
      {mapaQuieto}
      {/* Sin «activo»: Explorar es el botón del header, y «Dashboard» no se enciende acá (25-oct-2026). Sin cuenta, el de la
          entrada (wizard): el wordmark y «Entrar», sin pedir Supabase en el primer pintado (`sesion={null}`). */}
      {user ? <HeaderFranco sesion={{ email: user.email ?? "" }} /> : <HeaderFranco contexto="wizard" sesion={null} />}
      <Suspense fallback={<EsqueletoExplorar consulta={consulta} sinCuenta={!user} />}>
        {user ? <ExplorarConDatos consulta={consulta} user={user} /> : <ExplorarAbierto consulta={consulta} />}
      </Suspense>
    </div>
  );
}

/** SIN CUENTA (la puerta E): el número de anoche con pie 20 % y 25 años, y nada de la persona. La vista la emite el
 *  middleware (vista-entrada.ts › «explorar_abierto_vista», con la llegada y los robots marcados). */
async function ExplorarAbierto({ consulta }: { consulta: string }) {
  const sp = new URLSearchParams(consulta);
  const base = portalDeUrl(sp);
  const filtros = filtrosAbiertos(base.filtros);
  const orden = ordenAbierto(base.orden);
  // La bienvenida dice el número de todo el sitio (convienenHoy), aunque la URL traiga filtros; el del mapa es el filtrado.
  const [universo, tasa, convienen] = await Promise.all([
    universoDeLaNoche(filtros) ? universoDeLaNocheCacheado(PIE_ABIERTO, PLAZO_ABIERTO).catch(() => null) : Promise.resolve(null),
    tasaDelMotor(),
    convienenHoy(),
  ]);
  const n = universo ? filtrar(descompactar(universo), filtros).length : null;
  return <ExplorarCliente inicial={{ filtros, orden, n, cuenta: null, tasa, convienen }} abrir={sp.get("a")} origen={origenDeLlegada(sp.get("desde"))} />;
}

/** La cuenta y el número: lo que el esqueleto no espera. */
async function ExplorarConDatos({ consulta, user }: { consulta: string; user: User }) {
  const sp = new URLSearchParams(consulta);
  // LA VISTA GLOBAL SIN FILTROS DEL PERFIL: lo que diga la URL, y si no dice nada, la de anoche.
  const { filtros, orden } = portalDeUrl(sp);
  const admin = createServiceClient();
  const noche = universoDeLaNoche(filtros);
  const [cuenta, universo, tasa] = await Promise.all([
    cuentaPortal(admin, user),
    noche ? universoDeLaNocheCacheado(filtros.pie, filtros.plazo).catch(() => null) : Promise.resolve(null),
    tasaDelMotor(),
  ]);
  const n = universo ? filtrar(descompactar(universo), filtros).length : null;
  void capturarServidor(eventoPortalVista({ userId: user.id, filtros, orden, n, robot: robotDeVisita(headers().get("user-agent"), headers()) })).catch(() => false);
  const a = sp.get("a");
  return (
    <ExplorarCliente
      inicial={{ filtros, orden, n, cuenta, tasa, convienen: null }}
      abrir={a}
      autoAnalizar={sp.get("analizar") === "1" ? a : null}
      correo={user.email ?? null}
    />
  );
}
