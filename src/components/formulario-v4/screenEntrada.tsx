"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — LA ENTRADA (nodo `dir`) y EL MAPA (desvío `dirMapa`)
//
// UNA PUERTA, DOS ACCESOS (26-sep-2026). La primera pantalla del wizard es el hero de la landing v14
// —`HeroEntrada`, el mismo componente—: el título, el campo de dirección y dos caminos sin
// dirección. Reemplaza a la portada de tres estados (comuna primero con chips, «¿se paga solo?»,
// buscador de comuna y «todavía no tengo uno elegido» con las cifras de la comuna): la comuna se
// deduce de la dirección, que ya mandaba sobre el chip.
//
// Lo que sigue a la portada:
//   · dirección con número y cubierta → `tipo`, con la dirección en la reacción;
//   · dirección sin número            → el mapa, con el pin en la calle;
//   · «Estoy en el depto»             → la ubicación del teléfono; con ella, el mapa con el pin ahí;
//                                       sin permiso, el mapa sin pin y un aviso;
//   · «Marcarlo en el mapa»           → el mapa sin pin;
//   · fuera de cobertura              → se queda acá, con el aviso y la lista de espera.
//
// El mapa nombra el punto con la geocodificación inversa de `/api/geocode` y de ahí saca la comuna,
// así que los tres caminos terminan igual: una dirección con su comuna, confirmada por el usuario.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { HeroEntrada, type CaminoSinDireccion, type EventoCampo } from "@/components/entrada/HeroEntrada";
import type { SeleccionDireccion } from "@/components/entrada/useDireccionPlaces";
import { pedirUbicacion } from "@/components/entrada/ubicacion";
import type { PrecisionUbicacion } from "@/lib/geocoding-precision";
import type { ScreenProps } from "./screensActo1";
import { FieldLabel, GhostBtn, PrimaryBtn } from "./ui";
import { trackWizard } from "./track";
import { rangoChars, registrarSondaSalida, reportarValidacionRechazo } from "./stepTelemetry";
import { WaitlistZonaInline } from "./WaitlistZonaInline";
import { MapaPinAjustable } from "./MapaPinAjustable";

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
  logueado,
  autoCamino = null,
}: ScreenProps & {
  /** El aviso de un análisis a medias (o «seguir o retomar», si llega una dirección nueva). */
  banner?: ReactNode;
  logueado: boolean;
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
    if (sel.precision === "numero") {
      answer("dir", { ...base, direccionConfirmada: sel.direccion, ubicacionPrecision: "numero", mapaOrigen: undefined });
      return;
    }
    // Sin número: el punto es de la calle. El mapa lo dice y deja moverlo antes de confirmar.
    goDetour("dirMapa", { ...base, direccionConfirmada: undefined, ubicacionPrecision: "calle", mapaOrigen: "sin_numero" });
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

  return (
    <HeroEntrada
      derecha={logueado
        ? <a href="/dashboard" className="he-der">Mis análisis</a>
        : <a href="/login" className="he-der">Entrar</a>}
      pie={<a href="/demo" onClick={() => trackWizard(posthog, "wizard4_entrada_ejemplo", {})}>Ver un análisis de ejemplo<span aria-hidden="true">→</span></a>}
      antes={banner}
      valorInicial={answers.direccion ?? ""}
      confirmada={confirmada}
      onContinuarConfirmada={() => answer("dir")}
      ocupado={ocupado}
      despues={fueraDeZona ? (
        <div className="he-rechazo">
          <p className="he-aviso">
            {answers.comuna} está fuera del Gran Santiago: por ahora Franco no tiene datos suficientes ahí.
          </p>
          <WaitlistZonaInline comuna={answers.comuna!} region={region} sobreHero />
        </div>
      ) : null}
      onDireccion={onDireccion}
      onCamino={(c) => void onCamino(c)}
      onEvento={onEvento}
    />
  );
}

// ── EL MAPA: «¿Dónde queda exactamente?» ─────────────────────────────────────

