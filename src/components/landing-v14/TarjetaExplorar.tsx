// ─────────────────────────────────────────────────────────────────────────────
// LA SEGUNDA PUERTA DE LA LANDING (29-oct-2026, estado A de docs/puerta-b-mockups/6-puerta-e.html): debajo del hero —la puerta
// del informe, con «¿Tienes un depto en la mira?»—, una tarjeta con el mismo peso para quien no tiene un depto: el mapa chico
// de Gran Santiago con los grupos (un dibujo, no el mapa interactivo), «¿Buscas dónde invertir?», «N deptos en venta
// convienen hoy.» con el número en rojo, «Míralos en el mapa, sin registrarte.» y «Ver en el mapa →» en el material de la
// tríada, que lleva a /explorar con `?desde=landing` (la puerta E separa a quien llega desde acá). Debajo, «Ver un análisis
// de ejemplo» como enlace de texto. Sin JS propio: el enlace medido es el de siempre (LinkMedido).
// ─────────────────────────────────────────────────────────────────────────────
import { LinkMedido } from "./LinkMedido";
import { EV } from "./eventos";
import { HREF_DESDE_LANDING, LANDING_PUERTAS, MAPA_LANDING, type GrupoLanding } from "@/lib/explorar/puertas-landing";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function TarjetaExplorar({ datos }: { datos: { n: number; grupos: GrupoLanding[] } | null }) {
  const { ancho, alto } = MAPA_LANDING;
  const numero = datos ? LANDING_PUERTAS.numero(datos.n) : null;
  return (
    <section className="lv-puertas" aria-label={LANDING_PUERTAS.ojo} data-landing="puertas">
      {datos && numero && (
        <div className="lv-explorar" data-landing="tarjeta-explorar">
          <div className="lv-explorar-mapa" aria-hidden="true">
            <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="xMidYMid slice" focusable="false">
              <g className="lv-explorar-calles">
                <path d={`M0 ${alto * 0.36} Q${ancho / 2} ${alto * 0.5} ${ancho} ${alto * 0.28}`} />
                <path d={`M0 ${alto * 0.72} H${ancho}`} />
                <path d={`M${ancho * 0.28} 0 V${alto}`} />
                <path d={`M${ancho * 0.66} 0 V${alto}`} />
              </g>
              {datos.grupos.map((g) => (
                <g key={g.comuna} className="lv-explorar-grupo">
                  <circle cx={g.x} cy={g.y} r={g.r} />
                  <text x={g.x} y={g.y} dy="0.35em">{miles(g.n)}</text>
                </g>
              ))}
            </svg>
          </div>
          <div className="lv-explorar-cuerpo">
            <p className="lv-explorar-ojo">{LANDING_PUERTAS.ojo}</p>
            <p className="lv-explorar-n" data-landing="explorar-n"><span className="lv-explorar-cifra">{numero.cifra}</span>{numero.resto}</p>
            <p className="lv-explorar-texto">{LANDING_PUERTAS.texto}</p>
            <LinkMedido href={HREF_DESDE_LANDING} className="lv-explorar-cta" evento={EV.explorar} props={{ origen: "tarjeta" }}>
              {LANDING_PUERTAS.boton}
            </LinkMedido>
          </div>
        </div>
      )}
      <LinkMedido href="/demo" className="lv-ejemplo" evento={EV.ejemplo} props={{ origen: "puertas" }}>
        {LANDING_PUERTAS.ejemplo}
      </LinkMedido>
    </section>
  );
}
