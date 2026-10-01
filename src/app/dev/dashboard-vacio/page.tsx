// /dev/dashboard-vacio (29-sep-2026): la bienvenida del dashboard vacío con datos de muestra, para
// revisarla sin crear cuentas. Variantes por la URL: ?perfil=1 (con los chips del perfil), ?nombre=0 (sin nombre real),
// ?gratis=0 (sin el crédito de bienvenida), ?tema=oscuro. No escribe nada (demo). Gate en el servidor:
// dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { Bienvenida } from "@/app/dashboard/bienvenida";
import { Tema } from "./tema";

export const dynamic = "force-dynamic";

export default function DashboardVacioDemo({ searchParams }: { searchParams: { perfil?: string; gratis?: string; tema?: string; nombre?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const conPerfil = searchParams.perfil === "1";
  return (
    <>
      <Tema oscuro={searchParams.tema === "oscuro"} />
      <ChipVeredictoTokens />
      <Bienvenida
        nombre={searchParams.nombre === "0" ? null : "Fabrizio"}
        gratis={searchParams.gratis !== "0"}
        perfil={conPerfil ? { analysisId: "00000000-0000-0000-0000-000000000000", chips: { tipologia: "2D1B", comuna: "San Miguel", modalidad: "ltr" } } : null}
        onboarding
        demo
      />
    </>
  );
}
