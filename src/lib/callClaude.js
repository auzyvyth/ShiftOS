import { supabase } from "../supabaseClient";

export async function callClaude(prompt, systemPrompt = "", feature = "general") {
  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: { prompt, system: systemPrompt, feature },
  });
  if (error) throw new Error(error.message || "AI proxy error");
  if (!data?.reply) throw new Error("No response from AI proxy");
  return data.reply;
}
