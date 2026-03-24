import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getUserAccessLevel(
  userId: string | null
): Promise<"guest" | "free" | "premium" | "subscriber"> {
  if (!userId) return "guest";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_credits")
    .select("credits, subscription_status")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";
  if (data.subscription_status === "active") return "subscriber";
  if (data.credits > 0) return "premium";
  return "free";
}

export async function consumeCredit(
  userId: string,
  analysisId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Check if analysis is already premium
  const { data: analysis } = await supabase
    .from("analisis")
    .select("is_premium")
    .eq("id", analysisId)
    .single();

  if (analysis?.is_premium) return true;

  // Check subscription
  const { data: credits } = await supabase
    .from("user_credits")
    .select("credits, subscription_status")
    .eq("user_id", userId)
    .single();

  if (!credits) return false;

  // Subscribers don't consume credits
  if (credits.subscription_status === "active") {
    await supabase.from("analisis").update({ is_premium: true }).eq("id", analysisId);
    return true;
  }

  // Consume a credit
  if (credits.credits > 0) {
    const { error: creditError } = await supabase
      .from("user_credits")
      .update({
        credits: credits.credits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (creditError) return false;

    await supabase.from("analisis").update({ is_premium: true }).eq("id", analysisId);
    return true;
  }

  return false;
}
