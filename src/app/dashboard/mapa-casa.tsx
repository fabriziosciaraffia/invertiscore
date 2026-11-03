// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE LA SELECCIÓN (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html): la imagen quieta del mapa con el
// estilo de Franco (cacheable: la URL solo depende del encuadre), y encima un SVG con los deptos de la selección numerados —el
// mismo número que la tarjeta— y los demás que convienen con la búsqueda en gris; la píldora «5 en tu selección · 312 más que
// convienen en gris» y «Explorar los 312 en el mapa», que lleva a /explorar. Lo arma el servidor
// (lib/casa/mapa-casa-servidor.ts); sin la llave de Google, el fondo es plano y los pines se ven igual.
// 24-oct-2026 (recorrido de Fabrizio): la píldora dice dónde están los grises («5 en tu selección · 11 más en Providencia»)
// y el botón, el total de anoche en Santiago («Explorar los 4.807 de Santiago»). En «Estás dentro» (`variante="seleccion"`)
// va SOLO la selección: sin grises, sin píldora y sin botón —un solo objetivo en esa pantalla: que use el regalo—.
// 03-nov-2026 (la pasada real de Fabrizio): LOS PINES en el color de su clase (colores-pin.ts, casa.css): azul ✓ Comprar, ciruela
// − Ajustar, tinta con un ✓ blanco el ya analizado; rojo, ninguno. Y DOS IMÁGENES: la del teléfono (350 × 200) y, desde 768 px,
// la del PC (566 × 420), cada una pedida al tamaño que ocupa y con sus pines; el CSS muestra una y solo esa se baja.
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonExplorar, pildoraMapa } from "@/lib/casa/mapa-casa";
import type { DatosMapaCasa, ImagenMapaCasa } from "@/lib/casa/mapa-casa-servidor";
import { MARCA_ANALIZADO, type ClasePin } from "@/lib/explorar/colores-pin";
import "./casa.css";

/** EL NÚMERO DE UNA TARJETA DE LA SELECCIÓN (03-nov-2026): el mismo pin del mapa, en el color de su clase (deptos.css ›
 *  .sel-pin); el ya analizado, en tinta con el ✓ en vez del número. */
export function PinTarjeta({ n, clase }: { n: number; clase: ClasePin }) {
  return <span className="sel-pin" data-clase={clase} aria-hidden="true">{clase === "analizado" ? MARCA_ANALIZADO : n}</span>;
}

/** Una imagen con sus pines encima, al tamaño en que se pidió. */
function ImagenConPines({ img, tamano, conGrises, pildora }: { img: ImagenMapaCasa; tamano: "m" | "d"; conGrises: boolean; pildora: string | null }) {
  const { ancho, alto } = img;
  return (
    <div className={`ca-mapa-img ca-mapa-img-${tamano}`} style={{ aspectRatio: `${ancho} / ${alto}`, ...(tamano === "d" ? { maxWidth: ancho } : {}) }} data-casa={`mapa-${tamano}`} data-ancho={ancho} data-alto={alto}>
      {/* La imagen va como fondo CSS: si la llave no sirve en este origen, no queda el ícono de imagen rota. Las dos versiones
          (30-oct-2026) van en variables: el tema decide cuál se aplica, solo esa se baja y cambia al momento con el tema. */}
      {img.url && <div className="ca-mapa-fondo" style={{ "--mapa-claro": `url("${img.url}")`, ...(img.urlOscuro ? { "--mapa-oscuro": `url("${img.urlOscuro}")` } : {}) } as React.CSSProperties} data-casa="mapa-fondo" />}
      <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height="100%" aria-label="Mapa de tu selección" role="img" data-casa="mapa-pines">
        {conGrises && (
          <g className="ca-mapa-gris" data-casa="grises">
            {img.grises.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r="3.5" />)}
          </g>
        )}
        <g className="ca-mapa-pines">
          {img.seleccion.map((p) => (
            <g key={p.avisoId} data-casa="pin" data-n={p.n} data-clase={p.clase}>
              <circle cx={p.x} cy={p.y} r="9" />
              {p.clase === "analizado"
                ? <path d={`M${p.x - 3.8} ${p.y + 0.2}l2.7 2.7 4.9-5.4`} className="ca-mapa-check" />
                : <text x={p.x} y={p.y + 3.6} textAnchor="middle">{p.n}</text>}
            </g>
          ))}
        </g>
      </svg>
      {pildora && <span className="ca-mapa-pildora" data-casa="mapa-pildora">{pildora}</span>}
    </div>
  );
}

export function MapaCasa({ datos, variante = "casa", totalNoche = null }: {
  datos: DatosMapaCasa;
  /** «casa»: el dashboard, con los grises, la píldora y el botón. «seleccion»: «Estás dentro», solo los pines de la selección. */
  variante?: "casa" | "seleccion";
  /** Cuántos convenían anoche en todo Santiago (el número de /deptos), para el botón. */
  totalNoche?: number | null;
}) {
  const casa = variante === "casa";
  const pildora = casa ? pildoraMapa(datos.nSeleccion, datos.nOtros, datos.comunas) : null;
  return (
    <section className="ca-mapa" data-casa="mapa" data-variante={variante} data-n={datos.nConvienen} data-seleccion={datos.seleccion.length}>
      <ImagenConPines img={datos} tamano="m" conGrises={casa} pildora={pildora} />
      {/* La del PC; los datos guardados de antes no la traen y el PC sigue con la del teléfono. */}
      {datos.pc && <ImagenConPines img={datos.pc} tamano="d" conGrises={casa} pildora={pildora} />}
      {casa && (
        <div className="ca-mapa-pie">
          <EnlaceCarga href="/explorar" className="ca-boton-triada" data-casa="explorar-boton" data-n={totalNoche ?? undefined}>
            {botonExplorar(totalNoche)}
          </EnlaceCarga>
        </div>
      )}
    </section>
  );
}
