"use client";

// Los pop-ups de /dev/popups con un depto de muestra (el del mockup 4-ticket-y-popups.html: Providencia · 2D1B · 46 m² ·
// UF 3.275, Comprar 88 y +$88.363). «Cambiar» recalcula con una respuesta fija: con pie 10 % da Ajustar y −$45.120.
import { useEffect, useState } from "react";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { AvisoSinSaldoExplorar } from "@/app/explorar/aviso-sin-saldo";
import { comprasDeExplorar, ticketConSaldoDelDepto } from "@/lib/guia/compra-desde-depto";
// El aviso E vive en /explorar y su tarjeta roja se pinta con la hoja de esa página.
import "@/app/explorar/explorar.css";

export type EstadoDemoPopups = "a" | "a0" | "d1" | "d1t" | "d2" | "e" | "e0";

const DEPTO = { comuna: "Providencia", tipologia: "2D1B", m2: 46, precioUF: 3275 };
const FINANZAS = { tasa: 4.2, uf: 39_600, arriendo: 720_000 };
const BASE = { veredicto: "COMPRAR", score: 88, flujo: 88_363 };
const nada = () => {};

export function DemoPopups({ estado }: { estado: EstadoDemoPopups }) {
  // Después de cargar, como en las páginas reales (se abren con un toque): el modal va por un portal que el servidor no dibuja.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const ticket = estado === "a" || estado === "e";
  const compras = comprasDeExplorar({ filtros: "c=Providencia&t=2&r=0-60000&p=20&z=25", avisoId: "demo", ticket });
  return (
    <main style={{ minHeight: "100dvh", padding: 16 }} data-demo-popups={estado}>
      <p style={{ fontSize: 13, opacity: 0.6 }}>/dev/popups · {estado}</p>
      {!montado ? null : estado === "e" || estado === "e0" ? (
        <AvisoSinSaldoExplorar n={312} compras={compras} vence={ticket ? "mañana 18:07" : null} alCerrar={nada} alIr={nada} />
      ) : (
        <AvisoAntesDeAnalizar
          depto={DEPTO}
          combinacion={{ piePct: 20, plazoAnios: 25 }}
          finanzas={FINANZAS}
          uso={estado === "a" || estado === "a0" ? { tipo: "sin" } : { tipo: "regalo", vence: null }}
          compras={estado === "a" || estado === "a0" ? compras : null}
          ticketVence={estado === "a" ? "mañana 18:07" : null}
          ticketConSaldo={estado === "d1t" ? ticketConSaldoDelDepto({ token: "demo", avisoId: "demo", origen: "semanal", cuentaCreadaAt: new Date(Date.now() - 3_600_000).toISOString() }) : null}
          rutaCompra="/dev/popups"
          cambio={{
            recalcular: async (c) => (c.piePct === 20 && c.plazoAnios === 25 ? { ...BASE, cuota: 553_202 } : { veredicto: "AJUSTA SUPUESTOS", score: 61, flujo: -45_120, cuota: 612_900 }),
            base: BASE,
          }}
          alAnalizar={nada}
          alCancelar={nada}
        />
      )}
    </main>
  );
}
