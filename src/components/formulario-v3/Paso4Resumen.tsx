"use client";

// Paso 4 — Resumen consolidado navegable. Iteración 2026-05-10 (Commit 1).
// Reemplaza Paso4AjusteFino: los ajustes finos (plazo, tasa, vacancia,
// adminPct, comisión exacta, overrides ADR/Occ) son ahora data operacional
// que vive en pasos 2 y 3, no "tuneo" diferido. Este paso es solo lectura
// + navegación inline para editar cada sección.
//
// Anatomía siguiendo design system Franco:
//   - Sin color decorativo (solo Ink + Signal Red en CTA).
//   - Label uppercase mono + título Serif por sección.
//   - Filas con label Sans (izq) + valor Mono (der).
//   - Botón "Editar" mono uppercase por sección → setStep(N).
//   - CTAs footer: "← Volver" Sans gris + "Analizar ahora →" Signal Red sólido.

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { StateBox } from "@/components/ui/StateBox";
import { InfoTooltip } from "@/components/ui/tooltip";
import { canAnalyzeFromTier, CostoCard, type TierInfo } from "./Paso3Modalidad";
import {
  fmtCLP,
  fmtUF,
  gestionOptionToMotor,
  parseDecimalLocale,
  parseNum,
  type WizardV3State,
} from "./wizardV3State";

const LABEL_TIPO_EDIFICIO: Record<NonNullable<WizardV3State["tipoEdificio"]>, string> = {
  residencial_puro: "Residencial",
  dedicado: "Dedicado / aparthotel",
};
const LABEL_HABILITACION: Record<WizardV3State["habilitacion"], string> = {
  basico: "Básico",
  estandar: "Estándar",
  premium: "Premium",
};
const LABEL_MODALIDAD: Record<NonNullable<WizardV3State["modalidad"]>, string> = {
  ltr: "Renta larga",
  str: "Renta corta",
  both: "Ambas (LTR vs STR)",
};
const LABEL_EDIFICIO_PERMITE: Record<WizardV3State["edificioPermiteAirbnb"], string> = {
  si: "Sí permite",
  no: "No permite",
  no_seguro: "No estoy seguro",
};

// ─── Helpers ────────────────────────────────────────────

const STR_OCUPACION_TARGET = {
  edificio_dedicado_admin_pro: 0.74,
  edificio_dedicado_auto: 0.65,
  admin_pro_residencial: 0.65,
  auto_gestion_residencial: 0.55,
} as const;

function calcOccDerivada(
  tipoEdificio: WizardV3State["tipoEdificio"],
  adminPro: boolean,
): number {
  const dedicado = tipoEdificio === "dedicado";
  if (dedicado && adminPro) return STR_OCUPACION_TARGET.edificio_dedicado_admin_pro;
  if (dedicado && !adminPro) return STR_OCUPACION_TARGET.edificio_dedicado_auto;
  if (!dedicado && adminPro) return STR_OCUPACION_TARGET.admin_pro_residencial;
  return STR_OCUPACION_TARGET.auto_gestion_residencial;
}

// ─── Tipos ──────────────────────────────────────────────

interface ResumenRow {
  label: string;
  value: string;
  /** Opcional. 1 oración pedagógica en lenguaje no-técnico. */
  tooltip?: string;
  /** Marca la fila como valor de REFERENCIA derivado (no editable en esta
   * modalidad). Se renderiza atenuado + tag "Referencia" para no implicar que
   * el "Editar →" de la sección lleva a un input para tocarlo. */
  referencia?: boolean;
}

interface SectionConfig {
  numero: string;
  title: string;
  editStep: 1 | 2 | 3;
  rows: ResumenRow[];
}

// ─── Subcomponente: sección del resumen ─────────────────

