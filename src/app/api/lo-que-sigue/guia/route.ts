import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { guiaPara, leerConfigGuia, leerOrigenGuia } from "@/lib/guia/guia-servidor";
import { textoDistancia } from "@/lib/guia/seleccion";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";

// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (30-sep-2026): los parecidos del informe `a`, recalculados con los números
// de la persona. Solo lectura. Devuelve lo que la pantalla muestra y nada más: comuna, tipología, m²,
// precio, distancia, veredicto, puntaje y flujo. Sin enlace al aviso ni textos del aviso.
// El id del informe llega en la vuelta de Flow (el ticket paga sin sesión); sin él no hay guía.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const a = new URL(request.url).searchParams.get("a") ?? "";
  if (!UUID.test(a)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const admin = createAnonPipelineClient();
  try {
    const o = await leerOrigenGuia(admin, a);
    if (!o) return NextResponse.json({ disponible: false });
    const cfg = await leerConfigGuia(admin);
    const g = await guiaPara(admin, o, cfg);
    return NextResponse.json(
      {
        disponible: true,
        estado: g.estado,
        origen: { tipologia: tipologiaDe(o.dormitorios, null), m2: Math.round(o.m2), precioUF: Math.round(o.precioUF) },
        combinacion: g.combinacion,
        radioM: g.radioM,
        items: g.items.map(({ c, ev }) => ({
          avisoId: c.avisoId,
          comuna: c.comuna,
          tipologia: tipologiaDe(c.dormitorios, c.banos),
          m2: Math.round(c.m2),
          precioUF: Math.round(c.precioUF),
          distancia: textoDistancia(c.distanciaM),
          veredicto: ev.veredicto,
          score: ev.score,
          flujo: ev.flujo,
        })),
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/lo-que-sigue/guia", operacion: "guia", extra: { analysisId: a } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
