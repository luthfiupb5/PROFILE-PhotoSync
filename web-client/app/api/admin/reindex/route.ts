import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

// Reusing Supabase client from db.ts approach but simpler here since we just need to delete and insert
// Actually, db.ts doesn't expose a method to "replace vectors".
// We can use the Supabase client directly here or add a method to db.ts.
// Let's add a robust method here for now.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { photoId, eventId, vectors, faceHashes } = body;

        if (!photoId || !eventId || !vectors) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Reindex] Updating vectors for photo ${photoId} (Vectors: ${vectors.length})`);

        // 1. Delete existing vectors for this photo
        const { error: deleteError } = await supabase
            .from('vectors')
            .delete()
            .eq('photo_id', photoId);

        if (deleteError) {
            console.error("Delete Error:", deleteError);
            throw deleteError;
        }

        // 2. Insert new vectors
        if (vectors.length > 0) {
            const vectorRecords = vectors.map((vector: number[], i: number) => ({
                id: crypto.randomUUID(),
                photo_id: photoId,
                event_id: eventId,
                vector_str: JSON.stringify(vector),
                face_hash: faceHashes ? faceHashes[i] : null
            }));

            const { error: insertError } = await supabase
                .from('vectors')
                .insert(vectorRecords);

            if (insertError) {
                console.error("Insert Error:", insertError);
                throw insertError;
            }
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Reindex API Error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
