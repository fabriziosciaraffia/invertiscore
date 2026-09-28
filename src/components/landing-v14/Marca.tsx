// ─────────────────────────────────────────────────────────────────────────────
// Piezas de marca compartidas por la landing v14 y las páginas que hablan su
// mismo lenguaje (/metodologia). Vivían dentro de `Secciones.tsx` y `Respuesta.tsx`
// como funciones locales; se extraen acá SIN cambiar su markup para que la
// landing renderice igual y las otras páginas no repliquen nada.
//
// Todas son server components: markup puro, sin estado. El CSS es `landing.css`
// (prefijo `lv-`), que la página importa una vez.
// ─────────────────────────────────────────────────────────────────────────────

import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import FrancoLogo from "@/components/franco-logo";
import { DISCLAIMER_CANONICO } from "@/components/chrome/AppFooter";
import { ESLOGAN } from "@/lib/eslogan";
import type { DatosLanding } from "@/lib/landing-vivo";
import type { Veredicto } from "@/lib/types";

/** Wordmark canónico (.ai en Signal Red) + el eslogan. */
export function Wordmark() {
  return (
    <div>
      <FrancoLogo size="header" href="/" className="lv-wm" />
      <div className="lv-tag">{ESLOGAN}</div>
    </div>
  );
}

/** Glifo de veredicto (FASE 1.8): ✕ · — · ✓ a la izquierda de la palabra.
 *  Refuerza el veredicto sin depender del color (ciruela y azul se confunden con
 *  daltonismo) y recupera la lectura de semáforo. Decorativo: la palabra ya lo
 *  dice, así que va con aria-hidden y sin aria-label. SVG inline, sin librería. */
const GLIFO: Record<Veredicto, string> = {
  "BUSCAR OTRA": "M5 5l14 14M19 5L5 19",
  "AJUSTA SUPUESTOS": "M4 12h16",
  COMPRAR: "M4 13l5 5L20 6",
};

export function Glifo({ veredicto }: { veredicto: Veredicto }) {
  return (
    <svg className="lv-glifo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={GLIFO[veredicto]} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  );
}

/** "15 h" / "4 min" / "2 días": sin "hace", para que la línea del footer quepa
 *  en una a 390 px (FASE 1.3). */
export function haceCuanto(iso: string, ahora: Date): string {
  const ms = ahora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "día" : "días"}`;
}

/** El material del hero (la escala de la tríada con grano), para un bloque destacado. */
export function FondoMaterial() {
  return (
    <picture className="lv-fondo lv-fondo-material">
      <source media="(min-width: 768px)" srcSet="/landing/hero-d1x.webp 1x, /landing/hero-d2x.webp 2x" />
      <source srcSet="/landing/hero-m1x.webp 1x, /landing/hero-m2x.webp 2x, /landing/hero-m3x.webp 3x" />
      {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
      <img src="/landing/hero-m2x.webp" alt="" loading="lazy" decoding="async" />
    </picture>
  );
}

/** Footer de la landing: sobre el material del hero, wordmark y links en papel, último
 *  análisis, el disclaimer canónico del sitio (el de `AppFooter`, importado, no copiado) con
 *  términos y privacidad, y la atribución del mapa (ODbL). En la landing el material lo pone
 *  el envoltorio del cierre (`conFondo={false}`): cierre y pie son un solo bloque. */
export function PieLanding({ ultimo, ahora, conFondo = true }: { ultimo: DatosLanding["ultimoAnalisis"]; ahora: Date; conFondo?: boolean }) {
  return (
    <footer className={`lv-footer${conFondo ? " lv-footer-solo" : ""}`}>
      {conFondo && <FondoMaterial />}
      <div className="lv-col">
        <div className="lv-footer-fila">
          <Wordmark />
          <nav aria-label="Franco">
            <EnlaceCarga href="/metodologia">Cómo calcula</EnlaceCarga>
            <EnlaceCarga href="/comunas">Comunas</EnlaceCarga>
            <EnlaceCarga href="/pricing">Planes</EnlaceCarga>
            <EnlaceCarga href="/login">Entrar</EnlaceCarga>
          </nav>
        </div>
        {ultimo && (
          <div className="lv-ultimo">
            <i className="lv-dot" />Último análisis · <b>{ultimo.etiqueta}</b> · <span className="lv-ultimo-comuna">{ultimo.comuna} · </span>{haceCuanto(ultimo.createdAt, ahora)}
          </div>
        )}
        <div className="lv-legal">
          <p>{DISCLAIMER_CANONICO}</p>
          <nav aria-label="Legal">
            <EnlaceCarga href="/terms">Términos</EnlaceCarga>
            <EnlaceCarga href="/privacy">Privacidad</EnlaceCarga>
          </nav>
        </div>
        <div className="lv-osm">
          Mapa © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>
        </div>
      </div>
    </footer>
  );
}
