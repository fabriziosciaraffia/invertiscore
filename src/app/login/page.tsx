"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#E6E6E2] bg-white shadow-sm">
          <form onSubmit={handleLogin}>
            {/* Header */}
            <div className="px-6 pt-8 pb-2 text-center">
              <div className="mx-auto mb-4">
                <FrancoLogo size="xl" href="/" />
              </div>
              <h1 className="font-heading text-xl font-bold text-[#0F0F0F]">Bienvenido de vuelta</h1>
              <p className="mt-1.5 font-body text-sm text-[#71717A]">
                Ingresa tu email para continuar analizando
              </p>
            </div>

            {/* Fields */}
            <div className="space-y-4 px-6 pt-4 pb-2">
              {error && (
                <div className="rounded-lg border border-[#DC2626]/20 bg-[#DC2626]/5 p-3 font-body text-sm text-[#DC2626]">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="font-body text-sm font-semibold text-[#0F0F0F]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-sm text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#0F0F0F]/10"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="font-body text-sm font-semibold text-[#0F0F0F]">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E6E6E2] bg-white px-3 py-2.5 font-body text-sm text-[#0F0F0F] placeholder:text-[#71717A]/50 focus:border-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#0F0F0F]/10"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-4 px-6 pt-4 pb-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#0F0F0F] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#0F0F0F]/90 disabled:opacity-50"
              >
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </button>

              {/* Separator */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-[#E6E6E2]" />
                <span className="font-body text-xs text-[#71717A]">o</span>
                <div className="h-px flex-1 bg-[#E6E6E2]" />
              </div>

              {/* Google button */}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E6E6E2] bg-white py-3 font-body text-sm font-semibold text-[#0F0F0F] transition-colors hover:border-[#0F0F0F]/20 hover:bg-[#FAFAF8]"
                onClick={() => alert("Próximamente: Login con Google estará disponible pronto.")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuar con Google
              </button>

              <p className="text-center font-body text-sm text-[#71717A]">
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="font-semibold text-[#0F0F0F] underline hover:text-[#C8323C]">
                  Regístrate
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Franco tagline */}
        <div className="mt-6 text-center font-body text-[11px] text-[#71717A]">
          Tu corredor gana si compras. Franco gana si decides bien.
        </div>
      </div>
    </div>
  );
}
