// Envío del correo de remediación — bug pie 0% silencioso (ago-2026).
//
// Modos (los envíos los dispara Fabrizio, nunca el agente):
//   · sin flags            → DRY-RUN: imprime destinatario, asunto y cuerpo
//                            resuelto de cada uno. No envía nada.
//   · --prueba             → manda los 6 correos a PRUEBA_INBOX con los datos
//                            reales de cada destinatario y el asunto prefijado
//                            "[PRUEBA → email-real]". No toca el ledger (se
//                            puede repetir las veces que haga falta).
//   · --real CONFIRMO      → envío real a los 6 usuarios. Consulta y escribe
//                            el ledger (enviados.json): una segunda corrida
//                            salta a los ya enviados y lo dice.
//
// Correr: node --env-file=.env.local --import tsx scripts/email-remediacion-pie/enviar.ts [flags]
// Requiere RESEND_API_KEY en .env.local (hoy vive solo en Vercel — agregarla
// vía VS Code antes de la prueba; nunca por terminal).
//
// Patrón de la suite (src/lib/email.ts): mismo From. reply-to EXPLÍCITO a
// hola@refranco.ai — la suite no lo configura y depende del From; acá va
// explícito porque este correo va a generar respuestas.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Resend } from "resend";
import { buildEmailRemediacion, DESTINATARIOS } from "./template";

const FROM = "Franco <hola@refranco.ai>";
const REPLY_TO = "hola@refranco.ai";
const PRUEBA_INBOX = "fabriziosciaraffia@gmail.com";
const LEDGER_PATH = join(__dirname, "enviados.json");

type Ledger = Record<string, { sentAt: string; resendId: string | null; modo: string }>;

function leerLedger(): Ledger {
  if (!existsSync(LEDGER_PATH)) return {};
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Ledger;
}

function escribirLedger(l: Ledger): void {
  writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 2) + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const prueba = args.includes("--prueba");
  const real = args.includes("--real") && args.includes("CONFIRMO");
  if (args.includes("--real") && !real) {
    console.error("El envío real exige el token CONFIRMO explícito: --real CONFIRMO");
    process.exit(1);
  }

  if (!prueba && !real) {
    console.log("════ DRY-RUN (no se envía nada) ════\n");
    for (const d of DESTINATARIOS) {
      const { subject, text } = buildEmailRemediacion(d);
      console.log(`─── ${d.email} (${d.tipo}) ───`);
      console.log(`SUBJECT: ${subject}`);
      console.log(text);
      console.log("");
    }
    console.log("Para prueba a tu casilla: --prueba · Para envío real: --real CONFIRMO");
    return;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("Falta RESEND_API_KEY en el entorno (.env.local). Sin key no hay envío.");
    process.exit(1);
  }
  const resend = new Resend(key);
  const ledger = leerLedger();
  const resumen: Array<{ email: string; estado: string }> = [];

  for (const d of DESTINATARIOS) {
    const { subject, html, text } = buildEmailRemediacion(d);
    const destino = prueba ? PRUEBA_INBOX : d.email;
    const asunto = prueba ? `[PRUEBA → ${d.email}] ${subject}` : subject;

    if (real && ledger[d.email]) {
      console.log(`SKIP  ${d.email} — ya enviado el ${ledger[d.email].sentAt} (${ledger[d.email].resendId ?? "sin id"})`);
      resumen.push({ email: d.email, estado: "ya-enviado" });
      continue;
    }

    try {
      // Resend devuelve { data, error } — el error de API viene in-band, no lanza.
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: destino,
        replyTo: REPLY_TO,
        subject: asunto,
        html,
        text,
      });
      if (error) {
        console.error(`FALLO ${d.email} → ${destino}: ${error.name ?? ""} ${error.message}`);
        resumen.push({ email: d.email, estado: `fallo: ${error.message}` });
        continue;
      }
      console.log(`OK    ${d.email} → ${destino} (resend ${data?.id ?? "sin id"})`);
      resumen.push({ email: d.email, estado: "ok" });
      if (real) {
        ledger[d.email] = { sentAt: new Date().toISOString(), resendId: data?.id ?? null, modo: "real" };
        escribirLedger(ledger); // tras CADA éxito: un corte a mitad de corrida no pierde registro
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FALLO ${d.email} → ${destino}: ${msg}`);
      resumen.push({ email: d.email, estado: `fallo: ${msg}` });
    }
  }

  console.log(`\n════ RESUMEN ${prueba ? "PRUEBA" : "REAL"} ════`);
  for (const r of resumen) console.log(`  ${r.email}: ${r.estado}`);
  const fallos = resumen.filter((r) => r.estado.startsWith("fallo"));
  if (fallos.length > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
