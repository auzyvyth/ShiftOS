import { supabase } from "../supabaseClient";

export async function callClaude(prompt, systemPrompt = "", feature = "general") {
  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: { prompt, system: systemPrompt, feature },
  });
  if (error) throw new Error(error.message || "AI proxy error");
  if (!data?.reply) throw new Error("No response from AI proxy");
  return data.reply;
}

// Multi-turn chat on top of ai-proxy, which only takes ONE `prompt` string and
// returns `{ reply }`. The chat screens used to send `messages` and read
// `data.content[0].text`, so every reply came back empty ("Could not load advice").
// The earlier turns ride inside the prompt; the proxy still pins model and tokens.
export async function callClaudeChat(messages, systemPrompt = "", feature = "general") {
  const turns = (messages || []).filter((m) => m && m.content);
  const last = turns[turns.length - 1];
  const earlier = turns.slice(0, -1);
  const transcript = earlier
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n\n");
  const prompt = transcript
    ? `Conversation so far:\n\n${transcript}\n\nLatest message from the user:\n${last?.content || ""}`
    : last?.content || "";
  return callClaude(prompt, systemPrompt, feature);
}
