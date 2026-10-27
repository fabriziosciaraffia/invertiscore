"use client";

// Los pop-ups de /dev/popups con un depto de muestra (el del mockup 4-ticket-y-popups.html: Providencia · 2D1B · 46 m² ·
// UF 3.275, Comprar 88 y +$88.363). «Cambiar» recalcula con una respuesta fija: con pie 10 % da Ajustar y −$45.120.
// RENTA CORTA (27-oct-2026): c1 con saldo y c0 sin saldo, con la promesa de los dos casos; nd y nd2, el pop-up «no da» con
// la medición del caso del 26-oct (tarifa $61.143 contra $80.367, ocupación 44 % contra 47 %), sin parecidos y con dos.
import { useEffect, useState } from "react";
import { AvisoAntesDeAnalizar } from "@/components/guia/AvisoAntesDeAnalizar";
import { AvisoSinSaldoExplorar } from "@/app/explorar/aviso-sin-saldo";
import { PopupNoDa } from "@/components/guia/PopupNoDa";
import { porQueNoDa, textoAnalizarIgual } from "@/lib/guia/semanal-str";
import "@/components/guia/guia.css";
import "@/app/deptos/deptos.css";
import { comprasDeExplorar, ticketConSaldoDelDepto } from "@/lib/guia/compra-desde-depto";
// El aviso E vive en /explorar y su tarjeta roja se pinta con la hoja de esa página.
import "@/app/explorar/explorar.css";

export type EstadoDemoPopups = "a" | "a0" | "d1" | "d1t" | "d2" | "e" | "e0" | "c1" | "c0" | "nd" | "nd2";

const DEPTO = { comuna: "Providencia", tipologia: "2D1B", m2: 46, precioUF: 3275 };
const FINANZAS = { tasa: 4.2, uf: 39_600, arriendo: 720_000 };
const BASE = { veredicto: "COMPRAR", score: 88, flujo: 88_363 };
const nada = () => {};
/** La medición del 26-oct (comparaciones_zona_str del aviso 9bfe6906): la zona y lo medido en la dirección. */
const ZONA_CASO = { veredicto: "COMPRAR", score: 85, adr: 80367, ocupacion: 0.466 };
const FINO_CASO = { veredicto: "AJUSTA SUPUESTOS", score: 68, adr: 61143, ocupacion: 0.437 };
const tarjetaDemo = (k: string, ojo: string, uf: string) => (
  <article key={k} className="sel-av"><div className="sel-ojo">{ojo}</div><div className="sel-precio">{uf}</div><button type="button" className="sel-btn" data-primario="1">Analizar este</button></article>
);

export function DemoPopups({ estado }: { estado: EstadoDemoPopups }) {
  // Después de cargar, como en las páginas reales (se abren con un toque): el modal va por un portal que el servidor no dibuja.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const ticket = estado === "a" || estado === "e";
  const compras = comprasDeExplorar({ filtros: "c=Providencia&t=2&r=0-60000&p=20&z=25", avisoId: "demo", ticket });
  return (
    <main style={{ minHeight: "100dvh", padding: 16 }} data-demo-popups={estado}>
      <p style={{ fontSize: 13, opacity: 0.6 }}>/dev/popups · {estado}</p>
      {!montado ? null : estado === "nd" || estado === "nd2" ? (
        <PopupNoDa
          parecidos={estado === "nd2" ? 2 : 0}
          alCerrar={nada}
          publicacion="https://ejemplo.cl/aviso/9bfe6906"
          porQue={porQueNoDa(ZONA_CASO, FINO_CASO)}
          analizarIgual={{ texto: textoAnalizarIgual("usa 1 de tus 3"), ocupado: false, alTocar: nada }}
        >
          {estado === "nd2" ? [tarjetaDemo("p1", "Las Condes · 2D1B · 60 m²", "UF 3.155"), tarjetaDemo("p2", "Las Condes · 2D1B · 52 m²", "UF 3.306")] : null}
        </PopupNoDa>
      ) : estado === "e" || estado === "e0" ? (
        <AvisoSinSaldoExplorar totalNoche={4807} compras={compras} vence={ticket ? "mañana 18:07" : null} alCerrar={nada} alIr={nada} />
      ) : (
        <AvisoAntesDeAnalizar
          modalidad={estado === "c1" || estado === "c0" ? "str" : "ltr"}
          depto={DEPTO}
          combinacion={{ piePct: 20, plazoAnios: 25 }}
          finanzas={FINANZAS}
          uso={estado === "a" || estado === "a0" || estado === "c0" ? { tipo: "sin" } : estado === "c1" ? { tipo: "con", n: 3, noVencen: true } : { tipo: "regalo", vence: null }}
          compras={estado === "a" || estado === "a0" || estado === "c0" ? compras : null}
          ticketVence={estado === "a" ? "mañana 18:07" : null}
          ticketConSaldo={estado === "d1t" ? ticketConSaldoDelDepto({ token: "demo", avisoId: "demo", origen: "semanal", cuentaCreadaAt: new Date(Date.now() - 3_600_000).toISOString() }) : null}
          rutaCompra="/dev/popups"
          // Renta corta, como en la selección real: sin «Cambiar».
          cambio={estado === "c1" || estado === "c0" ? null : {
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
