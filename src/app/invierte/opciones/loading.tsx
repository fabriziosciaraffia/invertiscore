import { RESULTADO_COPY } from "@/lib/invierte-v2/opciones";
import { PERFIL_COPY } from "@/lib/invierte-v2/perfil";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { createClient } from "@/lib/supabase/server";

// La espera mientras se calculan las opciones (etapa 2, lámina 3.1-espera). Son segundos. Sin las comunas a mano (la página
// todavía no cargó), el primer paso dice «tus comunas». En el PC lleva el header del sitio, como el perfil y el resultado: el correo
// sale de la cookie (getSession, sin ir a la red; solo se muestra, no decide nada — el acceso lo decide la página).
export default async function Espera() {
  const E = RESULTADO_COPY.espera;
  const { data } = await createClient().auth.getSession();
  const email = data.session?.user?.email ?? null;
  return (
    <MarcoInvierte volver={null} pantalla="espera" layout="formulario" cabecera={PERFIL_COPY.titulo} pc={{ sesionEmail: email, invierte: true }}>
      <div className="iv2-espera" role="status" aria-live="polite" data-inv2="espera">
        <h1 className="inv-titulo" id="iv2-t">{E.titulo}</h1>
        <ul className="iv2-espera-pasos">
          <li data-hecho="1"><span aria-hidden="true">✓</span>{E.paso1("tus comunas")}</li>
          <li data-hecho="1"><span aria-hidden="true">✓</span>{E.paso2}</li>
          <li><span aria-hidden="true">·</span>{E.paso3}</li>
        </ul>
      </div>
    </MarcoInvierte>
  );
}
