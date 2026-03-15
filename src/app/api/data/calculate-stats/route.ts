import { NextResponse } from "next/server";
import { calculateMarketStats } from "@/lib/services/scraper/stats";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await calculateMarketStats();
  return NextResponse.json(result);
}
