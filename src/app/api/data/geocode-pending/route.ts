import { NextResponse } from "next/server";
import { geocodePendingProperties } from "@/lib/services/geocoding";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await geocodePendingProperties(100);
  return NextResponse.json({ success: true, ...result });
}
