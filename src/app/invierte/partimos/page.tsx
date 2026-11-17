import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { FLUJO_COPY, primerNombre } from "@/lib/invierte-v2/flujo";
import { URL_PERFIL, URL_VER_ORDEN } from "@/lib/invierte-v2/destino";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";

// 2.2 Partimos (etapa 1 de Invierte con Franco, 18-nov-2026): la confirmación con los cuatro pasos que siguen, «Por qué te vamos a
// mostrar más opciones», «Hacer mi perfil de inversión» (la etapa 2; mientras tanto, una pantalla que dice que viene pronto) y
// «Ver mi orden», que abre el PDF firmado. Pide sesión y una orden firmada; la orden se ve siempre, con o sin interruptor.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function PartimosPage() {
  const { user } = await sesionYAcceso();
  if (!user) notFound();
  const orden = await ultimaOrdenDe(createServiceClient(), user.id);
  if (!orden) notFound();
  const P = FLUJO_COPY.partimos;
  const comuna = orden.deptoLinea.split(" · ")[0]?.trim() || null;
  return (
    <MarcoInvierte volver={null} pantalla="partimos">
      <div className="inv-encabezado">
        <h1 className="iv2-titulo-grande" id="iv2-t">{P.titulo(primerNombre(orden.nombre))}</h1>
        <p className="inv-parrafo">{P.parrafo(comuna)}</p>
      </div>
      <ol className="iv2-pasos" data-inv2="pasos">
        {P.pasos.map((p, i) => (
          <li key={p.titulo}>
            <span className="iv2-num" aria-hidden="true">{i + 1}</span>
            <div><p className="iv2-paso-t">{p.titulo}</p><p className="iv2-paso-s">{p.texto}</p></div>
          </li>
        ))}
      </ol>
      <div className="iv2-acciones">
        <Link href={URL_PERFIL} className="inv-principal" data-inv2="perfil">{P.perfil}</Link>
        {orden.copiaEnviadaAt ? (
          <p className="iv2-guardada">{P.guardada} <a href={URL_VER_ORDEN} target="_blank" rel="noopener" data-inv2="ver-orden">{P.verOrden}</a></p>
        ) : (
          <p className="iv2-guardada" data-inv2="copia-pendiente">{P.copiaPendiente} <a href={URL_VER_ORDEN} target="_blank" rel="noopener" data-inv2="ver-orden">{P.verOrden}</a></p>
        )}
      </div>
      <section className="iv2-porque" aria-labelledby="iv2-porque-t">
        <h2 id="iv2-porque-t">{P.porQueTitulo}</h2>
        <p>{P.porQueTexto}</p>
      </section>
    </MarcoInvierte>
  );
}
