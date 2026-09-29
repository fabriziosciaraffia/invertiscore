"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /dev/lo-que-sigue (29-sep-2026): la coreografía del borde inferior —banner, barra, ticket,
// pestaña— sobre un informe de mentira, para verla y medirla SIN generar un análisis anónimo (las
// pruebas anónimas están prohibidas: escriben en la base compartida). Vive en dev y en los
// PREVIEWS de Vercel (VERCEL_ENV === "preview"); en producción responde 404. El registro y el pago
// de acá son reales contra un id falso: el pago da 400, el correo manda el código de verdad.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { BannerRegistro } from "@/components/lo-que-sigue/BannerRegistro";
import { TicketPack } from "@/components/lo-que-sigue/TicketPack";

const CTX = { analysisId: "demo-lo-que-sigue", veredicto: "AJUSTA SUPUESTOS", modalidad: "ltr" as const };

export function DemoCliente() {
  const [createdAt] = useState(() => new Date().toISOString());
  const fila = (k: string, v: string) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid var(--doc-line, #DAD6CC)", fontSize: 14 }}>
      <span>{k}</span><b style={{ fontFamily: "var(--font-mono)" }}>{v}</b>
    </div>
  );
  return (
    <div className="min-h-screen bg-[var(--franco-bg)] doc-lienzo">
      <div className="doc-tokens" style={{ maxWidth: 700, margin: "0 auto", padding: "22px 22px 40px", fontFamily: "var(--font-ui)" }}>
        <p style={{ font: "600 12px var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase", opacity: .6 }}>Demostración · lo que sigue</p>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, margin: "8px 0 18px" }}>Un informe de mentira para ver el borde inferior</h1>
        <div style={{ borderRadius: 16, padding: "22px 18px", background: "#2B2B30", color: "#fff", marginBottom: 34 }}>
          <p style={{ fontWeight: 700, fontSize: 19 }}>Lo que haría Franco</p>
          <p style={{ opacity: .62, fontSize: 14, margin: "5px 0 0" }}>Para que el veredicto pase a Comprar</p>
        </div>
        <BannerRegistro ctx={CTX} next="/dev/lo-que-sigue" />
        {["Cuánto renta", "Cómo lo pagas", "Plusvalía", "Tu resultado a 10 años", "La zona", "Qué pesa"].map((t) => (
          <section key={t} style={{ marginBottom: 34 }}>
            <p style={{ font: "600 12px var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase", opacity: .6, margin: "0 0 12px" }}>{t}</p>
            {fila("Cap rate neto", "4,1 %")}{fila("Arriendo de referencia", "$850.000")}{fila("Cuota", "$555.686")}{fila("Plazo", "25 años")}{fila("Vacancia", "5 %")}
          </section>
        ))}
        <p style={{ fontSize: 13, opacity: .6 }}>Acá empieza la zona del cierre: el ticket sube una vez; cerrado, queda la pestaña.</p>
        <TicketPack ctx={CTX} createdAt={createdAt} />
        <div style={{ height: 320 }} />
      </div>
    </div>
  );
}
