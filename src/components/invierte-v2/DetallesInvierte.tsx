// ─────────────────────────────────────────────────────────────────────────────
// LOS DETALLES DEL DEPTO EN MODO INVIERTE (lámina 3.x-detalles-desde-invierte del 19-nov-2026). Envuelven el informe de siempre,
// que no cambia: arriba, la barra fija con «← Mi inversión» y el chip (azul claro «Uno de tus deptos», ciruela «Te lo
// recomendamos»); abajo, fija, la acción que corresponde. En el celular, la cabecera del flujo («Los detalles del depto») en vez
// del header del sitio, como el resto de las pantallas de Invierte; en el PC, el header real y la barra bajo él.
// Entre la barra y el informe, las fotos con flechas y el depto en una línea con su chip (entrega 3), y «Lo que ve Franco» en su
// versión larga, con «Lo que el puntaje no considera» primero si la hay (entrega 4; textos aprobados el 19-nov-2026).
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { DETALLES_COPY, type ModoDetalles } from "@/lib/invierte-v2/detalles-modo";
import { urlWhatsapp, type LineaDepto } from "@/lib/invierte-v2/base";
import { IconoWhatsapp } from "./IconoWhatsapp";
import { DetallesCabezaCliente } from "./DetallesCabezaCliente";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
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
      {modo.relacion !== "recomendado"
        ? <span className="iv2-det-chip iv2-det-chip-suyo" data-inv2="chip-suyo">{D.chipSuyo}</span>
        : <span className="iv2-det-chip iv2-det-chip-reco" data-inv2="chip-recomendado">{D.chipRecomendado}</span>}
    </div>
  );
}

export function CabezaDeDetalles({ modo }: { modo: ModoDetalles }) {
  const c = modo.cabeza;
  return (
    <section className="iv2-det-cabeza" data-inv2="detalles-cabeza">
      <DetallesCabezaCliente avisoId={c.avisoId} fotos={c.fotos} lectura={c.lectura}>
        {c.nombre && (
          <div className="iv2-res-fila">
            <span className="iv2-res-nombre">{c.nombre}</span>
            {c.veredicto && <ChipVeredicto v={c.veredicto as Veredicto} puntaje={c.veredicto === "COMPRAR" ? c.score : null} />}
          </div>
        )}
      </DetallesCabezaCliente>
    </section>
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
        ) : modo.relacion === "entrada" ? (
          <>
            <p className="iv2-det-accion-t" data-inv2="estado-entrada">{modo.alcanza ? D.estadoEntrada : D.fueraDeAlcance}</p>
            {modo.alcanza && (
              <SumarDepto avisoId={modo.avisoId} etiqueta={D.seguir} origen="base" variante="principal"
                activos={modo.activos.map((a) => ({ avisoId: a.avisoId, datos: a.datos as unknown as LineaDepto }))} />
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
