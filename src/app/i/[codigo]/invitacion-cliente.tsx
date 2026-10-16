"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La página del invitado en el navegador (16-oct-2026, la puerta C). Tres modos, decididos UNA vez al cargar (useState): al
// registrarse, `router.refresh()` vuelve a pintar el servidor con sesión, y la pantalla no puede saltar a «ya tienes cuenta»
// en medio de «Estás dentro».
//   · invitado   — el titular, el regalo, y las mismas preguntas de /deptos (DeptosCliente con la puerta C y la vuelta a
//                  esta página); o, si ya trae un depto, la dirección, que lleva al wizard y a su informe gratis;
//   · propio     — quien invita abre su enlace: su enlace para compartir;
//   · con_cuenta — ya tiene cuenta: el enlace es para quien todavía no está.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { DeptosCliente } from "@/app/deptos/deptos-cliente";
import { InvitaAlguien } from "@/components/invitacion/InvitaAlguien";
import { CampoEntrada, type CaminoSinDireccion } from "@/components/entrada/HeroEntrada";
import type { SeleccionDireccion } from "@/components/entrada/useDireccionPlaces";
import { urlDeLlegada } from "@/components/entrada/llegada";
import { PREFIJO_DETALLE_INVITACION, REFERIDO_COPY, rutaInvitacion } from "@/lib/referido";
import "@/app/deptos/deptos.css";
import "./invitacion.css";

export type ModoInvitacion = "invitado" | "propio" | "con_cuenta";

export function InvitacionCliente({ modo: modoInicial, codigo, nombre, sesion }: {
  modo: ModoInvitacion;
  codigo: string | null;
  nombre: string | null;
  sesion: { email: string } | null;
}) {
  const [modo] = useState(modoInicial);
  const router = useRouter();
  const posthog = usePostHog();
  const [conDepto, setConDepto] = useState(false);
  const [navegando, setNavegando] = useState<CaminoSinDireccion | "escribir" | null>(null);

  useEffect(() => {
    posthog?.capture("invitacion_vista", { modo, con_nombre: !!nombre, valida: !!codigo });
  }, [posthog, modo, nombre, codigo]);

  if (modo === "propio") {
    return (
      <div className="dp" data-invitacion="propio">
        <h1 className="dp-titulo iv-titulo">{REFERIDO_COPY.tuEnlace}</h1>
        <InvitaAlguien variante="propio" />
      </div>
    );
  }

  if (modo === "con_cuenta") {
    return (
      <div className="dp" data-invitacion="con-cuenta">
        <h1 className="dp-titulo iv-titulo">{REFERIDO_COPY.yaTienesCuenta}</h1>
        <p className="iv-bajada">{REFERIDO_COPY.yaTienesCuentaTexto}</p>
        <div className="dp-fin">
          <a className="dp-boton iv-boton" href="/dashboard">{REFERIDO_COPY.irACuenta}</a>
        </div>
      </div>
    );
  }

  const titular = nombre ? `${nombre} te invitó a Franco.` : REFERIDO_COPY.titular;
  const encabezado = (
    <>
      <h1 className="dp-titulo iv-titulo" data-invitacion="titular">{titular}</h1>
      <p className="iv-bajada" data-invitacion="bajada">{REFERIDO_COPY.bajada}</p>
    </>
  );

  // Con un depto en la mira: la dirección lleva al wizard (con la dirección ya elegida) y a su informe gratis. El banner
  // de ese informe registra la cuenta, y el reclamo cobra la cookie de la invitación.
  if (conDepto) {
    const llegada = (destino: Parameters<typeof urlDeLlegada>[0]) => router.push(urlDeLlegada(destino, "invitacion"));
    return (
      <div className="dp" data-invitacion="con-depto">
        {encabezado}
        <p className="dp-pregunta iv-pregunta">{REFERIDO_COPY.conDepto}</p>
        <div className="iv-campo he-papel">
          <CampoEntrada
            ocupado={navegando}
            mantenerHojaAlEntregar
            onDireccion={(sel: SeleccionDireccion) => {
              posthog?.capture("invitacion_direccion", { via: sel.via, cubierta: sel.cubierta });
              setNavegando("escribir");
              llegada(sel);
            }}
            onCamino={(m: CaminoSinDireccion) => {
              setNavegando(m);
              llegada({ modo: m });
            }}
          />
        </div>
        <button type="button" className="dp-enlace iv-volver" onClick={() => setConDepto(false)}>{REFERIDO_COPY.conDeptoVolver}</button>
      </div>
    );
  }

  return (
    <div data-invitacion="invitado">
      <DeptosCliente
        sesion={sesion}
        pagina={codigo ? rutaInvitacion(codigo) : "/deptos"}
        puerta={{ puerta: "C", detalle: `${PREFIJO_DETALLE_INVITACION}${codigo ?? ""}` }}
        origenLead="invitado"
        cabecera={
          <>
            {encabezado}
            <button type="button" className="iv-con-depto" onClick={() => { posthog?.capture("invitacion_con_depto", {}); setConDepto(true); }} data-invitacion="con-depto-abrir">
              {REFERIDO_COPY.conDepto} <u>{REFERIDO_COPY.conDeptoAccion}</u><span aria-hidden="true"> →</span>
            </button>
          </>
        }
      />
    </div>
  );
}
