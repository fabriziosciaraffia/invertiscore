// scripts/flow-setup-plans.mjs
// Phase 2.7b — crea/asegura los 6 planes recurrentes en Flow con planId por
// entorno (base + FLOW_PLAN_SUFFIX) y urlCallback derivado de NEXT_PUBLIC_SITE_URL.
//
// Flow QUEMA el planId para siempre (501 "planId already used"): por eso QA y
// prod usan sufijos distintos. Idempotente: si Flow responde "already used", lo
// imprime y sigue con el siguiente (re-correr no rompe).
//
// NO hardcodea ni imprime credenciales. Léelas de process.env.
// baseURL sigue FLOW_ENV (igual que src/lib/flow.ts): 'sandbox' → sandbox.flow.cl.

import crypto from "node:crypto";

const FLOW_ENV = process.env.FLOW_ENV ?? "production";
const FLOW_API_URL =
  FLOW_ENV === "sandbox" ? "https://sandbox.flow.cl/api" : "https://www.flow.cl/api";

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const FLOW_PLAN_SUFFIX = process.env.FLOW_PLAN_SUFFIX ?? "";

if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
  console.error(
    "Faltan FLOW_API_KEY y/o FLOW_SECRET_KEY en el entorno. Expórtalas antes de correr."
  );
  process.exit(1);
}
if (!SITE_URL) {
  console.error(
    "Falta NEXT_PUBLIC_SITE_URL (de ahí sale el urlCallback de los planes). Expórtala."
  );
  process.exit(1);
}

// Firma idéntica a src/lib/flow.ts.
function signParams(params) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((key) => `${key}${params[key]}`).join("");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

async function flowPost(service, params) {
  const allParams = { ...params, apiKey: FLOW_API_KEY };
  const signature = signParams(allParams);

  const formData = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append("s", signature);

  const response = await fetch(`${FLOW_API_URL}/${service}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const body = await response.text();
  return { status: response.status, body };
}

const URL_CALLBACK = `${SITE_URL}/api/subscriptions/payment-callback`;

// Bases SIN sufijo (espejo de FLOW_PRODUCTS). El planId real = base + sufijo.
const PLANS = [
  { base: "franco_plan10_mensual",    name: "Franco Plan 10 — mensual",    amount: 39990,   interval: 3 },
  { base: "franco_plan10_anual",      name: "Franco Plan 10 — anual",      amount: 395880,  interval: 4 },
  { base: "franco_plan50_mensual",    name: "Franco Plan 50 — mensual",    amount: 149990,  interval: 3 },
  { base: "franco_plan50_anual",      name: "Franco Plan 50 — anual",      amount: 1499880, interval: 4 },
  { base: "franco_unlimited_mensual", name: "Franco Ilimitado — mensual",  amount: 399990,  interval: 3 },
  { base: "franco_unlimited_anual",   name: "Franco Ilimitado — anual",    amount: 3959880, interval: 4 },
];

async function run() {
  console.log(
    `Entorno: FLOW_ENV=${FLOW_ENV} · sufijo="${FLOW_PLAN_SUFFIX}" · callback=${URL_CALLBACK}\n`
  );

  for (const p of PLANS) {
    const planId = `${p.base}${FLOW_PLAN_SUFFIX}`;
    console.log(`=== plans/create — ${planId} (amount ${p.amount}, interval ${p.interval}) ===`);
    try {
      const res = await flowPost("plans/create", {
        planId,
        name: p.name,
        currency: "CLP",
        amount: p.amount,
        interval: p.interval,
        interval_count: 1,
        urlCallback: URL_CALLBACK,
      });

      console.log("HTTP status:", res.status);

      let parsed = null;
      try {
        parsed = JSON.parse(res.body);
      } catch {
        /* body no-JSON */
      }

      if (parsed && (parsed.code || parsed.message)) {
        const msg = String(parsed.message ?? "");
        if (/already used/i.test(msg) || parsed.code === 501) {
          console.log(`↷ ya existe (quemado), se omite: ${msg}`);
        } else {
          console.log("body code:", parsed.code ?? "", "· message:", msg);
        }
      } else if (parsed) {
        console.log("OK · body planId:", parsed.planId ?? "(sin planId)", "· status:", parsed.status ?? "");
      } else {
        console.log("body crudo:", res.body);
      }
    } catch (err) {
      console.error(`ERROR ${planId}:`, err?.message || err);
    }
    console.log("");
  }
}

run();
