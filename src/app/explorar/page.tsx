import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { hrefEntrar } from "@/lib/entrar/entrada";
import { capturarServidor } from "@/lib/posthog-servidor";
import { esCombinacionDeLaNoche, EXPLORAR_COPY, filtrosDeUrl, MAPA_QUIETO, TOPE_HOJA } from "@/lib/explorar/explorar";
import { MAPA_QUIETO_M } from "@/lib/explorar/mapa-quieto";
import { cargarExplorar, eventoExplorarVista, filtrosDeLaCuenta } from "@/lib/explorar/servidor";
import { portadaDeptos } from "@/lib/deptos/portada";
import { robotDeVisita } from "@/lib/vista-entrada";
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
// desvanece cuando el mapa real terminó de dibujar sus teselas. EN EL TELÉFONO VA INCRUSTADA EN EL HTML (mapa-quieto.ts):
// como archivo precargado empezaba a bajar 1,3 s después del primer byte y el LCP quedaba en 2,5 s. Se dibuja ACÁ, en el
// servidor, y viaja al cliente como un nodo: así los 11 kB no entran al JS de la página.
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
  // Una combinación que la noche no tiene (24-oct-2026) se calcula en el momento: no en el SSR —tardaría segundos antes del
  // primer byte— sino desde el navegador, que la pide enseguida y mientras tanto dice «Calculando con tu pie…».
  const noche = esCombinacionDeLaNoche(filtros);
  // El total de anoche en Santiago (el de /deptos, cacheado): el aviso sin saldo lo dice (24-oct-2026).
  const [d, portada] = await Promise.all([cargarExplorar(admin, user, filtros, new Date(), { pines: noche }), portadaDeptos()]);
  const analizadosN = d.pines.filter((p) => d.analizados[p.avisoId]).length;
  void capturarServidor(eventoExplorarVista({ userId: user.id, filtros, n: noche ? d.n : null, analizados: analizadosN, fuente: "pagina", cuenta: d.cuenta, robot: robotDeVisita(headers().get("user-agent"), headers()) })).catch(() => false);
  const a = sp.get("a");
  return (
    <div className="ex-pagina" data-explorar="pagina">
      <link rel="preload" as="image" href={MAPA_QUIETO.d} media="(min-width: 768px)" fetchPriority="high" />
      {/* Sin «activo»: Explorar es el botón del header, y «Dashboard» no se enciende acá (25-oct-2026). */}
      <HeaderFranco sesion={{ email: user.email ?? "" }} />
      <ExplorarCliente
        inicial={d.cerrado ? {
          // SIN SALDO, CERRADO (24-oct-2026): todos los pines, sin detalle y con la combinación de la noche; nada que pedir después.
          filtros: d.filtros, n: d.n, analizadosN: 0, pines: d.pines, completo: true, calculando: false, analizados: {},
          saldo: d.saldo, ticket: d.ticket, cuentaCreadaAt: d.cuentaCreadaAt, finanzas: d.finanzas, desdePerfil: deUrl ? true : !!cuenta?.desdePerfil, cerrado: true, totalNoche: portada.noche?.convienen ?? null,
        } : {
          filtros, n: d.n, analizadosN, pines: d.pines.slice(0, TOPE_HOJA), completo: noche && d.n <= TOPE_HOJA, calculando: !noche, analizados: d.analizados,
          saldo: d.saldo, ticket: d.ticket, cuentaCreadaAt: d.cuentaCreadaAt, finanzas: d.finanzas, desdePerfil: deUrl ? true : !!cuenta?.desdePerfil, cerrado: false, totalNoche: portada.noche?.convienen ?? null,
        }}
        abrir={d.cerrado ? null : a}
        autoAnalizar={!d.cerrado && sp.get("analizar") === "1" ? a : null}
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
