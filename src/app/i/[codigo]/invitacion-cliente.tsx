"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La página del invitado en el navegador (16-oct-2026, la puerta C). Tres modos, decididos UNA vez al cargar (useState): al
// registrarse, `router.refresh()` vuelve a pintar el servidor con sesión, y la pantalla no puede saltar a «ya tienes cuenta»
// en medio de «Estás dentro».
//   · invitado   — el titular, el regalo, y las mismas preguntas de /deptos (DeptosCliente con la puerta C y la vuelta a
//                  esta página); o, si ya trae un depto, la dirección, que lleva al wizard y a su informe gratis.
//                  Desde el 17-oct-2026, la misma pantalla que /deptos —qué es, el número, la banda del correo, «Afina
//                  tu búsqueda»— con su línea «Te invitaron a Franco» arriba y la dirección al final;
//   · propio     — quien invita abre su enlace: su enlace para compartir;
//   · con_cuenta — ya tiene cuenta: el enlace es para quien todavía no está.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePostHog } from "@/lib/posthog-react";
import { DeptosCliente } from "@/app/deptos/deptos-cliente";
import { InvitaAlguien } from "@/components/invitacion/InvitaAlguien";
import type { CaminoSinDireccion } from "@/components/entrada/HeroEntrada";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";
import type { SeleccionDireccion } from "@/components/entrada/useDireccionPlaces";
import { urlDeLlegada } from "@/components/entrada/llegada";
import { PREFIJO_DETALLE_INVITACION, REFERIDO_COPY, rutaInvitacion } from "@/lib/referido";
import type { PortadaDeptos } from "@/lib/deptos/portada";
import "@/app/deptos/deptos.css";
import "./invitacion.css";

export type ModoInvitacion = "invitado" | "propio" | "con_cuenta";

// El campo de la dirección por import() (20-oct-2026, LCP en el teléfono): aparece solo al tocar «¿Ya tienes un depto en
// la mira?», y con él venían el hook de Google Places, sus íconos y la hoja del hero (~8 kB de JS y su CSS) antes de
// pintar la banda. Se pide con la página quieta, así que al tocar ya está.
const cargarCampo = () => import("@/components/entrada/HeroEntrada").then((m) => ({ default: m.CampoEntrada }));
const CampoEntrada = dynamic(cargarCampo, { ssr: false });

export function InvitacionCliente({ modo: modoInicial, codigo, nombre, sesion, portada }: {
  modo: ModoInvitacion;
  codigo: string | null;
  nombre: string | null;
  sesion: { email: string } | null;
  portada?: PortadaDeptos;
}) {
  const [modo] = useState(modoInicial);
  const router = useRouter();
  const posthog = usePostHog();
  const [conDepto, setConDepto] = useState(false);
  const [navegando, setNavegando] = useState<CaminoSinDireccion | "escribir" | null>(null);
  useEffect(() => (modo === "invitado" ? cuandoLaPaginaEsteQuieta(() => { void cargarCampo(); }) : undefined), [modo]);
  // `invitacion_vista` ya no sale de acá (20-oct-2026): la emite la página en el servidor (lib/invitacion-vista.ts). Desde el
  // navegador se perdía si la persona se iba antes de que cargara PostHog, y las dos juntas la contarían dos veces.

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
          <a className="dp-boton dp-boton-tinta iv-boton" href="/dashboard">{REFERIDO_COPY.irACuenta}</a>
        </div>
      </div>
    );
  }

  const titular = nombre ? `${nombre} te invitó a Franco.` : REFERIDO_COPY.titular;
  // La línea del invitado, arriba de todo (17-oct-2026): «Te invitaron a Franco. Tu primer análisis va por cuenta de Franco.»
  const linea = (
    <p className="iv-linea" data-invitacion="linea">
      <b data-invitacion="titular">{titular}</b> <span data-invitacion="bajada">{REFERIDO_COPY.bajada}</span>
    </p>
  );

  // Con un depto en la mira: la dirección lleva al wizard (con la dirección ya elegida) y a su informe gratis. El banner
  // de ese informe registra la cuenta, y el reclamo cobra la cookie de la invitación.
  if (conDepto) {
    const llegada = (destino: Parameters<typeof urlDeLlegada>[0]) => router.push(urlDeLlegada(destino, "invitacion"));
    return (
      <div className="dp" data-invitacion="con-depto">
        {linea}
        <h1 className="dp-que">{REFERIDO_COPY.conDepto}</h1>
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
        portada={portada}
        cabecera={linea}
        pie={
          <button type="button" className="iv-con-depto" onClick={() => { posthog?.capture("invitacion_con_depto", {}); setConDepto(true); }} data-invitacion="con-depto-abrir">
            {REFERIDO_COPY.conDepto} <u>{REFERIDO_COPY.conDeptoAccion}</u><span aria-hidden="true"> →</span>
          </button>
        }
      />
    </div>
  );
}
