import { InformeLtr } from "@/app/analisis/[id]/informe-ltr";
import { DEMO_LTR_ID } from "@/lib/demo";
import { DemoCabecera } from "./demo-cabecera";

// EL DEMO GUARDADO (29-sep-2026). El motor lo calcula una vez y se sirve guardado: Next genera la
// página en cada deploy y la regenera una vez al día, para seguir la UF y los comparables. Hasta
// hoy corría por cada visita (force-dynamic, unos 4 segundos). El informe lo lee sin sesión en
// modo demo (`InformeLtr`), así que nada de la página depende de quién la mira.
export const revalidate = 86400;

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
