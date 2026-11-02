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
import { esTopeNegociar } from "@/lib/explorar/capa-negociar";
import { NEGOCIADO_COPY } from "@/lib/precio-publicado";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { wordmarkSvg } from "@/lib/og/wordmark";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/og/depto/<aviso>[?m=str] (02-nov-2026, goal «Compartir un depto desde Explorar»): LA VISTA PREVIA DEL ENLACE de
// un depto compartido, la imagen que muestran WhatsApp y las redes. Una tarjeta del depto: a la izquierda la
// vista de la calle (con su etiqueta, nunca «el edificio») o, si no hay foto que cumpla, el mapa chico con el pin; a la
// derecha el wordmark, la línea del depto, el precio y el chip ✓ Comprar de la casa —solo si el servidor comprueba que da
// Comprar hoy con el financiamiento por defecto (compartir-servidor.ts)—. SIN CIFRAS MÁS ALLÁ DEL CHIP: ni puntaje, ni
// flujo, ni cap rate; todo lo que se dibuja sale de `contenidoVistaPrevia` (lo exige el tier COMPARTIR-DEPTO).
// UN NEGOCIADO (`?n=<tope>`, 03-nov-2026): en lugar del chip Comprar, «Al precio publicado» con el chip Ajustar de la casa y
// la línea «Conviene si lo negocias a UF 2.950»; ni el descuento ni el puntaje.
// La genera el servidor y queda en la caché del CDN un día (y se sirve vieja una semana mientras se rehace): la piden los
// robots de vista previa cada vez que alguien pega el enlace. En Node (no Edge: el cálculo de renta corta es grande).
// LAS FUENTES: Inter, la única de Explorar, como en la tarjeta del pin —la línea en 400, el precio y el chip en 600—; el
// wordmark va dibujado. Satori no lee woff2 ni fuentes variables: van en TTF estático, sacadas del subconjunto español que
// ya sirve el sitio (public/fonts/inter-normal-es.woff2 → Inter-Regular-es.ttf e Inter-SemiBold-es.ttf), leídas del disco;
// si la función no las trae, de refranco.ai (son estáticas y públicas).
// EL TAMAÑO (medido en el preview, 02-nov-2026): a 1200 × 630 la imagen pesaba 589 kB —la foto de la calle no comprime en
// PNG— y WhatsApp suele saltarse las vistas previas de más de ~300 kB. Va a 800 × 420 (la proporción 1,91:1 de las redes;
// sobre el mínimo de 600 × 315 de la tarjeta grande): el diseño es el de 1200 × 630, escalado entero con `e()`.
// Y SALE EN JPEG (medido en el preview, 02-nov-2026, tras el rebase): aun a 800 × 420 el PNG pesó de 308 a 530 kB en doce
// avisos —la foto manda—; el mismo, en JPEG de calidad 82, 44 kB contra 354. ImageResponse solo da PNG: lo convierte sharp.
// ─────────────────────────────────────────────────────────────────────────────
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
/** La calidad del JPEG: la foto de la calle se ve igual y pesa una octava parte del PNG. */
const CALIDAD_JPEG = 82;
/** El diseño se dibujó a 1200 × 630; sale a 800 × 420. */
const ESCALA = 2 / 3;
const e = (n: number) => Math.round(n * ESCALA);
const ANCHO = e(1200);
const ALTO = e(630);
/** La foto de la calle al alto de la imagen y el mapa a la mitad con escala 2. */
const LADO = { foto: ALTO, mapa: Math.round(ALTO / 2) };

// Neutros del tema claro (globals.css › [data-theme="light"]) y el chip de Comprar de la casa en claro (ChipVeredicto.tsx).
const PAPEL = "#F6F6F7";
const TINTA = "#0F0F0F";
const SECUNDARIO = "#5F5E5A";
const MUTED = "#6B6B72";
const BORDE = "#DDDDE1";
const CHIP_COMPRAR = { fondo: "#2B558F", texto: "#FFFFFF" };
/** El chip Ajustar de la casa en claro (ChipVeredicto.tsx: la ciruela de la tríada). */
const CHIP_AJUSTAR = { fondo: "#F1E4EC", texto: "#6E4560", borde: "#DCC6D4" };

const FUENTES = { regular: "Inter-Regular-es.ttf", semibold: "Inter-SemiBold-es.ttf" } as const;
const INTER = "Inter";
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
      const [regular, semibold] = await Promise.all([fuente(FUENTES.regular), fuente(FUENTES.semibold)]);
      return { regular, semibold };
    })();
    // Una falla no se guarda: el próximo pedido vuelve a intentar.
    void fuentesCache.then((f) => { if (!f.regular || !f.semibold) fuentesCache = null; });
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

