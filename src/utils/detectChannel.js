// Auto-detects which platform a visitor arrived from, so a single share link
// (xdrive.my/cars/<slug>?ref=<salesman>) self-attributes without the sharer
// having to pick a channel button.
//
// Primary signal: the in-app browser User-Agent. When a link is tapped inside
// Instagram/Facebook/TikTok/WhatsApp etc., the app opens it in its own webview
// whose UA carries the app's fingerprint. Secondary signal: document.referrer
// (works for desktop / real-browser opens). Anything we can't classify returns
// null and is treated as "direct" downstream.
//
// Honest ceiling: this is best-effort. WhatsApp on iOS often opens Safari (no
// marker, no referrer) and plain copy-pasted links clicked from a normal tab
// have no signal — both fall through to "direct". That bucket is expected.

const UA_RULES = [
  // order matters: Instagram/Messenger UAs also contain FB tokens, so test the
  // more specific app first.
  [/instagram/i, "instagram"],
  [/messenger|fban\/messenger|orca-android/i, "messenger"],
  [/fban|fbav|fb_iab|fbios|\[fb/i, "facebook"],
  [/bytedancewebview|musical_ly|tiktok|trill|ttwebview|aweme/i, "tiktok"],
  [/whatsapp/i, "whatsapp"],
  [/telegram/i, "telegram"],
  [/\bline\//i, "line"],
  [/micromessenger/i, "wechat"],
  [/snapchat/i, "snapchat"],
  [/twitter|twitterandroid/i, "twitter"],
  [/xhs|xiaohongshu|discover\//i, "xiaohongshu"],
];

const REFERRER_RULES = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com)$/i, "facebook"],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/i, "instagram"],
  [/(^|\.)(tiktok\.com)$/i, "tiktok"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/i, "twitter"],
  [/(^|\.)(whatsapp\.com|wa\.me|chat\.whatsapp\.com)$/i, "whatsapp"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/i, "telegram"],
  [/(^|\.)(line\.me)$/i, "line"],
  [/(^|\.)(google\.[a-z.]+|bing\.com|search\.yahoo\.com|duckduckgo\.com)$/i, "google"],
];

/**
 * @param {string} ua  - user agent (defaults to navigator.userAgent)
 * @param {string} ref - referrer (defaults to document.referrer)
 * @returns {string|null} channel key, or null (→ treated as "direct")
 */
export function detectChannel(ua, ref) {
  const agent =
    ua != null ? ua : typeof navigator !== "undefined" ? navigator.userAgent : "";
  const referrer =
    ref != null ? ref : typeof document !== "undefined" ? document.referrer : "";

  for (const [re, key] of UA_RULES) {
    if (re.test(agent)) return key;
  }

  try {
    if (referrer) {
      const host = new URL(referrer).hostname;
      const sameHost =
        typeof window !== "undefined" && host === window.location.hostname;
      if (!sameHost) {
        for (const [re, key] of REFERRER_RULES) {
          if (re.test(host)) return key;
        }
      }
    }
  } catch {
    /* malformed referrer — ignore */
  }

  return null;
}

// Presentation config for the analytics UI. "direct" is the catch-all for
// untagged / organic / unclassifiable traffic.
export const CHANNEL_META = {
  whatsapp:    { label: "WhatsApp",    color: "#25D366" },
  facebook:    { label: "Facebook",    color: "#1877F2" },
  messenger:   { label: "Messenger",   color: "#0084FF" },
  instagram:   { label: "Instagram",   color: "#E4405F" },
  tiktok:      { label: "TikTok",      color: "#EE1D52" },
  telegram:    { label: "Telegram",    color: "#26A5E4" },
  twitter:     { label: "X / Twitter", color: "#1DA1F2" },
  line:        { label: "LINE",        color: "#06C755" },
  wechat:      { label: "WeChat",      color: "#07C160" },
  snapchat:    { label: "Snapchat",    color: "#FFFC00" },
  xiaohongshu: { label: "RED (Xiaohongshu)", color: "#FF2442" },
  google:      { label: "Google",      color: "#4285F4" },
  copy:        { label: "Copied link", color: "#6b7280" },
  direct:      { label: "Direct",      color: "#94a3b8" },
};

export const channelMeta = (key) =>
  CHANNEL_META[key] || { label: key ? key[0].toUpperCase() + key.slice(1) : "Direct", color: "#94a3b8" };
