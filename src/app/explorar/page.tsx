import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EXPLORAR_COPY, filtrosDeUrl, MAPA_QUIETO, TOPE_HOJA } from "@/lib/explorar/explorar";
import { cargarExplorar, eventoExplorarVista, filtrosDeLaCuenta } from "@/lib/explorar/servidor";
import { ExplorarCliente } from "./explorar-cliente";

// ─────────────────────────────────────────────────────────────────────────────
// /explorar (23-oct-2026, mockup docs/puerta-b-mockups/5-explorar.html): el mapa de todos los deptos que convienen con
// una búsqueda, con la evaluación de la noche. Con sesión. Abre con el perfil de la persona como filtros (o con los de la
// URL, si vuelve); cambiarlos no toca el perfil. Solo los Comprar; explorar no gasta, analizar sí.
// EL PRIMER PINTADO ES LIVIANO (LCP en el teléfono): el servidor dibuja los chips, la píldora y la hoja con las primeras
// tarjetas; el mapa es interactivo pero carga DESPUÉS del primer pintado (next/dynamic, con la página quieta), y el resto
// de los pines llega por /api/explorar cuando el mapa está por montarse.
// EL MAPA QUIETO (23-oct-2026, medido en producción): sin él, Lighthouse tomaba como LCP la primera tesela de Google Maps
// —que llega a los 8 s, después del load— y daba 9,7 s con el primer pintado a 1,3 s. Una foto quieta del mapa de Santiago
// con el estilo de Franco (public/explorar/mapa-quieto-*.webp, 16/32 kB), precargada desde el <head> y pintada debajo del
// mapa desde el primer cuadro, es lo más grande de la pantalla: es el LCP, y las teselas, más chicas, no lo mueven. Se
// desvanece cuando el mapa real terminó de dibujar sus teselas.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = { title: EXPLORAR_COPY.pestana, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ExplorarPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) if (typeof v === "string") sp.set(k, v);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const consulta = sp.toString();
  if (!user) redirect(hrefEntrar(`/explorar${consulta ? `?${consulta}` : ""}`, "generico"));
  const admin = createServiceClient();
  const deUrl = filtrosDeUrl(sp);
  const cuenta = deUrl ? null : await filtrosDeLaCuenta(admin, user.id);
  const filtros = deUrl ?? cuenta!.filtros;
  const d = await cargarExplorar(admin, user, filtros);
  const analizadosN = d.pines.filter((p) => d.analizados[p.avisoId]).length;
  void capturarServidor(eventoExplorarVista({ userId: user.id, filtros, n: d.n, analizados: analizadosN, fuente: "pagina" })).catch(() => false);
  const a = sp.get("a");
  return (
    <div className="ex-pagina" data-explorar="pagina">
      <link rel="preload" as="image" href={MAPA_QUIETO.m} media="(max-width: 767px)" fetchPriority="high" />
      <link rel="preload" as="image" href={MAPA_QUIETO.d} media="(min-width: 768px)" fetchPriority="high" />
      <HeaderFranco activo="mis" sesion={{ email: user.email ?? "" }} />
      <ExplorarCliente
        inicial={{
          filtros, n: d.n, analizadosN, pines: d.pines.slice(0, TOPE_HOJA), completo: d.n <= TOPE_HOJA, analizados: d.analizados,
          saldo: d.saldo, ticket: d.ticket, cuentaCreadaAt: d.cuentaCreadaAt, finanzas: d.finanzas, desdePerfil: deUrl ? true : !!cuenta?.desdePerfil,
        }}
        abrir={a}
        autoAnalizar={sp.get("analizar") === "1" ? a : null}
      />
    </div>
  );
}
