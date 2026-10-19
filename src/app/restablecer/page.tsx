"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { PLANO, UI_PLANO } from "@/components/plano/plano";

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

  // PLANA (19-oct-2026, decisión de Fabrizio): en el diseño actual (components/plano), sin tarjeta ni logo repetido; la
  // lógica de arriba no cambia.
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)] text-[var(--franco-text)]">
      <HeaderFranco contexto="auth" />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        {status === "checking" && <p className={PLANO.bajada}>Verificando el enlace...</p>}

        {status === "invalid" && (
          <div>
            <h1 className={PLANO.titulo}>El enlace ya no sirve</h1>
            <p className={PLANO.bajada}>Este enlace de recuperación expiró o ya se usó. Pide uno nuevo y vuelve a intentarlo.</p>
            <div className={PLANO.seccion}>
              <Link href="/recuperar" className={PLANO.principal}>Pedir un enlace nuevo</Link>
            </div>
            <p className={`mt-6 ${PLANO.nota}`}>
              <Link href="/login" className={PLANO.enlace}>Volver a iniciar sesión</Link>
            </p>
          </div>
        )}

        {status === "done" && (
          <div>
            <h1 className={PLANO.titulo}>Contraseña actualizada</h1>
            <p className={PLANO.bajada}>Listo. Te estamos llevando a tu panel...</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <h1 className={PLANO.titulo}>Crea una nueva contraseña</h1>
            <p className={PLANO.bajada}>Elige una contraseña nueva para tu cuenta.</p>

            <div className={`${PLANO.seccion} flex flex-col gap-3`}>
              {error && <p className={PLANO.error} role="alert">{error}</p>}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="password" className={PLANO.label}>Nueva contraseña</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={PLANO.campo} />
                </div>
                <div>
                  <label htmlFor="confirm-password" className={PLANO.label}>Confirmar contraseña</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={PLANO.campo} />
                </div>
                <button type="submit" disabled={loading} className={PLANO.principal}>
                  {loading ? "Guardando..." : "Guardar contraseña"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}
