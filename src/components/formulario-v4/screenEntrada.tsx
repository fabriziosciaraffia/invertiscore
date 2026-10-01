"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — LA ENTRADA (nodo `dir`) y EL MAPA (desvío `dirMapa`)
//
// UNA PUERTA, DOS ACCESOS (26-sep-2026). La primera pantalla del wizard tiene el campo del hero de la
// landing v14 —`CampoEntrada`, el mismo componente, con su hook y sus dos caminos sin dirección—.
// DESDE EL 01-oct-2026 ES UN PASO DEL FORMULARIO, NO LA LANDING: quien entra desde el dashboard o
// «Nuevo análisis» veía el hero con su material y su título y sentía que salía del recorrido. Ahora va
// en papel, dentro del armazón del wizard (cabecera «Acto 1 · Qué compras», título «¿Dónde está el
// depto?»); cambia el envoltorio, no el campo. La landing sigue con el hero, y quien llega desde ella
// salta al mapa como antes. Reemplaza a la portada de tres estados (comuna primero con chips, «¿se paga solo?»,
// buscador de comuna y «todavía no tengo uno elegido» con las cifras de la comuna): la comuna se
// deduce de la dirección, que ya mandaba sobre el chip.
//
// EL MAPA ES SIEMPRE LA SEGUNDA PANTALLA (27-sep-2026, prueba de Fabrizio en el teléfono): es la
// confirmación de que la dirección quedó bien y muestra que hay datos —los comparables alrededor y
// el conteo—. Lo que sigue a la portada:
//   · dirección con número            → el mapa, con el pin en la dirección;
//   · dirección sin número            → el mapa, con el pin en la calle;
//   · «Estoy en el depto»             → la ubicación del teléfono; con ella, el mapa con el pin ahí;
//                                       sin permiso, el mapa sin pin y un aviso;
//   · «Marcarlo en el mapa»           → el mapa sin pin;
//   · fuera de cobertura              → se queda acá, con el aviso y la lista de espera.
// Ninguna dirección se confirma en la portada: se confirma en el mapa, con «Continuar».
//
// El mapa nombra el punto con la geocodificación inversa de `/api/geocode` y de ahí saca la comuna,
// así que los caminos terminan igual: una dirección con su comuna, confirmada por el usuario.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "@/lib/posthog-react";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { CampoEntrada, type CaminoSinDireccion, type EventoCampo } from "@/components/entrada/HeroEntrada";
import type { SeleccionDireccion } from "@/components/entrada/useDireccionPlaces";
import { pedirUbicacion } from "@/components/entrada/ubicacion";
import type { PrecisionUbicacion } from "@/lib/geocoding-precision";
import type { ScreenProps } from "./screensActo1";
import { FieldLabel, LinkBtn, PrimaryBtn } from "./ui";
import { trackWizard } from "./track";
import { rangoChars, registrarSondaSalida, reportarValidacionRechazo } from "./stepTelemetry";
import { WaitlistZonaInline } from "./WaitlistZonaInline";
import { MapaPinAjustable } from "./MapaPinAjustable";
import { rotuloComparables } from "./comparablesRotulo";

/** Lo que `/api/geocode?lat&lng` devuelve de un punto. */
interface PuntoNombrado {
  direccion: string;
  comuna: string;
  ciudad: string;
  cubierta: boolean;
  precision: PrecisionUbicacion;
}

async function nombrarPunto(lat: number, lng: number, signal?: AbortSignal): Promise<PuntoNombrado | null> {
  try {
    const r = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal });
    const j = (await r.json()) as Partial<PuntoNombrado> & { direccion: string | null };
    if (!r.ok || !j.direccion || !j.comuna) return null;
    return { direccion: j.direccion, comuna: j.comuna, ciudad: j.ciudad ?? "Santiago", cubierta: !!j.cubierta, precision: j.precision ?? "calle" };
  } catch {
    return null;
  }
}

// ── LA PORTADA ───────────────────────────────────────────────────────────────

