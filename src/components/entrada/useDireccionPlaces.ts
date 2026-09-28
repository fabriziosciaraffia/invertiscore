"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useDireccionPlaces — EL campo de dirección de Franco, como hook.
//
// Lo usan la primera pantalla del wizard y, cuando mergee, el hero de la landing: mismo
// Autocomplete de Google Places, mismo filtro duro por la caja de cobertura (`strictBounds`), misma
// derivación de comuna, mismo respaldo por `/api/geocode` cuando Places no responde. Nada de
// réplicas. (La landing v14 extrajo una primera versión el 07-sep; ésta es la misma idea sobre el
// campo de hoy, con la regla de calle del 26-sep: nada se confirma sin una calle real, y la
// selección dice cuán precisa es.)
//
// El hook cablea el DOM y devuelve decisiones; NO sabe de PostHog ni del wizard. Quien lo consume
// decide qué hacer con la selección y emite su propia telemetría. Las decisiones puras (cuándo
// re-atar el widget, cómo derivar la comuna del texto) viven en `entradaPlaces.ts`, que se testea.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { cajaParaComuna, type Caja } from "@/lib/comuna-bounds";
import { comunaDeComponentes, precisionDeComponentes, sinCodigoPostal, type PrecisionUbicacion } from "@/lib/geocoding-precision";
import { decidirEnganche, derivarComuna } from "@/components/formulario-v4/entradaPlaces";

export interface SeleccionDireccion {
  /** Dirección canónica (formatted_address de Google o del geocodificador). */
  direccion: string;
  comuna: string;
  ciudad: string;
  /** ¿La comuna derivada está dentro de la cobertura de Franco? */
  cubierta: boolean;
  lat: number;
  lng: number;
  /** "numero" · "calle" (sin número: el punto es de la calle) · null = no es una calle. */
  precision: PrecisionUbicacion | null;
  /** Región según Google (solo Places; el geocodificador no la devuelve). */
  region: string | null;
  /** Por dónde entró: el desplegable de Places o el respaldo por texto. */
  via: "places" | "geocode";
}

