import { fmtCLP, fmtNumber } from "@/lib/admin-format";
import { fmtUsd } from "@/lib/costo-ia";
import type { CascadaMargen } from "@/lib/margen-informe";
import type { ResumenAirroi } from "@/lib/airroi-costo";
import type { ResumenGastosFijos } from "@/lib/gastos-fijos";

/**
 * Bloques de /admin/finanzas.
 *
 * REGLA TRANSVERSAL: toda cifra viaja con su procedencia. `Badge` tiene tres
 * estados y ninguno se disfraza de otro — medido (salió de la fuente), estimado
 * (se infirió de un conteo × una tarifa sin factura) y sin dato (no se midió,
 * que NO es cero). Un costo estimado nunca se suma en silencio con uno medido.
 *
 * Signal Red aparece en un solo lugar de toda la pantalla: el resultado cuando
 * es negativo (uso permitido #2 — valor monetario negativo crítico). Los badges
 * y las advertencias van en grises: un dato incompleto no es una alarma, es una
 * aclaración, y pintarlo de rojo gastaría el color que necesita el resultado.
 */

type Estado = "medido" | "estimado" | "parcial" | "sin-dato";

const TEXTO: Record<Estado, string> = {
  medido: "Medido",
  estimado: "Estimado",
  parcial: "Parcial",
  "sin-dato": "Sin dato",
};

