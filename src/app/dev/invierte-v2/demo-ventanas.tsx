"use client";

// Las ventanas del flujo nuevo de Invierte con Franco con datos de muestra, para medir que caben (sonda
// scripts/eval/golden/invierte-v2-alto-sonda.ts): la hoja de contacto (sin sesión: no pregunta nada al servidor ni guarda),
// «Ver mi orden» con un texto lleno y su registro, y las preguntas de la firma. Nada escribe: cerrar la vuelve a abrir.
// Los datos largos a propósito (nombre, comuna, precio) para ver que nada se corte.
import { useState } from "react";
import { HojaContacto } from "@/components/invierte-v2/HojaContacto";
import { ListaPreguntas, RegistroDocumento, TextoDocumento, VentanaDocumento } from "@/components/invierte-v2/VentanaDocumento";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { ordenVigente, partesDeTexto, registroDeFirma, textoPlano } from "@/lib/invierte-v2/orden";
import { PREGUNTAS_INVIERTE, TITULO_PREGUNTAS_INVIERTE } from "@/lib/invierte-v2/preguntas";
import "@/components/invierte/invierte.css";
import "@/components/invierte-v2/invierte-v2.css";

export type EstadoDemoVentanas = "contacto" | "orden" | "preguntas";

const DEPTO = { avisoId: "00000000-0000-4000-8000-000000000001", linea: "Pedro Aguirre Cerda · 3D2B · 78 m² · Usado", precioUF: 12650, veredicto: "COMPRAR", score: 82 };
const NOMBRE = "María José de los Ángeles Fernández-Valdivieso";
const TEXTO = textoPlano(ordenVigente({ nombre: NOMBRE, rut: "11.111.111-1", depto: "Pedro Aguirre Cerda · 3D2B · 78 m²" }));
const REGISTRO = registroDeFirma({ nombre: NOMBRE, rut: "11111111-1", firmadoAt: "2026-11-18T11:04:05.000Z", textoSha256: "e2b38d2850369677f8881abcfc600e3c5f4813925e6dd5505b42253a180999a4" });
const D = FLUJO_COPY.documento;

export function DemoVentanas({ estado }: { estado: EstadoDemoVentanas }) {
  const [abierta, setAbierta] = useState(true);
  const cerrar = () => { setAbierta(false); window.setTimeout(() => setAbierta(true), 400); };
  return (
    <main style={{ minHeight: "100dvh", padding: 24, background: "var(--franco-bg)", color: "var(--franco-text)" }} data-demo-ventanas={estado}>
      <p>La página de atrás (mapa, selección, informe o firma).</p>
      {abierta && estado === "contacto" && <HojaContacto depto={DEPTO} origen="explorar" sinSesion alCerrar={cerrar} />}
      {abierta && estado === "orden" && (
        <VentanaDocumento nombre="orden" estado={FLUJO_COPY.partimos.estado} titulo={D.tituloOrden}
          meta={<><span><b>{D.firmada}</b> el 18 de noviembre de 2026, 08:04</span><span>{D.mismoDocumento(1)}</span></>}
          descargar={{ href: "#descargar" }} alCerrar={cerrar}>
          <TextoDocumento parrafos={partesDeTexto(TEXTO).parrafos} />
          <RegistroDocumento registro={REGISTRO} />
        </VentanaDocumento>
      )}
      {abierta && estado === "preguntas" && (
        <VentanaDocumento nombre="preguntas" titulo={TITULO_PREGUNTAS_INVIERTE} variante="lista" accion={FLUJO_COPY.firma.volverFirma} alCerrar={cerrar}>
          <ListaPreguntas preguntas={PREGUNTAS_INVIERTE} />
        </VentanaDocumento>
      )}
    </main>
  );
}
