// ─────────────────────────────────────────────────────────────────────────────
// Piezas de marca compartidas por la landing v14 y las páginas que hablan su
// mismo lenguaje (/metodologia). Vivían dentro de `Secciones.tsx` y `Respuesta.tsx`
// como funciones locales; se extraen acá SIN cambiar su markup para que la
// landing renderice igual y las otras páginas no repliquen nada.
//
// Todas son server components: markup puro, sin estado. El CSS es `landing.css`
// (prefijo `lv-`), que la página importa una vez.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";
import type { DatosLanding } from "@/lib/landing-vivo";
import { TZ_CHILE } from "@/lib/fecha-cl";
import type { Veredicto } from "@/lib/types";

export const TAGLINE = "Real estate en su estado más franco";

/** Wordmark canónico (.ai en Signal Red) + slogan en mono. */
export function Wordmark() {
  return (
    <div>
      <FrancoLogo size="header" href="/" className="lv-wm" />
      <div className="lv-tag">{TAGLINE}</div>
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

/** "hoy 03:30" (hora de Chile) si el último scrape fue hoy; si no, "el 6 sep 03:30".
 *  Decisión del goal: sin "hace N min" — el scrape corre una vez al día. Lo usan
 *  la sección 3 de la landing y la cabecera de documento de /metodologia. */
export function actualizado(iso: string, ahora: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hora = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_CHILE }).format(d);
  const dia = (x: Date) => new Intl.DateTimeFormat("es-CL", { timeZone: TZ_CHILE, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  if (dia(d) === dia(ahora)) return `hoy ${hora}`;
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: TZ_CHILE, day: "numeric", month: "short" }).format(d).replace(".", "");
  return `el ${fecha} ${hora}`;
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

/** Footer de la landing: fondo con las tonalidades del hero (receta v3 invertida
 *  y vertical), wordmark y links en papel, último análisis en mono y la
 *  atribución del mapa (ODbL). */
export function PieLanding({ ultimo, ahora }: { ultimo: DatosLanding["ultimoAnalisis"]; ahora: Date }) {
  return (
    <footer className="lv-footer">
      <picture className="lv-fondo lv-fondo-footer">
        <source media="(min-width: 768px)" srcSet="/landing/footer-d2x.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- textura de marca ya en WebP */}
        <img src="/landing/footer-m2x.webp" alt="" loading="lazy" decoding="async" />
      </picture>
      <div className="lv-col">
        <div className="lv-footer-fila">
          <Wordmark />
          <nav aria-label="Franco">
            <Link href="/metodologia">Cómo calcula</Link>
            <Link href="/comunas">Comunas</Link>
            <Link href="/pricing">Planes</Link>
            <Link href="/login">Entrar</Link>
          </nav>
        </div>
        {ultimo && (
          <div className="lv-ultimo">
            <i className="lv-dot" />Último análisis · <b>{ultimo.etiqueta}</b> · <span className="lv-ultimo-comuna">{ultimo.comuna} · </span>{haceCuanto(ultimo.createdAt, ahora)}
          </div>
        )}
        <div className="lv-osm">
          Mapa © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a>
        </div>
      </div>
    </footer>
  );
}
