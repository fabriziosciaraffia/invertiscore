"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA TARJETA DE UN DEPTO EN LA BASE (etapa 3; rediseño del 23-nov-2026, lámina 3.3). Una por fila: la foto, la dirección (con número
// solo con la ubicación confirmada; mayúsculas bien puestas), metro, comuna y programa, el veredicto, la síntesis de «Lo que ve Franco»
// en el recuadro azul (solo en PC: en celular queda en la página del depto), precio, cap rate y lo que deja al mes, y su estado: el chip
// y, cuando le toca a la persona, qué le toca y el rango si existe (la tarjeta se levanta; VistaBase). Sale la etiqueta «El que
// elegiste / Te lo recomendamos». Las otras opciones van con lo mismo en chico (TarjetaOtra). Si la lectura llega después, la calle se
// completa sola.
// Todo en `span`: la tarjeta de «Tus deptos» va dentro de un botón (solo admite contenido en línea).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { pctUno } from "@/lib/explorar/explorar";
import { ALTERNATIVAS_COPY as A } from "@/lib/invierte-v2/alternativas";
import { urlFoto } from "@/lib/invierte-v2/fotos";
import { LECTURA_COPY as L, alertaPrimero, lineaAlternativa, type LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { fmtUF, textoAlMes } from "@/lib/invierte-v2/opciones";
import { BASE_COPY as B, lineaDepto } from "@/lib/invierte-v2/base";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { direccionDepto, tituloDepto } from "@/lib/invierte-v2/titulo-depto";
import type { DatosDepto } from "@/lib/invierte-v2/base-servidor";
import type { EstadoBase } from "@/lib/invierte-v2/depto-flujo";
import type { FichaDepto } from "@/lib/invierte-v2/ficha-depto-servidor";
import { useLectura } from "./LoQueVeFranco";

/** La portada: la primera foto que cargue, sin flechas (la tarjeta entera es un botón). Sin fotos, nada. */
export function FotoPortada({ avisoId, n, clase }: { avisoId: string; n: number; clase: string }) {
  const [i, setI] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  // Una foto que terminó de cargar antes de que la página despertara (sin `onLoad`) también se revisa: si es el pixel de una foto
  // borrada, se pasa a la siguiente.
  useEffect(() => { const x = img.current; if (x?.complete && (x.naturalWidth <= 1)) setI((k) => k + 1); }, [i]);
  if (!n || i >= n) return null;
  return (
    <span className={`iv2-portada ${clase}`} data-inv2="portada">
      {/* eslint-disable-next-line @next/next/no-img-element -- la sirve la ruta propia, con su caché; no pasa por el optimizador */}
      <img ref={img} src={urlFoto(avisoId, i)} alt={A.foto(i + 1, n)} decoding="async" onError={() => setI((x) => x + 1)} onLoad={(e) => { if (e.currentTarget.naturalWidth <= 1) setI((x) => x + 1); }} />
    </span>
  );
}

/** El título calle·metro: con la calle de la lectura, cuando llega. */
function tituloDe(f: FichaDepto | null, l: LecturaFranco | null, datos: DatosDepto): string {
  if (!f) return datos.comuna ?? "Depto";
  if (f.calleConfirmada) return f.titulo;
  return l?.calle ? tituloDepto({ calle: l.calle, metro: f.metro, comuna: f.comuna }) : f.titulo;
}

/** La síntesis en su recuadro: la alerta si existe (con su chip), si no la primera línea de la corta. */
function Sintesis({ l }: { l: LecturaFranco | null }) {
  const t = l ? lineaAlternativa(l) : null;
  if (!l || !t) return null;
  const alerta = alertaPrimero(l) ? (l.alerta.nivel === "grave" ? "grave" : "revisar") : null;
  return (
    <span className="iv2-lectura-caja iv2-td-sintesis" data-alerta={alerta ?? undefined} data-inv2="lectura-linea">
      <span className="iv2-lectura-cab">
        <span className="iv2-lectura-rotulo">{L.rotulo}</span>
        {alerta && <span className="iv2-lectura-chip" data-inv2="lectura-chip">{L.alertaNivel[alerta]}</span>}
      </span>
      <span className="iv2-td-sintesis-t">{t}</span>
    </span>
  );
}

function Dato({ et, children, clave }: { et: string; children: ReactNode; clave: string }) {
  return <span className="iv2-td-dato" data-inv2={clave}><span className="iv2-td-dato-et">{et}</span><span className="iv2-td-dato-v">{children}</span></span>;
}

/** La dirección de la tarjeta: la calle (la confirmada por Franco, o la que leyó la lectura) con el número solo si está confirmada; sin
 *  calle confiable, el título calle·metro de siempre. */
function direccionDe(f: FichaDepto | null, l: LecturaFranco | null, datos: DatosDepto, numero: string | null): { t: string; conMetro: boolean } {
  const d = f ? direccionDepto({ calle: f.calleConfirmada ?? l?.calle ?? null, numero: f.calleConfirmada ? numero : null, comuna: f.comuna }) : null;
  return d ? { t: d, conMetro: false } : { t: tituloDe(f, l, datos), conMetro: true };
}

/** «Tus deptos»: la tarjeta de un depto elegido (va dentro de TarjetaDetalles, que la vuelve tocable). */
export function TarjetaBase({ avisoId, datos, ficha, numeroConfirmado = null, alcanza, estado }: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; numeroConfirmado?: string | null; alcanza: boolean; estado: EstadoBase }) {
  const l = useLectura(avisoId, ficha?.lectura ?? null);
  const dir = direccionDe(ficha, l, datos, numeroConfirmado);
  const metro = !dir.conMetro && ficha?.metro && ficha.metro.metros <= 1000 ? `Metro ${ficha.metro.estacion.replace(/^(Estación|Metro)\s+/i, "")}` : null;
  const tuyo = estado.tono === "ciruela";
  const alMes = textoAlMes({ flujoCLP: datos.flujoCLP ?? null });
  return (
    <span className="iv2-td" data-inv2="tarjeta-depto">
      <span className="iv2-td-principal">
        <span className="iv2-td-cab">
          <FotoPortada avisoId={avisoId} n={ficha?.fotos ?? 0} clase="iv2-td-foto" />
          <span className="iv2-td-id">
            <span className="iv2-td-t" data-inv2="titulo-depto">{dir.t}</span>
            <span className="iv2-depto-s">{[metro, lineaDepto(datos)].filter(Boolean).join(" · ")}{alcanza ? "" : ` · ${B.fueraDeAlcance}`}</span>
            {datos.veredicto && <span className="iv2-td-chip"><ChipVeredicto v={datos.veredicto as Veredicto} puntaje={datos.veredicto === "COMPRAR" ? datos.score ?? null : null} /></span>}
          </span>
        </span>
        <Sintesis l={l} />
        <span className="iv2-td-datos">
          <Dato et={A.precio} clave="precio">{datos.precioUF ? `UF ${fmtUF(datos.precioUF)}` : "—"}</Dato>
          <Dato et={A.capRate} clave="cap-rate">{ficha?.capRatePct != null ? pctUno(ficha.capRatePct) : "—"}</Dato>
          <Dato et={A.alMes} clave="base-al-mes"><span className={alMes.pones ? "iv2-pones" : undefined}>{alMes.t}</span></Dato>
        </span>
      </span>
      <span className="iv2-td-estado" data-inv2="estado">
        <span className="iv2-td-estado-txt">
          <span className={tuyo ? "iv2-chip-tuyo" : "iv2-chip-franco"} data-inv2="estado-depto">{tuyo && <i aria-hidden="true" />}{estado.chip}</span>
          {estado.titulo && <span className="iv2-td-estado-t" data-inv2="estado-titulo">{estado.titulo}</span>}
          <span className="iv2-td-estado-linea">{estado.linea}</span>
          <span className="iv2-td-abrir" aria-hidden="true">{B.abrirEsteDepto} ›</span>
        </span>
        <span className="iv2-td-flecha" aria-hidden="true">›</span>
      </span>
    </span>
  );
}

