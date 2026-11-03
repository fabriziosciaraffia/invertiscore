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
import { portalDeUrl, PORTAL_COPY, universoDeLaNoche } from "@/lib/explorar/portal";
import { cuentaPortal, eventoPortalVista } from "@/lib/explorar/portal-servidor";
import { nocheExplorar, tasaDelMotor } from "@/lib/explorar/portal-cache";
import { cifrasDeLaNoche } from "@/lib/explorar/cifras-noche";
import { esTopeNegociar } from "@/lib/explorar/capa-negociar";
import { esRobot, robotDeVisita } from "@/lib/vista-entrada";
import { filtrosAbiertos, ordenAbierto, origenDeLlegada, PIE_ABIERTO, PLAZO_ABIERTO } from "@/lib/explorar/abierto";
import { llegadaDeExplorar } from "@/lib/explorar/puertas-landing";
import { compartidoDeUrl } from "@/lib/explorar/enlace-compartido";
import { contenidoVistaPrevia, negDelEnlace, rutaVistaPrevia, VISTA_PREVIA_PX } from "@/lib/explorar/compartir";
import { fichaCompartida, fichaCompartidaCacheada } from "@/lib/explorar/compartir-servidor";
import { firmaCompartidoValida } from "@/lib/explorar/firma-compartido";
import { ExplorarCliente, type CompartidoCliente } from "./explorar-cliente";
import { EsqueletoExplorar } from "./esqueleto";

// ─────────────────────────────────────────────────────────────────────────────
// /explorar COMO PORTAL (28-oct-2026, mockup docs/puerta-b-mockups/5b-explorar-portal.html; reemplaza el del 23-oct).
// ABIERTO SIN CUENTA desde el 29-oct-2026 (la puerta E, mockup 6-puerta-e.html): sin sesión no redirige; el mapa, los grupos,
// los filtros y la lista se ven con el financiamiento por defecto (pie 20 % y 30 años), sin cifras (abierto.ts), y registrarse sale de la hoja sobre el mapa.
// SIN NADA EN LA URL ABRE LA VISTA GLOBAL —todo Gran Santiago, arriendo tradicional, el financiamiento por defecto (pie 20 % y 30 años), solo los
// Comprar: los supuestos del número de anoche—, NO el perfil de la persona («Mi búsqueda» lo aplica si lo toca). Con
// filtros en la URL (al volver, al recargar) abre con ellos. Sin saldo se explora igual: el cobro sale en «Analizar este».
// EL PRIMER PINTADO ES LIVIANO (LCP en el teléfono): el mapa quieto (la foto del mapa de Santiago, incrustada en el teléfono:
// es el LCP, medido el 23-oct-2026) sale con el ESQUELETO apenas se valida la sesión; la cuenta y el número llegan después
// en el mismo pedido (Suspense). Medido en producción el 28-oct-2026: esperando la cuenta antes de mandar el HTML, el LCP daba
// 2,53 s de mediana (1,3 s de «load delay»). El número sale de la misma noche que después baja al navegador: la página le pasa
// su sello y la API lee esa misma entrada (portal-cache.ts › nocheExplorar, 03-nov-2026).
// UNA SOLA IMAGEN, PRIMERA EN EL HTML (28-oct-2026, candidatos a LCP medidos en Chromium): con el mapa quieto dentro del
// esqueleto y del cliente, el navegador a veces pintaba antes el wordmark del header (el primer pintado) y el mapa quieto un
// cuadro después, o lo pintaba en el esqueleto y lo quitaba al llegar el cliente; Lighthouse le sumaba al LCP el JS que corría
// entremedio. Ahora es una capa de la página, antes del header en el HTML y en la fila de abajo de él (explorar.css): todo
// pintado que muestre el header ya la muestra, y nunca se reemplaza. Se desvanece cuando el mapa real dibujó sus teselas.
// Y no cubre la pantalla entera: una imagen del tamaño del viewport Chrome la toma por fondo y no la cuenta como LCP.
// ─────────────────────────────────────────────────────────────────────────────

