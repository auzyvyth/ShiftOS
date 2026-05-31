import { supabase } from "../supabaseClient";

export async function callClaude(prompt, systemPrompt = "") {
  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: { prompt, system: systemPrompt },
  });
  if (error) throw new Error(error.message || "AI proxy error");
  if (!data?.text) throw new Error("No response from AI proxy");
  return data.text;
}
