import crypto from "crypto";

const FLOW_API_URL = "https://www.flow.cl/api";
const FLOW_API_KEY = process.env.FLOW_API_KEY!;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY!;

function signParams(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((key) => `${key}${params[key]}`).join("");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

export async function flowPost(service: string, params: Record<string, string | number>) {
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function flowGet(service: string, params: Record<string, string | number>) {
  const allParams = { ...params, apiKey: FLOW_API_KEY };
  const signature = signParams(allParams);

  const queryParams = new URLSearchParams();
  Object.entries(allParams).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  queryParams.append("s", signature);

  const response = await fetch(`${FLOW_API_URL}/${service}?${queryParams.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Flow API error ${response.status}: ${text}`);
  }

  return response.json();
}
