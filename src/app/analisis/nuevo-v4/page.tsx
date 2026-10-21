"use client";

// Wizard v4 — el wizard de producción (`RUTA_WIZARD`, src/lib/cta-analizar.ts). El v3
// (/analisis/nuevo-v2) se borró el 25-sep-2026 y su ruta redirige acá.

import { Suspense, useMemo } from "react";
import { leerPedidoReanalisis } from "@/lib/reanalisis";
import { useSearchParams } from "next/navigation";
import { WizardV4 } from "@/components/formulario-v4/WizardV4";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { COMUNAS } from "@/lib/comunas";
import { normalizeComuna } from "@/lib/comuna-normalizar";
import { leerDireccionLlegada, leerModoLlegada } from "@/components/entrada/llegada";

function NuevoAnalisisV4Inner() {
  const searchParams = useSearchParams();
  const resume = searchParams.get("resume") === "1";

  // ?comuna= — llega desde las páginas SEO ("Analizar depto en Ñuñoa"). Antes se
  // ignoraba y el usuario tipeaba todo de cero.
  //
  // Solo PRECARGA contexto: no saltea el paso de dirección, que necesitamos
  // exacta igual (la pantalla exige `direccionConfirmada` de Places para
  // avanzar, y los comparables piden lat/lng). Si Places devuelve otra comuna,
  // la pisa sin conflicto.
  //
  // Se valida contra la cobertura: una comuna no cubierta dispararía el mensaje
  // de "fuera del Gran Santiago" antes de que el usuario escriba nada.
  const comunaParam = searchParams.get("comuna")?.trim() || "";
  // Con el alias del repo (20-oct-2026): el dataset dice «Santiago Centro» y la página de Santiago manda «Santiago»;
  // comparando el nombre exacto, «Analizar depto en Santiago» llegaba sin la comuna puesta.
  const match = COMUNAS.find((c) => normalizeComuna(c.comuna).toLowerCase() === normalizeComuna(comunaParam).toLowerCase());
  const comunaInicial = match && isComunaDisponible(match.comuna) ? match : null;

  // ?direccion=&lat=&lng=&comuna=[&precision=] — la dirección elegida en el hero de la landing (el
  // mismo componente que la portada del wizard: una puerta, dos accesos). ?modo=ubicacion|mapa — un
  // camino sin dirección elegido allá. Con cualquiera de los dos el wizard no arranca en la portada.
  const direccionInicial = leerDireccionLlegada({
    direccion: searchParams.get("direccion"),
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
    comuna: searchParams.get("comuna"),
    precision: searchParams.get("precision"),
  });
  const modoInicial = direccionInicial ? null : leerModoLlegada(searchParams.get("modo"));

  // ?precarga=<analysisId> — después de pagar el pack (30-sep-2026): lo de la persona ya respondido
  // desde ese informe (pie, tasa, plazo, modalidad, comuna y tipología). Solo pregunta lo del depto.
  const precargaParam = searchParams.get("precarga") ?? "";
  const precargaId = /^[0-9a-f-]{36}$/i.test(precargaParam) ? precargaParam : null;

  // ?reanalisis=<analysisId>&precio=&pie=&plazo= — el botón del pop-up Ajustar (21-oct-2026, lib/reanalisis.ts): el
  // informe de origen entero y la recomendación de Franco puestos, en el resumen. Sin uno válido, el wizard de siempre.
  // useMemo: el objeto viaja como dependencia de un efecto del wizard y no tiene que cambiar en cada render.
  const reanalisisClave = searchParams.toString();
  const reanalisis = useMemo(() => leerPedidoReanalisis(searchParams), [reanalisisClave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?origen= — superficie del CTA que trajo al usuario. Viaja para que quede en
  // el $current_url del pageview automático; el wizard no lo usa para nada más.
  return (
    <WizardV4
      resume={resume}
      comunaInicial={comunaInicial ? { comuna: comunaInicial.comuna, ciudad: comunaInicial.ciudad } : null}
      direccionInicial={direccionInicial}
      modoInicial={modoInicial}
      entrada={direccionInicial || modoInicial ? "landing" : "wizard"}
      precargaId={precargaId}
      reanalisis={reanalisis}
    />
  );
}

export default function NuevoAnalisisV4Page() {
  // useSearchParams exige límite de Suspense en App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--franco-bg)]" />}>
      <NuevoAnalisisV4Inner />
    </Suspense>
  );
}