export function EntradaScreen({
  answers,
  patchAnswers,
  answer,
  goDetour,
  banner,
  autoCamino = null,
}: ScreenProps & {
  /** El aviso de un análisis a medias (o «seguir o retomar», si llega una dirección nueva). */
  banner?: ReactNode;
  /** `?modo=ubicacion` desde la landing: el camino se ejecuta al llegar, una vez. */
  autoCamino?: CaminoSinDireccion | null;
}) {
  const posthog = usePostHog();
  const [ocupado, setOcupado] = useState<CaminoSinDireccion | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  // Fuera de cobertura: la dirección quedó escrita pero sin confirmar, y su comuna no está cubierta.
  const fueraDeZona = !!answers.direccion && !answers.direccionConfirmada && !!answers.comuna && !isComunaDisponible(answers.comuna);

  // ── Sonda de salida del campo: se conserva `wizard4_dir_tipeo` para no cortar la serie. Desde el
  //    26-sep-2026 la portada es solo el campo, así que `estado_salida` vale siempre 2 (los estados 1
  //    —chips— y 3 —sin depto— ya no existen). ──
  const charsMax = useRef(0);
  const sugerencia = useRef(false);
  const conTexto = useRef(false);
  registrarSondaSalida("dir", () => ({
    name: "wizard4_dir_tipeo",
    props: {
      chars_rango: rangoChars(charsMax.current),
      sugerencia_seleccionada: sugerencia.current,
      salio_con_texto_sin_seleccion: conTexto.current && !sugerencia.current,
      estado_salida: 2,
    },
  }));

  const rechazar = (d: { direccion: string; comuna: string; ciudad: string; region: string | null }) => {
    trackWizard(posthog, "wizard4_dir_rechazo_cobertura", { comuna: d.comuna || "sin_dato", region: d.region || "sin_dato" });
    reportarValidacionRechazo(posthog, "cobertura", "dir");
    setRegion(d.region);
    patchAnswers({
      direccion: d.direccion, comuna: d.comuna, ciudad: d.ciudad,
      direccionConfirmada: undefined, lat: undefined, lng: undefined, ubicacionPrecision: undefined,
    });
  };

  const onDireccion = (sel: SeleccionDireccion) => {
    sugerencia.current = true;
    trackWizard(posthog, "wizard4_entrada_camino", { camino: "escribir", via: sel.via, precision: sel.precision, cubierta: sel.cubierta });
    if (!sel.cubierta) { rechazar(sel); return; }
    const base = { direccion: sel.direccion, comuna: sel.comuna, ciudad: sel.ciudad, lat: sel.lat, lng: sel.lng, mapaAviso: undefined };
    // Con o sin número, al mapa: con número el pin parte en la dirección; sin número, en un punto de
    // la calle, y el mapa lo dice. Se confirma allá.
    const numero = sel.precision === "numero";
    goDetour("dirMapa", { ...base, direccionConfirmada: undefined, ubicacionPrecision: numero ? "numero" : "calle", mapaOrigen: numero ? "numero" : "sin_numero" });
  };

  const onCamino = async (camino: CaminoSinDireccion) => {
    if (ocupado) return;
    trackWizard(posthog, "wizard4_entrada_camino", { camino });
    const limpio = { direccionConfirmada: undefined, ubicacionPrecision: undefined, mapaAviso: undefined } as const;
    if (camino === "mapa") {
      goDetour("dirMapa", { ...limpio, lat: undefined, lng: undefined, mapaOrigen: "mapa" });
      return;
    }
    setOcupado("ubicacion");
    const r = await pedirUbicacion();
    trackWizard(posthog, "wizard4_ubicacion_permiso", { resultado: r.estado, margen_m: r.estado === "concedido" ? r.margenM : null });
    if (r.estado !== "concedido") {
      setOcupado(null);
      goDetour("dirMapa", { ...limpio, lat: undefined, lng: undefined, mapaOrigen: "ubicacion", mapaAviso: "sin_ubicacion" });
      return;
    }
    const nombre = await nombrarPunto(r.lat, r.lng);
    setOcupado(null);
    if (nombre && !nombre.cubierta) { rechazar({ ...nombre, region: null }); return; }
    goDetour("dirMapa", {
      ...limpio,
      lat: r.lat, lng: r.lng, mapaOrigen: "ubicacion",
      ...(nombre ? { direccion: nombre.direccion, comuna: nombre.comuna, ciudad: nombre.ciudad } : {}),
    });
  };

  // `?modo=ubicacion` desde la landing: la persona ya tocó «Estoy en el depto» allá.
  const autoHecho = useRef(false);
  useEffect(() => {
    if (!autoCamino || autoHecho.current) return;
    autoHecho.current = true;
    void onCamino(autoCamino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCamino]);

  const onEvento = (e: EventoCampo) => {
    if (e.tipo === "texto") { charsMax.current = Math.max(charsMax.current, e.largo); conTexto.current = e.largo > 0; sugerencia.current = false; }
    if (e.tipo === "respaldo") trackWizard(posthog, "wizard4_entrada_fallback_geocode", { resuelto: e.resuelto });
  };

  // Volver a la portada con la dirección ya confirmada y apretar la flecha sin tocar nada: sigue.
  const confirmada = answers.direccionConfirmada && answers.lat != null && answers.lng != null ? answers.direccionConfirmada : null;

  // Un paso del formulario: el armazón del wizard pone la cabecera del acto y el título; acá van el
  // aviso del borrador, el campo con sus caminos y, fuera de cobertura, la lista de espera. En papel.
  return (
    <div className="he-papel" data-entrada="paso">
      {banner}
      <CampoEntrada
        valorInicial={answers.direccion ?? ""}
        confirmada={confirmada}
        onContinuarConfirmada={() => answer("dir")}
        ocupado={ocupado}
        onDireccion={onDireccion}
        onCamino={(c) => void onCamino(c)}
        onEvento={onEvento}
      />
      {fueraDeZona ? (
        <div className="he-rechazo">
          <p className="he-aviso">
            {answers.comuna} está fuera del Gran Santiago: por ahora Franco no tiene datos suficientes ahí.
          </p>
          <WaitlistZonaInline comuna={answers.comuna!} region={region} sobreHero />
        </div>
      ) : null}
    </div>
  );
}

// ── EL MAPA: «¿Dónde queda exactamente?» ─────────────────────────────────────

const AVISO_MAPA: Record<string, { titulo: string; texto: string }> = {
  numero: {
    titulo: "Tu dirección",
    texto: "Revisa que el pin quedó en el edificio. Si no, tócalo o arrástralo hasta ahí: los comparables se miden desde ese punto.",
  },
  sin_numero: {
    titulo: "Dirección sin número",
    texto: "Sin número, el depto quedó en un punto cualquiera de la calle. Toca el mapa o arrastra el pin hasta el edificio: los comparables se miden desde ahí.",
  },
  ubicacion: {
    titulo: "Tu ubicación",
    texto: "Te ubiqué con la ubicación del teléfono. Si no estás justo en el edificio, mueve el pin.",
  },
  sin_ubicacion: {
    titulo: "Sin tu ubicación",
    texto: "No pude usar la ubicación del teléfono. Márcalo en el mapa: toca donde está el edificio.",
  },
  mapa: {
    titulo: "Márcalo en el mapa",
    texto: "Toca el mapa donde está el edificio. Puedes acercarte con los botones o con dos dedos.",
  },
};

export function MapaScreen({ answers, data, patchAnswers, answer, onVolver }: ScreenProps & { onVolver: () => void }) {
  const posthog = usePostHog();
  const origen = answers.mapaOrigen ?? "mapa";
  const tieneInicial = typeof answers.lat === "number" && typeof answers.lng === "number";
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    tieneInicial ? { lat: answers.lat as number, lng: answers.lng as number } : null,
  );
  // El punto que llega con nombre (la dirección elegida, la calle, la ubicación ya nombrada) lo
  // conserva mientras nadie mueva el pin: la inversa de un punto con número daría «2098» por
  // «2100», y la de una calle sin número inventaría uno.
  const [nombreInicial] = useState<PuntoNombrado | null>(() =>
    tieneInicial && answers.direccion && answers.comuna
      ? {
          direccion: answers.direccion,
          comuna: answers.comuna,
          ciudad: answers.ciudad ?? "Santiago",
          cubierta: isComunaDisponible(answers.comuna),
          precision: origen === "numero" ? "numero" : "calle",
        }
      : null,
  );
  const [nombre, setNombre] = useState<PuntoNombrado | null>(nombreInicial);
  const [nombrando, setNombrando] = useState(false);
  const [sinNombre, setSinNombre] = useState(false);
  const movido = useRef(false);

  // Cada punto nuevo se nombra; si el usuario sigue moviendo, la respuesta vieja se descarta. Con el
  // nombre, el punto pasa a las respuestas: de ahí salen los comparables y el conteo del mapa, los
  // mismos que dirá la pregunta siguiente.
  useEffect(() => {
    if (!punto) return;
    if (!movido.current && nombreInicial) return;
    const ctrl = new AbortController();
    setNombrando(true);
    setSinNombre(false);
    const t = setTimeout(async () => {
      const n = await nombrarPunto(punto.lat, punto.lng, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setNombre(n);
      setSinNombre(!n);
      setNombrando(false);
      if (n && n.cubierta) patchAnswers({ lat: punto.lat, lng: punto.lng, comuna: n.comuna, ciudad: n.ciudad });
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [punto, nombreInicial, patchAnswers]);

  const onMover = (lat: number, lng: number) => {
    if (!movido.current) {
      movido.current = true;
      trackWizard(posthog, "wizard4_pin_movido", { origen, habia_pin: tieneInicial });
    }
    setPunto({ lat, lng });
  };

  const aviso = AVISO_MAPA[answers.mapaAviso === "sin_ubicacion" ? "sin_ubicacion" : origen];
  const listo = !!punto && !!nombre && nombre.cubierta && !nombrando;
  // La leyenda cuenta la lista que el mapa dibuja: los comparables detrás del arriendo de referencia
  // (misma tipología, superficie ±30%, activos, al radio que alcanzó la muestra), la misma que el
  // motor usa. El resto del radio va en gris más tenue y la leyenda lo distingue. Mientras se busca, se dice.
  const conteo = !punto
    ? null
    : data.suggestionsLoading || nombrando
      ? "Buscando comparables cerca…"
      : data.comparables.length > 0
        ? (
          <>
            {rotuloComparables(data.comparables.length, data.radiusUsed)}
            {data.restoRadio.length > 0 && <span className="text-[#6B6B72]"> · otros {data.restoRadio.length} en gris</span>}
          </>
        )
        : null;

  const usar = () => {
    if (!punto || !nombre) return;
    // Sin mover el pin, la precisión es la de lo que se eligió: con número sigue «numero» y la calle
    // sin número sigue «calle» —ese punto no lo eligió nadie—. Moverlo lo vuelve «pin».
    const sinMover = !movido.current;
    const precision = sinMover && origen === "numero" ? "numero" : sinMover && origen === "sin_numero" ? "calle" : "pin";
    const direccion = sinMover && nombreInicial ? nombreInicial.direccion : nombre.direccion;
    answer("dirMapa", {
      direccion,
      direccionConfirmada: direccion,
      comuna: nombre.comuna,
      ciudad: nombre.ciudad,
      lat: punto.lat,
      lng: punto.lng,
      ubicacionPrecision: precision,
    });
  };

  const sinMover = !movido.current;
  const pie = sinMover && origen === "numero"
    ? "La dirección que elegiste"
    : sinMover && origen === "sin_numero"
      ? "Un punto de la calle: mueve el pin hasta el edificio"
      : "Aproximada: la dirección más cercana al pin";

  return (
    <div>
      <div className="wz-gap">
      <div className="wz-bloque">
        <div className="wz-bt">{aviso.titulo}</div>
        <p>{aviso.texto}</p>
      </div>

      <div className="wz-campo">
        <FieldLabel>Ubicación en el mapa</FieldLabel>
        <MapaPinAjustable
          lat={punto?.lat ?? null}
          lng={punto?.lng ?? null}
          comuna={origen === "sin_numero" ? answers.comuna ?? null : null}
          limite="cobertura"
          height={300}
          onMover={onMover}
          puntos={data.comparables}
          contexto={data.restoRadio}
          etiqueta={conteo}
        />
      </div>

      {punto && (
        <div className="wz-bloque wz-punto" aria-live="polite">
          <div className="wz-bt">Dirección del punto</div>
          {nombrando ? (
            <p>Buscando la dirección…</p>
          ) : nombre ? (
            <>
              <p className="wz-punto-dir">{nombre.direccion.split(",").slice(0, 2).join(",")}</p>
              <p className="wz-punto-pie">{pie}</p>
              {!nombre.cubierta && (
                <p className="wz-punto-fuera">
                  {nombre.comuna} está fuera del Gran Santiago: por ahora Franco no tiene datos suficientes ahí.
                </p>
              )}
            </>
          ) : sinNombre ? (
            <p>No encuentro una calle en ese punto. Mueve el pin un poco, sobre la calle o el edificio.</p>
          ) : null}
        </div>
      )}
      </div>

      <PrimaryBtn onClick={usar} disabled={!listo}>Continuar →</PrimaryBtn>
      <LinkBtn onClick={onVolver}>Escribir la dirección</LinkBtn>
    </div>
  );
}
