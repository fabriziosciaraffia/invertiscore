import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Count user analyses
  const { count: analysisCount } = await supabase
    .from("analisis")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get credits
  const { data: creditsRow } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  const credits = creditsRow?.credits ?? 0;
  const now = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: "Franco <hola@refranco.ai>",
      to: "hola@refranco.ai",
      subject: "Solicitud de eliminación de cuenta",
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#151515;border-radius:16px;border:1px solid #222;padding:40px 32px;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#C8323C;margin:0 0 24px 0;">
        Solicitud de eliminación de cuenta
      </h1>

      <div style="background:#1A1A1A;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Email</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${user.email}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">User ID</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${user.id}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Fecha solicitud</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${now}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Análisis creados</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${analysisCount ?? 0}</span>
        </div>
        <div style="padding:8px 0;">
          <span style="color:#71717A;font-size:13px;">Créditos restantes</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${credits}</span>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`,
    });

    // Confirmation email to user
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const firstName = fullName.split(' ')[0] || '';
    const greeting = firstName ? `Hola ${firstName},` : 'Hola,';

    await resend.emails.send({
      from: "Franco <hola@refranco.ai>",
      to: user.email!,
      subject: "Tu solicitud de eliminación fue recibida",
      html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#151515;border-radius:16px;border:1px solid #222;padding:40px 32px;">
      <div style="margin-bottom:32px;font-size:24px;color:#FAFAF8;">
        <span style="font-family:Georgia,'Times New Roman',serif;opacity:0.28;font-style:italic;">re</span><span style="font-family:Georgia,'Times New Roman',serif;font-weight:700;">franco</span><span style="color:#C8323C;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">.ai</span>
      </div>

      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#FAFAF8;margin:0 0 16px 0;">
        ${greeting}
      </h1>

      <p style="color:#A1A1AA;line-height:1.7;font-size:15px;margin:0 0 24px 0;">
        Recibimos tu solicitud para eliminar tu cuenta. Tu cuenta y datos serán eliminados.
      </p>

      <p style="color:#A1A1AA;line-height:1.7;font-size:15px;margin:0 0 0 0;">
        Si tienes alguna consulta, escríbenos a <a href="mailto:hola@refranco.ai" style="color:#C8323C;text-decoration:none;">hola@refranco.ai</a>
      </p>

      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #222;">
        <p style="color:#52525B;font-size:12px;line-height:1.6;margin:0;">
          Franco analiza datos de mercado. No es asesoría financiera ni recomendación de inversión.
        </p>
        <p style="color:#3F3F46;font-size:11px;margin-top:8px;">
          <a href="https://refranco.ai" style="color:#52525B;text-decoration:none;">refranco.ai</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending deletion request email:", error);
    return NextResponse.json(
      { error: "No se pudo enviar la solicitud" },
      { status: 500 }
    );
  }
}