export function Badge({ estado, extra }: { estado: Estado; extra?: string }) {
  const borde =
    estado === "medido"
      ? "border-[var(--franco-border-strong)] text-[var(--franco-text-secondary)]"
      : estado === "sin-dato"
        ? "border-dotted border-[var(--franco-border)] text-[var(--franco-text-tertiary)] opacity-75"
        : "border-dashed border-[var(--franco-border)] text-[var(--franco-text-tertiary)]";
  return (
    <span
      className={`ml-1.5 inline-block whitespace-nowrap rounded-sm border-[0.5px] px-1.5 py-px align-middle font-mono text-[9px] uppercase tracking-wider ${borde}`}
    >
      {TEXTO[estado]}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}

export function SeccionHead({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-heading text-lg font-bold text-[var(--franco-text)]">{titulo}</h2>
      {nota && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          {nota}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────── RESULTADO ───────────────────────────

export interface LineaResultado {
  label: string;
  monto: number;
  estado: Estado;
  /** Cobertura de la línea, cuando aplica: "3 de 30 días". Va INLINE, no al pie. */
  cobertura?: string;
}

/**
 * Bloque de resultado.
 *
 * El aviso de cobertura NO es una nota al pie. Cuando faltan días de medición en
 * alguna línea de costo, el resultado deja de ser un número y pasa a ser un
 * PISO: la cifra se muestra con un "o peor" del mismo peso visual, y la
 * advertencia sube a banner callout —el patrón del Hero Verdict Block— porque
 * decir "−$146.120" a secas cuando dos de cinco costos están incompletos es
 * reportar un número que sabemos que está mal en una dirección conocida.
 */
export function BloqueResultado({
  total,
  lineas,
  incompletas,
}: {
  total: number;
  lineas: LineaResultado[];
  incompletas: Array<{ label: string; cobertura: string }>;
}) {
  const negativo = total < 0;
  const hayHuecos = incompletas.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--franco-border)]">
      <div className="bg-[var(--franco-card)] p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
          Resultado del período
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span
            className={`font-mono text-[32px] font-bold leading-tight tracking-tight sm:text-[38px] ${
              negativo ? "text-[var(--signal-red)]" : "text-[var(--franco-text)]"
            }`}
          >
            {negativo ? "−" : ""}
            {fmtCLP(Math.abs(total))}
          </span>
          {hayHuecos && negativo && (
            <span className="font-mono text-[18px] font-bold text-[var(--signal-red)] sm:text-[20px]">
              o peor
            </span>
          )}
        </div>
        <div className="mt-1 font-body text-[13px] text-[var(--franco-text-secondary)]">
          {negativo
            ? `El período no cubre los costos: falta facturar ${fmtCLP(Math.abs(total))} para quedar en cero.`
            : "El período cubre sus costos."}
        </div>

        {/* Banner callout — mismo peso que la cifra, no nota al pie. */}
        {hayHuecos && (
          <div className="mt-4 rounded-r-lg border-l-[3px] border-[var(--franco-border-strong)] bg-[var(--franco-sunken)] p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-secondary)]">
              Cobertura incompleta · el rojo real es mayor
            </div>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--franco-text)]">
              {incompletas.map((i) => `${i.label} tiene ${i.cobertura}`).join(" y ")}. Con la serie
              completa esos costos suben, así que la cifra de arriba es el <strong>techo optimista</strong>,
              no el piso.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--franco-border)] bg-[var(--franco-sunken)]">
        {lineas.map((l, i) => (
          <div
            key={l.label}
            className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13px] ${
              i < lineas.length - 1 ? "border-b border-[var(--franco-border)]" : ""
            }`}
          >
            <span className="text-[var(--franco-text-secondary)]">
              {l.label}
              <Badge estado={l.estado} extra={l.cobertura} />
            </span>
            <span className="shrink-0 font-mono text-[13px] text-[var(--franco-text)]">
              {l.monto < 0 ? "−" : ""}
              {fmtCLP(Math.abs(l.monto))}
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--franco-border-strong)] bg-[var(--franco-card)] px-4 py-3 text-[13px] font-medium">
          <span className="text-[var(--franco-text)]">Resultado</span>
          <span
            className={`shrink-0 font-mono ${negativo ? "text-[var(--signal-red)]" : "text-[var(--franco-text)]"}`}
          >
            {negativo ? "−" : ""}
            {fmtCLP(Math.abs(total))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── MARGEN ───────────────────────────

const LABEL_FAMILIA: Record<string, string> = {
  single: "Análisis individual",
  suscripcion: "Suscripción",
};

export function BloqueMargen({ cascadas }: { cascadas: CascadaMargen[] }) {
  if (cascadas.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
        <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
          No hubo cobros en el período. El margen se calcula sobre ventas reales, así que no hay nada
          que mostrar — no un ejemplo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {cascadas.map((c) => (
        <div key={c.producto} className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--franco-text-tertiary)]">
            {LABEL_FAMILIA[c.familia] ?? c.familia} · {fmtNumber(c.cobros)}{" "}
            {c.cobros === 1 ? "cobro" : "cobros"}
          </div>

          <div className="mt-3">
            <Fila label="Precio de lista" valor={c.precioLista} />
            <Fila label="− IVA (19%)" valor={-c.iva} tenue />
            <Fila label="Ingreso neto" valor={c.neto} />
            <Fila
              label="− Comisión Flow"
              valor={-c.comision}
              tenue
              badge={<Badge estado={c.comisionMedida ? "medido" : "estimado"} />}
            />
            {c.analisisCubiertos > 0 ? (
              <Fila
                label={
                  c.analisisCubiertos > 1
                    ? `− Costo IA si usa los ${c.analisisCubiertos}`
                    : "− Costo IA"
                }
                valor={-c.costoIa}
                tenue
                badge={<Badge estado={c.analisisCubiertos > 1 ? "estimado" : "medido"} />}
              />
            ) : (
              <div className="flex justify-between gap-3 border-b border-dashed border-[var(--franco-border)] py-2 text-[13px]">
                <span className="text-[var(--franco-text-muted)]">
                  − Costo IA
                  <Badge estado="sin-dato" />
                </span>
                <span className="shrink-0 font-mono text-[var(--franco-text-muted)]">sin medir</span>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-3 border-t border-[var(--franco-border-strong)] pt-2.5 text-[13px] font-medium">
              <span className="text-[var(--franco-text)]">
                {c.analisisCubiertos > 1 ? "Margen en el peor caso" : "Margen"}
              </span>
              <span className="shrink-0 font-mono text-[var(--franco-text)]">
                {fmtCLP(c.margen)} · {c.margenPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
            {c.analisisCubiertos > 1
              ? "El costo de IA depende del consumo real: si el suscriptor no usa todos sus análisis, el margen sube. Se muestra el peor caso para no inflarlo."
              : "El IVA de la comisión de Flow no resta acá: es crédito fiscal, no costo."}
          </p>
        </div>
      ))}
    </div>
  );
}

function Fila({
  label,
  valor,
  tenue,
  badge,
}: {
  label: string;
  valor: number;
  tenue?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-[var(--franco-border)] py-2 text-[13px]">
      <span className={tenue ? "text-[var(--franco-text-secondary)]" : "text-[var(--franco-text)]"}>
        {label}
        {badge}
      </span>
      <span className="shrink-0 font-mono text-[var(--franco-text)]">
        {valor < 0 ? "−" : ""}
        {fmtCLP(Math.abs(valor))}
      </span>
    </div>
  );
}

// ─────────────────────── COSTOS VARIABLES ───────────────────────

export function BloqueCostosVariables({
  iaUsd,
  iaClp,
  iaMedidos,
  iaSinMedir,
  airroi,
  usdClp,
  tarifaAirroi,
}: {
  iaUsd: number;
  iaClp: number;
  iaMedidos: number;
  iaSinMedir: number;
  airroi: ResumenAirroi;
  usdClp: number;
  tarifaAirroi: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
      {/* Tabla en desktop; en mobile cada fila colapsa a card (ver <Linea/>). */}
      <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-x-4 border-b border-[var(--franco-border)] pb-2 font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:grid">
        <span>Concepto</span>
        <span className="text-right">Volumen</span>
        <span className="text-right">Costo</span>
        <span className="text-right">Procedencia</span>
      </div>

      <LineaCosto
        concepto="IA (Claude)"
        detalle={`${fmtNumber(iaMedidos)} análisis medidos${iaSinMedir > 0 ? ` · ${fmtNumber(iaSinMedir)} sin medir` : ""}`}
        volumen={fmtUsd(iaUsd)}
        costo={fmtCLP(iaClp)}
        estado="medido"
      />

      {airroi.lineas.map((l) => (
        <LineaCosto
          key={l.metrica}
          concepto={`AirROI — ${l.label}`}
          detalle={
            l.sinDato
              ? "sin mediciones en el período"
              : `${fmtNumber(l.llamadas)} llamadas en ${fmtNumber(l.diasConDato)} ${l.diasConDato === 1 ? "día medido" : "días medidos"}`
          }
          volumen={l.sinDato ? "—" : fmtUsd(l.costoUsd)}
          costo={l.sinDato ? "sin dato" : fmtCLP(l.costoClp)}
          estado={l.sinDato ? "sin-dato" : "estimado"}
        />
      ))}

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-[var(--franco-border)] bg-[var(--franco-border)] sm:grid-cols-3">
        <Celda valor={fmtNumber(airroi.cacheHits)} sub="hits de caché AirROI · llamadas que no se pagaron" />
        <Celda
          valor={fmtUsd(tarifaAirroi)}
          sub="tarifa por llamada — de un comentario del código, no de una factura"
        />
        <Celda valor={fmtCLP(usdClp)} sub="dólar usado (USD_CLP)" />
      </div>

      <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
        <strong className="font-medium text-[var(--franco-text-secondary)]">
          El costo de AirROI no está medido, está inferido.
        </strong>{" "}
        Sale de multiplicar el conteo de llamadas por una tarifa que nadie confirmó contra una
        factura. Mientras sea así va marcado como estimado y no se mezcla con el costo de IA, que sí
        sale de tokens reales.
      </p>
    </div>
  );
}

function LineaCosto({
  concepto,
  detalle,
  volumen,
  costo,
  estado,
}: {
  concepto: string;
  detalle: string;
  volumen: string;
  costo: string;
  estado: Estado;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--franco-border)] py-2.5 text-[13px] last:border-b-0 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-baseline">
      <div>
        <div className="text-[var(--franco-text)]">{concepto}</div>
        <div className="font-mono text-[10px] text-[var(--franco-text-muted)]">{detalle}</div>
      </div>
      <div className="mt-1 flex justify-between font-mono sm:mt-0 sm:block sm:text-right">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
          Volumen
        </span>
        <span className="text-[var(--franco-text-secondary)]">{volumen}</span>
      </div>
      <div className="flex justify-between font-mono sm:block sm:text-right">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
          Costo
        </span>
        <span className="text-[var(--franco-text)]">{costo}</span>
      </div>
      <div className="mt-1 sm:mt-0 sm:text-right">
        <Badge estado={estado} />
      </div>
    </div>
  );
}

function Celda({ valor, sub }: { valor: string; sub: string }) {
  return (
    <div className="bg-[var(--franco-card)] p-3">
      <div className="font-mono text-[17px] font-bold text-[var(--franco-text)]">{valor}</div>
      <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-[var(--franco-text-tertiary)]">
        {sub}
      </div>
    </div>
  );
}

// ─────────────────────── GASTOS FIJOS ───────────────────────

const LABEL_PERIODICIDAD: Record<string, string> = { mensual: "mensual", anual: "anual" };

export function BloqueGastosFijos({ gastos }: { gastos: ResumenGastosFijos }) {
  if (gastos.sinDato) {
    return (
      <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
        <p className="font-body text-[13px] text-[var(--franco-text-muted)]">
          No hay gastos fijos cargados
          <Badge estado="sin-dato" />
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
      <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-x-4 border-b border-[var(--franco-border)] pb-2 font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:grid">
        <span>Servicio</span>
        <span>Se paga</span>
        <span className="text-right">Monto original</span>
        <span className="text-right">Equivale al mes</span>
      </div>

      {gastos.items.map((g) => (
        <div
          key={g.id}
          className="grid grid-cols-1 gap-x-4 border-b border-[var(--franco-border)] py-2.5 text-[13px] sm:grid-cols-[2fr_1fr_1fr_1fr] sm:items-baseline"
        >
          <div>
            <div className="text-[var(--franco-text)]">{g.nombre}</div>
            <div className="font-mono text-[10px] text-[var(--franco-text-muted)]">
              {g.categoria}
              {g.iva === "mas_iva" ? " · + IVA" : g.iva === "exento" ? " · exento" : ""}
              {g.nota ? ` · ${g.nota}` : ""}
            </div>
          </div>
          <div className="mt-1 flex justify-between sm:mt-0 sm:block">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
              Se paga
            </span>
            <span className="font-mono text-[var(--franco-text-secondary)]">
              {LABEL_PERIODICIDAD[g.periodicidad]}
            </span>
          </div>
          <div className="flex justify-between sm:block sm:text-right">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
              Monto
            </span>
            <span className="font-mono text-[var(--franco-text-secondary)]">
              {g.moneda === "USD" ? `US$${g.montoOriginal.toFixed(2)}` : fmtCLP(g.montoOriginal)}
            </span>
          </div>
          <div className="flex justify-between sm:block sm:text-right">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
              Al mes
            </span>
            <span className="font-mono text-[var(--franco-text)]">{fmtCLP(g.mensualClp)}</span>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-x-4 pt-3 text-[13px] font-medium sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <span className="text-[var(--franco-text)]">Total mensual</span>
        <span className="hidden sm:block" />
        <span className="hidden sm:block" />
        <div className="flex justify-between sm:block sm:text-right">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--franco-text-tertiary)] sm:hidden">
            Al mes
          </span>
          <span className="font-mono text-[var(--franco-text)]">{fmtCLP(gastos.totalMensual)}</span>
        </div>
      </div>

      <p className="mt-3 font-body text-[11px] leading-relaxed text-[var(--franco-text-muted)]">
        Lo anual se guarda como anual y se divide por 12 <em>al leer</em>: la tabla conserva lo que
        realmente se paga y cuándo. Los montos en dólares se convierten con USD_CLP también al leer —
        si el dólar cambia, cambian solos.
      </p>
    </div>
  );
}