const METADATOS: Metadata = { title: PORTAL_COPY.pestana, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** EL TOPE QUE TRAE EL ENLACE DE UN NEGOCIADO (`n`), tal cual: desde el 03-nov-2026 los filtros de la página tienen siempre un
 *  descuento máximo (10 % de entrada), así que un enlace de un ✓ Comprar —sin `n`— no puede leerse como el de un negociado. */
const topeDelEnlaceEnUrl = (sp: URLSearchParams): number | null => (esTopeNegociar(sp.get("n")) ? Number(sp.get("n")) : null);

/**
 * LA VISTA PREVIA DE UN DEPTO COMPARTIDO (02-nov-2026, lib/explorar/compartir.ts): con `?a=…&desde=compartido`, el título
 * y la imagen que leen WhatsApp y las redes son los del depto —la línea, el precio y el chip ✓ Comprar, sin más cifras—, y
 * la imagen la genera /api/og/depto. SOLO PARA LOS ROBOTS DE VISTA PREVIA (los que reconoce `esRobot`: WhatsApp, Meta,
 * Telegram, Slack…): a una persona estos metadatos no le sirven, y en Next 14 los metadatos se esperan antes de mandar el
 * primer byte, así que leer la ficha le costaría el LCP del mapa quieto. Sin robot, los de siempre, sin esperar nada.
 */
export async function generateMetadata({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }): Promise<Metadata> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) if (typeof v === "string") sp.set(k, v);
  const c = compartidoDeUrl(sp);
  if (!c || !esRobot(headers().get("user-agent"))) return METADATOS;
  // LA FIRMA (03-nov-2026): la vista previa con cifras, solo con un enlace firmado por el servidor para ese aviso y ese código;
  // sin firma o con la de otro aviso, la de siempre de /explorar.
  if (!firmaCompartidoValida(c.avisoId, c.codigo, c.firma)) return METADATOS;
  // El de un negociado lleva el tope de la capa (`n`, 03-nov-2026): la ficha lo verifica con los datos de hoy.
  const tope = topeDelEnlaceEnUrl(sp);
  const ficha = await fichaCompartidaCacheada(c.avisoId, c.modalidad, tope).catch(() => null);
  if (!ficha) return METADATOS;
  const v = contenidoVistaPrevia(ficha);
  const imagen = { url: rutaVistaPrevia(c.avisoId, c.modalidad, ficha.tope ?? null, { f: c.firma!, i: c.codigo }), width: VISTA_PREVIA_PX.ancho, height: VISTA_PREVIA_PX.alto, alt: v.titulo };
  return {
    ...METADATOS,
    title: { absolute: v.titulo },
    description: v.descripcion,
    openGraph: { title: v.titulo, description: v.descripcion, siteName: "Franco", locale: "es_CL", type: "website", images: [imagen] },
    twitter: { card: "summary_large_image", title: v.titulo, description: v.descripcion, images: [imagen.url] },
  };
}

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
      <Suspense fallback={<EsqueletoExplorar />}>
        {user ? <ExplorarConDatos consulta={consulta} user={user} /> : <ExplorarAbierto consulta={consulta} />}
      </Suspense>
    </div>
  );
}

/**
 * EL DEPTO DE UN ENLACE COMPARTIDO (02-nov-2026): si sigue publicado y lo que se sabe de él, para la tarjeta de «ya no está»
 * con sus parecidos. Si da Comprar lo decide el navegador con el universo que carga (el mismo que dibuja); acá solo se lee
 * la fila, en paralelo con lo demás. Null sin enlace compartido o si el aviso no existe.
 * EL DE UN NEGOCIADO (con el tope de la capa en la URL, 03-nov-2026): la ficha entera, verificada con los datos de hoy (la
 * misma en caché que la vista previa): «no-llega» si ya no llega dentro del tope, o el negociado de hoy. TAMBIÉN SIN CUENTA
 * (decisión de Fabrizio, 03-nov-2026): el precio negociado y el descuento del depto del enlace se ven nítidos —el texto que
 * llegó y la vista previa ya los dicen—; el flujo a ese precio no viaja, como el resto de las cifras sin cuenta. Los demás de
 * la capa siguen borrosos.
 * SOLO CON FIRMA (03-nov-2026, firma-compartido.ts): sin cuenta, un enlace sin firma o con la de otro aviso abre el pin como
 * /explorar sin cuenta de siempre —borroso, y sin la verificación de hoy, que lee comparables—; los enlaces de antes de la
 * firma siguen abriendo su pin así. Con cuenta la firma no cambia nada: la cuenta ya ve las cifras.
 */