/** EL PNG A JPEG (sharp viene con @vercel/og). Null si sharp no carga o falla: se sirve el PNG. */
async function aJpeg(png: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(png).jpeg({ quality: CALIDAD_JPEG, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

/** El ✓ del chip, dibujado: no depende de que la fuente traiga el carácter. */
function Check({ color }: { color: string }) {
  return (
    <svg width={e(30)} height={e(30)} viewBox="0 0 24 24" style={{ marginRight: e(12) }}>
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(req: Request, { params }: { params: { avisoId: string } }) {
  if (!esAvisoId(params.avisoId)) return new Response(null, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const modalidad = sp.get("m") === "str" ? "str" : "ltr";
  const tope = esTopeNegociar(sp.get("n")) ? Number(sp.get("n")) : null;
  const [ficha, imagen, f] = await Promise.all([
    fichaCompartidaCacheada(params.avisoId, modalidad, tope).catch(() => null),
    imagenComoDato(params.avisoId.toLowerCase()),
    fuentes(),
  ]);
  if (!ficha) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  const v = contenidoVistaPrevia(ficha);
  const wordmark = `data:image/svg+xml,${encodeURIComponent(wordmarkSvg(TINTA, 0.28))}`;
  const fonts = [
    ...(f.regular ? [{ name: INTER, data: f.regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(f.semibold ? [{ name: INTER, data: f.semibold, weight: 600 as const, style: "normal" as const }] : []),
  ];

  const respuesta = new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: "flex", backgroundColor: PAPEL, color: TINTA }}>
        <div style={{ width: ALTO, height: ALTO, display: "flex", position: "relative", backgroundColor: BORDE }}>
          {imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagen.src} width={ALTO} height={ALTO} alt="" style={{ width: ALTO, height: ALTO, objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", width: ALTO, height: ALTO, alignItems: "center", justifyContent: "center", fontFamily: INTER, fontSize: e(30), color: SECUNDARIO }}>{ficha.depto.comuna}</div>
          )}
          {imagen?.tipo === "foto" ? (
            <div style={{ position: "absolute", left: e(24), bottom: e(24), display: "flex", padding: `${e(6)}px ${e(14)}px`, borderRadius: e(8), backgroundColor: "rgba(0,0,0,0.55)", color: "#FFFFFF", fontFamily: INTER, fontSize: e(22) }}>
              {CALLE_COPY.etiqueta}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `${e(56)}px ${e(52)}px ${e(50)}px ${e(56)}px` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wordmark} width={e(212)} height={e(36)} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: INTER, fontWeight: 400, fontSize: e(30), lineHeight: 1.35, color: SECUNDARIO }}>{v.linea}</div>
            <div style={{ display: "flex", marginTop: e(14), fontFamily: INTER, fontWeight: 600, fontSize: e(76), lineHeight: 1.05, letterSpacing: "-0.02em" }}>{v.precio}</div>
            {v.chip === "COMPRAR" ? (
              <div style={{ display: "flex", marginTop: e(30) }}>
                <div style={{ display: "flex", alignItems: "center", padding: `${e(12)}px ${e(28)}px ${e(12)}px ${e(22)}px`, borderRadius: 999, backgroundColor: CHIP_COMPRAR.fondo, color: CHIP_COMPRAR.texto, fontFamily: INTER, fontWeight: 600, fontSize: e(34) }}>
                  <Check color={CHIP_COMPRAR.texto} />
                  Comprar
                </div>
              </div>
            ) : null}
            {v.chip === "AJUSTA SUPUESTOS" && v.negociado ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: e(26) }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", marginRight: e(14), fontFamily: INTER, fontWeight: 400, fontSize: e(28), color: SECUNDARIO }}>{NEGOCIADO_COPY.alPublicado}</div>
                  <div style={{ display: "flex", alignItems: "center", padding: `${e(8)}px ${e(22)}px`, borderRadius: 999, border: `${e(2)}px solid ${CHIP_AJUSTAR.borde}`, backgroundColor: CHIP_AJUSTAR.fondo, color: CHIP_AJUSTAR.texto, fontFamily: INTER, fontWeight: 600, fontSize: e(30) }}>
                    {`${signoVeredicto(v.chip)} ${etiquetaVeredicto(v.chip, "frase")}`}
                  </div>
                </div>
                <div style={{ display: "flex", marginTop: e(18), fontFamily: INTER, fontWeight: 600, fontSize: e(32), lineHeight: 1.25, color: TINTA }}>{v.negociado}</div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", fontFamily: INTER, fontWeight: 400, fontSize: e(24), lineHeight: 1.4, color: MUTED }}>
            {v.chip === "COMPRAR" ? COMPARTIR_COPY.vistaPrevia.pie : v.negociado ? COMPARTIR_COPY.negociado.pie : v.descripcion}
          </div>
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, fonts },
  );
  // Sale en JPEG (o en el PNG si sharp no carga), en una respuesta nueva con la caché propia: con `headers` en las opciones
  // de ImageResponse, Next la sumaba a su «immutable, max-age=31536000».
  const png = Buffer.from(await respuesta.arrayBuffer());
  const jpeg = await aJpeg(png);
  return new Response(new Uint8Array(jpeg ?? png), { headers: { "Content-Type": jpeg ? "image/jpeg" : "image/png", "Cache-Control": CACHE } });
}
