"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El aviso antes de gastar un análisis (13-oct-2026; reglas y copy en lib/guia/aviso-analizar.ts). Lo abren
// «Analizar este» de la página semanal y de la guía. Es EL MISMO modal de confirmación del wizard (ModalPlausibilidad,
// estado limpio; pedido de Fabrizio): el depto, la modalidad, destacado que va con el pie y el plazo de la persona, los
// datos que muestra el wizard —precio por m², pie, dividendo, retorno bruto— más el precio y la superficie, lo que usa
// («Usa 1 de tus N análisis.») y Analizar / Cancelar. Sin análisis, el mismo modal ofrece el pack de tres y lleva a
// pagarlo; después de pagar se vuelve a la página.
// DESDE LA SELECCIÓN (21-oct-2026, recorrido real de Fabrizio por la puerta B): al tocar «Analizar», el aviso queda abierto
// con «Franco está analizando este depto…» y la barra de carga del header —el mismo efecto que el wizard— hasta que abre el
// informe (`analizando`). Sin saldo, el pack de tres es el principal —al precio del ticket si la cuenta tiene menos de 24
// horas— y debajo «Comprar solo 1 · $9.990» (`compras`, lib/guia/compra-desde-depto.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useRouter } from "next/navigation";
import { claveActual, iniciarCarga } from "@/lib/carga-global";
import { COMPRA_DEPTO, type ComprasDelDepto } from "@/lib/guia/compra-desde-depto";
import { ModalPlausibilidad } from "@/components/formulario-v4/ModalPlausibilidad";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { AVISO_ANALIZAR, derivadosAviso, destacadoCombinacion, textoUso, type FinanzasAviso, type UsoAnalisis } from "@/lib/guia/aviso-analizar";
import "@/components/formulario-v4/wizard-v4.css";

export function AvisoAntesDeAnalizar({ depto, combinacion, finanzas, uso, rutaCompra, alAnalizar, alCancelar, modalidad = "ltr", analizando = false, compras = null, ticketConSaldo = null }: {
  depto: { comuna: string; tipologia: string | null; m2: number; precioUF: number };
  /** Renta corta (14-oct-2026): el ingreso estimado por zona va en `finanzas.arriendo`. La última línea es la de siempre,
   *  «Usa 1 de tus N análisis», sin condición (15-oct-2026). */
  modalidad?: "ltr" | "str";
  /** El pie y el plazo con que se analiza. */
  combinacion: { piePct: number; plazoAnios: number };
  finanzas: FinanzasAviso;
  uso: UsoAnalisis;
  /** El checkout del pack, con su origen y la vuelta a esta página. */
  rutaCompra: string;
  alAnalizar: () => void;
  alCancelar: () => void;
  /** Se está generando el informe: el aviso queda abierto, cargando, hasta que se abre. */
  analizando?: boolean;
  /** Sin saldo, desde la selección: el pack (principal) y el suelto (debajo), con la vuelta a este depto. */
  compras?: ComprasDelDepto | null;
  /** CON SALDO Y EL TICKET VIVO (22-oct-2026, decisión de Fabrizio): se usa el saldo como siempre y debajo una sola línea,
   *  «Hoy, 3 más por $14.990 · vence mañana 11:17», como enlace, sin frenar. */
  ticketConSaldo?: { texto: string; href: string } | null;
}) {
  const router = useRouter();
  const sin = uso.tipo === "sin";
  const d = destacadoCombinacion(combinacion);
  const comprar = (href: string) => { iniciarCarga(claveActual()); router.push(href); };
  return (
    <ModalPlausibilidad
      open
      anomalias={[]}
      marca={sin ? "aviso-analizar-sin" : "aviso-analizar"}
      titulo={sin ? AVISO_ANALIZAR.tituloSin : AVISO_ANALIZAR.titulo}
      resumen={{
        direccion: [depto.comuna, depto.tipologia].filter(Boolean).join(" · "),
        modalidad: modalidad === "str" ? AVISO_ANALIZAR.modalidadCorta : AVISO_ANALIZAR.modalidad,
        derivados: derivadosAviso(depto, combinacion, finanzas),
      }}
      destacado={<>Con el pie de <b>{d.pie}</b> y el plazo de <b>{d.plazo}</b> de tu perfil</>}
      consumo={sin && compras ? compras.sin : textoUso(uso)}
      nota={!sin && ticketConSaldo ? (
        <EnlaceCarga href={ticketConSaldo.href} className="wz-modal-nota-enlace" data-modal-ticket>{ticketConSaldo.texto}</EnlaceCarga>
      ) : undefined}
      labelConfirmar={sin ? (compras ? compras.pack.label : AVISO_ANALIZAR.comprar) : AVISO_ANALIZAR.analizar}
      labelRevisar={AVISO_ANALIZAR.cancelar}
      labelGenerando={COMPRA_DEPTO.analizando}
      submitting={analizando}
      secundario={sin && compras ? { label: compras.suelto.label, onClick: () => comprar(compras.suelto.href) } : undefined}
      onConfirmar={sin ? () => comprar(compras ? compras.pack.href : rutaCompra) : alAnalizar}
      onCerrar={alCancelar}
    />
  );
}
