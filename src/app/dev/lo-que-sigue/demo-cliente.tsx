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
import { claveTicket } from "@/lib/lo-que-sigue/estado-ticket";
import type { VeredictoLqs } from "@/lib/lo-que-sigue/copy";
import type { PerfilChips } from "@/lib/lo-que-sigue/perfil-chips";

const VEREDICTOS: { v: VeredictoLqs; rotulo: string; precio: number | null }[] = [
  { v: "BUSCAR OTRA", rotulo: "Buscar", precio: 1934 },
  { v: "AJUSTA SUPUESTOS", rotulo: "Ajustar", precio: 4175 },
  { v: "COMPRAR", rotulo: "Comprar", precio: null },
];
const PERFIL: PerfilChips = { tipologia: "2D1B", comuna: "San Miguel", modalidad: "ltr" };
const idDemo = (v: VeredictoLqs) => `demo-lo-que-sigue-${v === "COMPRAR" ? "c" : v === "BUSCAR OTRA" ? "b" : "a"}`;

export function DemoCliente() {
  const [createdAt] = useState(() => new Date().toISOString());
  const [v, setV] = useState<VeredictoLqs>("AJUSTA SUPUESTOS");
  const [vuelta, setVuelta] = useState(0);
  const [correo, setCorreo] = useState("");
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
      <div className="doc-tokens" style={{ maxWidth: 700, margin: "0 auto", padding: "22px 22px 40px", fontFamily: "var(--font-ui)" }}>
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
        <BannerRegistro key={`b-${v}`} ctx={ctx} next="/dev/lo-que-sigue" perfil={PERFIL} demo />
        {["Cuánto renta", "Cómo lo pagas", "Plusvalía", "Tu resultado a 10 años", "La zona", "Qué pesa"].map((t) => (
          <section key={t} style={{ marginBottom: 34 }}>
            {rotulo(t)}
            {fila("Cap rate neto", "4,1 %")}{fila("Arriendo de referencia", "$850.000")}{fila("Cuota", "$555.686")}{fila("Plazo", "25 años")}{fila("Vacancia", "5 %")}
          </section>
        ))}

        {rotulo("Después del código · «Estás dentro»")}
        <BannerRegistro key={`d-${v}`} ctx={ctx} next="/dev/lo-que-sigue" perfil={PERFIL} demo pasoInicial="dentro" />

        {rotulo("Después de pagar · con sesión")}
        <DespuesDePagar key={`p-${v}`} analysisId={ctx.analysisId} veredicto={v} conSesion />
        {rotulo("Después de pagar · sin sesión")}
        <DespuesDePagar key={`s-${v}`} analysisId={ctx.analysisId} veredicto={v} conSesion={false} />

        {rotulo("El correo del tercer día")}
        <iframe title="Correo del recordatorio" srcDoc={correo} style={{ width: "100%", height: 560, border: "1px solid var(--doc-line, #DAD6CC)", borderRadius: 16, background: "#fff" }} data-lqs="demo-correo" />

        <p style={{ fontSize: 13, opacity: .6, marginTop: 40 }}>Acá empieza la zona del cierre: el ticket sube una vez; cerrado, queda la pestaña.</p>
        <TicketPack key={`t-${v}-${vuelta}`} ctx={ctx} createdAt={createdAt} precioCierreUF={precio} />
        <div style={{ height: 320 }} />
      </div>
    </div>
  );
}
