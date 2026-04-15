import { NextRequest, NextResponse } from 'next/server';

// Trusted CDN base URL - only allow proxying from our own storage
const TRUSTED_CDN = 'https://tafs-assets.sgp1.cdn.digitaloceanspaces.com';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    // Security: only proxy our own CDN images
    if (!imageUrl.startsWith(TRUSTED_CDN)) {
        return NextResponse.json({ error: 'Only TAFS CDN URLs are allowed' }, { status: 403 });
    }

    try {
        const response = await fetch(imageUrl, { cache: 'force-cache' });

        if (!response.ok) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
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
    } catch {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
    }
}
