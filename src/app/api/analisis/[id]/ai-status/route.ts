import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasNewAiStructure } from "@/lib/ai-generation";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("analisis")
      .select("ai_analysis")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ai_analysis: null, ready: false });
    }

    const ready = hasNewAiStructure(data.ai_analysis);
    return NextResponse.json({
      ai_analysis: ready ? data.ai_analysis : null,
      ready,
    });
  } catch {
    return NextResponse.json({ ai_analysis: null, ready: false });
  }
}
