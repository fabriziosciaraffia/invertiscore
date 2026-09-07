"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El campo-CTA de la landing (hero y cierre): el MISMO campo real del wizard.
//
// Usa `useDireccionPlaces` — el hook que también consume la pantalla de entrada
// del wizard —, así que el desplegable, el filtro duro por caja de cobertura y
// el respaldo por `/api/geocode` son idénticos. Lo único propio de la landing es
// qué pasa después: al elegir una dirección se navega al wizard con ella
// (`?direccion&lat&lng&comuna`), donde entra confirmada si la comuna está
// cubierta y cae en el rechazo de cobertura si no. La landing no duplica esa
// lógica.
//
// El placeholder escribe y borra cinco direcciones reales (validadas contra
// `scraped_properties`), se detiene al enfocar o escribir, y con
// `prefers-reduced-motion` queda fija la primera.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useDireccionPlaces, type SeleccionDireccion } from "@/components/formulario-v4/useDireccionPlaces";
import { RUTA_WIZARD } from "@/lib/cta-analizar";
import { EV, type UbicacionCampo } from "./eventos";

/** Direcciones reales del catálogo (07-sep-2026), formato "Calle Número, Comuna". */
export const DIRECCIONES_EJEMPLO = [
  "Av. Ecuador 3866, Estación Central",
  "Linares 1415, Providencia",
  "Zañartu 980, Ñuñoa",
  "Cuarta Avenida 1350, San Miguel",
  "Eleuterio Ramírez 710, Santiago",
] as const;

function origenDe(ubicacion: UbicacionCampo) {
  return ubicacion === "hero" ? "landing_hero" : "landing_cta_final";
}

export function CampoDireccion({ ubicacion }: { ubicacion: UbicacionCampo }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [texto, setTexto] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const focoMedido = useRef(false);
  const seleccionRef = useRef<SeleccionDireccion | null>(null);

  const irAlWizard = (sel: SeleccionDireccion | null) => {
    const q = new URLSearchParams({ origen: origenDe(ubicacion) });
    if (sel && sel.comuna) {
      q.set("direccion", sel.direccion);
      q.set("comuna", sel.comuna);
      q.set("lat", String(sel.lat));
      q.set("lng", String(sel.lng));
    }
    router.push(`${RUTA_WIZARD}?${q.toString()}`);
  };

  const { inputRef, geocodificarEscrita } = useDireccionPlaces({
    activo: true,
    comuna: null,
    onSeleccion: (sel) => {
      seleccionRef.current = sel;
      setTexto(sel.direccion);
      if (sel.via === "places") irAlWizard(sel);
    },
  });

  // ── Placeholder: escribe y borra direcciones reales ──
  const [ph, setPh] = useState<string>("");
  const animar = !enfocado && texto === "";
  useEffect(() => {
    if (!animar) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPh(DIRECCIONES_EJEMPLO[0]);
      return;
    }
    const off = ubicacion === "hero" ? 0 : 1;
    let k = off % DIRECCIONES_EJEMPLO.length;
    let i = 0;
    let del = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = DIRECCIONES_EJEMPLO[k];
      if (!del) {
        i++;
        setPh(s.slice(0, i));
        if (i === s.length) { del = true; t = setTimeout(tick, 1600); return; }
        t = setTimeout(tick, 60);
        return;
      }
      i--;
      setPh(s.slice(0, i));
      if (i === 0) { del = false; k = (k + 1) % DIRECCIONES_EJEMPLO.length; t = setTimeout(tick, 500); return; }
      t = setTimeout(tick, 26);
    };
    t = setTimeout(tick, 900 + off * 300);
    return () => clearTimeout(t);
  }, [animar, ubicacion]);

  const onFocus = () => {
    setEnfocado(true);
    if (!focoMedido.current) {
      focoMedido.current = true;
      posthog?.capture(EV.ctaFocus, { ubicacion });
    }
  };

  // Botón o Enter sin haber elegido del desplegable: se intenta el respaldo por
  // texto; si tampoco resuelve, se va al wizard igual (con el origen) y el
  // usuario escribe ahí. Nunca un callejón sin salida.
  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (buscando) return;
    const sel = seleccionRef.current;
    if (sel && sel.direccion === texto.trim()) { irAlWizard(sel); return; }
    const q = texto.trim();
    if (!q) { irAlWizard(null); return; }
    setBuscando(true);
    const r = await geocodificarEscrita(q, "");
    setBuscando(false);
    irAlWizard(r);
  };

  const sinDireccion = (modo: "ubicacion" | "mapa") => {
    posthog?.capture(EV.sinDireccion, { modo, ubicacion });
  };
  const hrefSin = (modo: "ubicacion" | "mapa") =>
    `${RUTA_WIZARD}?${new URLSearchParams({ modo, origen: origenDe(ubicacion) }).toString()}`;

  return (
    <div className="lv-campo">
      <form className="lv-box" onSubmit={enviar} role="search" aria-label="Dirección del departamento">
        <span className="lv-tx">
          <input
            ref={inputRef}
            className="lv-input"
            type="text"
            autoComplete="off"
            inputMode="text"
            aria-label="Escribe la dirección del departamento"
            placeholder={DIRECCIONES_EJEMPLO[0]}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); seleccionRef.current = null; }}
            onFocus={onFocus}
            onBlur={() => setEnfocado(false)}
          />
          {animar && (
            <span className="lv-ph" aria-hidden="true">
              {ph}
              <span className="lv-caret" />
            </span>
          )}
        </span>
        <button type="submit" className="lv-btn" aria-label="Analizar esta dirección" disabled={buscando}>
          →
        </button>
      </form>
      <div className="lv-alt">
        <span>¿No tienes la dirección?</span>
        <a href={hrefSin("ubicacion")} onClick={() => sinDireccion("ubicacion")}>Estoy en el depto</a>
        <a href={hrefSin("mapa")} onClick={() => sinDireccion("mapa")}>Marcarlo en el mapa</a>
      </div>
    </div>
  );
}
