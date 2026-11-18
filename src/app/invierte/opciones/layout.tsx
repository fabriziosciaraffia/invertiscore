import { notFound } from "next/navigation";
import { sesionYAcceso } from "@/lib/invierte-v2/paginas";

// El acceso se decide ACÁ, arriba de la espera (loading.tsx): con la espera, la página ya empezó a responder 200 cuando su
// notFound() corre, así que sin sesión o fuera de la lista se veía la espera y después el 404 con código 200. El layout corre
// antes que el límite de la espera y responde 404 de verdad. La página repite el chequeo (no confía en el layout).
export const dynamic = "force-dynamic";

export default async function OpcionesLayout({ children }: { children: React.ReactNode }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  return <>{children}</>;
}
