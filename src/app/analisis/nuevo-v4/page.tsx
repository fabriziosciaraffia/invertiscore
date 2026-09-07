"use client";

// Wizard v4 — el wizard de producción. Nació como ruta paralela al v3
// (/analisis/nuevo-v2), pero el cutover ya ocurrió: ca3106f (27-jul-2026) dio
// vuelta todos los links y `RUTA_WIZARD` (src/lib/cta-analizar.ts) apunta acá.
// v3 sigue montado en su ruta, sin nadie que lo enlace.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WizardV4 } from "@/components/formulario-v4/WizardV4";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { COMUNAS } from "@/lib/comunas";

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
  const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaParam.toLowerCase());
  const comunaInicial = match && isComunaDisponible(match.comuna) ? match : null;

  // ?direccion=&lat=&lng=&comuna= — llega desde el campo del hero de la landing
  // (07-sep-2026), que es el MISMO campo de Places de esta pantalla
  // (`useDireccionPlaces`): la dirección ya viene canónica y con coordenadas, así
  // que se precarga como si el usuario la hubiera elegido acá. Mismo patrón que
  // `comunaInicial`: una sola vez y nunca pisa lo que ya había (ni un draft).
  //
  // `direccionConfirmada` SOLO si la comuna está cubierta: una comuna fuera de
  // cobertura entra sin confirmar y la pantalla cae en su rechazo normal, con la
  // captura de correo. La landing no duplica esa lógica; la delega acá.
  const direccionParam = searchParams.get("direccion")?.trim() || "";
  const latParam = Number(searchParams.get("lat"));
  const lngParam = Number(searchParams.get("lng"));
  const direccionInicial =
    direccionParam && comunaParam && Number.isFinite(latParam) && Number.isFinite(lngParam)
      ? {
          direccion: direccionParam,
          comuna: match?.comuna ?? comunaParam,
          ciudad: match?.ciudad ?? "Santiago",
          cubierta: isComunaDisponible(match?.comuna ?? comunaParam),
          lat: latParam,
          lng: lngParam,
        }
      : null;

  // ?origen= — superficie del CTA que trajo al usuario. Viaja para que quede en
  // el $current_url del pageview automático; el wizard no lo usa para nada más.
  return (
    <WizardV4
      resume={resume}
      comunaInicial={comunaInicial ? { comuna: comunaInicial.comuna, ciudad: comunaInicial.ciudad } : null}
      direccionInicial={direccionInicial}
    />
  );
}

export default function NuevoAnalisisV4Page() {
  // useSearchParams exige límite de Suspense en App Router (igual que v3).
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--franco-bg)]" />}>
      <NuevoAnalisisV4Inner />
    </Suspense>
  );
}
