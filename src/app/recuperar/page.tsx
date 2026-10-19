"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PLANO, UI_PLANO } from "@/components/plano/plano";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Estado "enlace enviado". Mensaje neutro a propósito: no confirmamos si el
  // correo existe o no (evita enumeración de usuarios).
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });

    // Solo mostramos error en fallos reales del lado de Franco (red, rate
    // limit). Un email inexistente NO devuelve error en Supabase, así que el
    // estado "enviado" es siempre neutro y no revela si la cuenta existe.
    if (error) {
      setError("No pudimos enviar el enlace. Intenta de nuevo en un momento.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  // PLANA (19-oct-2026, decisión de Fabrizio): en el diseño actual (components/plano), sin tarjeta ni logo repetido; la
  // lógica de arriba no cambia.
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco contexto="auth" />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        {sent ? (
          /* Estado: enlace enviado (mensaje neutro) */
          <div>
            <h1 className={PLANO.titulo}>Revisa tu correo</h1>
            <p className={PLANO.bajada}>
              Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de
              entrada (y la carpeta de spam).
            </p>
            <p className={`mt-6 ${PLANO.nota}`}>
              <Link href="/login" className={PLANO.enlace}>Volver a iniciar sesión</Link>
            </p>
          </div>
        ) : (
          <>
            <h1 className={PLANO.titulo}>Recupera tu acceso</h1>
            <p className={PLANO.bajada}>Ingresa tu correo y te enviamos un enlace para crear una nueva contraseña.</p>

            <div className={`${PLANO.seccion} flex flex-col gap-3`}>
              {error && <p className={PLANO.error} role="alert">{error}</p>}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="email" className={PLANO.label}>Email</label>
                  <input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={PLANO.campo} />
                </div>
                <button type="submit" disabled={loading} className={PLANO.principal}>
                  {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                </button>
              </form>
            </div>

            <p className={`mt-6 ${PLANO.nota}`}>
              ¿Te acordaste?{" "}
              <Link href="/login" className={PLANO.enlace}>Inicia sesión</Link>
            </p>
          </>
        )}
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
