"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppFooter } from "@/components/chrome/AppFooter";

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

  return (
    <div className="flex flex-col min-h-screen bg-[var(--franco-bg)]">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
            {sent ? (
              /* Estado: enlace enviado (mensaje neutro) */
              <div className="px-6 pt-8 pb-8 text-center">
                <div className="mx-auto mb-4">
                  <FrancoLogo size="xl" href="/" inverted />
                </div>
                <h1 className="font-heading text-xl font-bold text-[var(--franco-text)]">
                  Revisa tu correo
                </h1>
                <p className="mx-auto mt-3 max-w-[340px] font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  Si existe una cuenta con ese correo, te enviamos un enlace para
                  restablecer tu contraseña. Revisa tu bandeja de entrada (y la
                  carpeta de spam).
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-block font-body text-sm font-semibold text-[var(--franco-text)] underline hover:text-[#C8323C]"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 pt-8 pb-2 text-center">
                  <div className="mx-auto mb-4">
                    <FrancoLogo size="xl" href="/" inverted />
                  </div>
                  <h1 className="font-heading text-xl font-bold text-[var(--franco-text)]">
                    Recupera tu acceso
                  </h1>
                  <p className="mt-1.5 font-body text-sm text-[var(--franco-text-secondary)]">
                    Ingresa tu correo y te enviamos un enlace para crear una nueva
                    contraseña.
                  </p>
                </div>

                <div className="flex flex-col gap-4 px-6 pt-5 pb-8">
                  {error && (
                    <div className="rounded-lg border border-[#C8323C]/20 bg-[#C8323C]/5 p-3 font-body text-sm text-[#C8323C]">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="email"
                        className="font-body text-sm font-semibold text-[var(--franco-text)]"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:outline-none focus:ring-1 focus:ring-[#C8323C]/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90 disabled:opacity-50"
                    >
                      {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                    </button>
                  </form>

                  <p className="text-center font-body text-sm text-[var(--franco-text-secondary)]">
                    ¿Te acordaste?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-[var(--franco-text)] underline hover:text-[#C8323C]"
                    >
                      Inicia sesión
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Franco tagline */}
          <div className="mt-6 text-center font-body text-[11px] text-[var(--franco-text-secondary)]">
            Re franco con tu inversión.
          </div>
        </div>
      </div>
      <AppFooter variant="minimal" />
    </div>
  );
}
