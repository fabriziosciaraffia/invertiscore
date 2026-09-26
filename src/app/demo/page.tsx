import { InformeLtr } from "@/app/analisis/[id]/informe-ltr";
import { DEMO_LTR_ID } from "@/lib/demo";
import { DemoCabecera } from "./demo-cabecera";

// El demo se recalcula con el motor en cada visita, igual que cualquier informe: sin caché
// estática que congele un resultado viejo.
export const dynamic = "force-dynamic";

/**
 * EL DEMO PÚBLICO · RENTA LARGA (25-sep-2026). La pestaña que abre. Es la fila real
 * `DEMO_LTR_ID` dibujada por `InformeLtr`, el mismo camino que `/analisis/[id]`: el motor la
 * recalcula y el informe trae todo lo que trae cualquier otro. Hasta hoy esta página era un
 * resultado escrito a mano en el código, sin hallazgos, y su titular caía a la rama «sin card».
 */
export default function DemoRentaLargaPage() {
  return (
    <>
      <DemoCabecera modalidad="larga" />
      <InformeLtr id={DEMO_LTR_ID} demo />
    </>
  );
}
