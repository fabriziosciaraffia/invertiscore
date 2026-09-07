"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useDireccionPlaces — EL campo de dirección de Franco, como hook.
//
// Extraído de `screenEntrada.tsx` (07-sep-2026) para que la landing y el wizard
// usen el MISMO campo real: mismo Autocomplete de Google Places, mismo filtro
// duro por caja (`strictBounds`), misma derivación de comuna, mismo respaldo por
// `/api/geocode` cuando Places no responde. Nada de réplicas.
//
// El hook cablea el DOM y devuelve decisiones; NO sabe de PostHog ni del wizard.
// Quien lo consume decide qué hacer con la selección (el wizard la guarda en
// `answers`; la landing navega al wizard con ella) y emite su propia telemetría.
//
// Las decisiones puras (cuándo re-atar el widget, cómo derivar la comuna del
// texto) siguen en `entradaPlaces.ts`, que es lo que se testea.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { cajaParaComuna, type Caja } from "@/lib/comuna-bounds";
import { decidirEnganche, derivarComuna } from "./entradaPlaces";

export interface SeleccionDireccion {
  /** Dirección canónica (formatted_address de Google o del geocodificador). */
  direccion: string;
  comuna: string;
  ciudad: string;
  /** ¿La comuna derivada está dentro de la cobertura de Franco? */
  cubierta: boolean;
  lat: number;
  lng: number;
  /** Región según Google (solo Places; el geocodificador no la devuelve). */
  region: string | null;
  /** Por dónde entró: el desplegable de Places o el respaldo por texto. */
  via: "places" | "geocode";
  /** Solo geocode: la dirección desmintió a la comuna que el usuario había elegido. */
  corrigioAlChip: boolean;
}

export interface UseDireccionPlacesOpts {
  /** Atar el widget solo cuando el input está montado y corresponde (wizard:
   *  estado 2). Con `false` no se carga Google ni se crea nada. */
  activo: boolean;
  /** Comuna elegida, para acotar la caja. `null`/`undefined` = piso de cobertura
   *  (`cajaParaComuna(null)` nunca vuelve a "todo Chile"). */
  comuna?: string | null;
  /** Se llama con la selección resuelta; cubierta o no, el consumidor decide. */
  onSeleccion: (s: SeleccionDireccion) => void;
}

