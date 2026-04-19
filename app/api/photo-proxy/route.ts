import { NextRequest, NextResponse } from 'next/server';

// Trusted DigitalOcean Spaces identifiers for our bucket.
// Some older photos were stored with the direct-spaces URL (without the cdn. prefix),
// so we accept both and normalise to the CDN URL before fetching.
const TRUSTED_CDN     = 'https://tafs-assets.sgp1.cdn.digitaloceanspaces.com';
const TRUSTED_DIRECT  = 'https://tafs-assets.sgp1.digitaloceanspaces.com';

/**
 * Normalise a DigitalOcean Spaces URL to always use the CDN endpoint.
 * If the URL uses the direct (non-CDN) hostname, swap it for the CDN one.
 * Returns null if the URL is not from a trusted origin.
 */
function normaliseToCdnUrl(rawUrl: string): string | null {
    if (rawUrl.startsWith(TRUSTED_CDN)) return rawUrl;

    // Handle direct DO Spaces URL  ─ two possible shapes:
    //   https://tafs-assets.sgp1.digitaloceanspaces.com/<key>
    //   https://sgp1.digitaloceanspaces.com/tafs-assets/<key>
    if (rawUrl.startsWith(TRUSTED_DIRECT)) {
        // Shape 1: bucket-qualified host
        const key = rawUrl.slice(TRUSTED_DIRECT.length).replace(/^\//, '');
        return `${TRUSTED_CDN}/${key}`;
    }

    const altDirect = 'https://sgp1.digitaloceanspaces.com/tafs-assets/';
    if (rawUrl.startsWith(altDirect)) {
        const key = rawUrl.slice(altDirect.length);
        return `${TRUSTED_CDN}/${key}`;
    }

    return null; // Not a trusted URL
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    const cdnUrl = normaliseToCdnUrl(imageUrl);
    if (!cdnUrl) {
        return NextResponse.json({ error: 'Only TAFS CDN URLs are allowed' }, { status: 403 });
    }

    try {
        // Add a timeout so a slow CDN doesn't hang the request indefinitely
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s

        let response: Response;
        try {
            response = await fetch(cdnUrl, { signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: `CDN returned ${response.status}`, url: cdnUrl },
                { status: response.status }
            );
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: 'Failed to fetch image', detail: msg }, { status: 500 });
    }
}