async function compartidoDe(sp: URLSearchParams, tope: number | null, conCuenta: boolean): Promise<CompartidoCliente | null> {
  const c = compartidoDeUrl(sp);
  if (!c) return null;
  const firmado = firmaCompartidoValida(c.avisoId, c.codigo, c.firma);
  if (tope != null && c.modalidad === "ltr" && (conCuenta || firmado)) {
    const f = await fichaCompartidaCacheada(c.avisoId, "ltr", tope).catch(() => null);
    const estado = f?.estado === "despublicado" ? "despublicado" : f?.estado === "no-llega" ? "no-llega" : null;
    return { avisoId: c.avisoId, estado, depto: f?.depto ?? null, tope, neg: negDelEnlace(f, { conCuenta, firmado }) };
  }
  if (tope != null && c.modalidad === "ltr") {
    // Sin firma: lo de siempre (despublicado o no), con el tope para que el navegador espere la capa y abra el pin, borroso.
    const f = await fichaCompartida(createServiceClient(), c.avisoId, "ltr", { veredicto: false }).catch(() => null);
    return { avisoId: c.avisoId, estado: f?.estado === "despublicado" ? "despublicado" : null, depto: f?.depto ?? null, tope, neg: null };
  }
  const f = await fichaCompartida(createServiceClient(), c.avisoId, c.modalidad, { veredicto: false }).catch(() => null);
  return { avisoId: c.avisoId, estado: f ? (f.estado === "despublicado" ? "despublicado" : null) : null, depto: f?.depto ?? null };
}

/** SIN CUENTA (la puerta E): el número de anoche con el financiamiento por defecto (pie 20 % y 30 años), y nada de la persona. La vista la emite el
 *  middleware (vista-entrada.ts › «explorar_abierto_vista», con la llegada y los robots marcados). */
async function ExplorarAbierto({ consulta }: { consulta: string }) {
  const sp = new URLSearchParams(consulta);
  const base = portalDeUrl(sp);
  const filtros = filtrosAbiertos(base.filtros);
  const orden = ordenAbierto(base.orden);
  // UNA SOLA LECTURA DE LA NOCHE (02-nov-2026; con la capa y un sello desde el 03-nov, portal-cache.ts › nocheExplorar): el mapa
  // abierto, la bienvenida y la barra cuentan la misma noche (pie 20 % y 30 años), y el sello baja al navegador para que la API
  // le traiga esa misma.
  const [noche, tasa, compartido] = await Promise.all([
    nocheExplorar(PIE_ABIERTO, PLAZO_ABIERTO).catch(() => null),
    tasaDelMotor(),
    compartidoDe(sp, topeDelEnlaceEnUrl(sp), false),
  ]);
  // La bienvenida dice el número de todo el sitio, aunque la URL traiga filtros; el del mapa es el filtrado. Y, aparte, cuántos
  // más llegan negociando (03-nov-2026), en la vista global: nunca sumados a los que convienen. La barra del primer pintado:
  // los − Ajustar con los filtros de la URL; 0 si la capa no se ve con ellos.
  const { n, convienen, negociadosGlobal, nAjustar } = cifrasDeLaNoche(noche, filtros);
  return <ExplorarCliente inicial={{ filtros, orden, n, cuenta: null, tasa, convienen, negociadosGlobal, nAjustar, sello: noche?.sello ?? null }} abrir={compartido?.avisoId ?? sp.get("a")} compartido={compartido} origen={origenDeLlegada(sp.get("desde"))} />;
}

/** La cuenta y el número: lo que el esqueleto no espera. */
async function ExplorarConDatos({ consulta, user }: { consulta: string; user: User }) {
  const sp = new URLSearchParams(consulta);
  // LA VISTA GLOBAL SIN FILTROS DEL PERFIL: lo que diga la URL, y si no dice nada, la de anoche.
  const { filtros, orden } = portalDeUrl(sp);
  const admin = createServiceClient();
  const [cuenta, noche, tasa, compartido] = await Promise.all([
    cuentaPortal(admin, user),
    // Una sola noche, con su sello (portal-cache.ts › nocheExplorar): el universo y la capa juntos, la misma que bajará la API.
    universoDeLaNoche(filtros) ? nocheExplorar(filtros.pie, filtros.plazo).catch(() => null) : Promise.resolve(null),
    tasaDelMotor(),
    compartidoDe(sp, topeDelEnlaceEnUrl(sp), true),
  ]);
  // La barra del primer pintado (03-nov-2026): los − Ajustar con estos filtros; 0 si la capa no se ve con ellos.
  const { n, nAjustar } = cifrasDeLaNoche(noche, filtros);
  void capturarServidor(eventoPortalVista({ userId: user.id, filtros, orden, n, robot: robotDeVisita(headers().get("user-agent"), headers()), llegada: llegadaDeExplorar(sp.get("desde")) })).catch(() => false);
  const a = compartido?.avisoId ?? sp.get("a");
  return (
    <ExplorarCliente
      inicial={{ filtros, orden, n, cuenta, tasa, convienen: null, negociadosGlobal: null, nAjustar, sello: noche?.sello ?? null }}
      abrir={a}
      compartido={compartido}
      autoAnalizar={sp.get("analizar") === "1" ? a : null}
      correo={user.email ?? null}
    />
  );
}