/** `Caja` → el `LatLngBounds` que espera Places. Un solo lugar arma el objeto. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aLatLngBounds(google: any, caja: Caja) {
  const [sur, oeste, norte, este] = caja;
  return new google.maps.LatLngBounds(
    new google.maps.LatLng(sur, oeste),
    new google.maps.LatLng(norte, este),
  );
}

export function useDireccionPlaces({ activo, comuna, onSeleccion }: UseDireccionPlacesOpts) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);
  /** Nodo al que está atado `acRef`. Si cambia, hay que re-atar (ver el efecto). */
  const nodoAtado = useRef<HTMLInputElement | null>(null);
  /** Comuna vigente, para leerla al crear el widget sin meterla en las deps del
   *  efecto (meterla ahí re-crearía el widget de Places en cada corrección). */
  const comunaRef = useRef<string | null | undefined>(comuna);
  comunaRef.current = comuna;
  /** Idem para el callback: el listener de Places vive fuera del ciclo de React. */
  const onSeleccionRef = useRef(onSeleccion);
  onSeleccionRef.current = onSeleccion;

  // ── Places sobre el input ──
  //
  // EL ENGANCHE SIGUE AL NODO VIVO, NO A UN REF GLOBAL (fix 20-ago-2026)
  // ────────────────────────────────────────────────────────────────────
  // En el wizard el input solo existe en el estado 2: volver al 1 o al 3 lo
  // desmonta, y al volver React crea un nodo NUEVO. Un guard `if (acRef.current)
  // return` sobrevive al desmontaje y deja el Autocomplete escuchando a un
  // <input> que ya no está en el DOM: el campo visible no está conectado a nada
  // (medido en producción: camino principal roto para el ~19% de quienes
  // tipearon el 20-ago). Por eso se recuerda a QUÉ NODO se ató y, si cambió, se
  // sueltan los listeners del instance viejo y se vuelve a atar al vivo.
  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelado) return;
        const input = inputRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google?.maps?.places) return;
        const accion = decidirEnganche({
          tieneInstancia: !!acRef.current,
          nodoAtado: nodoAtado.current,
          nodoVivo: input,
        });
        if (accion === "sin-nodo" || accion === "ya-atado") return;
        if (accion === "reatar") {
          // `Autocomplete` no tiene destroy(): se le sueltan los listeners y se
          // abandona el instance. Su `.pac-container` queda colgado del <body>
          // (Google los crea ahí y nunca los recoge): sin borrarlo aparece un
          // desplegable huérfano con sugerencias rancias sobre el campo nuevo.
          google.maps.event.clearInstanceListeners(acRef.current);
          acRef.current = null;
          nodoAtado.current = null;
          document.querySelectorAll(".pac-container").forEach((n) => n.remove());
        }
        // ── FILTRO DURO: la comuna elegida (y con ella, la cobertura) ──
        // `componentRestrictions` solo admite país. `bounds` a secas es solo un
        // SESGO (medido: con la caja de la RM sin `strictBounds` seguían saliendo
        // Ovalle, Valdivia y hasta Linares). `strictBounds` es el único filtro
        // que EXCLUYE de verdad.
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
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const addr = place.formatted_address || inputRef.current?.value || "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const comps = (place.address_components || []) as any[];
          // En la RM, Google mapea la comuna a `locality` (fallback admin_level_3).
          const comunaRaw =
            comps.find((c) => c.types.includes("locality"))?.long_name ||
            comps.find((c) => c.types.includes("administrative_area_level_3"))?.long_name ||
            "";
          const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
          const comunaFinal = match?.comuna || comunaRaw;
          const regionRaw =
            comps.find((c) => c.types.includes("administrative_area_level_1"))?.long_name || "";
          // REGRESIÓN-7: Google rellena el input con un texto distinto al
          // formatted_address, y su `input` event puede correr DESPUÉS de este
          // handler. Se sincroniza el input a la dirección canónica y se usa ESA
          // misma cadena para todo.
          if (inputRef.current) inputRef.current.value = addr;
          onSeleccionRef.current({
            direccion: addr,
            comuna: comunaFinal,
            ciudad: match?.ciudad || "Santiago",
            cubierta: isComunaDisponible(comunaFinal),
            lat,
            lng,
            region: regionRaw || null,
            via: "places",
            corrigioAlChip: false,
          });
        });
        acRef.current = ac;
        nodoAtado.current = input;
      })
      .catch(() => { /* sin Google no hay desplegable; el respaldo por texto sigue disponible */ });
    return () => { cancelado = true; };
  }, [activo]);

  // La comuna puede cambiar SIN que el input se remonte (Places corrigió el
  // chip): al widget vivo se le mueve la caja con `setBounds` en vez de
  // re-crearlo.
  useEffect(() => {
    const ac = acRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!ac || !google?.maps) return;
    ac.setBounds(aLatLngBounds(google, cajaParaComuna(comuna ?? null)));
  }, [comuna]);

  // ── SALIDA SIN BLOQUEO ────────────────────────────────────────────────────
  // El campo exige elegir de la lista de Places, y si Places no responde el
  // usuario queda encerrado. Acá se geocodifica lo que ESCRIBIÓ contra
  // `/api/geocode` (Google del lado servidor, Nominatim de respaldo). No
  // reemplaza a Places: se ofrece recién cuando Places ya falló.
  //
  // La comuna se deriva del `formattedAddress` del geocodificador, no del chip.
  // Si no está cubierta se devuelve igual, con `cubierta: false`: el consumidor
  // cae en el mismo rechazo de cobertura que el camino de Places. Nunca se
  // inventa una cobertura que no existe.
  const geocodificarEscrita = useCallback(
    async (texto: string, comunaElegida: string): Promise<SeleccionDireccion | null> => {
      const q = texto.trim();
      if (!q) return null;
      try {
        const r = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&comuna=${encodeURIComponent(comunaElegida)}`,
        );
        const j = (await r.json()) as { lat: number | null; lng: number | null; formattedAddress?: string };
        if (!r.ok || j.lat == null || j.lng == null) return null;
        const fmt = j.formattedAddress ?? q;
        const d = derivarComuna(fmt, comunaElegida);
        if (inputRef.current) inputRef.current.value = fmt;
        const sel: SeleccionDireccion = {
          direccion: fmt,
          comuna: d.comuna,
          ciudad: d.ciudad,
          cubierta: d.cubierta,
          lat: j.lat,
          lng: j.lng,
          region: null,
          via: "geocode",
          corrigioAlChip: d.corrigioAlChip,
        };
        onSeleccionRef.current(sel);
        return sel;
      } catch {
        return null;
      }
    },
    [],
  );

  return { inputRef, geocodificarEscrita };
}
