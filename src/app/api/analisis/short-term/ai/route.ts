import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { findNearestStation } from "@/lib/metro-stations";
import {
  CLINICAS,
  ZONAS_NEGOCIOS,
  ZONAS_TURISTICAS,
  ACCESO_SKI,
  distanciaMinima,
} from "@/lib/data/str-attractors";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";

const anthropic = new Anthropic();

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored
          }
        },
      },
    }
  );
}

const SYSTEM_PROMPT = `Eres Franco — una plataforma de análisis de inversión inmobiliaria chilena. Hablas directo, sin rodeos, con datos. No eres asesor financiero — informas con honestidad radical.

CONTEXTO: Estás analizando una propiedad para RENTA CORTA (Airbnb/Booking). Tu trabajo es decirle al inversionista si le conviene operar en Airbnb o quedarse con arriendo tradicional, con datos reales.

TONO:
- Directo, provocador cuando es necesario, siempre respaldado por datos. Tuteas.
- No uses jerga corporativa. Si los números son malos, dilo sin anestesia.
- NUNCA uses lenguaje vulgar ni excesivamente coloquial. Nada de "hermano", "compadre", "weon/weón", "cachai", "bacán".
- NUNCA empieces con frases como "Te voy a hablar claro" o "Voy a ser franco contigo" — el tono directo se demuestra, no se anuncia.
- Profesional pero cercano. Como un asesor financiero joven que habla sin rodeos pero con respeto.

REGLAS:
1. NUNCA des asesoría financiera directa ("deberías comprar"). Siempre enmarca como análisis informativo.
2. El veredicto lo define el motor (VIABLE/AJUSTA ESTRATEGIA/NO RECOMENDADO). NO lo cambies.
3. Todos los montos en dos versiones: _clp y _uf.
4. Menciona las anomalías detectadas explícitamente.
5. Si el edificio no permite Airbnb, hazlo notar prominentemente.
6. Incluye contexto de estacionalidad de Santiago: julio (vacaciones de invierno, ski) es peak, febrero es low (verano, todos en la costa).

Respondes SOLO con el JSON solicitado, sin texto adicional ni backticks.`;

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}

function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

