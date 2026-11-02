import { ImageResponse } from "next/og";
import { AI_PATH, FRANCO_PATH, RE_PATH } from "@/lib/og/wordmark";

// ─────────────────────────────────────────────────────────────────────────
// OG image global (1200×630). Convención de archivo de Next: aplica a toda
// ruta que no declare su propia imagen (los informes /analisis/[id] siguen
// usando /api/og).
//
// Landing v14 (FASE 1.7): la textura del hero (receta v3, fondo oscuro; JPEG
// porque Satori no lee WebP: tools/texturas/generar.py hero 1200 630 … --sin-grano)
// con el h1 en Source Serif 4 Bold en papel y el wordmark arriba. El plumón va
// en papel al 26 % (sobre el fondo oscuro el rojo desaparece). El ".ai" en
// Signal Red es el uso 4.
//
// Wordmark: paths vectoriales de public/logos/refranco-wordmark-light.svg
// (la versión dark del SVG tiene el bug del .ai en x=155 — no usar).
// ─────────────────────────────────────────────────────────────────────────

export const runtime = "edge";
export const alt = "¿Ese depto es buena inversión? — Franco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Los trazos del wordmark refranco.ai viven en src/lib/og/wordmark.ts (los comparte la vista previa de un depto).

// Sobre el fondo oscuro: "re" fantasma papel al 55%, "franco" papel, ".ai" Signal Red (uso 4).
const WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0.40 8.50 134.96 22.94"><path fill="#FAFAF8" fill-opacity="0.55" d="${RE_PATH}"/><path fill="#FAFAF8" d="${FRANCO_PATH}"/><path fill="#C8323C" d="${AI_PATH}"/></svg>`;

function aBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export default async function OgImage() {
  const [serifBold, monoBold, textura] = await Promise.all([
    fetch(new URL("../../public/fonts/SourceSerif4-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("../../public/fonts/JetBrainsMono-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("../../public/landing/og-hero.jpg", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);

  const wordmarkDataUri = `data:image/svg+xml,${encodeURIComponent(WORDMARK_SVG)}`;
  const fondo = `data:image/jpeg;base64,${aBase64(textura)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor: "#1F3D67", // 0 % de la escala del hero, derivada del token (generar.py escala)
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fondo} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ position: "absolute", top: 56, left: 72, display: "flex", flexDirection: "column" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wordmarkDataUri} width={236} height={40} alt="" />
          <div
            style={{
              marginTop: 10,
              fontFamily: "JetBrains Mono",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "rgba(250,250,248,0.8)",
            }}
          >
            REAL ESTATE EN SU ESTADO MÁS FRANCO
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 236,
            display: "flex",
            flexDirection: "column",
            fontFamily: "Source Serif 4",
            fontSize: 108,
            fontWeight: 700,
            lineHeight: 0.96,
            letterSpacing: "-0.03em",
            color: "#FAFAF8",
          }}
        >
          <div style={{ display: "flex" }}>¿Ese depto es</div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {/* plumón (uso 11): Satori no parsea `transparent` en gradientes, así que es un bloque
                absoluto del 40% inferior de la línea, mismo color y opacidad que en la landing */}
            <span style={{ display: "flex", position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "40%",
                  backgroundColor: "rgba(250,250,248,0.26)",
                }}
              />
              <span style={{ position: "relative" }}>buena inversión</span>
            </span>
            <span>?</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serifBold, weight: 700, style: "normal" },
        { name: "JetBrains Mono", data: monoBold, weight: 700, style: "normal" },
      ],
    }
  );
}
