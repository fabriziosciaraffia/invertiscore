"use client";

import { useState } from "react";
import { ForceDark } from "@/components/force-dark";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: name },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try { const ph = (await import('posthog-js')).default; ph.capture('signup_completed', { method: 'email' }); } catch {}
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-page px-4">
      <ForceDark />
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-th-border-strong bg-th-card shadow-sm">
          <form onSubmit={handleRegister}>
            {/* Header */}
            <div className="px-6 pt-8 pb-2 text-center">
              <div className="mx-auto mb-4">
                <FrancoLogo size="xl" href="/" inverted />
              </div>
              <h1 className="font-heading text-xl font-bold text-th-text">Crea tu cuenta gratis</h1>
              <p className="mt-1.5 font-body text-sm text-th-text-secondary">
                Análisis completo de cualquier departamento en 30 segundos.
              </p>
            </div>

            {/* Fields */}
            <div className="space-y-4 px-6 pt-4 pb-2">
              {error && (
                <div className="rounded-lg border border-[#C8323C]/20 bg-[#C8323C]/5 p-3 font-body text-sm text-[#C8323C]">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="name" className="font-body text-sm font-semibold text-th-text">
                  Nombre completo
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-th-border-strong bg-th-surface px-3 py-2.5 font-body text-sm text-th-text placeholder:text-th-text-muted focus:border-[#FAFAF8]/30 focus:outline-none focus:ring-1 focus:ring-[#FAFAF8]/10"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="font-body text-sm font-semibold text-th-text">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-th-border-strong bg-th-surface px-3 py-2.5 font-body text-sm text-th-text placeholder:text-th-text-muted focus:border-[#FAFAF8]/30 focus:outline-none focus:ring-1 focus:ring-[#FAFAF8]/10"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="font-body text-sm font-semibold text-th-text">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-th-border-strong bg-th-surface px-3 py-2.5 font-body text-sm text-th-text placeholder:text-th-text-muted focus:border-[#FAFAF8]/30 focus:outline-none focus:ring-1 focus:ring-[#FAFAF8]/10"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="font-body text-sm font-semibold text-th-text">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-th-border-strong bg-th-surface px-3 py-2.5 font-body text-sm text-th-text placeholder:text-th-text-muted focus:border-[#FAFAF8]/30 focus:outline-none focus:ring-1 focus:ring-[#FAFAF8]/10"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-4 px-6 pt-4 pb-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90 disabled:opacity-50"
              >
                {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
              </button>

              {/* Separator */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="font-body text-xs text-th-text-secondary">o</span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              {/* Google button */}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-th-border-strong bg-th-surface py-3 font-body text-sm font-semibold text-th-text transition-colors hover:border-white/20 hover:bg-th-elevated"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuar con Google
              </button>

              <p className="text-center font-body text-sm text-th-text-secondary">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-semibold text-th-text underline hover:text-[#C8323C]">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Franco tagline */}
        <div className="mt-6 text-center font-body text-[11px] text-th-text-secondary">
          Sin compromisos. Sin tarjeta. Solo datos.
        </div>
      </div>
    </div>
  );
}