function fmtCLPSigned(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(Math.round(n));
  const formatted = "$" + abs.toLocaleString("es-CL");
  return n < 0 ? "-" + formatted : formatted;
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId } = await request.json();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }

    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const isAdmin = isAdminUser(user.email);

    if (analysis.user_id && analysis.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para analizar este registro" }, { status: 403 });
    }

    if (!analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    if (analysis.ai_analysis && typeof analysis.ai_analysis === "object" && "veredicto" in analysis.ai_analysis) {
      return NextResponse.json(analysis.ai_analysis);
    }

    const input = analysis.input_data as Record<string, unknown> | null;
    const results = analysis.results as (ShortTermResult & { francoScore?: FrancoScoreSTR; airbnbRaw?: unknown; tipoAnalisis?: string }) | null;

    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const inp = input;
    const r = results;
    const base = r.escenarios.base;
    const cons = r.escenarios.conservador;
    const agr = r.escenarios.agresivo;
    const comp = r.comparativa;

    // --- UF derivation ---
    const precioCompraCLP = (inp.precioCompra as number) ?? 0;
    const precioCompraUF = (inp.precioCompraUF as number) ?? 0;
    const UF_CLP = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : 38800;

    const superficie = (inp.superficie as number) ?? 0;
    const dormitorios = (inp.dormitorios as number) ?? 0;
    const banos = (inp.banos as number) ?? 0;
    const direccion = (inp.direccion as string) ?? "";
    const comuna = (analysis.comuna as string) ?? (inp.comuna as string) ?? "";
    const piePct = Math.round(((inp.piePercent as number) ?? 0.2) * 100);
    const tasa = ((inp.tasaCredito as number) ?? 0.045) * 100;
    const plazo = (inp.plazoCredito as number) ?? 25;
    const modoGestion = (inp.modoGestion as string) ?? "auto";
    const comisionPct = modoGestion === "auto" ? 3 : Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100);
    const regulacion = (inp.regulacionEdificio as string) ?? "no_estoy_seguro";
    const costoAmoblamiento = (inp.costoAmoblamiento as number) ?? 0;
    const amoblado = costoAmoblamiento > 0 ? "Sí" : "No";

    const elec = (inp.costoElectricidad as number) ?? 0;
    const agua = (inp.costoAgua as number) ?? 0;
    const wifi = (inp.costoWifi as number) ?? 0;
    const insumos = (inp.costoInsumos as number) ?? 0;
    const mant = (inp.mantencion as number) ?? 0;
    const gc = (inp.gastosComunes as number) ?? 0;
    const contribTrim = (inp.contribuciones as number) ?? 0;
    const contribMensual = Math.round(contribTrim / 3);

    // --- Metro distance ---
    const lat = (inp.lat as number) ?? 0;
    const lng = (inp.lng as number) ?? 0;
    let distMetro = 0;
    let metroName = "—";
    if (lat && lng) {
      const nearest = findNearestStation(lat, lng, "active");
      if (nearest) {
        distMetro = Math.round(nearest.distance);
        metroName = nearest.station.name;
      }
    }

    // --- Other attractors ---
    const clinica = lat && lng ? distanciaMinima(lat, lng, CLINICAS) : { distancia: Infinity, nombre: "—" };
    const zonaNT = lat && lng ? distanciaMinima(lat, lng, [...ZONAS_NEGOCIOS, ...ZONAS_TURISTICAS]) : { distancia: Infinity, nombre: "—" };
    const ski = lat && lng ? distanciaMinima(lat, lng, ACCESO_SKI) : { distancia: Infinity, nombre: "—" };
    const distClinicaTxt = isFinite(clinica.distancia) ? `${Math.round(clinica.distancia)}m` : "—";
    const distZonaTxt = isFinite(zonaNT.distancia) ? `${Math.round(zonaNT.distancia)}m` : "—";
    const distSkiTxt = isFinite(ski.distancia) ? `${(ski.distancia / 1000).toFixed(1)}km` : "—";

    // --- Tipo de propiedad ---
    const tipoPropiedad = (inp.tipoPropiedad as string) ?? "";

    // --- Auto vs Admin ---
    const strAuto = comp.str_auto;
    const strAdmin = comp.str_admin;
    const difAutoAdmin = strAuto.flujoCajaMensual - strAdmin.flujoCajaMensual;

    // --- Anomaly detection ---
    const anomalias: string[] = [];
    if (r.breakEvenPctDelMercado > 1) {
      anomalias.push(`BREAK-EVEN SOBRE MERCADO: Necesitas generar ${Math.round(r.breakEvenPctDelMercado * 100)}% del revenue P50 del mercado solo para cubrir costos. Estás obligado a operar sobre el promedio para no perder plata.`);
    }
    if (regulacion === "no") {
      anomalias.push(`REGULACIÓN BLOQUEA AIRBNB: El edificio NO permite arriendo de corto plazo. Operar Airbnb acá es arriesgarse a multas o cancelación del reglamento. Flag crítico.`);
    }
    if (regulacion === "no_estoy_seguro" || regulacion === "no_seguro") {
      anomalias.push(`REGULACIÓN NO CONFIRMADA: El usuario no sabe si el edificio permite Airbnb. DEBE verificar el reglamento antes de invertir en amoblamiento.`);
    }
    const minM = r.flujoEstacional.length ? Math.min(...r.flujoEstacional.map(m => m.ingresoBruto)) : 0;
    const maxM = r.flujoEstacional.length ? Math.max(...r.flujoEstacional.map(m => m.ingresoBruto)) : 0;
    const estabRatio = maxM > 0 ? minM / maxM : 1;
    if (estabRatio < 0.5 && maxM > 0) {
      anomalias.push(`ESTACIONALIDAD EXTREMA: El mes más bajo genera solo ${Math.round(estabRatio * 100)}% del mes peak. Vas a tener meses muy flojos que hay que cubrir con los meses buenos.`);
    }
    if (comp.sobreRentaPct < 0) {
      anomalias.push(`LTR GANA: El arriendo tradicional genera ${Math.abs(Math.round(comp.sobreRentaPct * 100))}% más que Airbnb para esta propiedad. STR no conviene.`);
    }
    if (base.capRate < 0.03) {
      anomalias.push(`CAP RATE BAJO: ${(base.capRate * 100).toFixed(1)}% es muy bajo — el NOI apenas justifica el precio de compra.`);
    }
    if (base.flujoCajaMensual < -200000) {
      anomalias.push(`FLUJO MUY NEGATIVO: ${fmtCLPSigned(base.flujoCajaMensual)}/mes de flujo negativo aun operando STR. Es mucha plata de bolsillo cada mes.`);
    }
    const ingresoBrutoBase = base.ingresoBrutoMensual;
    const costosOpTotal = base.costosOperativos + base.comisionMensual;
    if (ingresoBrutoBase > 0 && costosOpTotal / ingresoBrutoBase > 0.25) {
      anomalias.push(`COSTOS OPERATIVOS ALTOS: ${Math.round(costosOpTotal / ingresoBrutoBase * 100)}% del ingreso bruto se va en costos operativos y comisión. Poco margen.`);
    }

    const anomaliasTexto = anomalias.length > 0
      ? `\n\n=== ANOMALÍAS DETECTADAS ===\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nDEBES mencionar estas anomalías en tu análisis.`
      : "";

    const fs = results.francoScore;
    const score = fs?.score ?? 50;
    const veredicto = fs?.veredicto ?? r.veredicto;

    const mesesFmt = (revAnual: number, noi: number, flujo: number, label: string) =>
      `${label}: Revenue ${fmtCLP(revAnual)}, NOI ${fmtCLPSigned(noi)}/mes, Flujo ${fmtCLPSigned(flujo)}/mes`;

    const estacionalidadTxt = r.flujoEstacional
      .map(m => `  ${m.mes}: factor ${(m.factor * 12).toFixed(2)}×, ingreso ${fmtCLP(m.ingresoBruto)}, flujo ${fmtCLPSigned(m.flujo)}`)
      .join("\n");
    const mesesPositivos = r.flujoEstacional.filter(m => m.flujo >= 0);
    const mesesNegativos = r.flujoEstacional.filter(m => m.flujo < 0);
    const flujoPositivoMeses = mesesPositivos.length;
    const flujoNegativoMeses = mesesNegativos.length;
    const listaPositivos = mesesPositivos.map(m => `${m.mes.slice(0, 3)} (${fmtCLPSigned(m.flujo)})`).join(", ") || "ninguno";
    const listaNegativos = mesesNegativos.map(m => `${m.mes.slice(0, 3)} (${fmtCLPSigned(m.flujo)})`).join(", ") || "ninguno";
    const mesPeak = r.flujoEstacional.length ? r.flujoEstacional.reduce((a, b) => b.factor > a.factor ? b : a) : null;
    const mesLow = r.flujoEstacional.length ? r.flujoEstacional.reduce((a, b) => b.factor < a.factor ? b : a) : null;
    const adrBase = base.adrReferencia;
    const adrInvierno = `${fmtCLP(Math.round(adrBase * 1.25))}-${fmtCLP(Math.round(adrBase * 1.35))}`;
    const adrPrimavera = `${fmtCLP(Math.round(adrBase * 1.0))}-${fmtCLP(Math.round(adrBase * 1.10))}`;
    const adrVerano = `${fmtCLP(Math.round(adrBase * 0.85))}-${fmtCLP(Math.round(adrBase * 0.95))}`;
    const adrLow = `${fmtCLP(Math.round(adrBase * 0.75))}-${fmtCLP(Math.round(adrBase * 0.85))}`;

    const pieCLP = Math.round(precioCompraCLP * ((inp.piePercent as number) ?? 0.2));
    const dividendo = r.dividendoMensual;
    const capitalInv = r.capitalInvertido;

    const userPrompt = `Analiza esta inversión inmobiliaria en renta corta (Airbnb).

=== DATOS DE LA PROPIEDAD ===
Dirección: ${direccion || "—"}
Comuna: ${comuna}
Superficie: ${superficie} m²
Dormitorios: ${dormitorios}, Baños: ${banos}
Precio compra: ${fmtUF(precioCompraUF)} (${fmtCLP(precioCompraCLP)})
Pie: ${piePct}% = ${fmtCLP(pieCLP)} (${fmtUF(pieCLP / UF_CLP)})
Tasa crédito: ${tasa.toFixed(1)}%, Plazo: ${plazo} años
Dividendo: ${fmtCLP(dividendo)}/mes
Capital invertido: ${fmtCLP(capitalInv)} (pie + amoblamiento + gastos cierre)
Modo gestión: ${modoGestion} (comisión: ${comisionPct}%)
Edificio permite Airbnb: ${regulacion}
Amoblado: ${amoblado} (costo amoblamiento: ${fmtCLP(costoAmoblamiento)})

=== FRANCO SCORE STR: ${score}/100 — ${veredicto} ===
${fs ? `Rentabilidad: ${fs.desglose.rentabilidad.score}/100 — ${fs.desglose.rentabilidad.detail}
Sostenibilidad: ${fs.desglose.sostenibilidad.score}/100 — ${fs.desglose.sostenibilidad.detail}
Ventaja vs LTR: ${fs.desglose.ventaja.score}/100 — ${fs.desglose.ventaja.detail}
Factibilidad: ${fs.desglose.factibilidad.score}/100 — ${fs.desglose.factibilidad.detail}` : "(desglose no disponible)"}
${fs?.overrideApplied ? `Override aplicado: ${fs.overrideApplied}` : ""}

=== ESCENARIO BASE (P50 del mercado) ===
Revenue anual: ${fmtCLP(base.revenueAnual)}
ADR: ${fmtCLP(base.adrReferencia)}/noche
Ocupación: ${Math.round(base.ocupacionReferencia * 100)}%
Ingreso bruto mensual: ${fmtCLP(base.ingresoBrutoMensual)}/mes
Comisión (${comisionPct}%): -${fmtCLP(base.comisionMensual)}/mes
Costos operativos: -${fmtCLP(base.costosOperativos)}/mes (electricidad ${fmtCLP(elec)}, agua ${fmtCLP(agua)}, WiFi ${fmtCLP(wifi)}, insumos ${fmtCLP(insumos)}, mantención ${fmtCLP(mant)})
Gastos comunes: -${fmtCLP(gc)}/mes
Contribuciones: -${fmtCLP(contribMensual)}/mes (mensualizado)
NOI mensual: ${fmtCLPSigned(base.noiMensual)}/mes
Dividendo: -${fmtCLP(dividendo)}/mes
FLUJO DE CAJA MENSUAL: ${fmtCLPSigned(base.flujoCajaMensual)}/mes

=== ESCENARIOS ===
${mesesFmt(cons.revenueAnual, cons.noiMensual, cons.flujoCajaMensual, "Conservador (P25)")}
${mesesFmt(base.revenueAnual, base.noiMensual, base.flujoCajaMensual, "Base (P50)")}
${mesesFmt(agr.revenueAnual, agr.noiMensual, agr.flujoCajaMensual, "Agresivo (P75)")}

=== COMPARATIVA STR vs LTR (desglose) ===
RENTA LARGA:
Ingreso bruto (arriendo): ${fmtCLP(comp.ltr.ingresoBruto)}/mes
(-) Comisión admin 5%: ${fmtCLPSigned(-Math.round(comp.ltr.ingresoBruto * 0.05))}/mes
(-) Gastos comunes: ${fmtCLPSigned(-gc)}/mes
(-) Mantención: ${fmtCLPSigned(-mant)}/mes
(-) Contribuciones: ${fmtCLPSigned(-contribMensual)}/mes
= NOI LTR: ${fmtCLPSigned(comp.ltr.noiMensual)}/mes
(-) Dividendo: ${fmtCLPSigned(-dividendo)}/mes
= Flujo LTR: ${fmtCLPSigned(comp.ltr.flujoCaja)}/mes

RENTA CORTA (auto-gestión):
Ingreso bruto: ${fmtCLP(base.ingresoBrutoMensual)}/mes
(-) Comisión Airbnb ${comisionPct}%: ${fmtCLPSigned(-base.comisionMensual)}/mes
(-) Costos operativos: ${fmtCLPSigned(-base.costosOperativos)}/mes
(-) Gastos comunes: ${fmtCLPSigned(-gc)}/mes
(-) Contribuciones: ${fmtCLPSigned(-contribMensual)}/mes
= NOI STR: ${fmtCLPSigned(base.noiMensual)}/mes
(-) Dividendo: ${fmtCLPSigned(-dividendo)}/mes
= Flujo STR: ${fmtCLPSigned(base.flujoCajaMensual)}/mes

DIFERENCIA:
Sobre-renta (NOI): ${fmtCLPSigned(comp.sobreRenta)}/mes (${comp.sobreRentaPct >= 0 ? "+" : ""}${Math.round(comp.sobreRentaPct * 100)}%)
Diferencia flujo: ${fmtCLPSigned(base.flujoCajaMensual - comp.ltr.flujoCaja)}/mes
STR ${base.flujoCajaMensual > comp.ltr.flujoCaja ? "GANA" : "PIERDE"} en flujo de caja
Payback amoblamiento: ${comp.paybackMeses > 0 ? comp.paybackMeses + " meses" : "no se recupera"}

=== ESTACIONALIDAD DETALLADA ===
${estacionalidadTxt}

Meses con flujo POSITIVO: ${flujoPositivoMeses} de 12 — ${listaPositivos}
Meses con flujo NEGATIVO: ${flujoNegativoMeses} de 12 — ${listaNegativos}
${mesPeak ? `Peak: ${mesPeak.mes} con factor ${(mesPeak.factor * 12).toFixed(2)}× — ingreso bruto ${fmtCLP(mesPeak.ingresoBruto)}` : ""}
${mesLow ? `Low: ${mesLow.mes} con factor ${(mesLow.factor * 12).toFixed(2)}× — ingreso bruto ${fmtCLP(mesLow.ingresoBruto)}` : ""}

Estrategia de pricing sugerida (ADR base: ${fmtCLP(adrBase)}/noche):
- Jun-Ago (invierno/ski): ADR sugerido ${adrInvierno}/noche (+25-35%)
- Sep-Nov (primavera): ADR sugerido ${adrPrimavera}/noche (base)
- Dic-Feb (verano): ADR sugerido ${adrVerano}/noche (-5-15%), ofrecer descuentos +7 noches
- Mar-May (low season): ADR sugerido ${adrLow}/noche (-15-25%), activar descuentos semanales

INSTRUCCIÓN: Da rangos CONCRETOS de precios por noche para cada temporada. El usuario necesita saber exactamente cuánto cobrar en julio vs febrero. Menciona que en los meses bajos puede considerar arriendo mensual temporal (plataformas como Booking para estadías largas) para mantener la ocupación.

=== BREAK-EVEN ===
Revenue anual necesario: ${fmtCLP(r.breakEvenRevenueAnual)}
Porcentaje del mercado P50: ${Math.round(r.breakEvenPctDelMercado * 100)}%

=== RAMP-UP ===
Pérdida estimada primeros 3 meses: ${fmtCLP(r.perdidaRampUp)}

=== ATRACTORES DE DEMANDA EN LA ZONA ===
Metro más cercano: ${metroName} a ${distMetro}m
Clínica/hospital más cercano: ${clinica.nombre} a ${distClinicaTxt}
  → Contexto: Más del 40% de pacientes oncológicos y de especialidades complejas viajan a Santiago desde regiones. Clínicas como Alemana y Las Condes reciben 7.000+ pacientes internacionales al año. Deptos cerca de clínicas tienen demanda constante de estadías de 3-15 días.
Zona negocios/turismo más cercana: ${zonaNT.nombre} a ${distZonaTxt}
Acceso centros de ski: a ${distSkiTxt} del inicio de ruta a Farellones/Valle Nevado
  → Contexto: Temporada jun-sep. Peak julio coincide con el mes de mayor revenue en Santiago (+34% vs promedio). Deptos en zona oriente capturan esta demanda.

INSTRUCCIÓN: Usa esta información para explicar POR QUÉ la ubicación genera (o no) demanda de renta corta. No solo mencionar la cercanía — explicar qué tipo de huésped atrae (pacientes médicos, ejecutivos, turistas, esquiadores) y por qué eso importa para el revenue y la ocupación.

=== CONTEXTO DEL MERCADO LOCAL ===
Revenue anual promedio del mercado (P50): ${fmtCLP(base.revenueAnual)}
Tu depto está en el percentil 50 (mediana del mercado)
Para estar en P75 (${fmtCLP(agr.revenueAnual)}/año): necesitarías ADR de ${fmtCLP(agr.adrReferencia)}/noche u ocupación de ${Math.round(agr.ocupacionReferencia * 100)}%
Para estar en P25 (${fmtCLP(cons.revenueAnual)}/año): sería el escenario pesimista
Revenue mínimo para breakeven: ${fmtCLP(r.breakEvenRevenueAnual)}/año (${Math.round(r.breakEvenPctDelMercado * 100)}% del P50)

Benchmarks Santiago por dormitorios:
- Studio: ~$6.500.000/año
- 1D: ~$8.200.000/año
- 2D: ~$11.500.000/año
- 3D: ~$15.000.000/año

INSTRUCCIÓN: Explica al usuario dónde se ubica su propiedad en el mercado. Si está en P50, dile qué necesita para subir a P75 (mejor decoración, amenities, pricing dinámico). Si está bajo P50, explica por qué y qué hacer.
${tipoPropiedad === "usado" ? `
=== CONSIDERACIONES PROPIEDAD USADA ===
Este es un departamento USADO. En Airbnb, los deptos usados tienen desventajas Y ventajas competitivas:

