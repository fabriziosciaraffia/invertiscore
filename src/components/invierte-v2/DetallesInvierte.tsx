// ─────────────────────────────────────────────────────────────────────────────
// LOS DETALLES DEL DEPTO EN MODO INVIERTE (lámina 3.x-detalles-desde-invierte del 19-nov-2026). Envuelven el informe de siempre,
// que no cambia: arriba, la barra fija con «← Mi inversión» y el chip (azul claro «Uno de tus deptos», ciruela «Te lo
// recomendamos»); abajo, fija, la acción que corresponde. En el celular, la cabecera del flujo («Los detalles del depto») en vez
// del header del sitio, como el resto de las pantallas de Invierte; en el PC, el header real y la barra bajo él.
// Las fotos y «Lo que ve Franco» van entre la barra y el informe (entregas 3 y 4): todavía no.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { DETALLES_COPY, type ModoDetalles } from "@/lib/invierte-v2/detalles-modo";
import { urlWhatsapp, type LineaDepto } from "@/lib/invierte-v2/base";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { SumarDepto } from "./SumarDepto";
import "@/components/invierte/invierte.css";
import "./invierte-v2.css";

const D = DETALLES_COPY;

export function CabeceraDetalles() {
  return (
    <div className="iv2-det-cab inv-cab" data-inv2="detalles-cabecera">
      <span className="inv-cab-hueco" aria-hidden="true" />
      <span className="inv-cab-t">Los detalles del depto</span>
      <span className="inv-cab-hueco" aria-hidden="true" />
    </div>
  );
}

export function BarraDetalles({ modo }: { modo: ModoDetalles }) {
  return (
    <div className="iv2-det-barra" data-inv2="detalles-barra">
      <Link href={URL_INVIERTE} className="iv2-mi-inversion-a" data-inv2="mi-inversion">← {D.miInversion}</Link>
      {modo.relacion === "suyo"
        ? <span className="iv2-det-chip iv2-det-chip-suyo" data-inv2="chip-suyo">{D.chipSuyo}</span>
        : <span className="iv2-det-chip iv2-det-chip-reco" data-inv2="chip-recomendado">{D.chipRecomendado}</span>}
    </div>
  );
}

export function AccionDetalles({ modo }: { modo: ModoDetalles }) {
  return (
    <div className="iv2-det-accion" data-inv2="detalles-accion">
      <div className="iv2-det-accion-col">
        {modo.relacion === "suyo" ? (
          <>
            <p className="iv2-det-accion-t" data-inv2="estado-suyo">{D.estadoSuyo}</p>
            {modo.whatsapp && (
              <a href={urlWhatsapp(modo.whatsapp)} target="_blank" rel="noopener noreferrer" className="iv2-secundario iv2-det-escribir" data-inv2="escribirle">
                <IconoWhatsapp /> {D.escribirle}
              </a>
            )}
          </>
        ) : (
          <>
            <p className="iv2-det-accion-t" data-inv2="linea-recomendado">{modo.linea}</p>
            <SumarDepto avisoId={modo.avisoId} etiqueta={D.seguir} origen="base" variante="principal"
              activos={modo.activos.map((a) => ({ avisoId: a.avisoId, datos: a.datos as unknown as LineaDepto }))} />
          </>
        )}
      </div>
    </div>
  );
}
