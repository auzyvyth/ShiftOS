/**
 * Parse a YouTube, TikTok, or Instagram URL into an embed URL.
 * Returns null if the URL cannot be recognized.
 */
export function getEmbedUrl(url) {
  if (!url) return null;

  // YouTube — youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // TikTok — tiktok.com/@user/video/ID
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;

  // Instagram Reel or Post — instagram.com/reel/CODE or instagram.com/p/CODE
  const igMatch = url.match(/instagram\.com\/(?:reel|p)\/([^/?#]+)/);
  if (igMatch) return `https://www.instagram.com/p/${igMatch[1]}/embed`;

  return null;
}
