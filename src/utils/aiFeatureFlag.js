// Single switch for every AI feature (chat draft/ask, AI Caption Writer,
// OutreachHub AI draft) — Anthropic API credits aren't funded yet, so every
// one of them would currently fail against the ai-proxy edge function.
// Flip to true once tokens are loaded; nothing else needs to change.
export const AI_FEATURES_ENABLED = false;
