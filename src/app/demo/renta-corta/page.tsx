import type { Metadata } from "next";
import { InformeStr } from "@/app/analisis/renta-corta/[id]/informe-str";
import { DEMO_STR_ID } from "@/lib/demo";
import { DemoCabecera } from "../demo-cabecera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo — Ejemplo en renta corta",
  description: "Un análisis completo de Franco para renta corta: Franco Score, flujo, ocupación de la zona y qué ajustar para que convenga.",
  alternates: { canonical: "/demo/renta-corta" },
};

/**
 * EL DEMO PÚBLICO · RENTA CORTA (25-sep-2026). La fila real `DEMO_STR_ID` dibujada por
 * `InformeStr`, el mismo camino que `/analisis/renta-corta/[id]`. Otro departamento que el de
 * renta larga: no es una comparación.
 */
export default function DemoRentaCortaPage() {
  return (
    <>
      <DemoCabecera modalidad="corta" />
      <InformeStr id={DEMO_STR_ID} demo />
    </>
  );
}
