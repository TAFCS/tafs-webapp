/**
 * Normalize Spaces object URLs for direct browser display.
 *
 * Prefer the CDN host so list avatars skip the Vercel→Railway→CDN media-proxy
 * hop. PDF generators that need fetch/CORS still use /api/photo-proxy.
 */

const CDN_HOST = 'https://tafs-assets.sgp1.cdn.digitaloceanspaces.com';
const ORIGIN_HOST = 'https://tafs-assets.sgp1.digitaloceanspaces.com';

/** Collapse accidental double-slashes after the scheme. */
export function sanitizeAssetUrl(url: string): string {
  return url.replace(/([^:])\/\//g, '$1/');
}

/** Public photo/avatar URL safe for <img src>. Returns null when empty. */
export function directCdnUrl(url?: string | null): string | null {
  if (!url) return null;
  const sanitized = sanitizeAssetUrl(url.trim());
  if (!sanitized) return null;

  if (sanitized.startsWith(ORIGIN_HOST)) {
    return CDN_HOST + sanitized.slice(ORIGIN_HOST.length);
  }
  if (sanitized.includes('digitaloceanspaces.com')) {
    return sanitized.replace(
      'tafs-assets.sgp1.digitaloceanspaces.com',
      'tafs-assets.sgp1.cdn.digitaloceanspaces.com',
    );
  }
  return sanitized;
}
