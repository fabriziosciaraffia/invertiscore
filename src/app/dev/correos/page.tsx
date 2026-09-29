// /dev/correos (29-sep-2026): todos los correos de Franco, renderizados a 390 y a 720, en claro, para
// revisarlos juntos. Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { CATALOGO_CORREOS } from "@/lib/email/catalogo";
import { VistaCorreo } from "./vista-correo";

export const dynamic = "force-dynamic";

export default function CorreosPage() {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  return (
    <div style={{ background: "#ECECEE", minHeight: "100vh", padding: "28px 16px 80px", fontFamily: "var(--font-ui), Inter, sans-serif", color: "#0F0F0F" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ font: "600 12px var(--font-ui)", letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.6, margin: 0 }}>Demostración · correos</p>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: "6px 0 6px" }}>Todos los correos de Franco</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 28px" }}>{CATALOGO_CORREOS.length} correos · cada uno a 390 y a 720 px, con datos de muestra.</p>
        {CATALOGO_CORREOS.map((c) => {
          const correo = c.render ? c.render() : null;
          return (
            <section key={c.id} id={c.id} data-correo={c.id} style={{ marginBottom: 56 }}>
              <h2 style={{ fontSize: 18, margin: "0 0 2px" }}>{c.nombre}</h2>
              <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 4px" }}>{c.cuando} · tag <code>{c.tipo}</code></p>
              {correo ? (
                <>
                  <p style={{ fontSize: 14, margin: "0 0 14px" }}>Asunto: <b>{correo.subject}</b></p>
                  <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <VistaCorreo html={correo.html} ancho={390} />
                    <VistaCorreo html={correo.html} ancho={720} />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 14, margin: "8px 0 0", padding: "12px 16px", background: "#FFFFFF", borderLeft: "3px solid #0F0F0F", maxWidth: 720 }} data-pendiente="1">
                  Pendiente: {c.pendiente}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
