import Link from "next/link";
import { notFound } from "next/navigation";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { URL_PARTIMOS } from "@/lib/invierte-v2/destino";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";

// El perfil de inversión es la etapa 2. Mientras no exista, «Hacer mi perfil de inversión» llega acá (etapa 1, 18-nov-2026).
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function PerfilPage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const P = FLUJO_COPY.perfil;
  return (
    <MarcoInvierte volver={URL_PARTIMOS} pantalla="perfil">
      <div className="inv-encabezado">
        <h1 className="inv-titulo" id="iv2-t">{P.titulo}</h1>
        <p className="inv-parrafo">{P.texto}</p>
      </div>
      <div className="iv2-acciones">
        <Link href={URL_PARTIMOS} className="inv-principal inv-principal-tinta">{P.volver}</Link>
      </div>
    </MarcoInvierte>
  );
}
