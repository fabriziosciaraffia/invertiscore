"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import type { ZonaStr } from "@/lib/zona-str";
import { fechaCortaCL } from "@/lib/fecha-cl";
import { Modal, VProsa, VViz, VSub, VCierre, VFuente } from "@/components/analysis/hallazgos/vocabulario";
import { FilaDato, FilasDato, Planilla, type FilaPlanilla } from "@/components/analysis/shared";

/**
 * LA ZONA · STR (T2 · 05-sep-2026, contrato mockup-str-CONGELADO sección LA ZONA).
 * Síntesis de una línea + tres celdas (tarifa típica · ocupación estimada · contra quién
 * te comparan) + la tipología declarada, y el botón Explorar que abre el modal con los 25
 * avisos en detalle, el perfil de huésped cualitativo (sin porcentajes) y los lugares
 * cerca. Todo viene de `ZonaStr` (server, con procedencia); acá no se calcula nada.
 * Telemetría: `informe_capitulo_abierto` con tipo 'str' y capítulo 'zona', una vez por
 * montaje, al abrir el modal.
 */
export function ZonaStrSection({
  zona,
  comuna,
  direccion,
  currency,
  valorUF,
  veredicto,
  accessLevel,
}: {
  zona: ZonaStr;
  comuna: string;
  direccion: string;
  currency: "CLP" | "UF";
  valorUF: number;
  veredicto: string;
  accessLevel: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const posthog = usePostHog();
  const medido = useRef(false);
  const abrir = () => {
    if (!medido.current) {
      medido.current = true;
      const props = { capitulo: "zona", id_capitulo: "zona", n: 7, tipo: "str", veredicto, access_level: accessLevel };
      try {
        posthog?.capture("informe_capitulo_abierto", props);
      } catch {
        /* la telemetría jamás rompe la lectura */
      }
      if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
        (window.__informeEvents ??= []).push({ name: "informe_capitulo_abierto", props });
      }
    }
    setAbierto(true);
  };

  const money = (n: number) => (currency === "UF" ? `UF ${(n / (valorUF || 1)).toFixed(1).replace(".", ",")}` : `$${Math.round(n).toLocaleString("es-CL")}`);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const fecha = (iso: string) => fechaCortaCL(iso);
  const t = zona.tarifaZona;
  const o = zona.ocupacion;
  const c = zona.comparables;
  const relTxt = o.relacion === "mas" ? "más que" : o.relacion === "menos" ? "menos que" : o.relacion === "similar" ? "parecido a" : null;

  // ── síntesis (una línea, determinista) ──
  const cobras = t ? (t.posicion === "igual" ? "Cobras lo que cobra la zona" : t.posicion === "arriba" ? "Cobras sobre lo que cobra la zona" : "Cobras bajo lo que cobra la zona") : "Sin tarifa de referencia para tu zona";
  const ocupa = relTxt ? ` y tu zona ocupa ${relTxt} lo típico de ${comuna}` : "";
  const sintesis = `${cobras}${ocupa}.`;
  const mitad = t ? (t.posicion === "abajo" ? "la mitad de la zona cobra más que tú" : "la mitad de la zona cobra menos que tú") : "";
  const superhost = (
    <>
      <i>superhost</i> (anfitrión destacado por la plataforma)
    </>
  );

  // ── detalle para el modal ──
  const avisos = [...zona.avisos].sort((a, b) => (a.distanciaM ?? 1e9) - (b.distanciaM ?? 1e9));
  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const tarifaMed = med(avisos.map((a) => a.tarifa).filter((x): x is number => x != null && x > 0));
  const resenasMed = med(avisos.map((a) => a.resenas).filter((x): x is number => x != null));
  const notaMed = med(avisos.map((a) => a.nota).filter((x): x is number => x != null && x > 0));
  const filasAvisos: FilaPlanilla[] = avisos.map((a, i) => ({
    th: String(i + 1),
    celdas: [
      { v: a.distanciaM != null ? `${a.distanciaM} m` : "—" },
      { v: a.tarifa != null ? money(a.tarifa) : "—" },
      { v: a.ocupacion != null ? pct(a.ocupacion) : "—" },
      { v: a.estadiaNoches != null ? `${a.estadiaNoches.toFixed(1).replace(".", ",")} noches` : "—" },
      { v: a.superhost ? "sí" : "—" },
    ],
  }));
  const establecidos = c && c.n > 0 && c.nSuperhost / c.n >= 0.5;
  const dorms = zona.tipologia.split(" · ")[0];

  const cierre: ReactNode = (() => {
    if (!t && !c) return <>Sin tarifa de referencia ni avisos parecidos: la zona no se puede leer con datos. Trata la ocupación y la tarifa como supuestos tuyos.</>;
    const partes: ReactNode[] = [];
    if (t) partes.push(t.posicion === "igual" ? <mark key="t">Cobras la mediana de tu zona: no hay grasa en la tarifa, la diferencia la hacen las noches.</mark> : t.posicion === "arriba" ? <mark key="t">Cobras sobre la mediana de tu zona: cada noche vendida vale más, pero la tarifa es una apuesta a diferenciarte.</mark> : <mark key="t">Cobras bajo la mediana de tu zona: hay espacio en la tarifa antes de pedirle más a la ocupación.</mark>);
    if (c) partes.push(<span key="c"> {establecidos ? `Te comparan con ${c.nSuperhost} anfitriones destacados de ${c.n}: compites con avisos establecidos, no con recién publicados.` : `De los ${c.n} avisos parecidos, ${c.nSuperhost} son de anfitriones destacados: la competencia es mezclada.`}</span>);
    if (relTxt) partes.push(<span key="o"> Tu zona ocupa {relTxt} lo típico de {comuna}{o.comuna ? ` (${pct(o.comuna.valor)})` : ""}.</span>);
    return <>{partes}</>;
  })();

  return (
    <div>
      <VProsa>{sintesis}</VProsa>
      <div className="zona-cells">
        <div>
          <p className="k">Tarifa típica de la zona</p>
          <p className="v">{t ? money(t.mediana) : "sin datos suficientes"}</p>
          {t && (
            <p className="s">
              Tú: <b>{money(t.tuya)}</b> · {t.posicion === "igual" ? "cobras la mediana" : t.posicion === "arriba" ? `cobras sobre la mediana · ${mitad}` : `cobras bajo la mediana · ${mitad}`}
              {t.esTuya ? " · tarifa definida por ti" : ""}
            </p>
          )}
        </div>
        <div>
          <p className="k">Ocupación {o.esTuya ? "definida por ti" : "estimada"}</p>
          <p className="v">{pct(o.tuya)}</p>
          <p className="s">
            Para tu depto{o.comuna ? <> · lo típico de {comuna} es <b>{pct(o.comuna.valor)}</b> · {o.comuna.n} estimaciones al {fecha(o.comuna.fecha)}</> : " · sin datos suficientes de la comuna"}
          </p>
        </div>
        <div>
          <p className="k">Contra quién te comparan</p>
          <p className="v">{c ? `${c.n} avisos` : "sin datos suficientes"}</p>
          {c && (
            <p className="s">
              parecidos{c.radioM != null ? ` · hasta ${c.radioM} m` : ""} · <b>{c.nSuperhost}</b> son {superhost} · {fecha(c.fecha)}
            </p>
          )}
        </div>
      </div>
      <p className="tipo-line">
        <b>Tu depto</b>
        {zona.tipologia}
      </p>
      <div className="zona-foot">
        <VFuente>
          Datos de mercado · tarifa y ocupación {t?.esTuya || o.esTuya ? "definidas por ti" : "estimadas para este depto"}
          {c ? ` · ${c.n} avisos parecidos · ${fecha(c.fecha)}` : ""}
          {o.comuna ? " · típico de la comuna: universo Franco V2" : ""}
        </VFuente>
        <button type="button" className="doc-lnk" onClick={abrir}>
          Explorar →
        </button>
      </div>

      <Modal abierto={abierto} onClose={() => setAbierto(false)} titulo={`La zona · ${comuna}`} sub={direccion || undefined}>
        <div className="doc-tokens">
          <VProsa>
            {sintesis}
            {c ? ` Los ${c.n} avisos con los que te comparan están${c.radioM != null ? ` hasta ${c.radioM} m` : " cerca"}, ${c.nSuperhost} son de anfitriones destacados${c.estadiaNoches != null ? ` y la estadía típica es de ${c.estadiaNoches.toFixed(1).replace(".", ",")} noches` : ""}: ${establecidos ? "compites con anfitriones establecidos, no con avisos recién publicados." : "la competencia es mezclada, con avisos establecidos y otros más nuevos."}` : ""}
          </VProsa>
          {c ? (
            <VViz t={`Competencia en detalle · ${c.n} avisos parecidos${dorms ? `, ${dorms.replace("D", " dormitorio")}${dorms !== "1D" ? "s" : ""}` : ""}`}>
              <VSub>Contra quién te comparan</VSub>
              <FilasDato>
                <FilaDato k="Dónde están" tip="Distancia al aviso más lejano, desde tu dirección" v={c.radioM != null ? `hasta ${c.radioM} m` : "—"} />
                <FilaDato k="Tarifa promedio cobrada · 12 meses" tip="Mediana de los avisos" v={tarifaMed != null ? money(tarifaMed) : "—"} />
                <FilaDato k="Estadía típica" tip="Mediana de la estadía promedio de los avisos" v={c.estadiaNoches != null ? `${c.estadiaNoches.toFixed(1).replace(".", ",")} noches` : "—"} />
                <FilaDato k={<>Anfitriones destacados · reseñas · nota</>} tip="superhost, reseñas (mediana) y nota (mediana)" v={`${c.nSuperhost} de ${c.n}${resenasMed != null ? ` · ${Math.round(resenasMed)}` : ""}${notaMed != null ? ` · ${notaMed.toFixed(1).replace(".", ",")}` : ""}`} />
                <FilaDato k={`Ocupación ${o.esTuya ? "definida por ti" : "estimada para tu depto"}`} tip={o.esTuya ? "El supuesto que definiste" : "Estimación de mercado para un depto como el tuyo, estabilizado"} v={`${pct(o.tuya)} · ${Math.round(o.tuya * 365)} noches`} tono="in" />
                <FilaDato k={`Típico de ${comuna}`} tip={o.comuna ? `${o.comuna.n} estimaciones al ${fecha(o.comuna.fecha)}` : "Sin datos suficientes"} v={o.comuna ? `${pct(o.comuna.valor)}${relTxt ? ` · ${o.relacion === "similar" ? "parecido" : o.relacion === "mas" ? "tú más" : "tú menos"}` : ""}` : "sin datos suficientes"} />
              </FilasDato>
              <p className="v-copy" style={{ marginTop: 10 }}>
                La ocupación {o.esTuya ? "de tu depto es el supuesto que definiste" : "es la que los datos de mercado estiman para un depto como el tuyo, estabilizado"}; lo típico de la comuna es la mediana de esas mismas estimaciones para otras direcciones de {comuna}. Lo que cada aviso ocupó de verdad el último año se muestra, pero no entra en el cálculo.
              </p>
              <Planilla columnas={["#", "Distancia", "Tarifa 12 m", "Ocupación 12 m", "Estadía", "Destacado"]} filas={filasAvisos} />
            </VViz>
          ) : (
            <VViz t="Competencia en detalle">
              <p className="v-copy">Sin datos suficientes: este análisis no guardó los avisos con los que se comparó.</p>
            </VViz>
          )}
          {zona.perfiles.length > 0 && (
            <VViz t="Quién se va a alojar acá">
              <VSub>Perfil de huésped</VSub>
              {zona.perfiles.map((p, i) => (
                <div key={p.perfil} className={`perfil-row${i === 0 ? " dom" : ""}`}>
                  <p className="pn">{p.label}</p>
                  <p className="pd">{p.descripcion}</p>
                </div>
              ))}
            </VViz>
          )}
          {zona.lugares.length > 0 && (
            <VViz t="Lugares cerca">
              {zona.lugares.map((l, i) => (
                <div key={i} className="poi">
                  <span className="n">{l.nombre}</span>
                  <span className="d">{l.distanciaM} m</span>
                  <span className="t">{l.tipo}</span>
                </div>
              ))}
            </VViz>
          )}
          <VCierre titulo="Qué significa">{cierre}</VCierre>
          <VFuente>
            Datos de mercado{c ? ` · ${c.n} avisos parecidos y estimación para este depto · ${fecha(c.fecha)}` : ""} · perfil de huésped y lugares: dataset Franco, sin porcentajes
          </VFuente>
        </div>
      </Modal>
    </div>
  );
}
