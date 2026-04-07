/**
 * Converts a dealership name into a URL-safe subdomain slug.
 * Rules: lowercase, spaces/special chars → hyphens, max 20 chars, trim hyphens.
 */
export function generateSubdomain(name = '') {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
    .replace(/-$/g, '');
}