/** «Otras opciones que convienen»: lo mismo en chico. `acciones`: «Ver detalles» y «Seguir con este». */
export function TarjetaOtra({ avisoId, datos, ficha, acciones }: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; acciones: ReactNode }) {
  const l = useLectura(avisoId, ficha?.lectura ?? null);
  const titulo = tituloDe(ficha, l, datos);
  const linea = l ? lineaAlternativa(l) : null;
  const resumen = [datos.precioUF ? `UF ${fmtUF(datos.precioUF)}` : null, ficha?.capRatePct != null ? `${A.capRate} ${pctUno(ficha.capRatePct)}` : null, `${signoVeredicto("COMPRAR")} ${etiquetaVeredicto("COMPRAR", "frase")}${datos.score != null ? ` · ${datos.score}` : ""}`].filter(Boolean).join(" · ");
  return (
    <div className="iv2-otra-mini" data-inv2="otra">
      <div className="iv2-otra-mini-cab">
        <FotoPortada avisoId={avisoId} n={ficha?.fotos ?? 0} clase="iv2-otra-mini-foto" />
        <div className="iv2-otra-mini-id">
          <p className="iv2-otra-mini-t" data-inv2="titulo-depto">{titulo}</p>
          <p className="iv2-depto-s">{lineaDepto(datos)}</p>
          <p className="iv2-otra-mini-resumen" data-inv2="otra-resumen">{resumen}</p>
        </div>
      </div>
      {linea && <p className="iv2-otra-mini-linea" data-inv2="otra-linea">{linea}</p>}
      <div className="iv2-otra-mini-acciones">{acciones}</div>
    </div>
  );
}

/** El título calle·metro del resultado (A2, lámina 3.2-resultado): con la calle de la lectura, que puede llegar después. */
export function TituloCalle({ avisoId, metro, comuna, inicial }: { avisoId: string; metro: { estacion: string; metros: number } | null; comuna: string | null; inicial: LecturaFranco | null }) {
  const l = useLectura(avisoId, inicial);
  return <>{tituloDepto({ calle: l?.calle ?? null, metro, comuna })}</>;
}