function ResumenSection({
  numero,
  title,
  rows,
  onEditar,
}: SectionConfig & { onEditar: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
      {/* Header: label uppercase mono + título Serif + botón Editar */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono text-[10px] text-[var(--franco-text-muted)] uppercase tracking-[0.08em] mb-1">
            {numero}
          </div>
          <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)] m-0 leading-tight">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onEditar}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-dotted px-2 py-1"
        >
          Editar →
        </button>
      </div>

      {/* Filas: label Sans (izq) + valor Mono (der). Tooltip opcional inline. */}
      <dl className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-3 py-1 border-b border-dashed border-[var(--franco-border)] last:border-b-0"
          >
            <dt className="flex items-center gap-1.5 font-body text-[13px] text-[var(--franco-text-secondary)]">
              {row.label}
              {row.tooltip && <InfoTooltip content={row.tooltip} />}
            </dt>
            <dd
              className={`font-mono text-[13px] text-right m-0 ${
                row.referencia ? "text-[var(--franco-text-muted)]" : "text-[var(--franco-text)]"
              }`}
            >
              {row.referencia && (
                <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] mr-2">
                  Referencia
                </span>
              )}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────

export function Paso4Resumen({
  state,
  ufCLP,
  tierInfo,
  onEditarStep,
  onVolver,
  onAnalizar,
  isLoggedIn,
  onComprar,
  comprando,
  submitting,
  submitError,
}: {
  state: WizardV3State;
  ufCLP: number;
  tierInfo: TierInfo | null;
  /** Navega al paso N y permite al user editar la sección correspondiente. */
  onEditarStep: (n: 1 | 2 | 3) => void;
  /** Botón "← Volver" al paso 3. */
  onVolver: () => void;
  /** "Analizar ahora →" — submit final. */
  onAnalizar: () => void;
  /** Sesión activa. Habilita el flujo de compra pre-pago (logueado + LTR/STR/Ambas). */
  isLoggedIn: boolean;
  /** Crea el/los análisis bloqueado(s) (LTR, STR o Ambas) y va a checkout. */
  onComprar: (modalidad: "ltr" | "str" | "both") => void;
  /** True mientras se crea la fila bloqueada + redirige a checkout. */
  comprando: boolean;
  submitting: boolean;
  submitError: string;
}) {
  const mod = state.modalidad;
  const canAnalyze = canAnalyzeFromTier(tierInfo);

  // ─── Derivaciones para mostrar ─────────────────────

  const precioUF = parseNum(state.precio);
  const precioCLP = precioUF * ufCLP;
  const piePct = Number(state.piePct) || 20;
  const plazo = Number(state.plazoCredito) || 25;
  const tasa = parseDecimalLocale(state.tasaInteres) || 4.72;
  const supUtil = parseDecimalLocale(state.superficieUtil);
  const precioPorM2 = supUtil > 0 ? precioUF / supUtil : 0;
  const pieUF = precioUF * (piePct / 100);
  const creditoCLP = (precioUF - pieUF) * ufCLP;
  const tasaMensual = tasa / 100 / 12;
  const n = plazo * 12;
  const dividendoCLP = creditoCLP > 0 && tasaMensual > 0
    ? Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)))
    : 0;

  const motor = gestionOptionToMotor(state.gestionOption);
  const occDerivada = calcOccDerivada(state.tipoEdificio, motor.adminPro);
  const occFinal = state.occOverride !== null ? state.occOverride : occDerivada;
  const adrEsOverride = state.adrOverride !== null;
  const occEsOverride = state.occOverride !== null;
  const comisionUsadaPct = state.gestionOption === "tu_mismo" ? 3 : Number(state.comisionAdminPct);

  // ─── Secciones del resumen ──────────────────────────

  const seccionPropiedad: SectionConfig = {
    numero: "01 · PROPIEDAD",
    title: "Lo que vas a comprar",
    editStep: 1,
    rows: [
      { label: "Dirección", value: state.direccion || "—" },
      { label: "Comuna", value: state.comuna || "—" },
      {
        label: "Tipo",
        value: state.tipoPropiedad === "nuevo" ? "Nuevo" : "Usado",
        tooltip: "Nuevo = primera venta directa de la inmobiliaria. Usado = ya tuvo otro dueño. El motor ajusta plusvalía esperada según esto.",
      },
      {
        label: "Superficie útil",
        value: state.superficieUtil ? `${state.superficieUtil} m²` : "—",
        tooltip: "Metros cuadrados al interior del depto, sin contar terrazas ni espacios comunes.",
      },
      {
        label: "Tipología",
        value: `${state.dormitorios || "—"}D · ${state.banos || "—"}B${state.esStudio ? " (studio)" : ""}`,
      },
      { label: "Estac. / Bodega", value: `${state.estacionamientos || "0"} · ${state.bodegas || "0"}` },
    ],
  };

  const seccionFinanciamiento: SectionConfig = {
    numero: "02 · FINANCIAMIENTO",
    title: "Cómo la compras",
    editStep: 2,
    rows: [
      { label: "Precio", value: precioUF > 0 ? `${fmtUF(precioUF)} ≈ ${fmtCLP(precioCLP)}` : "—" },
      {
        label: "Precio por m²",
        value: precioPorM2 > 0 ? fmtUF(precioPorM2) : "—",
        tooltip: "Indicador para comparar este depto contra otros similares en la zona. UF/m² es la métrica estándar del mercado chileno.",
      },
      {
        label: "Pie",
        value: `${piePct}% · ${fmtUF(pieUF)}`,
        tooltip: "Lo que pagas al contado al firmar. El resto se financia con crédito hipotecario.",
      },
      {
        label: "Plazo crédito",
        value: `${plazo} años`,
        tooltip: "Cuánto tiempo te demoras en pagar el crédito. Más plazo = cuota mensual más baja pero pagas más intereses totales.",
      },
      {
        label: "Tasa anual",
        value: `${state.tasaInteres}%`,
        tooltip: "Tasa anual del crédito hipotecario en UF. Hoy en Chile fluctúa entre 4% y 5,5%.",
      },
      {
        label: "Dividendo estimado",
        value: dividendoCLP > 0 ? `${fmtCLP(dividendoCLP)}/mes` : "—",
        tooltip: "Cuota mensual fija del crédito hipotecario. Calculada con la fórmula de cuota francesa estándar.",
      },
    ],
  };

  const operacionalRows: ResumenRow[] = [
    {
      label: "Modalidad de análisis",
      value: mod ? LABEL_MODALIDAD[mod] : "—",
      tooltip: "Modo en el que vas a operar la propiedad. LTR = arriendo tradicional a 1+ año. STR = renta corta tipo Airbnb. Ambas = se calculan en paralelo para comparar.",
    },
  ];

  // Orden LTR → STR (alineado al Paso 3). Primero el bloque LTR, luego el
  // estado del depto (STR), luego el resto de la operación STR.
  if (mod === "ltr" || mod === "both") {
    operacionalRows.push(
      {
        label: "Vacancia LTR",
        value: `${state.vacanciaPct}%`,
        tooltip: "Porcentaje del año estimado sin arrendatario en arriendo tradicional. Default 5% ≈ 18 días/año.",
      },
      {
        label: "Gestión LTR",
        value: state.adminPct === "0" ? "Autogestión" : `${state.adminPct}% corredor`,
        tooltip: "Quién gestiona el arriendo tradicional. Autogestión = sin costo. Corredor = comisión mensual sobre el arriendo (típico 7-10%).",
      },
    );
  }

  // Estado del depto: solo aplica para STR. En LTR puro no tiene sentido
  // porque típicamente no se amobla para arrendar a largo plazo.
  if (mod === "str" || mod === "both") {
    operacionalRows.push({
      label: "Estado del depto",
      value: state.estaAmoblado
        ? "Ya amoblado"
        : `Falta amoblar (${state.costoAmoblamiento ? fmtCLP(parseNum(state.costoAmoblamiento)) : "—"})`,
      tooltip: "Si el depto ya viene amoblado, no se descuenta nada del flujo. Si no, sumamos el costo de amoblar como inversión inicial.",
    });
  }

  if (mod === "str" || mod === "both") {
    operacionalRows.push(
      {
        label: "Tipo de edificio",
        value: state.tipoEdificio ? LABEL_TIPO_EDIFICIO[state.tipoEdificio] : "—",
        tooltip: "Residencial = la mayoría de los vecinos vive ahí. Dedicado = aparthotel diseñado para Airbnb (todos los departamentos son de renta corta).",
      },
      {
        label: "Gestión",
        value: state.gestionOption === "pro_formal" ? "Operador profesional" : "Auto-gestión",
        tooltip: "Quién va a operar el Airbnb. Auto = tú mismo (limpieza, check-in, mensajes). Profesional = una empresa lo hace por ti a cambio de comisión.",
      },
      {
        label: "Comisión operador",
        value: `${comisionUsadaPct}%`,
        tooltip: "Porcentaje del ingreso bruto que se queda el operador (o Airbnb si es auto-gestión).",
      },
      {
        label: "Habilitación",
        value: LABEL_HABILITACION[state.habilitacion],
        tooltip: "Calidad del amoblamiento y fotos. Premium implica decoración curada y amenidades extra; define el costo de habilitación, no la tarifa.",
      },
      {
        label: "Edificio permite Airbnb",
        value: LABEL_EDIFICIO_PERMITE[state.edificioPermiteAirbnb],
        tooltip: "Algunos edificios prohíben Airbnb en su reglamento. Verifica esto antes de comprar — un veto del comité puede invalidar el modelo entero.",
      },
    );
    if (state.tipoEdificio === "dedicado" && state.operadorNombre.trim().length > 0) {
      operacionalRows.push({ label: "Operador del edificio", value: state.operadorNombre.trim() });
    }
    operacionalRows.push(
      {
        label: "Tu tarifa diaria estimada",
        value: adrEsOverride
          ? `${fmtCLP(state.adrOverride!)} (Ajustado manualmente)`
          : "Derivada automáticamente",
        tooltip: "Lo que vas a cobrar por noche, anclado a la tarifa de mercado de la zona. Es la base del cálculo de ingresos.",
      },
      {
        label: "Ocupación estabilizada",
        value: occEsOverride
          ? `${Math.round(occFinal * 100)}% (Ajustado manualmente)`
          : `${Math.round(occDerivada * 100)}% (mes 7+)`,
        tooltip: "Porcentaje del año que el depto está reservado, una vez que pasaste los primeros 6 meses de ramp-up y tienes reseñas.",
      },
    );
  }

  const seccionOperacional: SectionConfig = {
    numero: "03 · OPERACIONAL",
    title: "Cómo lo operas",
    editStep: 3,
    rows: operacionalRows,
  };

  const costosRows: ResumenRow[] = [
    {
      label: "Arriendo de referencia LTR",
      value: state.arriendo ? `${fmtCLP(parseNum(state.arriendo))}/mes` : "—",
      tooltip: "Arriendo tradicional estimado. En modo Ambas se usa para comparar STR vs LTR; en modo STR solo es referencia visual.",
      // STR-only: la zona Renta larga del Paso 3 está oculta, así que no hay
      // input para editarlo. Se marca como referencia derivada (atenuada + tag)
      // para no implicar que el "Editar →" de la sección lleva a un campo.
      referencia: mod === "str",
    },
    {
      label: "Gastos comunes",
      value: state.gastos ? `${fmtCLP(parseNum(state.gastos))}/mes` : "—",
      tooltip: "Cuota mensual a la administración del edificio. La pagas tú aunque el depto esté vacío.",
    },
    {
      label: "Contribuciones",
      value: state.contribuciones ? `${fmtCLP(parseNum(state.contribuciones))}/trim` : "—",
      tooltip: "Impuesto territorial trimestral que paga el dueño. Lo calcula el SII según el avalúo fiscal.",
    },
  ];
  if (mod === "str" || mod === "both") {
    const totalSTROps = parseNum(state.costoElectricidad)
      + parseNum(state.costoAgua)
      + parseNum(state.costoWifi)
      + parseNum(state.costoInsumos)
      + parseNum(state.mantencionMensual);
    costosRows.push({
      label: "Costos operativos STR",
      value: totalSTROps > 0 ? `${fmtCLP(totalSTROps)}/mes (luz + agua + internet + insumos + mant.)` : "—",
      tooltip: "Suma de los costos que el dueño asume mensualmente para operar el Airbnb (servicios básicos + insumos + mantención). En Airbnb no se traspasan al huésped.",
    });
  }

  const seccionCostos: SectionConfig = {
    numero: "04 · COSTOS",
    title: "Lo que te cuesta cada mes",
    editStep: 3,
    rows: costosRows,
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 animate-slide-left">
      <div>
        <h2 className="font-heading text-2xl font-bold text-[var(--franco-text)] m-0 mb-1">
          Revisa antes de analizar
        </h2>
        <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
          Edita cualquier sección si necesitas ajustar algo antes de analizar.
        </p>
      </div>

      <ResumenSection {...seccionPropiedad} onEditar={() => onEditarStep(1)} />
      <ResumenSection {...seccionFinanciamiento} onEditar={() => onEditarStep(2)} />
      <ResumenSection {...seccionOperacional} onEditar={() => onEditarStep(3)} />
      <ResumenSection {...seccionCostos} onEditar={() => onEditarStep(3)} />

      {/* Costo tier-aware: mismo componente que Paso 3. Sin créditos rinde la
          señal de paywall con sus salidas (comprar single / ver planes), de
          modo que el free no quede en un dead-end al final del wizard. */}
      {tierInfo && <CostoCard tierInfo={tierInfo} />}

      {submitError && (
        <StateBox variant="left-border" state="negative">{submitError}</StateBox>
      )}

      {/* Ancla pre-pago: deja claro que se paga por ESTE análisis ya configurado,
          no por un crédito abstracto. Logueado + LTR/STR/Ambas (el caso del botón
          de compra pre-pago). Sans regular, sin color (sistema de 2 colores). */}
      {!canAnalyze && isLoggedIn && (mod === "ltr" || mod === "str" || mod === "both") && (
        <p className="font-body text-[12px] text-[var(--franco-text-muted)] m-0">
          Estás comprando este análisis{mod === "both" ? " comparativo" : ""}{state.comuna ? ` de ${state.comuna}` : ""}. Pagas y se desbloquea al instante.
        </p>
      )}

      {/* Footer CTAs siguiendo Patrón 5 — Form Step.
          El Paso 4 es el cierre del wizard, así que el pie SIEMPRE tiene un
          CTA primario. Con créditos: "Analizar ahora" (submit). Sin créditos:
          el primario pasa a ser un botón de compra ACTIVO al checkout single
          — nunca un disabled "Necesitas un crédito" (ese dead-end ya se
          eliminó). La CostoCard de arriba refuerza el mensaje. */}
      <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-[var(--franco-border)]">
        <button
          type="button"
          onClick={onVolver}
          className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2"
        >
          ← Volver al paso 3
        </button>
        {canAnalyze ? (
          <button
            type="button"
            onClick={onAnalizar}
            disabled={submitting}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando análisis…</>
            ) : (
              <>Analizar ahora →</>
            )}
          </button>
        ) : isLoggedIn && (mod === "ltr" || mod === "str" || mod === "both") ? (
          // Logueado + LTR/STR/Ambas: crear el/los análisis bloqueado(s) y pagar
          // por ÉL. El copy ancla al análisis concreto ("este análisis"), no a un
          // crédito. Mismo checkout single ($9.990) para las tres modalidades;
          // Ambas crea 2 filas locked y un solo cobro las cubre.
          <button
            type="button"
            onClick={() => onComprar(mod)}
            disabled={comprando}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {comprando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Te llevamos a pagar…</>
            ) : mod === "both" ? (
              <>Desbloquear este análisis comparativo · $9.990</>
            ) : (
              <>Desbloquear este análisis · $9.990</>
            )}
          </button>
        ) : !isLoggedIn ? (
          // Guest: NO lo mandamos a checkout (que lo rebota a registro con
          // next=checkout → vuelve a checkout sin análisis y el draft queda
          // huérfano). Va directo a crear cuenta y regresa al wizard con
          // ?resume=1 para retomar ESTE paso y pagar. Type-agnostic (LTR/STR/Ambas):
          // no hardcodea precio porque el monto depende de la modalidad.
          <Link
            href={`/register?next=${encodeURIComponent("/analisis/nuevo-v2?resume=1")}`}
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            Crear cuenta gratis <ArrowRight size={14} />
          </Link>
        ) : (
          // Fallback defensivo: logueado sin modalidad elegida (mod===null), que
          // en la práctica no ocurre en el Paso 4 (se llega con modalidad ya
          // seleccionada). LTR/STR/Ambas ya pasan por la rama pre-pago de arriba.
          <Link
            href="/checkout?product=single"
            className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-7 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            Comprar 1 análisis · $9.990 <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
