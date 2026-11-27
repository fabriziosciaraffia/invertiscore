import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { accesoAsesoriaDe } from "@/lib/asesoria/acceso-servidor";
import { estres } from "@/lib/asesoria/capacidad";
import { calcularPerfil, filaPerfil, validarPedidoPerfil } from "@/lib/asesoria/perfil";
import { capRate, elegirTres } from "@/lib/asesoria/tres";
import { cercaDe, cercaDelMetro } from "@/lib/asesoria/lugar";
import { universoAsesoria } from "@/lib/asesoria/servidor";
import { conveniencia, palanca } from "@/lib/asesoria/palanca";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import type { PlazoMascara } from "@/lib/asesoria/aporte";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asesoria/perfil (27-nov-2026, el cierre de la asesoría): CON CUENTA. Recibe las respuestas que vivían en el navegador,
// recalcula la capacidad con la misma función (capacidad.ts), guarda el perfil declarado en inv_perfiles (sin orden), elige los 3
// deptos (tres.ts) con el flujo de SU plazo y devuelve el perfil, la prueba de estrés y los 3. Sin la asesoría habilitada, 404.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const acceso = await accesoAsesoriaDe({ dispositivoHash: huellaDeRequest(request).dispositivo, userId: user.id });
  if (!acceso.habilitada) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const v = validarPedidoPerfil((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const p = v.pedido;
  const admin = createServiceClient();
  try {
    const cfg = await leerConfigGuia(admin);
    const calc = calcularPerfil(p, { tasaPct: cfg.tasa, uf: cfg.uf });
    const plazo = calc.cap.plazo as PlazoMascara;
    const enLugar = p.donde.modo === "metro" ? cercaDelMetro : p.donde.modo === "pega" && p.donde.pega ? cercaDe(p.donde.pega) : undefined;
    const universo = await universoAsesoria();
    const perfilTres = { plazo, aporte: p.aporte, topeUF: calc.cap.topeUF, comunas: p.donde.modo === "comunas" || p.donde.modo === "rinde" ? p.donde.comunas : [], enLugar, uf: cfg.uf };
    const tres = calc.cap.topeUF > 0 ? elegirTres(universo, perfilTres) : [];
    // Menos de 3: no se rellena; la palanca que más mueve (palanca.ts). Plazo corto: cuántos convienen con su plazo.
    const laPalanca = tres.length < 3 && calc.cap.topeUF > 0 ? palanca(universo, perfilTres, p.numeros, { tasaPct: cfg.tasa, uf: cfg.uf }) : null;
    const conv = plazo < 30 ? conveniencia(universo, plazo) : null;
    const { data: previo } = await admin.from("inv_perfiles").select("user_id").eq("user_id", user.id).maybeSingle();
    const fila = filaPerfil(user.id, p, calc, { esPrueba: acceso.prueba, existe: !!previo, elegidos: tres.map((e) => e.c.id) });
    const { error } = await admin.from("inv_perfiles").upsert(fila, { onConflict: "user_id" });
    if (error) throw new Error(`inv_perfiles: ${error.message}`);
    const arriendos = tres.map((e) => e.c.arriendo).filter((x): x is number => x != null).sort((a, b) => a - b);
    const arriendoMedio = arriendos.length ? arriendos[Math.floor(arriendos.length / 2)] : null;
    return NextResponse.json({
      tipo: calc.tipo,
      capacidad: calc.cap,
      estres: estres(calc.cap, cfg.uf, { aporteCLP: p.aporte, arriendoCLP: arriendoMedio }),
      tres: tres.map((e) => ({ id: e.c.id, porQue: e.porQue, comuna: e.c.comuna, dormitorios: e.c.dormitorios, precioUF: e.c.precioUF, flujo: e.c.flujo[plazo], cap: capRate(e.c, cfg.uf), lat: e.c.lat, lng: e.c.lng })),
      plazo,
      conveniencia: conv,
      palanca: laPalanca,
      esPrueba: acceso.prueba,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/asesoria/perfil", operacion: "perfil", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
