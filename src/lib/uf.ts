const UF_FALLBACK = 38800;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedUF: { value: number; fetchedAt: number } | null = null;

export async function getUFValue(): Promise<number> {
  // Return cached value if still fresh
  if (cachedUF && Date.now() - cachedUF.fetchedAt < CACHE_DURATION_MS) {
    return cachedUF.value;
  }

  try {
    const res = await fetch("https://mindicador.cl/api/uf", {
      next: { revalidate: 86400 }, // Next.js cache: 24h
    });

    if (!res.ok) throw new Error(`mindicador.cl responded ${res.status}`);

    const data = await res.json();
    const serie = data?.serie;
    if (!Array.isArray(serie) || serie.length === 0) throw new Error("Empty serie");

    const valor = Math.round(serie[0].valor);
    cachedUF = { value: valor, fetchedAt: Date.now() };
    return valor;
  } catch (err) {
    console.error("Error fetching UF value:", err);
    // Return cached even if expired, otherwise fallback
    return cachedUF?.value ?? UF_FALLBACK;
  }
}

// Synchronous fallback for client-side code that can't await
export const UF_CLP_FALLBACK = UF_FALLBACK;
