import { NextResponse } from "next/server";
import { getUFValue } from "@/lib/uf";

export const dynamic = "force-dynamic";

export async function GET() {
  const uf = await getUFValue();
  return NextResponse.json({ uf });
}