export interface UseDireccionPlacesOpts {
  /** Atar el widget solo cuando corresponde. Con `false` no se carga Google ni se crea nada. */
  activo: boolean;
  /** Comuna para acotar la caja. `null` = el piso de cobertura (nunca «todo Chile»). */
  comuna?: string | null;
  /** Se llama con la selección de Places, sea calle o no: el consumidor decide. */
  onSeleccion: (s: SeleccionDireccion) => void;
  /** Cambia cuando el <input> vivo es otro (en el teléfono, el campo se muda a una hoja a pantalla
   *  completa): el widget se vuelve a atar al nodo nuevo. */
  clave?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aLatLngBounds(google: any, caja: Caja) {
  const [sur, oeste, norte, este] = caja;
  return new google.maps.LatLngBounds(new google.maps.LatLng(sur, oeste), new google.maps.LatLng(norte, este));
}

export function useDireccionPlaces({ activo, comuna, onSeleccion, clave }: UseDireccionPlacesOpts) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);
  /** Nodo al que está atado `acRef`. Si cambia, hay que re-atar (ver el efecto). */
  const nodoAtado = useRef<HTMLInputElement | null>(null);
  const comunaRef = useRef<string | null | undefined>(comuna);
  comunaRef.current = comuna;
  const onSeleccionRef = useRef(onSeleccion);
  onSeleccionRef.current = onSeleccion;

  // ── Places sobre el input ──
  // EL ENGANCHE SIGUE AL NODO VIVO, NO A UN REF GLOBAL (fix 20-ago-2026): si el input se desmonta y
  // vuelve, React crea un nodo nuevo, y un guard `if (acRef.current) return` dejaba al Autocomplete
  // escuchando a un <input> fuera del DOM (medido: camino principal roto para el ~19%). Se recuerda a
  // QUÉ NODO se ató y, si cambió, se sueltan los listeners del instance viejo y se re-ata.
  //
  // GOOGLE MAPS SE CARGA AL PRIMER TOQUE, NO AL MONTAR (28-sep-2026, rendimiento de la landing):
  // el script pesa 381 kB y bloqueaba 350-600 ms del hilo principal antes del titular en la
  // landing y en la portada del wizard. Ahora `prepararPlaces()` es lo que carga y ata; lo dispara
  // el primer foco / toque / tecla sobre el campo (listeners de abajo) o quien monta, al abrir la
  // hoja del teléfono. Hasta ese toque no hay ni script ni widget. Si el toque llega con texto ya
  // escrito, al atar se le avisa al widget con un `input` sintético para que proponga igual.
  const tocado = useRef(false);
  const prepararPlaces = useCallback(() => {
    if (!activo) return;
    tocado.current = true;
    loadGoogleMaps()
      .then(() => {
        if (!activo) return;
        const input = inputRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google?.maps?.places) return;
        const accion = decidirEnganche({ tieneInstancia: !!acRef.current, nodoAtado: nodoAtado.current, nodoVivo: input });
        if (accion === "sin-nodo" || accion === "ya-atado") return;
        if (accion === "reatar") {
          // `Autocomplete` no tiene destroy(): se sueltan los listeners y se borra el
          // `.pac-container` huérfano que Google deja colgado del <body>.
          google.maps.event.clearInstanceListeners(acRef.current);
          acRef.current = null;
          nodoAtado.current = null;
          document.querySelectorAll(".pac-container").forEach((n) => n.remove());
        }
        // FILTRO DURO: `componentRestrictions` solo admite país y `bounds` a secas es un sesgo;
        // `strictBounds` es el único filtro que EXCLUYE (medido el 20-ago).
        const ac = new google.maps.places.Autocomplete(input, {
          types: ["address"],
          componentRestrictions: { country: "cl" },
          bounds: aLatLngBounds(google, cajaParaComuna(comunaRef.current ?? null)),
          strictBounds: true,
          fields: ["geometry", "formatted_address", "address_components"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place?.geometry?.location) return;
          const addr = sinCodigoPostal(place.formatted_address || inputRef.current?.value || "");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const comps = (place.address_components || []) as any[];
          const comunaRaw = comunaDeComponentes(comps);
          const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
          const comunaFinal = match?.comuna || comunaRaw;
          const regionRaw = comps.find((c) => c.types.includes("administrative_area_level_1"))?.long_name || "";
          // REGRESIÓN-7: Google rellena el input con un texto distinto al formatted_address, y su
          // `input` event puede correr DESPUÉS de este handler: se sincroniza a la canónica.
          if (inputRef.current) inputRef.current.value = addr;
          onSeleccionRef.current({
            direccion: addr,
            comuna: comunaFinal,
            ciudad: match?.ciudad || "Santiago",
            cubierta: isComunaDisponible(comunaFinal),
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            // NADA SE CONFIRMA SIN UNA CALLE REAL (26-sep-2026): sin `route` no es una dirección.
            precision: precisionDeComponentes(comps),
            region: regionRaw || null,
            via: "places",
          });
        });
        acRef.current = ac;
        nodoAtado.current = input;
        // El widget escucha teclas; lo ya escrito antes de que llegara no lo ve sin este aviso.
        if (input && input.value && document.activeElement === input) {
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Unidentified" }));
        }
      })
      .catch(() => { /* sin Google no hay desplegable; el respaldo por texto sigue disponible */ });
  }, [activo]);

  // Los listeners del primer toque sobre el <input> vivo. Cambia `clave` cuando el nodo es otro (la
  // hoja del teléfono): se vuelven a atar. Si ya hubo un toque antes (por ejemplo la hoja se abrió
  // con el campo enfocado desde quien monta), se ata de inmediato al nodo nuevo.
  useEffect(() => {
    if (!activo) return;
    const input = inputRef.current;
    if (!input) return;
    if (tocado.current) { prepararPlaces(); return; }
    const alPrimerToque = () => prepararPlaces();
    const eventos = ["focus", "pointerdown", "touchstart", "keydown"] as const;
    for (const e of eventos) input.addEventListener(e, alPrimerToque, { once: true, passive: true });
    if (document.activeElement === input) prepararPlaces();
    return () => { for (const e of eventos) input.removeEventListener(e, alPrimerToque); };
  }, [activo, clave, prepararPlaces]);

  // La comuna puede cambiar sin que el input se remonte: se le mueve la caja al widget vivo.
  useEffect(() => {
    const ac = acRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!ac || !google?.maps) return;
    ac.setBounds(aLatLngBounds(google, cajaParaComuna(comuna ?? null)));
  }, [comuna]);

  // ── SALIDA SIN BLOQUEO ──
  // Si Places no responde, se geocodifica lo que ESCRIBIÓ contra `/api/geocode`, que ya no
  // devuelve nada que no sea una calle («asdf» no cae en el centroide) y dice cuán precisa es. La
  // comuna se deriva del texto canónico; fuera de cobertura se devuelve igual, con `cubierta: false`.
  const geocodificarEscrita = useCallback(async (texto: string): Promise<SeleccionDireccion | null> => {
    const q = texto.trim();
    if (!q) return null;
    try {
      const qs = new URLSearchParams({ q });
      if (comunaRef.current) qs.set("comuna", comunaRef.current);
      const r = await fetch(`/api/geocode?${qs.toString()}`);
      const j = (await r.json()) as { lat: number | null; lng: number | null; formattedAddress?: string; precision?: PrecisionUbicacion };
      if (!r.ok || j.lat == null || j.lng == null || !j.precision) return null;
      const fmt = j.formattedAddress ?? q;
      const d = derivarComuna(fmt, comunaRef.current ?? "");
      if (inputRef.current) inputRef.current.value = fmt;
      return {
        direccion: fmt,
        comuna: d.comuna,
        ciudad: d.ciudad,
        cubierta: d.cubierta,
        lat: j.lat,
        lng: j.lng,
        precision: j.precision,
        region: null,
        via: "geocode",
      };
    } catch {
      return null;
    }
  }, []);

  return { inputRef, geocodificarEscrita, prepararPlaces };
}
