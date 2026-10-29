// ─────────────────────────────────────────────────────────────────────────────
// EL HERO LIMPIO DE LA LANDING (30-oct-2026, docs/puerta-b-mockups/7c-landing-limpia.html, en teléfono y PC). Reemplaza al
// hero con el mapa del 29-oct (opción 3 de 7-landing-puertas): el material de la tríada a pantalla completa, como el hero
// anterior, sin mapa. El nombre del archivo (HeroMapa, hero-mapa.css, las clases `hm-`) quedó de ese hero.
//
// En orden: lo revisado anoche en chico, el título en serif con el número único de «convienen» (portal-cache.ts ›
// convienenHoy), «Verlos en el mapa →» (blanco, a /explorar con la llegada de la landing), el separador «¿Tienes uno en la
// mira?», el campo de dirección de siempre —con su animación— y «Franco te dice si conviene. Ver un ejemplo». En el
// teléfono el bloque va centrado en vertical y alineado a la izquierda; en el PC, a la izquierda con un margen generoso, el
// botón y el campo del ancho de la columna, y la derecha limpia.
//
// EL TÍTULO ES EL LCP: el material es el degradado chico (52 × 113 y 96 × 60, bajo el umbral de 0,05 bits por píxel con que
// Chrome descarta las imágenes de relleno) estirado, y el grano lo pone el CSS. Componente de servidor: el único JS propio es
// el del campo (CampoHero) y el de los enlaces medidos.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { LinkMedido } from "./LinkMedido";
import { CampoHero } from "./Entrada";
import { EV } from "./eventos";
import { HERO_MAPA, HREF_DESDE_LANDING } from "@/lib/explorar/puertas-landing";
import "./hero-mapa.css";

/** Lo que el hero lee de la noche: cuántos convienen (el número único, convienenHoy) y cuántos se revisaron. */
export interface DatosHeroMapa {
  convienen: number | null;
  revisados: number | null;
}

export function HeroMapa({ cabecera, datos }: { cabecera: ReactNode; datos: DatosHeroMapa }) {
  return (
    <section className="hm" aria-label="Los deptos que convienen hoy" data-landing="hero">
      {/* El material: el degradado chico (menos de 600 B), que estirado se ve igual y Chrome no cuenta como LCP; el grano lo
          pone el CSS. */}
      <picture className="hm-fondo">
        <source media="(min-width: 900px)" srcSet="/landing/hero-liso-chico-d.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
        <img src="/landing/hero-liso-chico-m.webp" alt="" decoding="async" />
      </picture>
      <div className="hm-cab">{cabecera}</div>
      <div className="hm-col" data-landing="hero-bloque">
        <p className="hm-ojo" data-landing="hero-ojo">{HERO_MAPA.ojo(datos.revisados)}</p>
        <h1 className="hm-h1" data-landing="hero-titulo">{HERO_MAPA.titulo(datos.convienen)}</h1>
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
    </section>
  );
}