Desventajas:
- Fotos menos atractivas vs deptos nuevos con diseño moderno
- Amenities del edificio posiblemente desactualizados (sin cowork, piscina temperada)
- Necesidad de renovación para competir en reviews y ADR
- Electrodomésticos y muebles con desgaste, reposición más frecuente

Ventajas:
- Precio de compra menor → mejor CAP rate
- Ubicación consolidada con servicios establecidos
- Gastos comunes generalmente menores que edificios nuevos

INSTRUCCIÓN: Incluye recomendaciones concretas con montos para maximizar el rendimiento:
- Fotografía profesional: ~$200-500K CLP, retorno en 2-3 meses vía mejor ADR y ocupación
- Amenities que suben el ADR: Netflix/streaming, cafetera Nespresso (~$50K, sube ADR $3-5K/noche), ropa de cama premium (~$150K), blackout curtains
- Limpieza profesional como diferenciador (#1 factor en reviews de Airbnb)
- Pintura y pequeñas renovaciones: $500K-1M puede transformar las fotos del listing
` : ""}
=== COMPARATIVA AUTO-GESTIÓN vs ADMINISTRADOR ===
El usuario eligió: ${modoGestion}

Auto-gestión (comisión Airbnb 3%):
- Comisión mensual: ${fmtCLP(strAuto.comisionMensual)}
- NOI: ${fmtCLPSigned(strAuto.noiMensual)}/mes
- Flujo de caja: ${fmtCLPSigned(strAuto.flujoCajaMensual)}/mes
- Requiere: ~8-12 hrs/semana de gestión activa

Con administrador (comisión ${Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100)}%):
- Comisión mensual: ${fmtCLP(strAdmin.comisionMensual)}
- NOI: ${fmtCLPSigned(strAdmin.noiMensual)}/mes
- Flujo de caja: ${fmtCLPSigned(strAdmin.flujoCajaMensual)}/mes
- Requiere: 0 hrs — inversión 100% pasiva

Diferencia mensual: auto-gestión genera ${fmtCLPSigned(difAutoAdmin)}/mes ${difAutoAdmin > 0 ? "más" : "menos"} que con administrador

INSTRUCCIÓN: Presenta honestamente ambas opciones. Un buen operador profesional ofrece ventajas reales:
- Pricing dinámico con herramientas especializadas (pueden subir el ADR 10-15% vs pricing manual)
- Respuesta a mensajes 24/7 (afecta directamente el ranking de Airbnb — si demoras >1 hora, pierdes posiciones)
- Red de equipos de limpieza profesional (mejor rating → más reservas → más revenue)
- Gestión de reviews y resolución de conflictos con huéspedes
- Ocupación optimizada: un buen operador puede subir la ocupación de P50 a P75
- Libertad total para el inversionista — inversión pasiva real, como un arriendo largo pero con mejor retorno

El trade-off real:
- La pregunta correcta no es "cuánto gano" sino "cuánto vale mi tiempo"
- Si con operador el flujo sigue siendo positivo o mejor que LTR, es una inversión pasiva superior al arriendo largo
- Si con operador el flujo es muy negativo, ser honesto: necesitas auto-gestionar o quedarte con arriendo largo

IMPORTANTE: NO recomendar ningún operador específico. Cerrar con: "Un buen operador de renta corta puede optimizar tu revenue. Franco pronto te conectará con operadores verificados en tu zona."
${anomaliasTexto}

VEREDICTO OBLIGATORIO: El veredicto del motor es "${veredicto}". DEBES usar exactamente ese veredicto en tu respuesta. No lo cambies.

Responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin backticks, sin texto fuera del JSON) con esta estructura:
{
  "resumenEjecutivo_clp": "2-3 frases. Qué es este depto, cuánto genera en Airbnb, y si conviene. Montos en CLP.",
  "resumenEjecutivo_uf": "Lo mismo pero con montos en UF.",
  "tuBolsillo": {
    "titulo": "Lo que sale de tu bolsillo",
    "contenido_clp": "Explica el flujo mensual real. Cuánto entra por Airbnb, cuánto sale en costos, cuánto queda (o cuánto pones). Compara con lo que pagarías si fuera arriendo largo. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF.",
    "alerta_clp": "Solo si hay anomalía relevante (flujo muy negativo, regulación bloquea, costos altos). Si no hay, string vacío ''.",
    "alerta_uf": "Lo mismo en UF. Si no aplica, string vacío ''."
  },
  "vsAlternativas": {
    "titulo": "¿Airbnb o arriendo largo?",
    "contenido_clp": "Comparativa directa. Cuánto más (o menos) genera Airbnb. Menciona el esfuerzo de gestión (cambio de ropa de cama, reviews, pricing dinámico, check-ins). Si la sobre-renta es <10%, cuestiona si el esfuerzo vale la pena. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF."
  },
  "operacion": {
    "titulo": "Cómo operar",
    "contenido_clp": "Tips operativos concretos: auto-gestión (${comisionPct === 3 ? "ahorras comisión pero trabajas tú" : "delegaste en administrador " + comisionPct + "%"}), pricing estacional (subir tarifa en julio y enero, bajar en febrero y meses fríos), amenities que suben el ADR (Netflix, cafetera, ropa de cama de calidad), gestión de reviews (responde rápido, pide review siempre). Si el edificio no permite Airbnb, advertir fuertemente y sugerir verificar el reglamento ANTES de comprar. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF."
  },
  "proyeccion": {
    "titulo": "A 5 y 10 años",
    "contenido_clp": "Proyección del patrimonio con plusvalía 4% anual + flujo acumulado STR. Compara con qué pasaría si fuera LTR a 10 años. Menciona que los primeros 3 meses hay ramp-up (${fmtCLP(r.perdidaRampUp)} de pérdida estimada mientras la propiedad gana tracción en reviews y ranking). Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF."
  },
  "riesgos": {
    "titulo": "Los riesgos que nadie te dice",
    "items_clp": [
      "Estacionalidad: en los meses low (febrero típicamente) puedes tener flujo negativo aunque el promedio anual sea positivo.",
      "Regulación: municipalidades están endureciendo normas de arriendo corto plazo. Edificios pueden modificar reglamento.",
      "Competencia: nuevas unidades en la zona bajan ADR u ocupación. AirROI muestra promedio actual, no futuro.",
      "Costos ocultos: rotación de sábanas/toallas, reposición de amenities, reparaciones por uso intensivo — suman más de lo que parece."
    ],
    "items_uf": ["Riesgo 1 en UF.", "Riesgo 2 en UF.", "Riesgo 3 en UF.", "Riesgo 4 en UF."]
  },
  "veredicto": {
    "titulo": "Veredicto Franco",
    "decision": "${veredicto}",
    "explicacion_clp": "Por qué este veredicto. Qué tendría que cambiar para que sea mejor (o peor). Monto en CLP.",
    "explicacion_uf": "Lo mismo pero con montos en UF."
  },
  "aFavor": ["Punto 1 concreto con número", "Punto 2", "Punto 3 si hay"],
  "puntosAtencion": ["Punto 1 concreto con número", "Punto 2", "Punto 3 si hay"],
  "textoSimple_clp": "Resumen en lenguaje cotidiano, 3-4 frases. Como si le explicaras a un amigo que nunca invirtió. No uses términos como CAP rate, NOI, ocupación. Di 'entra X al mes', 'sale Y', 'te queda Z'. Montos en CLP.",
  "textoSimple_uf": "Lo mismo pero con montos en UF.",
  "textoImportante_clp": "Con esta estructura EXACTA con estos marcadores en líneas separadas:\\nRESUMEN:\\n[1 párrafo con evaluación general, números clave]\\nA FAVOR:\\n- [punto 1]\\n- [punto 2]\\nEN CONTRA:\\n- [punto 1]\\n- [punto 2]\\nRECOMENDACIÓN:\\n[Qué hacer, con qué negociar o por qué no conviene]\\nTodo en CLP.",
  "textoImportante_uf": "Lo mismo pero con montos en UF."
}

INSTRUCCIONES PARA LA RESPUESTA:
- En "tuBolsillo": explica el flujo mensual con AMBOS escenarios (auto y admin). Dile al usuario cuánto gana/pierde en cada caso.
- En "vsAlternativas": la comparativa central es STR auto vs STR admin vs LTR. Tres columnas mentales. Incluye cuántas horas semanales requiere cada opción.
- En "operacion": da tips CONCRETOS con montos chilenos: "invierte $300K en fotos profesionales", "una cafetera Nespresso de $50K sube el ADR en $3-5K/noche", "smart lock de $80K elimina la necesidad de coordinar check-in". Menciona las ventajas de un operador profesional y cierra con "Franco pronto te conectará con operadores verificados en tu zona."
- En "proyeccion": incluye el ramp-up (primeros 3 meses al 70%→80%→90%), la pérdida estimada, y cuándo se alcanza el revenue estable.
- En "riesgos": incluye siempre: (1) estacionalidad con meses específicos, (2) regulación del edificio, (3) competencia en la zona, (4) costos operativos como % del ingreso, (5) dependencia de una sola plataforma (Airbnb).
- En "aFavor": menciona los atractores de demanda específicos (clínica X a Y metros, zona de negocios, acceso ski).
- En "puntosAtencion": si el depto es usado, mencionar las implicancias. Si la regulación es incierta, destacar.
- En "textoSimple": imagina que le explicas a un amigo en 4 frases. Incluye: cuánto gana, cuánto trabaja, y si vale la pena.
- Todos los montos en formato chileno con separador de miles (punto). Sin decimales en CLP. En UF usar 1 decimal.

IMPORTANTE:
- El veredicto.decision DEBE ser exactamente: ${veredicto}
- Todos los montos en formato chileno con separador de miles (punto) y sin decimales
- No uses markdown dentro del JSON (no **, no __, no itálica)
- Si el edificio NO permite Airbnb, el primer punto de "puntosAtencion" DEBE ser sobre eso
- Menciona la estacionalidad de Santiago: julio es peak (vacaciones invierno, ski), febrero es low (todos en la costa)
- Los arrays aFavor y puntosAtencion NO llevan bullet points al inicio — solo texto limpio`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
    console.log("[STR AI] Raw response length:", rawText.length);
    console.log("[STR AI] Raw response first 500 chars:", rawText.substring(0, 500));
    console.log("[STR AI] Raw response last 200 chars:", rawText.substring(rawText.length - 200));

    let aiResult;
    try {
      let cleanText = rawText;
      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const firstBrace = cleanText.indexOf("{");
      const lastBrace = cleanText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      cleanText = cleanText.replace(/,(\s*[}\]])/g, "$1");
      aiResult = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("[STR AI] Parse error:", parseError);
      return NextResponse.json({ error: "Error parsing AI response", raw: rawText }, { status: 500 });
    }

    await supabase
      .from("analisis")
      .update({ ai_analysis: aiResult })
      .eq("id", analysisId);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("STR AI analysis error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
