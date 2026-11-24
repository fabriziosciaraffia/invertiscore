// ─────────────────────────────────────────────────────────────────────────────
// LO QUE DIBUJA «PERFIL ACTUALIZADO» (entrega 2, 19-nov-2026; lámina 3.3-perfil-editado). La usan la página y
// /dev/invierte-v2/base?vista=actualizado. Sin "use client".
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { ACTUALIZADO_COPY, fraseCambioPerfil, lineaDepto } from "@/lib/invierte-v2/base";
import type { PerfilActualizado } from "@/lib/invierte-v2/base-servidor";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";

const A = ACTUALIZADO_COPY;

export function VistaActualizado({ r }: { r: PerfilActualizado }) {
  const frase = fraseCambioPerfil(r.cambio.antes, r.cambio.despues);
  const titulo = r.entran.length ? A.masDeptos(r.entran.length) : r.fuera.length ? A.menosDeptos(r.fuera.length) : A.sinNuevos;
  const lista = [...r.entran.map((d) => ({ ...d, entra: true })), ...r.fuera.map((d) => ({ ...d, entra: false }))];
  return (
    <>
      <h1 className="iv2-titulo-res" id="iv2-t">{A.titulo}</h1>
      <div className="iv2-tarjeta-fuerte" data-inv2="actualizado-resumen">
        {frase && <p className="iv2-linea-chica" data-inv2="cambio-perfil">{frase}</p>}
        <p className="iv2-fuerte-t">{titulo}</p>
        <p className="iv2-depto-s">{A.hasta(r.topeUF)}</p>
      </div>
      {lista.length > 0 && (
        <section className="iv2-base-sec" aria-labelledby="iv2-cambiaron-t" data-inv2="opciones-cambiaron">
          <h2 className="iv2-base-h2" id="iv2-cambiaron-t">{A.cambiaron}</h2>
          <ul className="iv2-otras">
            {lista.map((d) => (
              <li key={d.avisoId} className="iv2-otra" data-inv2={d.entra ? "entra" : "fuera"}>
                <div className="iv2-depto-id">
                  <p className="iv2-depto-t">{lineaDepto(d.datos)}</p>
                  <p className="iv2-depto-s">{[d.datos.precioUF ? `UF ${fmtUF(d.datos.precioUF)}` : null, d.datos.veredicto ? `${signoVeredicto(d.datos.veredicto)} ${etiquetaVeredicto(d.datos.veredicto, "frase")}${d.datos.score != null && d.datos.veredicto === "COMPRAR" ? ` · ${d.datos.score}` : ""}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <span className={d.entra ? "iv2-estado" : "iv2-estado-gris"}>{d.entra ? A.entra : A.fuera}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="iv2-linea-chica" data-inv2="siguen">{[A.siguen(r.siguen), r.fuera.length ? A.quedanMarcadas : ""].filter(Boolean).join(" ")}</p>
      <div className="iv2-acciones">
        <Link href={URL_OPCIONES} className="inv-principal" data-inv2="ver-mis-opciones">{A.boton}</Link>
      </div>
    </>
  );
}
