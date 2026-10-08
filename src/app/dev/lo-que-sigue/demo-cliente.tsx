"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /dev/lo-que-sigue (29-sep-2026; copy nuevo 30-sep): la coreografía del borde inferior —banner,
// barra, ticket, pestaña— y lo que viene después —«Estás dentro», la pantalla de después de pagar y
// el correo del recordatorio— sobre un informe de mentira, para verla SIN generar un análisis
// anónimo (las pruebas anónimas están prohibidas: escriben en la base compartida). Vive en dev y en
// los PREVIEWS de Vercel (VERCEL_ENV === "preview"); en producción responde 404. El registro y el
// pago de acá son reales contra un id falso: el pago da 400, el correo manda el código de verdad.
// «Estás dentro» en modo demo no escribe el perfil.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { BannerRegistro } from "@/components/lo-que-sigue/BannerRegistro";
import { TicketPack } from "@/components/lo-que-sigue/TicketPack";
import { DespuesDePagar } from "@/components/lo-que-sigue/DespuesDePagar";
import { correoRecordatorioPack } from "@/lib/lo-que-sigue/recordatorio";
import { GuiaBusqueda, type RespuestaGuia } from "@/components/guia/GuiaBusqueda";
import { InformeDeAviso } from "@/components/guia/InformeDeAviso";
import { CATALOGO_CORREOS } from "@/lib/email/catalogo";
import { claveTicket } from "@/lib/lo-que-sigue/estado-ticket";
import { FinCapitulos } from "@/components/lo-que-sigue/FinCapitulos";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { bannerRegistroVisible, correoDelTicket, ofertaPackDelInforme, type QuienMira } from "@/lib/lo-que-sigue/oferta-informe";
import type { VeredictoLqs } from "@/lib/lo-que-sigue/copy";
import type { PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";

const VEREDICTOS: { v: VeredictoLqs; rotulo: string; precio: number | null }[] = [
  { v: "BUSCAR OTRA", rotulo: "Buscar", precio: 1934 },
  { v: "AJUSTA SUPUESTOS", rotulo: "Ajustar", precio: 4175 },
  { v: "COMPRAR", rotulo: "Comprar", precio: null },
];
const PERFIL: PerfilChips = { tipologia: "2D1B", comuna: "San Miguel", modalidad: "ltr" };
// «Por dónde seguir buscando» (30-sep-2026): las tres formas con datos de muestra. Con `?a=<id de un informe
// de renta larga>` se ve además la guía REAL de ese informe (solo lectura; «Analizar este» genera de verdad
// y cobra un crédito si el informe es tuyo).
const ORIGEN = { tipologia: "2D", m2: 60, precioUF: 4300 };
const GUIA_MUESTRA: Record<"normal" | "ajustada" | "ninguno", RespuestaGuia> = {
  normal: { disponible: true, estado: "normal", origen: ORIGEN, combinacion: { piePct: 20, plazoAnios: 25 }, radioM: 1000, items: [
    { avisoId: "m1", comuna: "Ñuñoa", tipologia: "2D2B", m2: 57, precioUF: 3980, distancia: "420 m", veredicto: "COMPRAR", score: 76, flujo: 12000 },
    { avisoId: "m2", comuna: "Ñuñoa", tipologia: "2D1B", m2: 62, precioUF: 4120, distancia: "780 m", veredicto: "COMPRAR", score: 71, flujo: -64000 },
    { avisoId: "m3", comuna: "Providencia", tipologia: "2D1B", m2: 55, precioUF: 4390, distancia: "950 m", veredicto: "COMPRAR", score: 70, flujo: -81000 },
  ] },
  ajustada: { disponible: true, estado: "ajustada", origen: ORIGEN, combinacion: { piePct: 20, plazoAnios: 30 }, radioM: 2000, items: [
    { avisoId: "m4", comuna: "Ñuñoa", tipologia: "2D1B", m2: 64, precioUF: 4480, distancia: "1,3 km", veredicto: "COMPRAR", score: 72, flujo: -52000 },
    { avisoId: "m5", comuna: "Macul", tipologia: "2D2B", m2: 61, precioUF: 3890, distancia: "1,8 km", veredicto: "COMPRAR", score: 70, flujo: -58000 },
  ] },
  ninguno: { disponible: true, estado: "ninguno", origen: ORIGEN, combinacion: null, radioM: null, items: [] },
};
const idDemo = (v: VeredictoLqs) => `demo-lo-que-sigue-${v === "COMPRAR" ? "c" : v === "BUSCAR OTRA" ? "b" : "a"}`;

export function DemoCliente() {
  const [createdAt] = useState(() => new Date().toISOString());
  const [v, setV] = useState<VeredictoLqs>("AJUSTA SUPUESTOS");
  const [vuelta, setVuelta] = useState(0);
  const [correo, setCorreo] = useState("");
  const [origenReal, setOrigenReal] = useState<string | null>(null);
  // La oferta es del informe (08-oct-2026): `?quien=anonimo|origen|sesion|ajeno`, `?pagado=1` y
  // `?correo=` simulan lo que el servidor decide (quién mira, si hay pack pagado y el correo conocido)
  // con las mismas funciones que usa el informe. Sin parámetros: el anónimo dueño, sin correo.
  const [sim, setSim] = useState<{ quien: QuienMira; pagado: boolean; correo: string | null }>({ quien: "anonimo", pagado: false, correo: null });
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get("a");
    if (a && /^[0-9a-f-]{36}$/i.test(a)) setOrigenReal(a);
    const q = sp.get("quien");
    const quien: QuienMira = q === "origen" || q === "sesion" || q === "anonimo" ? q : q === "ajeno" ? null : "anonimo";
    setSim({ quien, pagado: sp.get("pagado") === "1", correo: sp.get("correo") });
  }, []);
  const ofertaSim = ofertaPackDelInforme({ nacioAnonimo: true, quienMira: sim.quien, packPagado: sim.pagado, esDemo: false });
  const bannerSim = bannerRegistroVisible({ quienMira: sim.quien, conSesion: sim.quien === "sesion", recienDentro: false, compartido: false });
  const correoInteres = CATALOGO_CORREOS.find((c) => c.id === "aviso_pedido")?.render?.().html ?? "";
  const precio = VEREDICTOS.find((x) => x.v === v)?.precio ?? null;
  const ctx = { analysisId: idDemo(v), veredicto: v, modalidad: "ltr" as const };

  useEffect(() => {
    setCorreo(correoRecordatorioPack(window.location.origin, idDemo(v)).html);
  }, [v]);

  const reiniciar = () => {
    try {
      VEREDICTOS.forEach((x) => window.localStorage.removeItem(claveTicket(idDemo(x.v))));
    } catch {
      /* sin storage */
    }
    setVuelta((n) => n + 1);
  };

  const fila = (k: string, val: string) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid var(--doc-line, #DAD6CC)", fontSize: 14 }}>
      <span>{k}</span><b style={{ fontFamily: "var(--font-mono)" }}>{val}</b>
    </div>
  );
  const rotulo = (t: string) => (
    <p style={{ font: "600 12px var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase", opacity: .6, margin: "40px 0 12px" }}>{t}</p>
  );
  const boton = (activo: boolean) => ({
    height: 34, padding: "0 14px", borderRadius: 99, cursor: "pointer", font: "600 13px var(--font-ui)",
    border: "1.5px solid var(--doc-tx, #0F0F0F)", background: activo ? "var(--doc-tx, #0F0F0F)" : "transparent", color: activo ? "var(--doc-bg, #fff)" : "var(--doc-tx, #0F0F0F)",
  });

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] doc-lienzo">
      {/* Los tokens del documento, como en el informe (los pone la portada): sin ellos la hoja del ticket
          y la pestaña quedaban sin fondo en esta demo (08-oct-2026). */}
      <DocTokens />
      <div className="doc-tokens" style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 22px 40px", fontFamily: "var(--font-ui)" }}>
        <p style={{ font: "600 12px var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase", opacity: .6 }}>Demostración · lo que sigue</p>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, margin: "8px 0 14px" }}>Un informe de mentira para ver el borde inferior</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 22 }} data-lqs="demo-veredicto">
          {VEREDICTOS.map((x) => (
            <button key={x.v} type="button" style={boton(v === x.v)} onClick={() => setV(x.v)}>{x.rotulo}</button>
          ))}
          <button type="button" style={{ ...boton(false), borderStyle: "dashed" }} onClick={reiniciar}>Volver a mostrar el ticket</button>
        </div>
        <div style={{ borderRadius: 16, padding: "22px 18px", background: "#2B2B30", color: "#fff", marginBottom: 34 }}>
          <p style={{ fontWeight: 700, fontSize: 19 }}>Lo que haría Franco</p>
          <p style={{ opacity: .62, fontSize: 14, margin: "5px 0 0" }}>{precio ? `El precio que cierra: UF ${precio.toLocaleString("es-CL")}` : "Este conviene tal como está"}</p>
        </div>
        {bannerSim && <BannerRegistro key={`b-${v}`} ctx={ctx} next="/dev/lo-que-sigue" perfil={PERFIL} demo />}
        {["Cuánto renta", "Cómo lo pagas", "Plusvalía", "Tu resultado a 10 años", "La zona", "Qué pesa"].map((t) => (
          <section key={t} style={{ marginBottom: 34 }}>
            {rotulo(t)}
            {fila("Cap rate neto", "4,1 %")}{fila("Arriendo de referencia", "$850.000")}{fila("Cuota", "$555.686")}{fila("Plazo", "25 años")}{fila("Vacancia", "5 %")}
            {/* Como en el informe: la marca del final va justo después de «Tu resultado a 10 años». */}
            {t === "Tu resultado a 10 años" && <FinCapitulos />}
          </section>
        ))}

        {rotulo("Después del código · «Estás dentro»")}
        <BannerRegistro key={`d-${v}`} ctx={ctx} next="/dev/lo-que-sigue" perfil={PERFIL} demo pasoInicial="dentro" />

        {rotulo("Después de pagar · con sesión")}
        <DespuesDePagar key={`p-${v}`} analysisId={ctx.analysisId} veredicto={v} modalidad="ltr" conSesion saldo={3} />
        {rotulo("Después de pagar · sin sesión")}
        <DespuesDePagar key={`s-${v}`} analysisId={ctx.analysisId} veredicto={v} modalidad="ltr" conSesion={false} saldo={3} />

        {rotulo("Por dónde seguir buscando · tres que convienen")}
        <GuiaBusqueda analysisId={ctx.analysisId} veredicto={v} conSesion saldo={3} muestra={GUIA_MUESTRA.normal} />
        {rotulo("Después de pagar sin cuenta · «Analizar este» pide el código en la tarjeta (el correo es real)")}
        <GuiaBusqueda analysisId={ctx.analysisId} veredicto={v} conSesion={false} saldo={3} muestra={GUIA_MUESTRA.normal} />
        {rotulo("Por dónde seguir buscando · con el plazo ajustado")}
        <GuiaBusqueda analysisId={ctx.analysisId} veredicto={v} conSesion saldo={3} muestra={GUIA_MUESTRA.ajustada} />
        {rotulo("Por dónde seguir buscando · ninguno conviene")}
        <GuiaBusqueda analysisId={ctx.analysisId} veredicto={v} conSesion saldo={3} muestra={GUIA_MUESTRA.ninguno} />
        {origenReal && (
          <>
            {rotulo("Por dónde seguir buscando · la real de ?a=")}
            <GuiaBusqueda analysisId={origenReal} veredicto={v} conSesion />
          </>
        )}

        {rotulo("El informe que sale de un aviso · antigüedad supuesta")}
        <div className="doc-dictamen" style={{ padding: "18px 0" }}><InformeDeAviso analysisId={ctx.analysisId} veredicto={v} antiguedad="supuesta" esDueno demo /></div>
        {rotulo("El informe que sale de un aviso · con el año de la ficha")}
        <div className="doc-dictamen" style={{ padding: "18px 0" }}><InformeDeAviso analysisId={ctx.analysisId} veredicto={v} antiguedad="ficha" esDueno demo /></div>
        {rotulo("El correo a la persona · «Quiero verlo»")}
        <iframe title="Correo de Quiero verlo" srcDoc={correoInteres} style={{ width: "100%", height: 760, border: "1px solid var(--doc-line, #DAD6CC)", borderRadius: 16, background: "#fff" }} />

        {rotulo("El correo del tercer día")}
        <iframe title="Correo del recordatorio" srcDoc={correo} style={{ width: "100%", height: 560, border: "1px solid var(--doc-line, #DAD6CC)", borderRadius: 16, background: "#fff" }} data-lqs="demo-correo" />

        <p style={{ fontSize: 13, opacity: .6, marginTop: 40 }}>El final de la página. El ticket sube 8 s después de pasar «Tu resultado a 10 años», a los 4 minutos de lectura o al sacar el cursor por arriba en PC; cerrado, queda la pestaña.</p>
        {ofertaSim && <TicketPack key={`t-${v}-${vuelta}`} ctx={ctx} createdAt={createdAt} correoSesion={correoDelTicket({ recienDentro: null, correoConocido: sim.correo })} />}
        <div style={{ height: 320 }} />
      </div>
    </div>
  );
}
