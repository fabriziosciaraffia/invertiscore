// Renderiza los 6 correos a HTML para revisión visual (STOP GATE 2). No envía.
import { writeFileSync } from "fs";
import { buildEmailRemediacion, DESTINATARIOS } from "./template";

const outDir = process.argv[2];
if (!outDir) throw new Error("uso: render-preview.ts <dir-salida>");
for (const d of DESTINATARIOS) {
  const { subject, html, text } = buildEmailRemediacion(d);
  const slug = d.email.split("@")[0].replace(/[^a-z0-9.]/gi, "");
  writeFileSync(`${outDir}/email-${slug}.html`, html, "utf8");
  writeFileSync(`${outDir}/email-${slug}.txt`, `SUBJECT: ${subject}\n\n${text}`, "utf8");
  console.log(`${d.email} → ${subject}`);
}
