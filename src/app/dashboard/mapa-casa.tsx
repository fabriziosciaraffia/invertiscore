// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE LA SELECCIÓN (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html): la imagen quieta del mapa con el
// estilo de Franco (cacheable: la URL solo depende del encuadre), y encima un SVG con los deptos de la selección en rojo
// y numerados —el mismo número que la tarjeta— y los demás que convienen con la búsqueda en gris; la píldora «5 en tu
// selección · 312 más que convienen en gris» y «Explorar los 312 en el mapa», que lleva a /explorar. Lo arma el servidor
// (lib/casa/mapa-casa-servidor.ts); sin la llave de Google, el fondo es plano y los pines se ven igual.
// 24-oct-2026 (recorrido de Fabrizio): la píldora dice dónde están los grises («5 en tu selección · 11 más en Providencia»)
// y el botón, el total de anoche en Santiago («Explorar los 4.807 de Santiago»). En «Estás dentro» (`variante="seleccion"`)
// va SOLO la selección: sin grises, sin píldora y sin botón —un solo objetivo en esa pantalla: que use el regalo—.
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonExplorar, MAPA_CASA, pildoraMapa } from "@/lib/casa/mapa-casa";
import type { DatosMapaCasa } from "@/lib/casa/mapa-casa-servidor";
import "./casa.css";

export function MapaCasa({ datos, variante = "casa", totalNoche = null }: {
  datos: DatosMapaCasa;
  /** «casa»: el dashboard, con los grises, la píldora y el botón. «seleccion»: «Estás dentro», solo los pines rojos. */
  variante?: "casa" | "seleccion";
  /** Cuántos convenían anoche en todo Santiago (el número de /deptos), para el botón. */
  totalNoche?: number | null;
}) {
  const { ancho, alto } = MAPA_CASA;
  const casa = variante === "casa";
  return (
    <section className="ca-mapa" data-casa="mapa" data-variante={variante} data-n={datos.nConvienen} data-seleccion={datos.seleccion.length}>
      <div className="ca-mapa-img" style={{ aspectRatio: `${ancho} / ${alto}` }}>
        {/* La imagen va como fondo CSS: si la llave no sirve en este origen, no queda el ícono de imagen rota. */}
        {datos.url && <div className="ca-mapa-fondo" style={{ backgroundImage: `url("${datos.url}")` }} data-casa="mapa-fondo" />}
        <svg viewBox={`0 0 ${ancho} ${alto}`} width="100%" height="100%" aria-label="Mapa de tu selección" role="img" data-casa="mapa-pines">
          {casa && (
            <g className="ca-mapa-gris" data-casa="grises">
              {datos.grises.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r="3.5" />)}
            </g>
          )}
          <g className="ca-mapa-rojo">
            {datos.seleccion.map((p) => (
              <g key={p.avisoId} data-casa="pin" data-n={p.n}>
                <circle cx={p.x} cy={p.y} r="9" />
                <text x={p.x} y={p.y + 3.6} textAnchor="middle">{p.n}</text>
              </g>
            ))}
          </g>
        </svg>
        {casa && <span className="ca-mapa-pildora" data-casa="mapa-pildora">{pildoraMapa(datos.nSeleccion, datos.nOtros, datos.comunas)}</span>}
      </div>
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
