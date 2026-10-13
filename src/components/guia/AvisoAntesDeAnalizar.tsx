"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso antes de gastar un análisis (13-oct-2026; reglas y copy en lib/guia/aviso-analizar.ts). Lo abren
// «Analizar este» de la página semanal y de la guía. Es EL MISMO modal de confirmación del wizard (ModalPlausibilidad,
// estado limpio; pedido de Fabrizio): el depto, la modalidad, destacado que va con el pie y el plazo de la persona, los
// datos que muestra el wizard —precio por m², pie, dividendo, retorno bruto— más el precio y la superficie, lo que usa
// («Usa 1 de tus N análisis.») y Analizar / Cancelar. Sin análisis, el mismo modal ofrece el pack de tres y lleva a
// pagarlo; después de pagar se vuelve a la página.
// ─────────────────────────────────────────────────────────────────────────────
import { useRouter } from "next/navigation";
import { ModalPlausibilidad } from "@/components/formulario-v4/ModalPlausibilidad";
import { AVISO_ANALIZAR, derivadosAviso, destacadoCombinacion, textoUso, type FinanzasAviso, type UsoAnalisis } from "@/lib/guia/aviso-analizar";
import "@/components/formulario-v4/wizard-v4.css";

export function AvisoAntesDeAnalizar({ depto, combinacion, finanzas, uso, rutaCompra, alAnalizar, alCancelar }: {
  depto: { comuna: string; tipologia: string | null; m2: number; precioUF: number };
  /** El pie y el plazo con que se analiza. */
  combinacion: { piePct: number; plazoAnios: number };
  finanzas: FinanzasAviso;
  uso: UsoAnalisis;
  /** El checkout del pack, con su origen y la vuelta a esta página. */
  rutaCompra: string;
  alAnalizar: () => void;
  alCancelar: () => void;
}) {
  const router = useRouter();
  const sin = uso.tipo === "sin";
  const d = destacadoCombinacion(combinacion);
  return (
    <ModalPlausibilidad
      open
      anomalias={[]}
      marca={sin ? "aviso-analizar-sin" : "aviso-analizar"}
      titulo={sin ? AVISO_ANALIZAR.tituloSin : AVISO_ANALIZAR.titulo}
      resumen={{
        direccion: [depto.comuna, depto.tipologia].filter(Boolean).join(" · "),
        modalidad: AVISO_ANALIZAR.modalidad,
        derivados: derivadosAviso(depto, combinacion, finanzas),
      }}
      destacado={<>Con el pie de <b>{d.pie}</b> y el plazo de <b>{d.plazo}</b> de tu perfil</>}
      consumo={textoUso(uso)}
      labelConfirmar={sin ? AVISO_ANALIZAR.comprar : AVISO_ANALIZAR.analizar}
      labelRevisar={AVISO_ANALIZAR.cancelar}
      onConfirmar={sin ? () => router.push(rutaCompra) : alAnalizar}
      onCerrar={alCancelar}
    />
  );
}
