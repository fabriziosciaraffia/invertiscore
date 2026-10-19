"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /entrar (01-oct-2026): UNA SOLA ENTRADA A FRANCO, EL CÓDIGO. «Entrar» del header lleva acá con
// `?next=<ruta actual>`; `?ctx=` elige el copy (pack · informe · semanal; si no, el genérico). /registro
// redirige acá conservando la query. /login (contraseña) queda para las cuentas viejas, enlazado chico
// desde abajo. Con sesión, el middleware manda directo al `next`. Plana desde el 19-oct-2026 (components/plano). La
// compra NO pasa por acá: /checkout pide el correo y el código en su misma pantalla.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";
import { AppFooter } from "@/components/chrome/AppFooter";
import { EntrarConCodigo } from "@/components/entrar/EntrarConCodigo";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { contextoEntrada, destinoTrasEntrar } from "@/lib/entrar/entrada";

export default function EntrarPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--franco-bg)]">
      <HeaderFranco contexto="auth" />
      <main className={PLANO.main} style={{ fontFamily: UI_PLANO }}>
        <Suspense fallback={null}>
          <EntrarContenido />
        </Suspense>
      </main>
      <AppFooter variant="informe" />
    </div>
  );
}

function EntrarContenido() {
  const sp = useSearchParams();
  const next = destinoTrasEntrar(sp.get("next"));
  const ctx = contextoEntrada(sp.get("ctx"), next);
  return <EntrarConCodigo next={next} ctx={ctx} />;
}
