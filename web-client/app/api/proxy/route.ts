import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse("Missing URL param", { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();
        const headers = new Headers();
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        return new NextResponse(blob, { headers });
    } catch (e) {
        console.error("Proxy Error:", e);
        return new NextResponse("Failed to fetch image", { status: 500 });
    }
}
