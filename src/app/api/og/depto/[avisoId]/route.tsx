import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";
import { francoMapStaticStyleParams } from "@/lib/map-styles";
import { imagenDeCalle } from "@/lib/explorar/calle-servidor";
import { CALLE_COPY } from "@/lib/explorar/calle";
import { COMPARTIR_COPY, contenidoVistaPrevia } from "@/lib/explorar/compartir";
import { fichaCompartidaCacheada } from "@/lib/explorar/compartir-servidor";
import { esAvisoId } from "@/lib/explorar/enlace-compartido";
import { wordmarkSvg } from "@/lib/og/wordmark";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/og/depto/<aviso>[?m=str] (02-nov-2026, goal «Compartir un depto desde Explorar»): LA VISTA PREVIA DEL ENLACE de
// un depto compartido, la imagen que muestran WhatsApp y las redes (1200 × 630). Una tarjeta del depto: a la izquierda la
// vista de la calle (con su etiqueta, nunca «el edificio») o, si no hay foto que cumpla, el mapa chico con el pin; a la
// derecha el wordmark, la línea del depto, el precio y el chip ✓ Comprar de la casa —solo si el servidor comprueba que da
// Comprar hoy con el financiamiento por defecto (compartir-servidor.ts)—. SIN CIFRAS MÁS ALLÁ DEL CHIP: ni puntaje, ni
// flujo, ni cap rate; todo lo que se dibuja sale de `contenidoVistaPrevia` (lo exige el tier COMPARTIR-DEPTO).
// La genera el servidor y queda en la caché del CDN un día (y se sirve vieja una semana mientras se rehace): la piden los
// robots de vista previa cada vez que alguien pega el enlace. En Node (no Edge: el cálculo de renta corta es grande).
// LAS FUENTES: las TTF de public/fonts, leídas del disco; si la función no las trae, de refranco.ai (son estáticas y
// públicas). Satori no lee woff2: por eso el chip va en JetBrains Mono, la de los veredictos.
// ─────────────────────────────────────────────────────────────────────────────
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const ANCHO = 1200;
const ALTO = 630;
/** La foto de la calle a 630 px (Street View Static llega hasta 640) y el mapa a 315 con escala 2. */
const LADO = { foto: 630, mapa: 315 };

// Neutros del tema claro (globals.css › [data-theme="light"]) y el chip de Comprar de la casa en claro (ChipVeredicto.tsx).
const PAPEL = "#F6F6F7";
const TINTA = "#0F0F0F";
const SECUNDARIO = "#5F5E5A";
const MUTED = "#6B6B72";
const BORDE = "#DDDDE1";
const CHIP_COMPRAR = { fondo: "#2B558F", texto: "#FFFFFF" };

const FUENTES = { serif: "SourceSerif4-Bold.ttf", mono: "JetBrainsMono-Regular.ttf", monoBold: "JetBrainsMono-Bold.ttf" } as const;
let fuentesCache: Promise<Record<keyof typeof FUENTES, ArrayBuffer | null>> | null = null;

async function fuente(nombre: string): Promise<ArrayBuffer | null> {
  try {
    const b = await readFile(join(process.cwd(), "public", "fonts", nombre));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  } catch { /* la función no trae public/: se pide al sitio */ }
  try {
    const r = await fetch(`https://refranco.ai/fonts/${nombre}`, { signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}
function fuentes() {
  if (!fuentesCache) {
    fuentesCache = (async () => {
      const [serif, mono, monoBold] = await Promise.all([fuente(FUENTES.serif), fuente(FUENTES.mono), fuente(FUENTES.monoBold)]);
      return { serif, mono, monoBold };
    })();
    // Una falla no se guarda: el próximo pedido vuelve a intentar.
    void fuentesCache.then((f) => { if (!f.serif || !f.mono || !f.monoBold) fuentesCache = null; });
  }
  return fuentesCache;
}

/** La imagen de la calle (o el mapa chico) como data URI; null si Google no la entrega. */
async function imagenComoDato(avisoId: string): Promise<{ src: string; tipo: "foto" | "mapa" } | null> {
  const img = await imagenDeCalle(createServiceClient(), avisoId, francoMapStaticStyleParams("light"), new Date(), {}, LADO).catch(() => null);
  if (!img) return null;
  const traer = async (url: string) => {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const tipo = r.headers.get("content-type") ?? "";
      if (!r.ok || !tipo.startsWith("image/")) return null;
      return `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    } catch {
      return null;
    }
  };
  const foto = await traer(img.url);
  if (foto) return { src: foto, tipo: img.tipo };
  const mapa = img.respaldo ? await traer(img.respaldo) : null;
  return mapa ? { src: mapa, tipo: "mapa" } : null;
}

/** El ✓ del chip, dibujado: no depende de que la fuente traiga el carácter. */
function Check({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(req: Request, { params }: { params: { avisoId: string } }) {
  if (!esAvisoId(params.avisoId)) return new Response(null, { status: 404 });
  const modalidad = new URL(req.url).searchParams.get("m") === "str" ? "str" : "ltr";
  const [ficha, imagen, f] = await Promise.all([
    fichaCompartidaCacheada(params.avisoId, modalidad).catch(() => null),
    imagenComoDato(params.avisoId.toLowerCase()),
    fuentes(),
  ]);
  if (!ficha) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  const v = contenidoVistaPrevia(ficha);
  const wordmark = `data:image/svg+xml,${encodeURIComponent(wordmarkSvg(TINTA, 0.28))}`;
  const fonts = [
    ...(f.serif ? [{ name: "Source Serif 4", data: f.serif, weight: 700 as const, style: "normal" as const }] : []),
    ...(f.mono ? [{ name: "JetBrains Mono", data: f.mono, weight: 400 as const, style: "normal" as const }] : []),
    ...(f.monoBold ? [{ name: "JetBrains Mono", data: f.monoBold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: "flex", backgroundColor: PAPEL, color: TINTA }}>
        <div style={{ width: ALTO, height: ALTO, display: "flex", position: "relative", backgroundColor: BORDE }}>
          {imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagen.src} width={ALTO} height={ALTO} alt="" style={{ width: ALTO, height: ALTO, objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", width: ALTO, height: ALTO, alignItems: "center", justifyContent: "center", fontFamily: "JetBrains Mono", fontSize: 30, color: SECUNDARIO }}>{ficha.depto.comuna}</div>
          )}
          {imagen?.tipo === "foto" ? (
            <div style={{ position: "absolute", left: 24, bottom: 24, display: "flex", padding: "6px 14px", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.55)", color: "#FFFFFF", fontFamily: "JetBrains Mono", fontSize: 22 }}>
              {CALLE_COPY.etiqueta}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 52px 50px 56px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wordmark} width={212} height={36} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 28, lineHeight: 1.35, color: SECUNDARIO }}>{v.linea}</div>
            <div style={{ display: "flex", marginTop: 16, fontFamily: "Source Serif 4", fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: "-0.02em" }}>{v.precio}</div>
            {v.chip ? (
              <div style={{ display: "flex", marginTop: 30 }}>
                <div style={{ display: "flex", alignItems: "center", padding: "12px 28px 12px 22px", borderRadius: 999, backgroundColor: CHIP_COMPRAR.fondo, color: CHIP_COMPRAR.texto, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34 }}>
                  <Check color={CHIP_COMPRAR.texto} />
                  Comprar
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 22, lineHeight: 1.4, color: MUTED }}>
            {v.chip ? COMPARTIR_COPY.vistaPrevia.pie : v.descripcion}
          </div>
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, fonts, headers: { "Cache-Control": CACHE } },
  );
}
