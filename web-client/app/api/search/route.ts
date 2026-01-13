import { NextResponse } from 'next/server';
import { db, Photo } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { eventId, vector, vectors } = body;

        // Support both single 'vector' (legacy) and 'vectors' array
        const searchVectors = vectors || (vector ? [vector] : null);

        if (!eventId || !searchVectors || searchVectors.length === 0) {
            return NextResponse.json({ error: "Missing eventId or vectors" }, { status: 400 });
        }

        const matches = await db.findMatches(eventId, searchVectors);

        return NextResponse.json({ matches });

    } catch (e) {
        console.error("Search Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