const AVISO_MAPA: Record<string, { titulo: string; texto: string }> = {
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

export function MapaScreen({ answers, answer, onVolver }: ScreenProps & { onVolver: () => void }) {
  const posthog = usePostHog();
  const origen = answers.mapaOrigen ?? "mapa";
  const tieneInicial = typeof answers.lat === "number" && typeof answers.lng === "number";
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    tieneInicial ? { lat: answers.lat as number, lng: answers.lng as number } : null,
  );
  const [nombre, setNombre] = useState<PuntoNombrado | null>(null);
  const [nombrando, setNombrando] = useState(false);
  const [sinNombre, setSinNombre] = useState(false);
  const movido = useRef(false);

  // Cada punto nuevo se nombra; si el usuario sigue moviendo, la respuesta vieja se descarta.
  useEffect(() => {
    if (!punto) return;
    const ctrl = new AbortController();
    setNombrando(true);
    setSinNombre(false);
    const t = setTimeout(async () => {
      const n = await nombrarPunto(punto.lat, punto.lng, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setNombre(n);
      setSinNombre(!n);
      setNombrando(false);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [punto]);

  const onMover = (lat: number, lng: number) => {
    if (!movido.current) {
      movido.current = true;
      trackWizard(posthog, "wizard4_pin_movido", { origen, habia_pin: tieneInicial });
    }
    setPunto({ lat, lng });
  };

  const aviso = AVISO_MAPA[answers.mapaAviso === "sin_ubicacion" ? "sin_ubicacion" : origen];
  const listo = !!punto && !!nombre && nombre.cubierta && !nombrando;

  const usar = () => {
    if (!punto || !nombre) return;
    // Sin mover el pin, la calle sin número sigue siendo «calle»: el punto no lo eligió nadie.
    const precision = !movido.current && origen === "sin_numero" ? "calle" : "pin";
    answer("dirMapa", {
      direccion: nombre.direccion,
      direccionConfirmada: nombre.direccion,
      comuna: nombre.comuna,
      ciudad: nombre.ciudad,
      lat: punto.lat,
      lng: punto.lng,
      ubicacionPrecision: precision,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-r-lg border-l-2 border-[var(--franco-text-secondary)] pl-4 pr-4 py-3"
        style={{ background: "color-mix(in srgb, var(--franco-text) 3.5%, transparent)" }}
      >
        <p className="font-body text-[12px] font-medium text-[var(--franco-text-tertiary)] m-0 mb-1">{aviso.titulo}</p>
        <p className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text)] m-0">{aviso.texto}</p>
      </div>

      <MapaPinAjustable
        lat={punto?.lat ?? null}
        lng={punto?.lng ?? null}
        comuna={origen === "sin_numero" ? answers.comuna ?? null : null}
        limite="cobertura"
        height={300}
        onMover={onMover}
      />

      {punto && (
        <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3">
          <FieldLabel>Dirección del punto</FieldLabel>
          {nombrando ? (
            <p className="font-body text-[14px] text-[var(--franco-text-muted)] m-0">Buscando la dirección…</p>
          ) : nombre ? (
            <>
              <p className="font-body text-[15px] font-medium text-[var(--franco-text)] m-0">{nombre.direccion.split(",").slice(0, 2).join(",")}</p>
              <p className="font-body text-[12px] text-[var(--franco-text-muted)] mt-0.5 mb-0">Aproximada: la dirección más cercana al pin</p>
              {!nombre.cubierta && (
                <p className="font-body text-[13px] text-[var(--franco-text)] mt-2 mb-0">
                  {nombre.comuna} está fuera del Gran Santiago: por ahora Franco no tiene datos suficientes ahí.
                </p>
              )}
            </>
          ) : sinNombre ? (
            <p className="font-body text-[13px] text-[var(--franco-text)] m-0">No encuentro una calle en ese punto. Mueve el pin un poco, sobre la calle o el edificio.</p>
          ) : null}
        </div>
      )}

      <div className="mt-1 flex flex-col gap-2">
        <PrimaryBtn onClick={usar} disabled={!listo}>Usar este punto →</PrimaryBtn>
        <GhostBtn onClick={onVolver}>Escribir la dirección</GhostBtn>
      </div>
    </div>
  );
}
