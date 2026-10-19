"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La entrada por código (01-oct-2026): UNA SOLA ENTRADA a Franco. El correo, el código en la misma pantalla y de vuelta
// a `next` validado (solo rutas internas; si no, /dashboard). La lógica vive en useEntradaPorCodigo (19-oct-2026), la
// misma que usa la pantalla de compra; acá queda qué se dibuja y que, al entrar, se vuelve a `next`.
//
// PLANA (19-oct-2026, decisión de Fabrizio): sin tarjeta, en el diseño actual (components/plano/plano.ts) — Inter en el
// cuerpo, Source Serif en el título, tokens --franco-*, sin mono ni mayúsculas. El copy vive en lib/entrar/entrada.ts
// (lo fija el tier ENTRADA-CÓDIGO).
// ─────────────────────────────────────────────────────────────────────────────
import { useRouter } from "next/navigation";
import { CODIGO_MAX } from "@/lib/lo-que-sigue/codigo";
import { ENTRAR, ENTRAR_CONTEXTO, hrefConContrasena, type ContextoEntrada } from "@/lib/entrar/entrada";
import { PLANO, UI_PLANO } from "@/components/plano/plano";
import { IconoGoogle } from "@/components/entrar/IconoGoogle";
import { useEntradaPorCodigo } from "@/components/entrar/useEntradaPorCodigo";

export function EntrarConCodigo({ next, ctx }: { next: string; ctx: ContextoEntrada }) {
  const router = useRouter();
  const e = useEntradaPorCodigo(next);
  const textos = ENTRAR_CONTEXTO[ctx];

  async function entrar(ev: React.FormEvent) {
    if (!(await e.verificar(ev))) return;
    router.push(e.destino);
    router.refresh();
  }

  return (
    <div className="w-full" style={{ fontFamily: UI_PLANO }} data-entrar={ctx}>
      {e.enviado ? (
        <form onSubmit={entrar} noValidate data-entrar-paso="codigo">
          <h1 className={PLANO.titulo}>{ENTRAR.enviadoTitulo}</h1>
          <p className={PLANO.bajada}>{ENTRAR.enviadoCuerpo(e.enviado)}</p>
          <div className={`${PLANO.seccion} flex flex-col gap-3`}>
            <input
              ref={e.campoCodigo}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODIGO_MAX}
              placeholder={ENTRAR.placeholderCodigo}
              aria-label="Código"
              className={`${PLANO.campo} text-[18px] tracking-[0.2em] placeholder:tracking-normal`}
              value={e.codigo}
              onChange={(x) => e.setCodigo(x.target.value)}
            />
            <button type="submit" className={PLANO.principal} disabled={e.ocupado}>{ENTRAR.entrar}</button>
          </div>
          {e.error && <p className={`mt-3 ${PLANO.error}`} role="alert">{e.error}</p>}
          {e.reenviado && !e.error && <p className={`mt-3 ${PLANO.nota}`} role="status">{ENTRAR.reenviado}</p>}
          <p className={`mt-5 ${PLANO.nota}`}>
            {ENTRAR.noLlego}{" "}
            <button type="button" className={PLANO.enlace} onClick={e.mandarDeNuevo} disabled={e.ocupado}>{ENTRAR.mandarDeNuevo}</button>
            {" · "}
            <button type="button" className={PLANO.enlace} onClick={e.usarOtroCorreo}>{ENTRAR.otroCorreo}</button>
          </p>
        </form>
      ) : (
        <>
          <h1 className={PLANO.titulo}>{textos.titulo}</h1>
          <p className={PLANO.bajada}>{textos.bajada}</p>
          <form className={`${PLANO.seccion} flex flex-col gap-3`} onSubmit={e.enviarCodigo} noValidate data-entrar-paso="correo">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={ENTRAR.placeholderCorreo}
              aria-label="Tu correo"
              className={PLANO.campo}
              value={e.correo}
              onChange={(x) => e.setCorreo(x.target.value)}
            />
            <button type="submit" className={PLANO.principal} disabled={e.ocupado}>{ENTRAR.mandarCodigo}</button>
            {e.error && <p className={PLANO.error} role="alert">{e.error}</p>}
          </form>
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--franco-border)]" />
            <span className="text-[13px] text-[var(--franco-text-muted)]">{ENTRAR.o}</span>
            <span className="h-px flex-1 bg-[var(--franco-border)]" />
          </div>
          <button type="button" onClick={e.conGoogle} className={PLANO.secundario}>
            <span className={PLANO.iconoGoogle}><IconoGoogle /></span> {ENTRAR.google}
          </button>
          <p className={`mt-6 ${PLANO.nota}`} data-entrar="con-contrasena">
            {ENTRAR.conContrasenaPregunta}{" "}
            <a href={hrefConContrasena(e.destino)} className="text-[var(--franco-text)] underline underline-offset-2">{ENTRAR.conContrasenaEnlace}</a>
          </p>
        </>
      )}
    </div>
  );
}
