// ─────────────────────────────────────────────────────────────────────────────
// LAS CUATRO CIFRAS DE UN DEPTO, UN SOLO COMPONENTE (etapa 3, ficha del 23-nov-2026; láminas 4.2-ficha-del-depto, 4.2-pagina-del-depto,
// 3.3-base-tarjetas y 5.1-oferta). Siempre las mismas y en el mismo orden (cifras.ts › listaCifras): Publicado, Arriendo estimado, Cap
// rate y «Pones al mes» / «Te sobran al mes» con el número solo, que nunca se parte en dos líneas. En negro, también lo que pone (decisión
// de Fabrizio, 24-nov-2026: en Invierte el rojo es solo el botón principal cuando le toca a la persona; la etiqueta ya dice «Pones»). Con pocos arriendos comparables, la
// marca gris debajo (las cifras van igual: decisión de Fabrizio, 23-nov-2026). Y el bloque de las cifras a otro precio: «Con tu oferta
// de UF X», «Con el precio acordado de UF X» o «A este precio» (la oferta), con el precio publicado como referencia.
// Sin "use client" ni hooks: lo usan la página (servidor), la base y el resultado (cliente). No calcula: recibe los números del motor.
// ─────────────────────────────────────────────────────────────────────────────
import { CIFRAS_COPY as C, cuartaCifra, listaCifras, pctCifra, type CifrasAPrecio, type CifrasDepto } from "@/lib/invierte-v2/cifras";

export function CuatroCifras({ c, variante }: { c: CifrasDepto; variante: "ficha" | "base" | "resultado" }) {
  // En la base la tarjeta va dentro de un enlace: todo en `span` (contenido en línea).
  if (variante === "base") {
    return (
      <span className="iv2-4c iv2-4c-base" data-inv2="cuatro-cifras">
        <span className="iv2-4c-lista">
          {listaCifras(c).map((x) => (
            <span key={x.clave} className="iv2-4c-celda" data-cifra={x.clave}>
              <span className="iv2-4c-et">{x.clave === "arriendo" ? <><span className="iv2-4c-largo">{C.arriendo}</span><span className="iv2-4c-corto">{C.arriendoCorto}</span></> : x.et}</span>
              <span className="iv2-4c-v">{x.v}</span>
            </span>
          ))}
        </span>
        {c.pocosComparables && <span className="iv2-4c-pocos" data-inv2="pocos-comparables">{C.pocos}</span>}
      </span>
    );
  }
  return (
    <div className={`iv2-4c iv2-4c-${variante}`} data-inv2="cuatro-cifras">
      <dl className="iv2-4c-lista">
        {listaCifras(c).map((x) => (
          <div key={x.clave} className="iv2-4c-celda" data-cifra={x.clave}>
            <dt className="iv2-4c-et">{x.et}</dt>
            <dd className="iv2-4c-v">{x.v}</dd>
          </div>
        ))}
      </dl>
      {c.pocosComparables && <p className="iv2-4c-pocos" data-inv2="pocos-comparables">{C.pocos}</p>}
    </div>
  );
}

/** El cap rate y lo que queda al mes a otro precio, con los del precio publicado debajo. */
export function CifrasAOtroPrecio({ titulo, a, publicado, clave }: { titulo: string; a: CifrasAPrecio; publicado: { capRatePct: number | null; flujoCLP: number | null }; clave: string }) {
  const cuarta = cuartaCifra(a.flujoCLP);
  return (
    <section className="iv2-4c-precio" data-inv2={clave} aria-label={titulo}>
      <p className="iv2-4c-precio-t">{titulo}</p>
      <dl className="iv2-4c-precio-lista">
        <div><dt>{C.capRate}</dt><dd data-inv2="cap-a-precio">{pctCifra(a.capRatePct)}</dd></div>
        <div><dt>{cuarta.et}</dt><dd data-inv2="mes-a-precio">{cuarta.v}</dd></div>
      </dl>
      <p className="iv2-4c-precio-ref" data-inv2="al-publicado">{C.alPublicado(publicado.capRatePct, publicado.flujoCLP)}</p>
    </section>
  );
}
