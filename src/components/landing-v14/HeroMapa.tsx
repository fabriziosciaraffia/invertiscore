// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA ES EL HERO (29-oct-2026, opción 3 de docs/puerta-b-mockups/7-landing-puertas.html, en teléfono y PC). Reemplaza al
// hero compacto de la puerta del informe y a la tarjeta del mapa que entraron con la puerta E.
//
// En el teléfono, la mitad de arriba es el mapa de Gran Santiago con los grupos por comuna y su número —un dibujo (SVG), con la
// misma función de grupos de siempre (`gruposDeLanding`)— y el header encima con un degradado para que se lea. La mitad de
// abajo es el panel en el material de la tríada, con las esquinas de arriba redondeadas: lo revisado anoche en chico, el
// título con el total de anoche, «Verlos en el mapa →» (blanco, a /explorar), el separador «¿Tienes uno en la mira?», el campo
// de dirección de siempre y «Franco te dice si conviene. Ver un ejemplo». Tocar el mapa también lleva a /explorar. En el PC,
// dos mitades a toda la altura: el panel a la izquierda, en el mismo orden, y el mapa a la derecha con «Entrar» arriba.
//
// EL TÍTULO ES EL LCP: el mapa es un dibujo sin imágenes y el panel pinta el degradado chico (bajo el umbral de 0,05 bits por
// píxel con que Chrome descarta las imágenes de relleno). Si no alcanza el alto, se achica el mapa, nunca el título
// (hero-mapa.css). Componente de servidor: el único JS propio es el del campo (CampoHero) y el de los enlaces medidos.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { LinkMedido } from "./LinkMedido";
import { CampoHero } from "./Entrada";
import { EV } from "./eventos";
import { HERO_MAPA, HREF_DESDE_LANDING, MAPA_LANDING, RADIO_CON_NUMERO, type GrupoLanding } from "@/lib/explorar/puertas-landing";
import "./hero-mapa.css";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Lo que el hero lee de la noche: cuántos convienen y sus grupos (el universo de Explorar sin cuenta) y cuántos se revisaron. */
export interface DatosHeroMapa {
  explorar: { n: number; grupos: GrupoLanding[] } | null;
  revisados: number | null;
}

/** El dibujo del mapa: cuadrado, a escala 1, centrado en su caja y recortado por ella. Calles de mentira (es un dibujo, no un
 *  plano) y los grupos con su número cuando el círculo da para escribirlo. */
function DibujoMapa({ grupos }: { grupos: GrupoLanding[] }) {
  const l = MAPA_LANDING.lado;
  return (
    <svg className="hm-svg" viewBox={`0 0 ${l} ${l}`} width={l} height={l} aria-hidden="true" focusable="false">
      <rect className="hm-svg-fondo" width={l} height={l} />
      <g className="hm-calles">
        <path d={`M0 ${l * 0.34} Q${l * 0.5} ${l * 0.44} ${l} ${l * 0.28}`} />
        <path d={`M0 ${l * 0.66} H${l}`} />
        <path d={`M${l * 0.3} 0 V${l}`} />
        <path d={`M${l * 0.68} 0 V${l}`} />
      </g>
      <g className="hm-calles hm-calles--finas">
        <path d={`M0 ${l * 0.52} H${l}`} />
        <path d={`M0 ${l * 0.82} Q${l * 0.5} ${l * 0.78} ${l} ${l * 0.86}`} />
        <path d={`M${l * 0.16} 0 V${l}`} />
        <path d={`M${l * 0.5} 0 V${l}`} />
        <path d={`M${l * 0.86} 0 V${l}`} />
      </g>
      {grupos.map((g) => (
        <g key={g.comuna} className="hm-grupo">
          <circle cx={g.x} cy={g.y} r={g.r} />
          {g.r >= RADIO_CON_NUMERO && <text x={g.x} y={g.y} dy="0.35em">{miles(g.n)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function HeroMapa({ cabecera, datos }: { cabecera: ReactNode; datos: DatosHeroMapa }) {
  const convienen = datos.explorar?.n ?? null;
  return (
    <section className="hm" aria-label="Los deptos que convienen hoy" data-landing="hero-mapa">
      <LinkMedido href={HREF_DESDE_LANDING} className="hm-mapa" evento={EV.explorarMapa} props={{ origen: "hero" }} aria-label={HERO_MAPA.mapa} data-landing="hero-mapa-enlace">
        <DibujoMapa grupos={datos.explorar?.grupos ?? []} />
      </LinkMedido>
      <div className="hm-cab">{cabecera}</div>
      <div className="hm-panel" data-landing="hero-panel">
        {/* El material: el degradado chico (52 × 113 y 96 × 60, menos de 600 B), que estirado se ve igual y Chrome no cuenta
            como LCP; el grano lo pone el CSS. */}
        <picture className="hm-fondo">
          <source media="(min-width: 900px)" srcSet="/landing/hero-liso-chico-d.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
          <img src="/landing/hero-liso-chico-m.webp" alt="" decoding="async" />
        </picture>
        <div className="hm-col">
          <p className="hm-ojo" data-landing="hero-ojo">{HERO_MAPA.ojo(datos.revisados)}</p>
          <h1 className="hm-h1" data-landing="hero-titulo">{HERO_MAPA.titulo(convienen)}</h1>
          <LinkMedido href={HREF_DESDE_LANDING} className="hm-boton" evento={EV.explorar} props={{ origen: "hero" }} data-landing="hero-boton">
            {HERO_MAPA.boton}
          </LinkMedido>
          <p className="hm-sep" data-landing="hero-separador"><span>{HERO_MAPA.separador}</span></p>
          <div className="hm-campo" data-landing="hero-campo">
            <CampoHero />
          </div>
          <p className="hm-ejemplo">
            {HERO_MAPA.ejemplo.antes}{" "}
            <LinkMedido href="/demo" className="hm-ejemplo-enlace" evento={EV.ejemplo} props={{ origen: "hero" }}>{HERO_MAPA.ejemplo.enlace}</LinkMedido>
          </p>
        </div>
      </div>
    </section>
  );
}
