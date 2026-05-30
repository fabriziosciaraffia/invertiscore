"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppFooter } from "@/components/chrome/AppFooter";

type Status = "checking" | "ready" | "invalid" | "done";

export default function RestablecerPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("checking");

  // Al llegar desde el correo, Supabase puede mandar el token de recovery de
  // dos formas según el template:
  //   · hash:  #access_token=...&type=recovery  (template default)
  //   · code:  ?code=...                          (PKCE)
  // El SDK con detectSessionInUrl (default) procesa AMBOS y dispara el evento
  // PASSWORD_RECOVERY. Nos suscribimos a onAuthStateChange ANTES de nada para
  // no perder el evento — es el patrón oficial de Supabase para esta pantalla.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // 1) Suscripción primero: el SDK dispara PASSWORD_RECOVERY al detectar el
    //    token en la URL (venga por hash o por code) → habilita el formulario.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    // 2) Detectar error de enlace expirado/usado, que Supabase devuelve tanto
    //    en el hash (#error=...&error_code=otp_expired) como en el search.
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const searchParams = new URLSearchParams(window.location.search);
    const errorParam =
      hashParams.get("error") ||
      hashParams.get("error_code") ||
      searchParams.get("error");

    if (errorParam) {
      if (!cancelled) setStatus("invalid");
      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    }

    // 3) Fallback: si el token ya fue procesado antes de montar (o hay una
    //    sesión activa), getSession lo confirma. Si no hay nada y no llega el
    //    evento PASSWORD_RECOVERY, queda en "invalid".
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
      } else {
        // Damos un margen breve para que el SDK termine de parsear la URL y
        // dispare PASSWORD_RECOVERY; si no llega, el enlace no es válido.
        setTimeout(() => {
          if (!cancelled) {
            setStatus((prev) => (prev === "checking" ? "invalid" : prev));
          }
        }, 1500);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // Sesión de recovery vencida mientras estaba en la página.
      if (/session|expired|jwt|token/i.test(error.message)) {
        setStatus("invalid");
        setLoading(false);
        return;
      }
      setError(error.message);
      setLoading(false);
      return;
    }

    setStatus("done");
    setLoading(false);
    // Ya quedó con sesión activa → al dashboard tras un breve confirmación.
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1800);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--franco-bg)]">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm">
            {status === "checking" && (
              <div className="px-6 pt-8 pb-8 text-center">
                <div className="mx-auto mb-4">
                  <FrancoLogo size="xl" href="/" inverted />
                </div>
                <p className="font-body text-sm text-[var(--franco-text-secondary)]">
                  Verificando el enlace...
                </p>
              </div>
            )}

            {status === "invalid" && (
              <div className="px-6 pt-8 pb-8 text-center">
                <div className="mx-auto mb-4">
                  <FrancoLogo size="xl" href="/" inverted />
                </div>
                <h1 className="font-heading text-xl font-bold text-[var(--franco-text)]">
                  El enlace ya no sirve
                </h1>
                <p className="mx-auto mt-3 max-w-[340px] font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  Este enlace de recuperación expiró o ya se usó. Pide uno nuevo
                  y vuelve a intentarlo.
                </p>
                <Link
                  href="/recuperar"
                  className="mt-6 inline-block w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90"
                >
                  Pedir un enlace nuevo
                </Link>
                <Link
                  href="/login"
                  className="mt-4 inline-block font-body text-sm font-semibold text-[var(--franco-text)] underline hover:text-[#C8323C]"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            )}

            {status === "done" && (
              <div className="px-6 pt-8 pb-8 text-center">
                <div className="mx-auto mb-4">
                  <FrancoLogo size="xl" href="/" inverted />
                </div>
                <h1 className="font-heading text-xl font-bold text-[var(--franco-text)]">
                  Contraseña actualizada
                </h1>
                <p className="mx-auto mt-3 max-w-[340px] font-body text-sm leading-relaxed text-[var(--franco-text-secondary)]">
                  Listo. Te estamos llevando a tu panel...
                </p>
              </div>
            )}

            {status === "ready" && (
              <>
                {/* Header */}
                <div className="px-6 pt-8 pb-2 text-center">
                  <div className="mx-auto mb-4">
                    <FrancoLogo size="xl" href="/" inverted />
                  </div>
                  <h1 className="font-heading text-xl font-bold text-[var(--franco-text)]">
                    Crea una nueva contraseña
                  </h1>
                  <p className="mt-1.5 font-body text-sm text-[var(--franco-text-secondary)]">
                    Elige una contraseña nueva para tu cuenta.
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
                        htmlFor="password"
                        className="font-body text-sm font-semibold text-[var(--franco-text)]"
                      >
                        Nueva contraseña
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:outline-none focus:ring-1 focus:ring-[#C8323C]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="confirm-password"
                        className="font-body text-sm font-semibold text-[var(--franco-text)]"
                      >
                        Confirmar contraseña
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] px-3 py-2.5 font-body text-sm text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[#C8323C] focus:outline-none focus:ring-1 focus:ring-[#C8323C]/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-[#C8323C] py-3 font-body text-sm font-semibold text-white transition-colors hover:bg-[#C8323C]/90 disabled:opacity-50"
                    >
                      {loading ? "Guardando..." : "Guardar contraseña"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* Franco tagline */}
          <div className="mt-6 text-center font-body text-[11px] text-[var(--franco-text-secondary)]">
            Tu corredor gana si compras. Franco gana si decides bien.
          </div>
        </div>
      </div>
      <AppFooter variant="minimal" />
    </div>
  );
}
